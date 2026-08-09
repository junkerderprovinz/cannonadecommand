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
