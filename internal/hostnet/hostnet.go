// Package hostnet reports the host's cumulative network byte counters, which the
// status island polls and turns into a rate.
package hostnet

import (
	"os"
	"regexp"
	"strconv"
	"strings"
)

// physRe matches a physical NIC as Unraid names them. A VLAN child such as
// eth0.20 is left out because its traffic already crosses the parent.
var physRe = regexp.MustCompile(`^eth\d+$`)

// Rate returns the host's cumulative rx and tx bytes summed over the physical
// NICs. Every frame crosses exactly one of them, whatever runs on top, whereas a
// bridge only counts the frames the host itself terminates and misses forwarded
// container and VM traffic. A host without eth* NICs falls back to the
// default-route interface. Both are 0 when /proc cannot be read.
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

// sumPhysical adds up the rx and tx bytes of every physical NIC in /proc/net/dev.
// found is false when no NIC matches physRe.
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

// defaultIface returns the default-route interface from /proc/net/route, or "".
func defaultIface() string {
	data, err := os.ReadFile("/proc/net/route")
	if err != nil {
		return ""
	}
	return parseDefaultIface(string(data))
}

// parseDefaultIface picks the row of /proc/net/route whose destination is 0.0.0.0.
func parseDefaultIface(data string) string {
	lines := strings.Split(data, "\n")
	for i, line := range lines {
		if i == 0 {
			continue
		}
		f := strings.Fields(line)
		if len(f) < 2 {
			continue
		}
		if f[1] == "00000000" {
			return f[0]
		}
	}
	return ""
}

// parseIfaceBytes returns rx and tx bytes for iface from /proc/net/dev, where
// they are fields 0 and 8 after the colon.
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
