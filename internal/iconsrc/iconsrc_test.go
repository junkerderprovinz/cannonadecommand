package iconsrc

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

const glyphSVG = `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Plex</title><path d="M0 0h24v24H0z"/></svg>`
const colorSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect fill="#282a2d" width="512" height="512"/></svg>`

// newTest builds a resolver pointed at a stub instead of the real CDNs, with the
// background workers running as in production.
func newTest(t *testing.T, simple, dash string) *Resolver {
	t.Helper()
	r := New(t.TempDir())
	r.SimpleBase = []string{simple}
	r.DashBase = []string{dash}
	t.Cleanup(r.Close)
	return r
}

// waitFor polls until cond holds or the deadline passes. The lookups run on
// background workers, so the test WAITS on the condition rather than sleeping a
// guessed interval (the async-cleanup race this repo has been bitten by before).
func waitFor(t *testing.T, what string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for %s", what)
}

func TestResolveNeverBlocksAndBackfills(t *testing.T) {
	var hits int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/simple/plex.svg") {
			hits++
			_, _ = w.Write([]byte(glyphSVG))
			return
		}
		http.NotFound(w, r)
	}))
	defer srv.Close()
	r := newTest(t, srv.URL+"/simple/", srv.URL+"/dash/")

	// FIRST call must answer instantly from an empty cache: pending, no network.
	start := time.Now()
	got := r.Resolve([]string{"Plex"})
	if d := time.Since(start); d > 250*time.Millisecond {
		t.Fatalf("Resolve blocked for %v; it must never touch the network on the request path", d)
	}
	if got["Plex"].Kind != KindPending {
		t.Fatalf("first Resolve = %q, want %q", got["Plex"].Kind, KindPending)
	}

	waitFor(t, "the background lookup to land", func() bool {
		return r.Resolve([]string{"Plex"})["Plex"].Kind == KindGlyph
	})
	res := r.Resolve([]string{"Plex"})["Plex"]
	if res.Source != SrcSimple || res.Slug != "plex" {
		t.Fatalf("resolved = %+v, want simple-icons/plex", res)
	}
	body, kind, ok := r.SVG("Plex")
	if !ok || kind != KindGlyph || string(body) != glyphSVG {
		t.Fatalf("SVG() = (%q, %v, %v), want the cached glyph", string(body), kind, ok)
	}
	// Repeated calls are cache reads, not fetches.
	for i := 0; i < 5; i++ {
		r.Resolve([]string{"Plex"})
	}
	if hits != 1 {
		t.Fatalf("fetched %d times, want exactly 1 (the cache must absorb every repeat)", hits)
	}
}

func TestSimpleIconsWinsOverDashboardIcons(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/simple/immich.svg"):
			_, _ = w.Write([]byte(glyphSVG))
		case strings.HasSuffix(r.URL.Path, "/dash/immich.svg"):
			_, _ = w.Write([]byte(colorSVG))
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()
	r := newTest(t, srv.URL+"/simple/", srv.URL+"/dash/")
	r.Resolve([]string{"Immich"})
	waitFor(t, "immich", func() bool { return r.Resolve([]string{"Immich"})["Immich"].Kind != KindPending })
	if got := r.Resolve([]string{"Immich"})["Immich"]; got.Kind != KindGlyph || got.Source != SrcSimple {
		t.Fatalf("got %+v, want the monochrome glyph to win over the colour icon", got)
	}
}

func TestDashboardIconsFallback(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/dash/navidrome.svg") {
			_, _ = w.Write([]byte(colorSVG))
			return
		}
		http.NotFound(w, r) // simple-icons has no navidrome, exactly as upstream
	}))
	defer srv.Close()
	r := newTest(t, srv.URL+"/simple/", srv.URL+"/dash/")
	r.Resolve([]string{"Navidrome"})
	waitFor(t, "navidrome", func() bool { return r.Resolve([]string{"Navidrome"})["Navidrome"].Kind != KindPending })
	if got := r.Resolve([]string{"Navidrome"})["Navidrome"]; got.Kind != KindColor || got.Source != SrcDashboard {
		t.Fatalf("got %+v, want the dashboard-icons colour icon", got)
	}
}

func TestNoMatchAnywhereIsNone(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "not found", http.StatusNotFound)
	}))
	defer srv.Close()
	r := newTest(t, srv.URL+"/simple/", srv.URL+"/dash/")
	r.Resolve([]string{"TrickWork"})
	waitFor(t, "trickwork", func() bool { return r.Resolve([]string{"TrickWork"})["TrickWork"].Kind == KindNone })
	if _, _, ok := r.SVG("TrickWork"); ok {
		t.Fatal("a name with no match anywhere must have no cached artwork")
	}
}

// A dead network is the case that must NOT break or slow the Docker tab, and
// must not be cached as a week-long miss either — the icon probably does exist.
func TestUnreachableHostDegradesGracefully(t *testing.T) {
	r := newTest(t, "http://127.0.0.1:1/simple/", "http://127.0.0.1:1/dash/")
	start := time.Now()
	got := r.Resolve([]string{"Plex"})
	if d := time.Since(start); d > 250*time.Millisecond {
		t.Fatalf("Resolve blocked for %v with the CDN unreachable", d)
	}
	if got["Plex"].Kind != KindPending {
		t.Fatalf("got %q, want %q", got["Plex"].Kind, KindPending)
	}
	waitFor(t, "the failed lookup to be recorded", func() bool {
		r.mu.Lock()
		defer r.mu.Unlock()
		e, ok := r.ents["plex"]
		return ok && e.Err
	})
	// Recorded as an ERROR, so it is retried in minutes rather than blackholed
	// for the full miss TTL.
	r.mu.Lock()
	e := r.ents["plex"]
	r.mu.Unlock()
	if e.Kind != KindNone || !e.Err {
		t.Fatalf("entry = %+v, want a short-lived error entry", e)
	}
	if e.fresh(time.Unix(e.At, 0).Add(ttlError + time.Second)) {
		t.Fatal("an error entry must expire after the short error TTL")
	}
	if !e.fresh(time.Unix(e.At, 0).Add(time.Minute)) {
		t.Fatal("an error entry must stay fresh for a few minutes (no probe storm)")
	}
	// And the UI still gets a usable answer, immediately.
	if r.Resolve([]string{"Plex"})["Plex"].Kind == "" {
		t.Fatal("Resolve must always answer with a kind, even when nothing works")
	}
}

func TestCachePersistsAcrossRestart(t *testing.T) {
	dir := t.TempDir()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/simple/plex.svg") {
			_, _ = w.Write([]byte(glyphSVG))
			return
		}
		http.NotFound(w, r)
	}))
	defer srv.Close()

	first := New(dir)
	first.SimpleBase = []string{srv.URL + "/simple/"}
	first.DashBase = []string{srv.URL + "/dash/"}
	first.Resolve([]string{"plex"})
	waitFor(t, "the first resolver to cache plex", func() bool { return first.Resolve([]string{"plex"})["plex"].Kind == KindGlyph })
	first.Close()

	if _, err := os.Stat(filepath.Join(dir, "icons", "index.json")); err != nil {
		t.Fatalf("index.json was not written: %v", err)
	}
	// A brand-new resolver, with the stub torn down, must still answer from disk.
	srv.Close()
	second := New(dir)
	defer second.Close()
	if got := second.Resolve([]string{"plex"})["plex"]; got.Kind != KindGlyph {
		t.Fatalf("after restart got %+v, want the cached glyph with no network at all", got)
	}
	if _, _, ok := second.SVG("plex"); !ok {
		t.Fatal("the cached SVG bytes must survive a restart")
	}
}

func TestOversizedAndNonSVGBodiesAreRejected(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.Contains(r.URL.Path, "huge"):
			_, _ = w.Write(make([]byte, maxSVG+1024))
		case strings.Contains(r.URL.Path, "html"):
			_, _ = w.Write([]byte("<!doctype html><html><body>nope</body></html>"))
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()
	r := newTest(t, srv.URL+"/simple/", srv.URL+"/dash/")
	for _, n := range []string{"huge", "html"} {
		r.Resolve([]string{n})
		name := n
		waitFor(t, name, func() bool { return r.Resolve([]string{name})[name].Kind == KindNone })
		if _, _, ok := r.SVG(name); ok {
			t.Fatalf("%s: a rejected body must not be cached as artwork", name)
		}
	}
}

func TestSlugCandidates(t *testing.T) {
	cases := []struct {
		name       string
		wantSimple []string
		wantDash   []string
	}{
		{"Plex", []string{"plex"}, []string{"plex"}},
		{"binhex-plex", []string{"plex"}, []string{"plex"}},
		{"BombVault-Test", []string{"bombvaulttest", "bombvault"}, []string{"bombvault-test", "bombvault"}},
		{"Stirling-PDF", []string{"stirlingpdf", "stirling"}, []string{"stirling-pdf", "stirling"}},
		{"Omada-Controller", []string{"omadacontroller", "omada"}, []string{"omada-controller", "omada"}},
	}
	for _, c := range cases {
		key := normalise(c.name)
		if got := simpleSlugs(key); !eq(got, c.wantSimple) {
			t.Errorf("simpleSlugs(%q) = %v, want %v", c.name, got, c.wantSimple)
		}
		if got := dashSlugs(key); !eq(got, c.wantDash) {
			t.Errorf("dashSlugs(%q) = %v, want %v", c.name, got, c.wantDash)
		}
	}
}

func TestNormaliseIsTheCacheKey(t *testing.T) {
	for _, in := range []string{"Plex", "plex", "  PLEX  ", "binhex-plex", "linuxserver-plex"} {
		if got := normalise(in); got != "plex" {
			t.Errorf("normalise(%q) = %q, want plex", in, got)
		}
	}
	if normalise("   ") != "" {
		t.Error("a blank name must normalise to the empty key and be skipped")
	}
}

func TestBlankNamesAreSkipped(t *testing.T) {
	r := newTest(t, "http://127.0.0.1:1/s/", "http://127.0.0.1:1/d/")
	got := r.Resolve([]string{"", "   "})
	if len(got) != 0 {
		t.Fatalf("got %v, want no entries for blank names", got)
	}
}

func TestProbeCountIsBounded(t *testing.T) {
	var probes int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		probes++
		http.NotFound(w, nil)
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()
	r := newTest(t, srv.URL+"/s/", srv.URL+"/d/")
	r.Resolve([]string{"a-b-c-d-e-f-g-h-i-j"})
	waitFor(t, "the long name", func() bool { return r.Resolve([]string{"a-b-c-d-e-f-g-h-i-j"})["a-b-c-d-e-f-g-h-i-j"].Kind == KindNone })
	if probes > maxProbes {
		t.Fatalf("made %d probes for one name, want at most %d", probes, maxProbes)
	}
}

func eq(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
