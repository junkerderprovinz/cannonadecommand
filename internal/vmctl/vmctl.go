// Package vmctl gives CannonadeCommand the same per-workload limits for libvirt/KVM
// VMs that dockercli+netshape give for containers — CPU pinning, a CPU cap, a RAM
// (balloon) allocation, and up/down bandwidth — but done the NATIVE libvirt way via
// virsh, never by hand-rolling tc/iptables:
//
//   - CPU cores (pin):  virsh vcpupin  (each vcpu) + emulatorpin  -> <cputune><vcpupin>
//   - CPU cap:          virsh schedinfo --set vcpu_quota/vcpu_period -> <cputune>
//   - RAM:              virsh setmem   (balloon, <= max memory)
//   - Bandwidth:        virsh domiftune --inbound/--outbound -> <interface><bandwidth>
//
// The bandwidth path is why this is a libvirt job and not a netshape job: libvirt's
// interface QoS polices INBOUND through an ifb device, NOT sch_ingress — so it carries
// none of the kernel-crash risk that killed the container-side tc-ingress experiment
// (see the netshape package header). Everything is applied with --config (persists in
// the domain XML across a VM restart) plus --live when the domain is running.
//
// stdlib-only, like the rest of the engine. Every virsh call is bounded by a context
// timeout so a wedged libvirtd can never stall the caller.
package vmctl

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/junkerderprovinz/cannonadecommand/internal/netshape"
)

// callTimeout bounds a single virsh invocation.
const callTimeout = 8 * time.Second

// VM is one domain plus its currently-configured limits (0 / "" = unlimited/unset).
type VM struct {
	Name      string `json:"name"`
	State     string `json:"state"`     // running | shut off | paused | ...
	Running   bool   `json:"running"`   // convenience for the UI
	VCPUs     int    `json:"vcpus"`     // configured vcpu count
	MaxMemMiB int    `json:"maxMemMiB"` // ceiling (setmem can't exceed it)
	MemMiB    int    `json:"memMiB"`    // current balloon allocation
	MAC       string `json:"mac"`       // first bridged NIC, used as the domiftune iface
	CPUCores  string `json:"cpuCores"`  // pin cpuset of vcpu 0, e.g. "6-15" ("" = not pinned)
	CPUCap    int    `json:"cpuCap"`    // vcpu_quota as a percentage of ONE core (0 = uncapped)
	InKbit    int    `json:"inKbit"`    // download cap kbit (0 = unlimited)
	OutKbit   int    `json:"outKbit"`   // upload cap kbit (0 = unlimited)
}

// Limits is a requested CPU/RAM change (persisted natively in the domain XML). A nil pointer
// field means "leave this one alone". Bandwidth is NOT here — it can't live in libvirt on this
// kernel, so it is stored in the CC config and applied host-side via ApplyBandwidth.
type Limits struct {
	CPUCores *string `json:"cpuCores,omitempty"` // pin cpuset ("" clears the pin)
	CPUCap   *int    `json:"cpuCap,omitempty"`   // % of one core (0 clears the cap)
	MemMiB   *int    `json:"memMiB,omitempty"`   // balloon target
}

// runner is the virsh shell-out, swappable in tests.
type runner func(ctx context.Context, args ...string) (string, error)

func virshRun(ctx context.Context, args ...string) (string, error) {
	cctx, cancel := context.WithTimeout(ctx, callTimeout)
	defer cancel()
	out, err := exec.CommandContext(cctx, "virsh", args...).CombinedOutput()
	if err != nil {
		return string(out), fmt.Errorf("virsh %s: %w: %s", strings.Join(args, " "), err, strings.TrimSpace(string(out)))
	}
	return string(out), nil
}

// Controller wraps a runner so tests can inject a fake virsh. It also remembers which tap
// each VM's bandwidth is currently policed on, so a VM restarted onto a new tap gets the
// old tap's rules cleared.
type Controller struct {
	run    runner
	mu     sync.Mutex
	shaped map[string]string // vm name -> tap it is currently bandwidth-shaped on
}

// New returns a Controller backed by the real virsh binary.
func New() *Controller { return &Controller{run: virshRun, shaped: map[string]string{}} }

// vcpuPeriod is the CFS period we standardise on so a cap reads as a clean percentage.
const vcpuPeriod = 100000

