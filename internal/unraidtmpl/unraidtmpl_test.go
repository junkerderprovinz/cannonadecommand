package unraidtmpl

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestApplyExtraParams_UpsertPreservesOthers(t *testing.T) {
	doc := `<?xml version="1.0"?>
<Container version="2">
  <Name>plex</Name>
  <Repository>linuxserver/plex</Repository>
  <ExtraParams>--restart=unless-stopped --memory=2G</ExtraParams>
</Container>`
	out, ok := applyExtraParams(doc, "plex", map[string]string{"--memory": "4294967296", "--cpus": "2"})
	if !ok {
		t.Fatal("should have matched <Name>plex")
	}
	// the prior --memory=2G is replaced, --restart is preserved, --cpus is added.
	if strings.Contains(out, "--memory=2G") {
		t.Fatalf("old --memory should be gone:\n%s", out)
	}
	for _, want := range []string{"--restart=unless-stopped", "--memory=4294967296", "--cpus=2"} {
		if !strings.Contains(out, want) {
			t.Fatalf("missing %q in:\n%s", want, out)
		}
	}
	// exactly one --memory flag (no duplicate)
	if strings.Count(out, "--memory=") != 1 {
		t.Fatalf("expected one --memory=, got %d:\n%s", strings.Count(out, "--memory="), out)
	}
}

func TestApplyExtraParams_MemoryNotConfusedWithSwap(t *testing.T) {
	doc := `<Container><Name>x</Name><ExtraParams>--memory-swap=8G --memory=2G</ExtraParams></Container>`
	out, _ := applyExtraParams(doc, "x", map[string]string{"--memory": "1073741824"})
	if !strings.Contains(out, "--memory-swap=8G") {
		t.Fatalf("--memory-swap must be preserved when replacing --memory:\n%s", out)
	}
	if strings.Count(out, "--memory=") != 1 || strings.Contains(out, "--memory=2G") {
		t.Fatalf("only --memory (not -swap) should be replaced:\n%s", out)
	}
}

func TestApplyExtraParams_SelfClosingReplaced(t *testing.T) {
	// Unraid commonly writes an empty <ExtraParams/>; it must be REPLACED, not left in
	// place with a second ExtraParams appended (which Unraid would then read as empty).
	doc := `<Container><Name>plex</Name><ExtraParams/></Container>`
	out, ok := applyExtraParams(doc, "plex", map[string]string{"--memory": "4294967296"})
	if !ok {
		t.Fatal("should match")
	}
	if strings.Contains(out, "<ExtraParams/>") {
		t.Fatalf("self-closing tag must be gone:\n%s", out)
	}
	if strings.Count(out, "ExtraParams") != 2 { // exactly one <ExtraParams> + one </ExtraParams>
		t.Fatalf("must NOT create a duplicate ExtraParams:\n%s", out)
	}
	if !strings.Contains(out, "<ExtraParams>--memory=4294967296</ExtraParams>") {
		t.Fatalf("self-closing must become a proper element:\n%s", out)
	}
}

func TestApplyExtraParams_WithAttributes(t *testing.T) {
	doc := `<Container><Name>x</Name><ExtraParams foo="bar">--restart=always</ExtraParams></Container>`
	out, ok := applyExtraParams(doc, "x", map[string]string{"--cpus": "2"})
	if !ok || !strings.Contains(out, "--cpus=2") || !strings.Contains(out, "--restart=always") {
		t.Fatalf("the attributes form should upsert into its inner text:\n%s", out)
	}
	if strings.Count(out, "ExtraParams") != 2 {
		t.Fatalf("must not duplicate ExtraParams:\n%s", out)
	}
}

func TestApplyExtraParams_CreatesWhenMissing(t *testing.T) {
	doc := "<Container>\n  <Name>db</Name>\n</Container>"
	out, ok := applyExtraParams(doc, "db", map[string]string{"--cpus": "1.5"})
	if !ok || !strings.Contains(out, "<ExtraParams>--cpus=1.5</ExtraParams>") {
		t.Fatalf("should create ExtraParams:\n%s", out)
	}
}

func TestApplyExtraParams_NameMismatch(t *testing.T) {
	doc := "<Container><Name>plex</Name></Container>"
	if out, ok := applyExtraParams(doc, "sonarr", map[string]string{"--cpus": "1"}); ok || out != doc {
		t.Fatal("a non-matching name must leave the doc untouched")
	}
}

