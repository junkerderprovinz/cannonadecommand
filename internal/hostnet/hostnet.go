// Package hostnet reports the HOST's cumulative network byte counters for the
// status-island Up/Down chip. Like hostcpu, this is proxy-safe HTTP the island can
// poll on every page: the daemon reads /proc/net/dev and the browser deltas two
// samples into a per-second rate. The native Dashboard's live figure rides a
// GraphQL websocket a reverse proxy often fails to upgrade, so this exists.
package hostnet

import (
	"os"
	"regexp"
	"strconv"
	"strings"
)

// physRe matches a PHYSICAL NIC as Unraid names them: eth0, eth1, … A VLAN child
// (eth0.20) carries a dot and is deliberately excluded — its traffic already crosses
// its parent, so counting both would double it.
var physRe = regexp.MustCompile(`^eth\d+$`)

// Rate returns the host's cumulative rx/tx bytes, summed over the PHYSICAL NICs.
//
// It used to report the single interface carrying the default route, on the theory
// that one interface avoids double-counting a bridge and its member. That measured the
// wrong layer: on Unraid the default route is a bridge (and /proc/net/route lists
// shim-br0 first, so that is what actually got measured), and a Linux bridge only
// counts frames the HOST stack itself terminates — not frames it forwards between
// ports, and nothing on a different netdev. With containers on a VLAN bridge (br0.20)
// and VMs on tap ports, only WebGUI traffic was left, so a 100 Mbit/s transfer showed
// as a few Kbit/s. Measured on the live box: eth0 rx=526.9 GB vs br0 rx=3.1 GB, a
// factor of ~170 — exactly the reported symptom.
//
// Summing the physical NICs is both complete and free of double counting: every frame
// crosses exactly one hardware NIC, whatever rides on top of it (br0, br0.20, a bond,
// docker0, an ipvlan child inside a container netns, a VM tap).
//
// Falls back to the default-route interface when no eth* exists (an unusual naming
// scheme), so an odd host degrades to the previous behaviour instead of reporting
// nothing. The frontend deltas successive calls; a counter reset just skips one sample
// (its rx>=prev guard). Both 0 when /proc can't be read (e.g. a non-Linux dev host) —
// the chip then shows "--".
func Rate() (rx, tx uint64) {
	data, err := os.ReadFile("/proc/net/dev")
	if err != nil {
		return 0, 0
	}
	if rx, tx, found := sumPhysical(string(data)); found {
		return rx, tx
	}
	iface := defaultIface()
	if iface == "" {
		return 0, 0
	}
	return parseIfaceBytes(string(data), iface)
}

// sumPhysical adds up the rx/tx byte counters of every physical NIC in /proc/net/dev
// content. found is false when the host names its NICs differently, which tells Rate
// to fall back. Split out so it is unit-testable without /proc.
func sumPhysical(data string) (rx, tx uint64, found bool) {
	for _, line := range strings.Split(data, "\n") {
		name, rest, ok := strings.Cut(line, ":")
		if !ok || !physRe.MatchString(strings.TrimSpace(name)) {
			continue
		}
		f := strings.Fields(rest)
		if len(f) < 9 {
			continue
		}
		r, _ := strconv.ParseUint(f[0], 10, 64)
		t, _ := strconv.ParseUint(f[8], 10, 64)
		rx += r
		tx += t
		found = true
	}
	return rx, tx, found
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
