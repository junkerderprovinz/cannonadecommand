// Package netshape applies per-container bandwidth caps inside the container's own network
// namespace (entered via nsenter using the container PID). It never touches the host uplink.
//
// BOTH directions are POLICED with netfilter (an iptables hashlimit DROP), never a tc qdisc:
// this Unraid kernel ships NO sch_tbf/sch_htb, so the old tc-tbf egress shaper silently
// no-op'd (a failure = "no shaping"). UPLOAD now drops packets above the byte rate on OUTPUT,
// DOWNLOAD on INPUT; TCP backs off to the cap either way.
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
	"time"
)

// DefaultIface is the in-container interface to shape when none is configured. eth0 is
// the container's primary NIC in bridge, ipvlan and macvlan setups alike.
const DefaultIface = "eth0"

// dlChain is our private iptables chain inside the container netns; keeping the rule in
// an own chain makes apply/remove surgical and visible (`iptables -S CC_DL`).
const dlChain = "CC_DL"

// ulChain is the UPLOAD (egress) equivalent. This kernel has no sch_tbf, so the old tc-tbf
// egress shaper silently no-op'd — CC now polices upload with a hashlimit DROP on OUTPUT,
// exactly like the download policing on INPUT.
const ulChain = "CC_UL"

// ifaceOr returns the chosen interface, or DefaultIface when the (Settings-configured)
// name is blank. The iface is threaded through every call rather than held in a mutable
// global so a config change can never race with an in-flight tick.
func ifaceOr(iface string) string {
	if iface = strings.TrimSpace(iface); iface != "" {
		return iface
	}
	return DefaultIface
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

// rateFactor was historically 8 on legacy iptables >= 1.8.12 to compensate a
// byte-rate bug (the box appeared to enforce ~1/8 of a byte-mode cap). Re-measured
// on Unraid 7.3.2 (kernel 6.18.38, iptables v1.8.13 legacy) in an isolated netns:
// a byte-mode hashlimit enforces the configured byte rate CORRECTLY (1,000,000 b/s
// delivered ~8 Mbit/s; the old compensated 8,000,000 b/s over-delivered ~10x). So
// that under-enforcement was a transient KERNEL bug, not tied to the iptables
// version — multiplying by 8 off the version over-limited downloads ~8x on current
// kernels. No compensation is applied; the byte-mode rule is used as-is.
func rateFactor() int { return 1 }

// DLRateBytes, DLBurstBytes and RateFactor expose the download-policing byte-rate math
// so the VM shaper in package vmctl can build the SAME hashlimit rule host-side on a
// VM's bridged tap.
func DLRateBytes(kbit int) int  { return dlRateBytes(kbit) }
func DLBurstBytes(kbit int) int { return dlBurstBytes(kbit) }
func RateFactor() int           { return rateFactor() }

// dlRuleSpec is the hashlimit rule body (everything after the chain name). Split out so
// the -C check and the -A add use the EXACT same spec, and for unit tests. The byte
// rate is used as-is (rateFactor() is 1; see above).
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

// ulRuleSpec is the upload hashlimit body — same byte-rate math as download (incl. the legacy
// x8 factor) on its OWN hashlimit table + chain.
func ulRuleSpec(kbit int) []string {
	f := rateFactor()
	return []string{"-m", "hashlimit",
		"--hashlimit-above", strconv.Itoa(dlRateBytes(kbit)*f) + "b/s",
		"--hashlimit-burst", strconv.Itoa(dlBurstBytes(kbit)*f) + "b",
		"--hashlimit-name", "ccul", "-j", "DROP"}
}

// applyEgressPolicing installs (or re-asserts) the UPLOAD cap as a hashlimit DROP on OUTPUT
// inside the container netns (no tc/tbf — unavailable on this kernel). Fast path: when the
// rule + the OUTPUT jump already exist, nothing runs. Mirrors applyIngressPolicing.
func applyEgressPolicing(iface string, pid, kbit int) error {
	dev := ifaceOr(iface)
	if run(iptArgs(pid, append([]string{"-C", ulChain}, ulRuleSpec(kbit)...)...)) == nil &&
		run(iptArgs(pid, "-C", "OUTPUT", "-o", dev, "-j", ulChain)) == nil {
		return nil
	}
	_ = run(iptArgs(pid, "-N", ulChain)) // "chain exists" is fine
	if err := run(iptArgs(pid, "-F", ulChain)); err != nil {
		return err
	}
	if err := run(iptArgs(pid, append([]string{"-A", ulChain}, ulRuleSpec(kbit)...)...)); err != nil {
		return err
	}
	if run(iptArgs(pid, "-C", "OUTPUT", "-o", dev, "-j", ulChain)) != nil {
		return run(iptArgs(pid, "-I", "OUTPUT", "-o", dev, "-j", ulChain))
	}
	return nil
}

// clearEgressPolicing removes the upload cap (jump, rules, chain). Best-effort.
func clearEgressPolicing(iface string, pid int) error {
	dev := ifaceOr(iface)
	_ = ignoreMissing(run(iptArgs(pid, "-D", "OUTPUT", "-o", dev, "-j", ulChain)))
	_ = ignoreMissing(run(iptArgs(pid, "-F", ulChain)))
	return ignoreMissing(run(iptArgs(pid, "-X", ulChain)))
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
		if err := applyEgressPolicing(iface, pid, egressKbit); err != nil {
			errs = append(errs, fmt.Errorf("netshape: egress policing: %w", err))
		}
	} else if err := clearEgressPolicing(iface, pid); err != nil {
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
	if err := clearEgressPolicing(iface, pid); err != nil {
		return err
	}
	return clearIngressPolicing(iface, pid)
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
	if uf, ue := output(iptArgs(pid, "-S", ulChain)); ue == nil {
		f = strings.TrimSpace(f) + "\n" + strings.TrimSpace(uf)
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