func TestStripFlags(t *testing.T) {
	tests := []struct {
		name  string
		in    string
		flags []string
		want  string
	}{
		{"equals form", "--restart=always --memory=2g --net=host", []string{"--memory"}, "--restart=always --net=host"},
		{"space form eats value", "--restart=always --memory 2g --net=host", []string{"--memory"}, "--restart=always --net=host"},
		{"bare flag at end", "--restart=always --cpus", []string{"--cpus"}, "--restart=always"},
		{"bare flag then another flag keeps it", "--cpus --restart=always", []string{"--cpus"}, "--restart=always"},
		{"short -m space form", "-m 2g --net=host", []string{"-m"}, "--net=host"},
		{"short -m equals form", "-m=2g --net=host", []string{"-m"}, "--net=host"},
		{"short -m attached form", "-m2g --net=host", []string{"-m"}, "--net=host"},
		{"memory does not eat swap sibling", "--memory-swap=8g --memory=2g", []string{"--memory"}, "--memory-swap=8g"},
		{"quoted arg untouched", `--env FOO="--memory=2g -m 1g" --memory=4g`, []string{"--memory", "-m"}, `--env FOO="--memory=2g -m 1g"`},
		{"single-quoted arg untouched", `--label a='--cpus=9' --cpus=2`, []string{"--cpus"}, `--label a='--cpus=9'`},
		{"quoted value of stripped flag eaten", `--cpuset-cpus "0-3" --net=host`, []string{"--cpuset-cpus"}, "--net=host"},
		{"multiple flags one pass", "--cpus=2 --cpu-shares 512 --cpuset-cpus=0-3 --net=host", []string{"--cpus", "--cpuset-cpus", "--cpu-shares"}, "--net=host"},
		{"repeated flag all occurrences", "--memory=1g -v /a:/b --memory 2g", []string{"--memory"}, "-v /a:/b"},
		{"no-op keeps bytes identical", "  --restart=always   --net=host ", []string{"--memory", "--cpus"}, "  --restart=always   --net=host "},
		{"spacing collapses only at removal", "a   b  --cpus=1  c", []string{"--cpus"}, "a   b  c"},
		{"removal at string end trims gap", "--net=host --memory=2g", []string{"--memory"}, "--net=host"},
		{"empty input", "", []string{"--memory"}, ""},
		{"everything removed", "--memory=1g --cpus 2", []string{"--memory", "--cpus"}, ""},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := StripFlags(tc.in, tc.flags...); got != tc.want {
				t.Fatalf("StripFlags(%q, %v) = %q, want %q", tc.in, tc.flags, got, tc.want)
			}
		})
	}
}

// The dual-write transform must strip CONFLICTING template flags (short -m,
// --cpu-shares, --memory-reservation, space forms) even though CC never writes
// them itself — an empty kv value is remove-only.
func TestApplyExtraParams_StripsConflictingFlags(t *testing.T) {
	doc := `<Container><Name>x</Name><ExtraParams>--restart=always -m 1g --memory-reservation=512m --cpu-shares 512 --memory-swap=4g</ExtraParams></Container>`
	out, ok := applyExtraParams(doc, "x", map[string]string{
		"--memory": "1073741824", "-m": "", "--memory-swap": "", "--memory-reservation": "",
		"--cpus": "2", "--cpuset-cpus": "", "--cpu-shares": "",
	})
	if !ok {
		t.Fatal("should match")
	}
	for _, gone := range []string{"-m 1g", "-m=", "--memory-reservation", "--cpu-shares", "--memory-swap"} {
		if strings.Contains(out, gone) {
			t.Fatalf("conflicting flag %q must be stripped:\n%s", gone, out)
		}
	}
	for _, want := range []string{"--restart=always", "--memory=1073741824", "--cpus=2"} {
		if !strings.Contains(out, want) {
			t.Fatalf("missing %q in:\n%s", want, out)
		}
	}
}

func TestSetExtraParams_FileRoundTrip(t *testing.T) {
	dir := t.TempDir()
	f := filepath.Join(dir, "my-plex.xml")
	_ = os.WriteFile(f, []byte("<Container><Name>plex</Name><ExtraParams>--restart=always</ExtraParams></Container>"), 0o644)
	if err := SetExtraParams(dir, "plex", map[string]string{"--memory": "4294967296"}); err != nil {
		t.Fatalf("SetExtraParams: %v", err)
	}
	got, _ := os.ReadFile(f)
	if !strings.Contains(string(got), "--memory=4294967296") || !strings.Contains(string(got), "--restart=always") {
		t.Fatalf("file not updated correctly:\n%s", got)
	}
	if err := SetExtraParams(dir, "ghost", map[string]string{"--cpus": "1"}); err == nil {
		t.Fatal("a missing container template should return an error")
	}
}
