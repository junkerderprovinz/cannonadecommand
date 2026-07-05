package netshape

import (
	"reflect"
	"strings"
	"testing"
)

func TestEgressArgs_Set(t *testing.T) {
	got := egressArgs("", 4242, 10000) // blank iface → DefaultIface (eth0)
	want := []string{"-t", "4242", "-n", "tc", "qdisc", "replace", "dev", "eth0", "root", "tbf",
		"rate", "10000kbit", "burst", "125000", "latency", "50ms"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("egressArgs set =\n %v\nwant\n %v", got, want)
	}
}

func TestEgressArgs_CustomIface(t *testing.T) {
	got := egressArgs("br0.20", 4242, 10000)
	want := []string{"-t", "4242", "-n", "tc", "qdisc", "replace", "dev", "br0.20", "root", "tbf",
		"rate", "10000kbit", "burst", "125000", "latency", "50ms"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("egressArgs custom iface =\n %v\nwant\n %v", got, want)
	}
}

func TestEgressArgs_BurstFloor(t *testing.T) {
	got := strings.Join(egressArgs("eth0", 100, 100), " ") // tiny rate → burst floored at 4000
	if !strings.Contains(got, "burst 4000") {
		t.Fatalf("small rate should floor burst at 4000, got %q", got)
	}
}

func TestEgressArgs_Clear(t *testing.T) {
	got := egressArgs("eth0", 4242, 0)
	want := []string{"-t", "4242", "-n", "tc", "qdisc", "del", "dev", "eth0", "root"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("egressArgs clear = %v, want %v", got, want)
	}
}

// Apply must NEVER create an ingress qdisc (the sch_ingress kernel-crash trigger). With a
// bad pid it returns an error without running anything; the important guarantee — no
// `handle ffff: ingress` command exists in the package — is enforced by there being no
// ingress code left to call.
func TestApply_NoIngress_BadPID(t *testing.T) {
	if err := Apply("eth0", 0, 5000, 9000); err == nil {
		t.Fatalf("Apply with pid 0 should error")
	}
}
