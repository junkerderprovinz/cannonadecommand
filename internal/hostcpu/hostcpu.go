// Package hostcpu reports the Unraid host's CPU layout, load and memory. The pin
// grid needs this from the server because the browser only knows the client's
// core count.
package hostcpu

import (
	"os"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
)

// Unraid 7.3 moved CPU load from the /sub/cpuload nchan channel to a GraphQL
// websocket, which reverse proxies often fail to upgrade. Percent works over plain
// HTTP polling instead, diffing /proc/stat against the previous call.
var (
	hcMu        sync.Mutex
	hcPrevIdle  uint64
	hcPrevTotal uint64
	hcSeeded    bool
)

// Percent returns host CPU utilisation (0-100) since the previous call. The first
// call returns 0.
func Percent() int {
	idle, total := readProcStatCPU()
	hcMu.Lock()
	defer hcMu.Unlock()
	pct := 0
	if hcSeeded && total > hcPrevTotal {
		dt := total - hcPrevTotal
		var di uint64
		if idle > hcPrevIdle {
			di = idle - hcPrevIdle
		}
		if dt > 0 {
			busy := dt - di
			if busy > dt {
				busy = dt
			}
			pct = int((busy*100 + dt/2) / dt)
		}
	}
	hcPrevIdle, hcPrevTotal, hcSeeded = idle, total, true
	return pct
}

// readProcStatCPU sums the aggregate "cpu " line of /proc/stat into idle plus
// iowait and the total.
func readProcStatCPU() (idle, total uint64) {
	data, err := os.ReadFile("/proc/stat")
	if err != nil {
		return 0, 0
	}
	for _, line := range strings.Split(string(data), "\n") {
		if !strings.HasPrefix(line, "cpu ") {
			continue
		}
		fields := strings.Fields(line)[1:] // user nice system idle iowait irq softirq steal guest guest_nice
		for i, f := range fields {
			n, perr := strconv.ParseUint(f, 10, 64)
			if perr != nil {
				continue
			}
			total += n
			if i == 3 || i == 4 { // idle + iowait
				idle += n
			}
		}
		return idle, total
	}
	return 0, 0
}

// MemTotal returns the host's total RAM in bytes from /proc/meminfo, or 0 if it
// cannot be read.
func MemTotal() int64 {
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 0
	}
	return parseMemTotal(string(data))
}

// parseMemTotal reads the "MemTotal: N kB" line of /proc/meminfo into bytes.
func parseMemTotal(data string) int64 {
	for _, line := range strings.Split(data, "\n") {
		if strings.HasPrefix(line, "MemTotal:") {
			f := strings.Fields(line)
			if len(f) >= 2 {
				if kb, e := strconv.ParseInt(f[1], 10, 64); e == nil {
					return kb * 1024
				}
			}
		}
	}
	return 0
}

// HybridPE returns the logical CPUs that are Intel hybrid P-cores and E-cores,
// from /sys/devices/cpu_core/cpus and /sys/devices/cpu_atom/cpus. Both are nil on
// a machine without that split.
func HybridPE() (p, e []int) {
	p = readCPUList("/sys/devices/cpu_core/cpus")
	e = readCPUList("/sys/devices/cpu_atom/cpus")
	if len(p) == 0 || len(e) == 0 {
		return nil, nil
	}
	return p, e
}

func readCPUList(path string) []int {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	return parseCPUList(string(data))
}

// parseCPUList expands a kernel cpulist such as "0-15,32,34-35", or returns nil
// if any part is malformed.
func parseCPUList(s string) []int {
	var out []int
	for _, part := range strings.Split(strings.TrimSpace(s), ",") {
		if part == "" {
			continue
		}
		if lo, hi, ok := strings.Cut(part, "-"); ok {
			a, e1 := strconv.Atoi(strings.TrimSpace(lo))
			b, e2 := strconv.Atoi(strings.TrimSpace(hi))
			if e1 != nil || e2 != nil || b < a || b-a > 4096 {
				return nil
			}
			for i := a; i <= b; i++ {
				out = append(out, i)
			}
			continue
		}
		n, err := strconv.Atoi(strings.TrimSpace(part))
		if err != nil {
			return nil
		}
		out = append(out, n)
	}
	return out
}

// Count returns the host's logical CPU count from /proc/cpuinfo.
// runtime.NumCPU follows the affinity mask and would miss the isolcpus cores
// reserved for VMs, so it is only the fallback.
func Count() int {
	if n := procCount(); n > 0 {
		return n
	}
	return runtime.NumCPU()
}

func procCount() int {
	data, err := os.ReadFile("/proc/cpuinfo")
	if err != nil {
		return 0
	}
	n := 0
	for _, line := range strings.Split(string(data), "\n") {
		if k, _, ok := strings.Cut(line, ":"); ok && strings.TrimSpace(k) == "processor" {
			n++
		}
	}
	return n
}

// CoreOf returns the physical core id of each logical CPU, so hyperthread
// siblings share an id. It is nil when /proc/cpuinfo is unreadable, disagrees
// with Count or has no topology fields.
func CoreOf() []int {
	data, err := os.ReadFile("/proc/cpuinfo")
	if err != nil {
		return nil
	}
	out, hasTopo := parseCoreOf(string(data))
	if !hasTopo || len(out) != Count() {
		return nil
	}
	return out
}

// parseCoreOf maps /proc/cpuinfo to a core group id per logical CPU, indexed by
// processor number rather than file order. The bool reports whether any block
// had physical id or core id fields.
func parseCoreOf(data string) ([]int, bool) {
	type entry struct {
		proc int
		key  string
	}
	var entries []entry
	hasTopo := false
	maxProc := -1
	for _, block := range strings.Split(data, "\n\n") {
		if strings.TrimSpace(block) == "" {
			continue
		}
		proc, gotProc := -1, false
		var phys, core string
		for _, line := range strings.Split(block, "\n") {
			k, v, ok := strings.Cut(line, ":")
			if !ok {
				continue
			}
			switch strings.TrimSpace(k) {
			case "processor":
				if n, e := strconv.Atoi(strings.TrimSpace(v)); e == nil {
					proc, gotProc = n, true
				}
			case "physical id":
				phys, hasTopo = strings.TrimSpace(v), true
			case "core id":
				core, hasTopo = strings.TrimSpace(v), true
			}
		}
		if !gotProc {
			continue
		}
		if proc > maxProc {
			maxProc = proc
		}
		entries = append(entries, entry{proc: proc, key: phys + ":" + core})
	}
	if len(entries) == 0 || maxProc < 0 {
		return nil, false
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].proc < entries[j].proc })
	out := make([]int, maxProc+1)
	for i := range out {
		out[i] = -1
	}
	groups := map[string]int{}
	for _, e := range entries {
		g, ok := groups[e.key]
		if !ok {
			g = len(groups)
			groups[e.key] = g
		}
		if e.proc >= 0 && e.proc < len(out) {
			out[e.proc] = g
		}
	}
	for _, v := range out {
		if v < 0 { // a gap in the processor numbering
			return nil, false
		}
	}
	return out, hasTopo
}