func running(state string) bool { return strings.HasPrefix(strings.TrimSpace(state), "running") }

// scope returns the persistence flags: always --config, plus --live when running.
func scope(isRunning bool) []string {
	if isRunning {
		return []string{"--config", "--live"}
	}
	return []string{"--config"}
}

// List returns every defined domain with its details + current limits.
func (c *Controller) List(ctx context.Context) ([]VM, error) {
	out, err := c.run(ctx, "list", "--all", "--name")
	if err != nil {
		return nil, err
	}
	var vms []VM
	for _, name := range strings.Split(out, "\n") {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		vm, gErr := c.Get(ctx, name)
		if gErr != nil {
			// A single unreadable domain must not blank the whole tab.
			vms = append(vms, VM{Name: name, State: "unknown"})
			continue
		}
		vms = append(vms, vm)
	}
	return vms, nil
}

// Get reads one domain's details and currently-configured limits.
func (c *Controller) Get(ctx context.Context, name string) (VM, error) {
	vm := VM{Name: name}
	info, err := c.run(ctx, "dominfo", name)
	if err != nil {
		return vm, err
	}
	for _, ln := range strings.Split(info, "\n") {
		k, v, ok := splitKV(ln)
		if !ok {
			continue
		}
		switch k {
		case "State":
			vm.State = v
		case "CPU(s)":
			vm.VCPUs, _ = strconv.Atoi(v)
		case "Max memory":
			vm.MaxMemMiB = kibFieldToMiB(v)
		case "Used memory":
			vm.MemMiB = kibFieldToMiB(v)
		}
	}
	vm.Running = running(vm.State)

	// pin cpuset of vcpu 0 (Unraid pins uniformly; vcpu 0 represents the set)
	if pin, pErr := c.run(ctx, "vcpupin", name); pErr == nil {
		vm.CPUCores = firstVcpuAffinity(pin)
	}
	// CPU cap: vcpu_quota / vcpu_period as a % of one core. A running domain reports a
	// huge sentinel quota when UNcapped (libvirt's "unlimited"), so only treat a quota
	// that fits a sane cap (<= vcpus+2 cores) as a real limit; anything larger = uncapped.
	if sched, sErr := c.run(ctx, "schedinfo", name); sErr == nil {
		q, p := schedQuotaPeriod(sched)
		if q > 0 && p > 0 && q <= int64(vm.VCPUs+2)*vcpuPeriod {
			vm.CPUCap = int(q * 100 / p)
		}
	}
	// MAC of the first bridged NIC (informational). Bandwidth is NOT read from libvirt: this
	// kernel can't run domiftune's HTB QoS, so CC polices it host-side (see ApplyBandwidth) and
	// the configured caps are overlaid from the store by the API.
	if mac, iErr := c.run(ctx, "domiflist", name); iErr == nil {
		vm.MAC = firstMAC(mac)
	}
	return vm, nil
}

// Apply writes the requested (non-nil) limit changes to a domain.
func (c *Controller) Apply(ctx context.Context, name string, lim Limits) error {
	vm, err := c.Get(ctx, name)
	if err != nil {
		return err
	}
	sc := scope(vm.Running)

	if lim.CPUCores != nil {
		cores := strings.TrimSpace(*lim.CPUCores)
		for v := 0; v < vm.VCPUs; v++ {
			set := cores
			if set == "" {
				set = allCores(vm) // clearing the pin = float over every host core
			}
			if _, e := c.run(ctx, append([]string{"vcpupin", name, strconv.Itoa(v), set}, sc...)...); e != nil {
				return e
			}
		}
		if cores != "" {
			if _, e := c.run(ctx, append([]string{"emulatorpin", name, cores}, sc...)...); e != nil {
				return e
			}
		}
	}
	if lim.CPUCap != nil {
		quota := "-1" // uncapped
		if *lim.CPUCap > 0 {
			quota = strconv.Itoa(*lim.CPUCap * vcpuPeriod / 100)
		}
		args := append([]string{"schedinfo", name}, sc...)
		args = append(args, "--set", "vcpu_period="+strconv.Itoa(vcpuPeriod), "--set", "vcpu_quota="+quota)
		if _, e := c.run(ctx, args...); e != nil {
			return e
		}
	}
	if lim.MemMiB != nil && *lim.MemMiB > 0 {
		if _, e := c.run(ctx, append([]string{"setmem", name, strconv.Itoa(*lim.MemMiB*1024) + "KiB"}, sc...)...); e != nil {
			return e
		}
	}
	return nil
}

