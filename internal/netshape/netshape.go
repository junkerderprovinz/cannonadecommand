// Package netshape applies per-container bandwidth caps inside the container's own network
// namespace (entered via nsenter using the container PID). It never touches the host uplink.
//
// UPLOAD (egress) is shaped with a plain tbf root qdisc (sch_tbf) on the container's
// interface.
//
// DOWNLOAD (ingress) is POLICED with netfilter: an iptables hashlimit rule on the
// container's INPUT chain drops packets above the byte rate, and TCP backs off to the cap.
// This is pure netfilter — NO ingress qdisc is EVER created: `tc qdisc add dev X ingress`
// triggers a KERNEL CRASH in the sch_ingress module (fault at tcx_miniq_inc, "exited with
// irqs disabled") on some Unraid kernels, freezing WebUI/SSH while ping and running
// containers keep working. That module stays untouched forever. Netfilter policing also
// works identically for ipvlan AND macvlan networks (br0.x) — there is no host-side veth
// to shape, but the rule lives inside the container's own netns, where the traffic always
// passes the INPUT chain.
//
// Everything is bounded and safe: a failure just means "no shaping", never broken
// networking and never a kernel qdisc that can crash the host. Rules are ephemeral (gone on
// container restart), so the monitor re-applies them every tick (both paths idempotent).
package netshape

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"
)

// DefaultIface is the in-container interface to shape when none is configured. eth0 is
// the container's primary NIC in bridge, ipvlan and macvlan setups alike.
const DefaultIface = "eth0"

// dlChain is our private iptables chain inside the container netns; keeping the rule in
// an own chain makes apply/remove surgical and visible (`iptables -S CC_DL`).
const dlChain = "CC_DL"

// ifaceOr returns the chosen interface, or DefaultIface when the (Settings-configured)
// name is blank. The iface is threaded through every call rather than held in a mutable
// global so a config change can never race with an in-flight tick.
func ifaceOr(iface string) string {
	if iface = strings.TrimSpace(iface); iface != "" {
		return iface
	}
	return DefaultIface
}

// burstBytes ≈ 0.1s of data at the given rate, with a sane floor so small rates still
// pass traffic.
func burstBytes(kbit int) int {
	b := kbit * 1000 / 80
	if b < 4000 {
		b = 4000
	}
	return b
}

// egressArgs builds the nsenter argv that sets (kbit>0) or clears (kbit<=0) the EGRESS tbf
// rate limit on `iface`'s root qdisc inside the netns of `pid`. Split out for unit tests.
func egressArgs(iface string, pid, kbit int) []string {
	dev := ifaceOr(iface)
	base := []string{"-t", strconv.Itoa(pid), "-n", "tc", "qdisc"}
	if kbit <= 0 {
		return append(base, "del", "dev", dev, "root")
	}
	return append(base, "replace", "dev", dev, "root", "tbf",
		"rate", strconv.Itoa(kbit)+"kbit", "burst", strconv.Itoa(burstBytes(kbit)), "latency", "50ms")
}

// dlRateBytes converts kbit/s to bytes/s (kbit × 125), min 125. The rule uses the
// NATIVE byte unit ("b") on purpose: the kb/mb prefixes are parsed differently
// across legacy/nf_tables userspace builds — the box enforced ~1/8 of the
// configured rate on "kb/s" (60 Mbit set → 7 Mbit measured).
func dlRateBytes(kbit int) int {
	r := kbit * 125
	if r < 125 {
		r = 125
	}
	return r
}

// dlBurstBytes = TWO seconds of the rate. iptables hashlimit enforces a minimum
// burst: nf_tables builds demand >= 1x rate, LEGACY iptables (v1.8.13 on the box)
// demands ~1.5x rate — 2x clears both with margin.
func dlBurstBytes(kbit int) int {
	return 2 * dlRateBytes(kbit)
}

