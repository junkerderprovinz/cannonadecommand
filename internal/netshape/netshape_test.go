package netshape

import (
	"reflect"
	"strings"
	"testing"
)

// UPLOAD is now netfilter-policed (this kernel has no sch_tbf), on its OWN hashlimit table +
// chain — never a tc/tbf qdisc.
func TestUlRuleSpec(t *testing.T) {
	got := strings.Join(ulRuleSpec(10000), " ")
	for _, want := range []string{"-m hashlimit", "--hashlimit-above", "--hashlimit-name ccul", "-j DROP"} {
		if !strings.Contains(got, want) {
			t.Fatalf("ulRuleSpec missing %q: %q", want, got)
		}
	}
	if strings.Contains(got, "tbf") || strings.Contains(got, "tc ") || strings.Contains(got, "qdisc") {
		t.Fatalf("upload must NOT use a tc/tbf qdisc (unavailable on the kernel): %q", got)
	}
}

// Apply must NEVER create an ingress qdisc (the sch_ingress kernel-crash trigger). With a
// bad pid it returns an error without running anything; the important guarantee — no
// `handle ffff: ingress` command exists in the package — still holds: download limiting
// exists again, but ONLY as netfilter policing (iptables hashlimit) — see the qdisc-free
// guard below.
func TestApply_NoIngress_BadPID(t *testing.T) {
	if err := Apply("eth0", 0, 5000, 9000); err == nil {
		t.Fatalf("Apply with pid 0 should error")
	}
}

func TestDlRuleSpec(t *testing.T) {
	got := dlRuleSpec(8000) // 8000 kbit/s → 1,000,000 B/s; burst = 2s of rate; NATIVE byte unit
	want := []string{"-m", "hashlimit", "--hashlimit-above", "1000000b/s", "--hashlimit-burst", "2000000b", "--hashlimit-name", "ccdl", "-j", "DROP"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("dlRuleSpec =\n %v\nwant\n %v", got, want)
	}
}

func TestDlRateAndBurstFloors(t *testing.T) {
	if r := dlRateBytes(0); r != 125 { // tiny rate must still pass a positive byte rate
		t.Fatalf("dlRateBytes(0) = %d, want 125", r)
	}
	if b := dlBurstBytes(100); b != 2*dlRateBytes(100) { // legacy iptables demands ~1.5x rate
		t.Fatalf("dlBurstBytes(100) = %d, want %d (== 2x rate)", b, 2*dlRateBytes(100))
	}
}

func TestIptArgs(t *testing.T) {
	got := iptArgs(4242, "-F", dlChain)
	want := []string{"-t", "4242", "-n", "iptables", "-w", "-F", "CC_DL"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("iptArgs = %v, want %v", got, want)
	}
}

// No byte-rate compensation is applied any more: measured on Unraid 7.3.2 (kernel
// 6.18.38, iptables v1.8.13 legacy) that a byte-mode hashlimit enforces the
// configured byte rate correctly, so the old x8 (keyed off the iptables version)
// over-limited downloads ~8x on current kernels.
func TestRateFactorNoCompensation(t *testing.T) {
	if f := rateFactor(); f != 1 {
		t.Fatalf("rateFactor() = %d, want 1 (no compensation)", f)
	}
	if got := strings.Join(dlRuleSpec(8000), " "); !strings.Contains(got, "1000000b/s") {
		t.Fatalf("rule must use the un-multiplied byte rate, got %q", got)
	}
}

// The download path must never emit a tc command at all — and in particular no ingress
// qdisc (`ffff:`/"ingress"). This guards the kernel-crash trigger out of existence.
func TestDownloadPathIsQdiscFree(t *testing.T) {
	all := strings.Join(iptArgs(1, dlRuleSpec(5000)...), " ")
	if strings.Contains(all, "tc ") || strings.Contains(all, "ingress") || strings.Contains(all, "ffff:") {
		t.Fatalf("download policing must be pure netfilter, got %q", all)
	}
	if !strings.Contains(all, "iptables") || !strings.Contains(all, "hashlimit") {
		t.Fatalf("download policing should use iptables hashlimit, got %q", all)
	}
}