// ── parse helpers (all defensive: a missing/odd field yields the zero value) ──

func splitKV(ln string) (string, string, bool) {
	i := strings.Index(ln, ":")
	if i < 0 {
		return "", "", false
	}
	return strings.TrimSpace(ln[:i]), strings.TrimSpace(ln[i+1:]), true
}

// kibFieldToMiB turns "6291456 KiB" into MiB.
func kibFieldToMiB(v string) int {
	f := strings.Fields(v)
	if len(f) == 0 {
		return 0
	}
	kib, _ := strconv.Atoi(f[0])
	return kib / 1024
}

// firstVcpuAffinity reads the cpuset of "0" from a vcpupin table.
func firstVcpuAffinity(table string) string {
	for _, ln := range strings.Split(table, "\n") {
		f := strings.Fields(ln)
		if len(f) == 2 && f[0] == "0" {
			return f[1]
		}
	}
	return ""
}

// schedQuotaPeriod pulls vcpu_quota + vcpu_period out of schedinfo. int64 because a
// running domain's "unlimited" quota is a huge sentinel that would overflow an int.
func schedQuotaPeriod(sched string) (quota, period int64) {
	for _, ln := range strings.Split(sched, "\n") {
		k, v, ok := splitKV(ln)
		if !ok {
			continue
		}
		switch k {
		case "vcpu_quota":
			quota, _ = strconv.ParseInt(v, 10, 64)
		case "vcpu_period":
			period, _ = strconv.ParseInt(v, 10, 64)
		}
	}
	return
}

// firstMAC returns the MAC of the first bridged interface in a domiflist table.
func firstMAC(table string) string {
	for _, ln := range strings.Split(table, "\n") {
		f := strings.Fields(ln)
		// columns: Interface Type Source Model MAC
		if len(f) >= 5 && strings.Contains(f[4], ":") {
			return f[4]
		}
	}
	return ""
}

// allCores returns a cpuset spanning every host core, used to clear a pin.
func allCores(vm VM) string {
	// The host has at least the VM's vcpu count; hostcpu is the real source, but for a
	// clear we just need a wide set. 0-127 is a safe upper bound libvirt clamps to the host.
	return "0-127"
}

// ── BANDWIDTH ──────────────────────────────────────────────────────────────────────────
// Hand-rolled because this Unraid kernel has no sch_htb/sch_tbf (libvirt's domiftune QoS
// fails) and sch_ingress crashes it. The one mechanism that works is an iptables hashlimit
// DROP on the host FORWARD chain, matched to the VM's bridged tap via -m physdev
// (br_netfilter is loaded, bridge-nf-call-iptables is on). Applied in BOTH directions with
// netshape's byte-rate math (incl. the legacy-iptables x8 compensation). The tap changes on
// VM restart, so the monitor re-asserts every tick and this clears the OLD tap.

func vmDLChain(tap string) string { return "CC-VMBW-DL-" + tap }
func vmULChain(tap string) string { return "CC-VMBW-UL-" + tap }

// ipt runs a host-side iptables command (-w waits for the xtables lock).
func ipt(ctx context.Context, args ...string) error {
	cctx, cancel := context.WithTimeout(ctx, callTimeout)
	defer cancel()
	out, err := exec.CommandContext(cctx, "iptables", append([]string{"-w"}, args...)...).CombinedOutput()
	if err != nil {
		return fmt.Errorf("iptables %s: %w: %s", strings.Join(args, " "), err, strings.TrimSpace(string(out)))
	}
	return nil
}

// iptQuiet runs iptables and swallows the "it was never there" errors of an idempotent clear.
func iptQuiet(ctx context.Context, args ...string) {
	if err := ipt(ctx, args...); err != nil {
		m := err.Error()
		if strings.Contains(m, "No chain/target/match by that name") || strings.Contains(m, "does not exist") ||
			strings.Contains(m, "Chain already exists") || strings.Contains(m, "No such file or directory") {
			return
		}
	}
}

