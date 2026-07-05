// Package netshape applies a per-container EGRESS (upload) rate limit inside the container's
// own network namespace (entered via nsenter using the container PID), via a tbf shaper on
// the interface root qdisc. It never touches the host uplink.
//
// DOWNLOAD (ingress) shaping was REMOVED. It required an ingress qdisc
// (`tc qdisc add dev X handle ffff: ingress`), which triggers a KERNEL CRASH in the
// sch_ingress module (fault at tcx_miniq_inc, "exited with irqs disabled") on some Unraid
// kernels — freezing the WebUI/SSH and other TCP management services while ping and the
// already-running containers keep working. Because the monitor re-asserts shaping every tick,
// that crash could even recur after a reboot. There is also no safe per-container download cap
// for macvlan containers (br0.x — no host-side veth to shape), so we do NOT create any ingress
// qdisc at all. Only egress (upload) is shaped, with a plain tbf root qdisc (sch_tbf), which
// is unaffected by the sch_ingress bug.
//
// Everything is bounded and safe: a failure just means "no shaping", never broken networking
// and never a kernel qdisc that can crash the host. Rules are ephemeral (gone on container
// restart), so the monitor re-applies them every tick (tc qdisc replace is idempotent).
package netshape

import (
	"context"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

// DefaultIface is the in-container interface to shape when none is configured. eth0 is
// the container's primary NIC in both bridge and macvlan setups.
const DefaultIface = "eth0"

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

// Apply sets the EGRESS (upload) cap on `iface` inside the container whose main process is
// `pid`. The 4th argument (the former ingress/download kbit) is accepted for signature
// stability but is INTENTIONALLY IGNORED: download shaping needs an ingress qdisc, which
// crashes some Unraid kernels (see the package doc), so it is never created. egressKbit<=0
// clears the shaping; Apply(iface,pid,0,0) is the monitor's "unshape" call. Idempotent
// (tc qdisc replace). A failure just means "no shaping", never broken networking.
func Apply(iface string, pid, egressKbit, _ int) error {
	if pid <= 0 {
		return fmt.Errorf("netshape: invalid pid %d", pid)
	}
	if egressKbit > 0 {
		if err := run(egressArgs(iface, pid, egressKbit)); err != nil {
			return fmt.Errorf("netshape: egress: %w", err)
		}
		return nil
	}
	if err := clearEgress(iface, pid); err != nil {
		return fmt.Errorf("netshape: egress clear: %w", err)
	}
	return nil
}

// Clear removes the (egress) shaping from the container. Best-effort. It never touches an
// ingress qdisc — none is ever created (see the package doc).
func Clear(iface string, pid int) error {
	if pid <= 0 {
		return nil
	}
	return clearEgress(iface, pid)
}

// clearEgress deletes the root tbf (ignoring "nothing to delete").
func clearEgress(iface string, pid int) error {
	return ignoreMissing(run(egressArgs(iface, pid, 0)))
}

// ignoreMissing swallows a tc "no such file/qdisc" error (there was nothing to delete).
func ignoreMissing(err error) error {
	if err != nil {
		m := err.Error()
		if strings.Contains(m, "No such file or directory") || strings.Contains(m, "RTNETLINK answers: No such file") || strings.Contains(m, "Cannot find") {
			return nil
		}
	}
	return err
}

func run(args []string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, "nsenter", args...).CombinedOutput()
	if err != nil {
		return fmt.Errorf("nsenter tc: %w: %s", err, strings.TrimSpace(string(out)))
	}
	return nil
}
