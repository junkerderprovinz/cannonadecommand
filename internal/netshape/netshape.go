// Package netshape applies per-container network rate limits inside the container's own
// network namespace (entered via nsenter using the container PID), so it never touches the
// host uplink. Two directions:
//
//	EGRESS  (upload)   – a tbf shaper on the interface root qdisc (queues + paces).
//	INGRESS (download) – an ingress qdisc + a u32 "police ... drop" filter (drops packets
//	                     over the rate; TCP then backs off). Ingress can't be queued, so
//	                     policing is the standard way to cap download.
//
// Everything is bounded and safe: a failure just means "no shaping", never broken
// networking. The rules are ephemeral (gone on container restart), so the monitor
// re-applies them every tick while a limited container runs.
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

// ingressDelArgs removes the ingress qdisc (and its police filter) from `iface`.
func ingressDelArgs(iface string, pid int) []string {
	return []string{"-t", strconv.Itoa(pid), "-n", "tc", "qdisc", "del", "dev", ifaceOr(iface), "ingress"}
}

// ingressQdiscArgs adds the ingress qdisc (handle ffff:) to `iface`.
func ingressQdiscArgs(iface string, pid int) []string {
	return []string{"-t", strconv.Itoa(pid), "-n", "tc", "qdisc", "add", "dev", ifaceOr(iface), "handle", "ffff:", "ingress"}
}

// ingressFilterArgs adds a u32 "match everything" police filter that drops INGRESS traffic
// over `kbit` on `iface`'s ingress qdisc — the download cap. protocol=all (not ip) so IPv6
// downloads are capped too, matching the egress tbf which shapes all traffic.
func ingressFilterArgs(iface string, pid, kbit int) []string {
	return []string{"-t", strconv.Itoa(pid), "-n", "tc", "filter", "add", "dev", ifaceOr(iface),
		"parent", "ffff:", "protocol", "all", "prio", "1", "u32", "match", "u32", "0", "0",
		"police", "rate", strconv.Itoa(kbit) + "kbit", "burst", strconv.Itoa(burstBytes(kbit)), "drop", "flowid", ":1"}
}

// Apply sets the egress (upload) and ingress (download) caps on `iface` inside the container
// whose main process is `pid`. A direction with kbit<=0 is CLEARED. Idempotent: egress uses
// tc qdisc replace, ingress is torn down and rebuilt each call. Apply(iface,pid,0,0) clears
// both directions (that is the monitor's "unshape" call).
func Apply(iface string, pid, egressKbit, ingressKbit int) error {
	if pid <= 0 {
		return fmt.Errorf("netshape: invalid pid %d", pid)
	}
	var errs []string
	// egress (upload) on the root qdisc
	if egressKbit > 0 {
		if err := run(egressArgs(iface, pid, egressKbit)); err != nil {
			errs = append(errs, "egress: "+err.Error())
		}
	} else if err := clearEgress(iface, pid); err != nil {
		errs = append(errs, "egress clear: "+err.Error())
	}
	// ingress (download): tear down any existing ingress qdisc first (idempotent), then add
	// a fresh qdisc + police filter if a cap is wanted. The del is best-effort (may be absent).
	_ = clearIngress(iface, pid)
	if ingressKbit > 0 {
		if err := run(ingressQdiscArgs(iface, pid)); err != nil {
			errs = append(errs, "ingress qdisc: "+err.Error())
		} else if err := run(ingressFilterArgs(iface, pid, ingressKbit)); err != nil {
			errs = append(errs, "ingress filter: "+err.Error())
		}
	}
	if len(errs) > 0 {
		return fmt.Errorf("netshape: %s", strings.Join(errs, "; "))
	}
	return nil
}

// Clear removes ALL shaping (both directions) from the container. Best-effort.
func Clear(iface string, pid int) error {
	if pid <= 0 {
		return nil
	}
	_ = clearEgress(iface, pid)
	_ = clearIngress(iface, pid)
	return nil
}

// clearEgress deletes the root tbf (ignoring "nothing to delete").
func clearEgress(iface string, pid int) error {
	return ignoreMissing(run(egressArgs(iface, pid, 0)))
}

// clearIngress deletes the ingress qdisc (ignoring "nothing to delete").
func clearIngress(iface string, pid int) error {
	return ignoreMissing(run(ingressDelArgs(iface, pid)))
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
