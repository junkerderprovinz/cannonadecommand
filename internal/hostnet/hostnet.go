// Package hostnet reports the HOST's cumulative network byte counters for the
// status-island Up/Down chip. Like hostcpu, this is proxy-safe HTTP the island can
// poll on every page: the daemon reads /proc/net/dev and the browser deltas two
// samples into a per-second rate. The native Dashboard's live figure rides a
// GraphQL websocket a reverse proxy often fails to upgrade, so this exists.
package hostnet

import (
	"os"
	"strconv"
	"strings"
)

// Rate returns the cumulative bytes received (rx) and transmitted (tx) on the host's
// PRIMARY uplink — the interface that carries the default route. Reporting ONE
// interface (not the sum of all) avoids double-counting a bridge and its member
// (br0 + eth0 + veth*). The frontend deltas successive calls; a counter reset or an
// interface change just skips one sample (its rx>=prev guard). Both 0 when /proc
// can't be read (e.g. non-Linux dev host) — the chip then shows "--".
func Rate() (rx, tx uint64) {
	iface := defaultIface()
	if iface == "" {
		return 0, 0
	}
	return ifaceBytes(iface)
}

// defaultIface reads the name of the default-route interface from /proc/net/route
// (the row whose hex Destination is 00000000 = 0.0.0.0). "" when none/unreadable.
func defaultIface() string {
	data, err := os.ReadFile("/proc/net/route")
	if err != nil {
		return ""
	}
	return parseDefaultIface(string(data))
}

// parseDefaultIface picks the default-route interface out of /proc/net/route. Split
// out so it is unit-testable without /proc. Fields: Iface Destination Gateway Flags …
func parseDefaultIface(data string) string {
	lines := strings.Split(data, "\n")
	for i, line := range lines {
		if i == 0 { // header row (Iface Destination Gateway …)
			continue
		}
		f := strings.Fields(line)
		if len(f) < 2 {
			continue
		}
		if f[1] == "00000000" { // destination 0.0.0.0 → default route
			return f[0]
		}
	}
	return ""
}

// ifaceBytes reads the rx/tx byte counters for one interface from /proc/net/dev.
func ifaceBytes(iface string) (rx, tx uint64) {
	data, err := os.ReadFile("/proc/net/dev")
	if err != nil {
		return 0, 0
	}
	return parseIfaceBytes(string(data), iface)
}

// parseIfaceBytes returns (rx, tx) for iface from /proc/net/dev content. Each data
// row is "  name: rxbytes rxpkts … (8 rx cols) txbytes txpkts …", so rx = field 0
// and tx = field 8 after the colon. Split out so it is unit-testable without /proc.
func parseIfaceBytes(data, iface string) (rx, tx uint64) {
	for _, line := range strings.Split(data, "\n") {
		name, rest, ok := strings.Cut(line, ":")
		if !ok || strings.TrimSpace(name) != iface {
			continue
		}
		f := strings.Fields(rest)
		if len(f) < 9 {
			return 0, 0
		}
		rx, _ = strconv.ParseUint(f[0], 10, 64)
		tx, _ = strconv.ParseUint(f[8], 10, 64)
		return rx, tx
	}
	return 0, 0
}