// resolveTap returns the running domain's first bridged tap (vnetX), or "" when not running.
func (c *Controller) resolveTap(ctx context.Context, name string) string {
	out, err := c.run(ctx, "domiflist", name)
	if err != nil {
		return ""
	}
	for _, ln := range strings.Split(out, "\n") {
		f := strings.Fields(ln)
		if len(f) >= 1 && strings.HasPrefix(f[0], "vnet") {
			return f[0]
		}
	}
	return ""
}

// hashRule is the hashlimit DROP body applied inside a per-tap/direction chain.
func hashRule(hname string, kbit int) []string {
	f := netshape.RateFactor()
	return []string{"-m", "hashlimit",
		"--hashlimit-above", strconv.Itoa(netshape.DLRateBytes(kbit)*f) + "b/s",
		"--hashlimit-burst", strconv.Itoa(netshape.DLBurstBytes(kbit)*f) + "b",
		"--hashlimit-name", hname, "-j", "DROP"}
}

// hName is a <=15-char hashlimit table name unique per tap + direction.
func hName(dir, tap string) string {
	n := "ccvm" + dir + strings.TrimPrefix(tap, "vnet")
	if len(n) > 15 {
		n = n[:15]
	}
	return n
}

// applyDir (re-)asserts one direction: a per-tap chain holds the hashlimit DROP, jumped from
// FORWARD for packets crossing the tap in that direction (physdev-out = download to the VM,
// physdev-in = upload from it). Flush+re-add so a changed rate replaces cleanly.
func (c *Controller) applyDir(ctx context.Context, chain, physdev, tap, hname string, kbit int) error {
	_ = ipt(ctx, "-N", chain) // "chain exists" is fine
	if err := ipt(ctx, "-F", chain); err != nil {
		return err
	}
	if err := ipt(ctx, append([]string{"-A", chain}, hashRule(hname, kbit)...)...); err != nil {
		return err
	}
	jump := []string{"FORWARD", "-m", "physdev", physdev, tap, "-j", chain}
	if ipt(ctx, append([]string{"-C"}, jump...)...) != nil {
		return ipt(ctx, append([]string{"-I"}, jump...)...)
	}
	return nil
}

func (c *Controller) clearDir(ctx context.Context, chain, physdev, tap string) {
	iptQuiet(ctx, "-D", "FORWARD", "-m", "physdev", physdev, tap, "-j", chain)
	iptQuiet(ctx, "-F", chain)
	iptQuiet(ctx, "-X", chain)
}

// ApplyBandwidth polices a domain's download (inKbit) + upload (outKbit) on its current tap,
// clearing the previous tap when the VM was restarted onto a new one. A stopped VM (no tap) or
// (0,0) clears + forgets it. Idempotent — safe for the monitor to call every tick.
func (c *Controller) ApplyBandwidth(ctx context.Context, name string, inKbit, outKbit int) error {
	tap := c.resolveTap(ctx, name)
	c.mu.Lock()
	if c.shaped == nil {
		c.shaped = map[string]string{}
	}
	old := c.shaped[name]
	c.mu.Unlock()
	if old != "" && old != tap {
		c.clearDir(ctx, vmDLChain(old), "--physdev-out", old)
		c.clearDir(ctx, vmULChain(old), "--physdev-in", old)
	}
	if tap == "" || (inKbit <= 0 && outKbit <= 0) {
		if tap != "" {
			c.clearDir(ctx, vmDLChain(tap), "--physdev-out", tap)
			c.clearDir(ctx, vmULChain(tap), "--physdev-in", tap)
		}
		c.mu.Lock()
		delete(c.shaped, name)
		c.mu.Unlock()
		return nil
	}
	var errs []error
	if inKbit > 0 {
		errs = append(errs, c.applyDir(ctx, vmDLChain(tap), "--physdev-out", tap, hName("d", tap), inKbit))
	} else {
		c.clearDir(ctx, vmDLChain(tap), "--physdev-out", tap)
	}
	if outKbit > 0 {
		errs = append(errs, c.applyDir(ctx, vmULChain(tap), "--physdev-in", tap, hName("u", tap), outKbit))
	} else {
		c.clearDir(ctx, vmULChain(tap), "--physdev-in", tap)
	}
	c.mu.Lock()
	c.shaped[name] = tap
	c.mu.Unlock()
	return errors.Join(errs...)
}