// iptArgs builds one nsenter+iptables argv inside the netns of `pid`. -w waits for the
// xtables lock instead of failing on contention.
func iptArgs(pid int, args ...string) []string {
	return append([]string{"-t", strconv.Itoa(pid), "-n", "iptables", "-w"}, args...)
}

// byteRateFactor compensates a legacy-iptables byte-rate bug: legacy builds
// >= 1.8.12 APPLY a byte rate as BITS — the box (v1.8.13 legacy) enforced
// exactly 1/8 of the configured cap (30 Mbit set → 3.45 Mbit measured, twice),
// while the nf_tables build enforces bytes correctly (CI measures 105% of cap).
// Detected once from `iptables --version`; 8 = compensate, 1 = correct build.
var (
	rfOnce         sync.Once
	byteRateFactor = 1
)

func rateFactor() int {
	rfOnce.Do(func() {
		out, err := exec.Command("iptables", "--version").CombinedOutput()
		if err != nil {
			return
		}
		v := strings.TrimSpace(string(out))
		if !strings.Contains(v, "(legacy)") {
			return
		}
		var maj, min, patch int
		if _, err := fmt.Sscanf(v, "iptables v%d.%d.%d", &maj, &min, &patch); err != nil {
			return
		}
		if maj > 1 || min > 8 || (min == 8 && patch >= 12) {
			byteRateFactor = 8
		}
	})
	return byteRateFactor
}

// dlRuleSpec is the hashlimit rule body (everything after the chain name). Split out so
// the -C check and the -A add use the EXACT same spec, and for unit tests. The rate is
// multiplied by rateFactor() (see above) — on an affected legacy build the rule TEXT
// shows 8x the target, but the kernel then enforces the intended byte rate.
func dlRuleSpec(kbit int) []string {
	f := rateFactor()
	return []string{"-m", "hashlimit",
		"--hashlimit-above", strconv.Itoa(dlRateBytes(kbit)*f) + "b/s",
		"--hashlimit-burst", strconv.Itoa(dlBurstBytes(kbit)*f) + "b",
		"--hashlimit-name", "ccdl", "-j", "DROP"}
}

// applyIngressPolicing installs (or re-asserts) the download cap. Fast path: when the
// exact rule and the INPUT jump already exist, nothing runs — the monitor calls this
// every tick.
func applyIngressPolicing(iface string, pid, kbit int) error {
	dev := ifaceOr(iface)
	if run(iptArgs(pid, append([]string{"-C", dlChain}, dlRuleSpec(kbit)...)...)) == nil &&
		run(iptArgs(pid, "-C", "INPUT", "-i", dev, "-j", dlChain)) == nil {
		return nil
	}
	_ = run(iptArgs(pid, "-N", dlChain)) // "chain exists" is fine
	if err := run(iptArgs(pid, "-F", dlChain)); err != nil {
		return err
	}
	if err := run(iptArgs(pid, append([]string{"-A", dlChain}, dlRuleSpec(kbit)...)...)); err != nil {
		return err
	}
	if run(iptArgs(pid, "-C", "INPUT", "-i", dev, "-j", dlChain)) != nil {
		return run(iptArgs(pid, "-I", "INPUT", "-i", dev, "-j", dlChain))
	}
	return nil
}

// clearIngressPolicing removes the download cap (jump, rules, chain). Best-effort:
// "was never there" is success.
func clearIngressPolicing(iface string, pid int) error {
	dev := ifaceOr(iface)
	_ = ignoreMissing(run(iptArgs(pid, "-D", "INPUT", "-i", dev, "-j", dlChain)))
	_ = ignoreMissing(run(iptArgs(pid, "-F", dlChain)))
	return ignoreMissing(run(iptArgs(pid, "-X", dlChain)))
}

