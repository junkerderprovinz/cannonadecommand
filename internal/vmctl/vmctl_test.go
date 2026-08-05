package vmctl

import (
	"context"
	"strings"
	"testing"
)

func TestParsers(t *testing.T) {
	if got := kibFieldToMiB("6291456 KiB"); got != 6144 {
		t.Errorf("kibFieldToMiB = %d, want 6144", got)
	}
	if got := firstVcpuAffinity(" VCPU   CPU Affinity\n----------------------\n 0      6-15\n 1      7"); got != "6-15" {
		t.Errorf("firstVcpuAffinity = %q, want 6-15", got)
	}
	if q, p := schedQuotaPeriod("cpu_shares     : 0\nvcpu_period    : 100000\nvcpu_quota     : 50000"); q != 50000 || p != 100000 {
		t.Errorf("schedQuotaPeriod = %d/%d, want 50000/100000", q, p)
	}
	if got := firstMAC(" Interface   Type     Source   Model        MAC\n---------\n -           bridge   br0      virtio-net   52:54:00:e4:52:5a"); got != "52:54:00:e4:52:5a" {
		t.Errorf("firstMAC = %q", got)
	}
	if got := hName("d", "vnet3"); got != "ccvmd3" {
		t.Errorf("hName(d,vnet3) = %q, want ccvmd3", got)
	}
}

// fakeVirsh answers the Get() probes with canned output and records every call so an
// Apply can be asserted on the exact virsh argv it generates.
func fakeVirsh(calls *[][]string, state string) runner {
	return func(_ context.Context, args ...string) (string, error) {
		*calls = append(*calls, args)
		switch {
		case args[0] == "dominfo":
			return "State:          " + state + "\nCPU(s):         2\nMax memory:     4194304 KiB\nUsed memory:    4194304 KiB", nil
		case args[0] == "vcpupin":
			return " VCPU   CPU Affinity\n 0      0-7\n 1      0-7", nil
		case args[0] == "schedinfo":
			return "vcpu_period    : 0\nvcpu_quota     : 0", nil
		case args[0] == "domiflist":
			return " Interface Type Source Model MAC\n - bridge br0 virtio-net 52:54:00:aa:bb:cc", nil
		case args[0] == "domiftune":
			return "inbound.average: 0\noutbound.average: 0", nil
		}
		return "", nil
	}
}

func TestApply_RunningSetsLiveConfigCap(t *testing.T) {
	var calls [][]string
	c := &Controller{run: fakeVirsh(&calls, "running")}
	cap := 50
	if err := c.Apply(context.Background(), "UbuntuTest", Limits{CPUCap: &cap}); err != nil {
		t.Fatalf("Apply: %v", err)
	}
	var sched []string
	for _, a := range calls {
		if a[0] == "schedinfo" && len(a) > 2 {
			sched = a
		}
	}
	// cap 50% of one core -> quota 50000 at the 100000 period, applied to both --config + --live.
	if sched == nil || !contains(sched, "vcpu_quota=50000") || !contains(sched, "--live") || !contains(sched, "--config") {
		t.Fatalf("schedinfo argv wrong: %v", sched)
	}
}

func TestApply_ShutOffOmitsLive(t *testing.T) {
	var calls [][]string
	c := &Controller{run: fakeVirsh(&calls, "shut off")}
	mem := 2048
	if err := c.Apply(context.Background(), "Linux", Limits{MemMiB: &mem}); err != nil {
		t.Fatalf("Apply: %v", err)
	}
	var setmem []string
	for _, a := range calls {
		if a[0] == "setmem" {
			setmem = a
		}
	}
	if setmem == nil || contains(setmem, "--live") || !contains(setmem, "--config") || !contains(setmem, "2097152KiB") {
		t.Fatalf("setmem argv wrong (should be --config only): %v", setmem)
	}
}

func contains(s []string, want string) bool {
	for _, v := range s {
		if v == want || strings.Contains(v, want) {
			return true
		}
	}
	return false
}
