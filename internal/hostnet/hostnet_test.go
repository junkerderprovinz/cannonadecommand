package hostnet

import "testing"

func TestParseDefaultIface(t *testing.T) {
	// real /proc/net/route: header, then default route (dest 00000000) on eth0, then a
	// subnet route (non-zero dest) that must NOT be picked.
	route := "Iface\tDestination\tGateway\tFlags\tRefCnt\tUse\tMetric\tMask\n" +
		"br0\t00000000\t0102A8C0\t0003\t0\t0\t0\t00000000\n" +
		"br0\t0002A8C0\t00000000\t0001\t0\t0\t0\t00FFFFFF\n"
	if got := parseDefaultIface(route); got != "br0" {
		t.Fatalf("default iface = %q, want br0", got)
	}
	// no default route → empty
	if got := parseDefaultIface("Iface\tDestination\n" + "eth0\t0002A8C0\n"); got != "" {
		t.Fatalf("no-default = %q, want empty", got)
	}
	if got := parseDefaultIface(""); got != "" {
		t.Fatalf("empty input = %q, want empty", got)
	}
}

// The island reported "a few Kbit" during a 100 Mbit transfer because the counters came
// from the default-route BRIDGE, which only sees host-terminated traffic. These figures
// are the real ones measured on the live box (eth0 526.9 GB vs br0 3.1 GB) and pin the
// rule: sum the physical NICs, never a bridge, and never a VLAN child on top of one.
func TestSumPhysical(t *testing.T) {
	dev := "Inter-|   Receive                                                |  Transmit\n" +
		" face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed\n" +
		"    lo: 100 1 0 0 0 0 0 0 200 2 0 0 0 0 0 0\n" +
		"  eth0: 526909322213 10 0 0 0 0 0 0 225368183653 5 0 0 0 0 0 0\n" +
		"eth0.20: 504924029598 10 0 0 0 0 0 0 171322925565 5 0 0 0 0 0 0\n" +
		"   br0: 3075104700 10 0 0 0 0 0 0 53875600401 5 0 0 0 0 0 0\n" +
		"br0.20: 504921626538 10 0 0 0 0 0 0 171322924839 5 0 0 0 0 0 0\n" +
		"shim-br0: 3141176203 10 0 0 0 0 0 0 53875086588 5 0 0 0 0 0 0\n"
	rx, tx, found := sumPhysical(dev)
	if !found {
		t.Fatal("found = false, want true (eth0 is present)")
	}
	// exactly eth0 — the VLAN child, both bridges and the shim must not be added
	if rx != 526909322213 || tx != 225368183653 {
		t.Fatalf("sum = (%d,%d), want eth0 only (526909322213,225368183653)", rx, tx)
	}
	// two physical NICs add up
	two := "  eth0: 10 1 0 0 0 0 0 0 20 2 0 0 0 0 0 0\n" +
		"  eth1: 5 1 0 0 0 0 0 0 7 2 0 0 0 0 0 0\n"
	if rx, tx, _ := sumPhysical(two); rx != 15 || tx != 27 {
		t.Fatalf("two NICs = (%d,%d), want (15,27)", rx, tx)
	}
	// no eth* at all → found=false so Rate() falls back to the default-route interface
	if _, _, found := sumPhysical("  br0: 1 2 3 4 5 6 7 8 9 10\n"); found {
		t.Fatal("found = true for a host with no eth*, want false")
	}
}

func TestParseIfaceBytes(t *testing.T) {
	// /proc/net/dev: rx bytes = 1st field after colon, tx bytes = 9th (index 8).
	dev := "Inter-|   Receive                                                |  Transmit\n" +
		" face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed\n" +
		"    lo: 100 1 0 0 0 0 0 0 200 2 0 0 0 0 0 0\n" +
		"  br0: 123456 10 0 0 0 0 0 0 7890 5 0 0 0 0 0 0\n"
	rx, tx := parseIfaceBytes(dev, "br0")
	if rx != 123456 || tx != 7890 {
		t.Fatalf("br0 = (%d,%d), want (123456,7890)", rx, tx)
	}
	// unknown iface → (0,0)
	if rx, tx := parseIfaceBytes(dev, "eth9"); rx != 0 || tx != 0 {
		t.Fatalf("unknown = (%d,%d), want (0,0)", rx, tx)
	}
	// truncated row → (0,0), no panic
	if rx, tx := parseIfaceBytes("  br0: 1 2 3\n", "br0"); rx != 0 || tx != 0 {
		t.Fatalf("short row = (%d,%d), want (0,0)", rx, tx)
	}
}