// Apply sets the UPLOAD (egress tbf) and DOWNLOAD (netfilter policing) caps on `iface`
// inside the container whose main process is `pid`. A value <=0 clears that direction;
// Apply(iface,pid,0,0) is the monitor's "unshape" call. Both paths are idempotent, and
// each direction is applied independently — a failure in one still leaves the other
// correct (the monitor keeps the container tracked either way).
func Apply(iface string, pid, egressKbit, ingressKbit int) error {
	if pid <= 0 {
		return fmt.Errorf("netshape: invalid pid %d", pid)
	}
	// The directions are INDEPENDENT — an egress(-clear) failure must never abort
	// the ingress policing (an early return here silently blocked every download
	// limit whenever no upload cap was set: the noqueue root-delete errored first).
	var errs []error
	if egressKbit > 0 {
		if err := run(egressArgs(iface, pid, egressKbit)); err != nil {
			errs = append(errs, fmt.Errorf("netshape: egress: %w", err))
		}
	} else if err := clearEgress(iface, pid); err != nil {
		errs = append(errs, fmt.Errorf("netshape: egress clear: %w", err))
	}
	if ingressKbit > 0 {
		if err := applyIngressPolicing(iface, pid, ingressKbit); err != nil {
			errs = append(errs, fmt.Errorf("netshape: ingress policing: %w", err))
		}
	} else if err := clearIngressPolicing(iface, pid); err != nil {
		errs = append(errs, fmt.Errorf("netshape: ingress clear: %w", err))
	}
	return errors.Join(errs...)
}

// Clear removes the shaping (both directions) from the container. Best-effort.
func Clear(iface string, pid int) error {
	if pid <= 0 {
		return nil
	}
	if err := clearEgress(iface, pid); err != nil {
		return err
	}
	return clearIngressPolicing(iface, pid)
}

// clearEgress deletes the root tbf (ignoring "nothing to delete").
func clearEgress(iface string, pid int) error {
	return ignoreMissing(run(egressArgs(iface, pid, 0)))
}

// ignoreMissing swallows tc/iptables "nothing to delete" errors.
func ignoreMissing(err error) error {
	if err != nil {
		m := err.Error()
		if strings.Contains(m, "No such file or directory") || strings.Contains(m, "RTNETLINK answers: No such file") ||
			strings.Contains(m, "Cannot find") || strings.Contains(m, "No chain/target/match by that name") ||
			strings.Contains(m, "does not exist") ||
			// deleting the root qdisc of a device that only has the default noqueue —
			// nothing was shaped, so nothing to delete
			strings.Contains(m, "handle of zero") {
			return nil
		}
	}
	return err
}

// Show returns the LIVE shaping state inside the netns — the tc qdisc line(s) on the
// interface and our CC_DL netfilter chain — for the on-demand diagnostics endpoint.
// Best-effort: an error becomes readable text instead of an empty answer.
func Show(iface string, pid int) (qdisc, filter string) {
	dev := ifaceOr(iface)
	q, qe := output([]string{"-t", strconv.Itoa(pid), "-n", "tc", "qdisc", "show", "dev", dev})
	if qe != nil {
		q = qe.Error()
	}
	f, fe := output(iptArgs(pid, "-S", dlChain))
	if fe != nil {
		f = fe.Error()
	}
	return strings.TrimSpace(q), strings.TrimSpace(f)
}

// DetectIface returns the container's default-route device (e.g. eth0), or "" when
// undetectable. Used when no interface is configured, so bridge/ipvlan/macvlan
// containers with unusual NIC names still get shaped on the right device.
func DetectIface(pid int) string {
	if pid <= 0 {
		return ""
	}
	out, err := output([]string{"-t", strconv.Itoa(pid), "-n", "ip", "-o", "-4", "route", "show", "default"})
	if err != nil {
		return ""
	}
	fs := strings.Fields(out)
	for i, f := range fs {
		if f == "dev" && i+1 < len(fs) {
			return fs[i+1]
		}
	}
	return ""
}

func run(args []string) error {
	_, err := output(args)
	return err
}

func output(args []string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, "nsenter", args...).CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("nsenter: %w: %s", err, strings.TrimSpace(string(out)))
	}
	return string(out), nil
}
