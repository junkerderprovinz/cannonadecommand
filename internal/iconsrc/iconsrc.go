// Package iconsrc resolves an app name (a container / VM / plugin name) to a
// better icon than whatever the image or template happened to ship, and caches
// the answer — and the SVG bytes — on the flash so a page load never waits on
// the network.
//
// Two public icon sets are consulted, in this order:
//
//  1. simple-icons/simple-icons (CC0-1.0) — a single-path MONOCHROME glyph.
//     Because it is a glyph by construction it can be ink-flattened to one flat
//     colour without losing anything, which is the crisp "badge ink" look.
//  2. homarr-labs/dashboard-icons (Apache-2.0) — a full-COLOUR app icon, far
//     better curated than the average shipped container icon, used as the source
//     for the luminance-preserving tint.
//
// THE CONTRACT THAT MATTERS: Resolve never blocks on the network. It answers
// from the cache and hands anything unknown to a small background worker pool;
// unknown names come back as KindPending and the caller simply renders the
// native icon this time round. A dead CDN, DNS failure or a captive portal
// therefore costs the Docker tab exactly nothing — the worst case is that
// icons stay native forever, which is where they started.
package iconsrc

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

// Result kinds handed back to the browser.
const (
	KindGlyph   = "glyph"   // monochrome single-path glyph: safe to ink-flatten
	KindColor   = "color"   // full-colour artwork: tint it, never flatten it
	KindNone    = "none"    // nothing found in either set; use the native icon
	KindPending = "pending" // queued for lookup; ask again later
)

// Source names, surfaced so the UI (and a support log) can say where an icon came from.
const (
	SrcSimple    = "simple-icons"
	SrcDashboard = "dashboard-icons"
)

// Cache lifetimes. Icon sets change slowly, so a hit is good for a month; a
// genuine 404 is re-checked weekly (new icons DO get added upstream); a
// transport error is retried in minutes, because that one is probably us.
const (
	ttlHit   = 30 * 24 * time.Hour
	ttlMiss  = 7 * 24 * time.Hour
	ttlError = 15 * time.Minute
)

// maxSVG caps a single cached icon. dashboard-icons holds a few very detailed
// pieces of artwork; anything past this is not worth shipping to a browser 50
// times over, and is treated as a miss.
const maxSVG = 128 << 10

// maxProbes bounds the HTTP requests one unknown name may cost, so a container
// called "a-b-c-d-e-f" can't fan out into a probe storm.
const maxProbes = 8

// entry is one cached lookup. It is written to index.json verbatim.
type entry struct {
	Kind   string `json:"kind"`
	Source string `json:"source,omitempty"`
	Slug   string `json:"slug,omitempty"`
	File   string `json:"file,omitempty"` // basename of the cached .svg next to index.json
	At     int64  `json:"at"`             // unix seconds of the last resolution attempt
	Err    bool   `json:"err,omitempty"`  // last attempt failed at the transport level, not a 404
}

func (e entry) fresh(now time.Time) bool {
	age := now.Sub(time.Unix(e.At, 0))
	switch {
	case e.Err:
		return age < ttlError
	case e.Kind == KindNone:
		return age < ttlMiss
	default:
		return age < ttlHit
	}
}

// Result is what Resolve hands back per name.
type Result struct {
	Kind   string `json:"kind"`
	Source string `json:"source,omitempty"`
	Slug   string `json:"slug,omitempty"`
}

// Resolver owns the cache directory and the background lookup workers.
type Resolver struct {
	dir    string
	client *http.Client

	// SimpleBase / DashBase are the URL prefixes a slug is appended to (plus
	// ".svg"). Overridden by the tests to point at an httptest server; in
	// production they are the jsdelivr CDN with a raw.githubusercontent fallback.
	SimpleBase []string
	DashBase   []string

	// Now is the clock, injectable so a test can age the cache without sleeping.
	Now func() time.Time

	mu       sync.Mutex
	ents     map[string]entry
	inflight map[string]bool
	dirty    bool

	queue  chan string
	closed chan struct{}
	wg     sync.WaitGroup
	once   sync.Once
}

// New opens (or creates) the cache under dir/icons and starts the workers.
// A dir that cannot be created is not fatal: the resolver then runs purely
// in memory, which still spares the CDN and still never blocks a render.
func New(dir string) *Resolver {
	r := &Resolver{
		dir: filepath.Join(dir, "icons"),
		client: &http.Client{Timeout: 8 * time.Second, CheckRedirect: func(_ *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return http.ErrUseLastResponse
			}
			return nil
		}},
		SimpleBase: []string{
			"https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/",
			"https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/",
		},
		DashBase: []string{
			"https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/",
			"https://raw.githubusercontent.com/homarr-labs/dashboard-icons/main/svg/",
		},
		Now:      time.Now,
		ents:     map[string]entry{},
		inflight: map[string]bool{},
		queue:    make(chan string, 256),
		closed:   make(chan struct{}),
	}
	_ = os.MkdirAll(r.dir, 0o755)
	r.load()
	for i := 0; i < 3; i++ { // three workers: enough to warm 50 names quickly, gentle on the CDN
		r.wg.Add(1)
		go r.worker()
	}
	return r
}

// Close stops the workers and flushes the index.
func (r *Resolver) Close() {
	r.once.Do(func() {
		close(r.closed)
		r.wg.Wait()
		r.save()
	})
}

// Resolve answers for every name from the cache, queueing anything unknown or
// stale for a background lookup. It performs NO network I/O and never blocks.
func (r *Resolver) Resolve(names []string) map[string]Result {
	out := make(map[string]Result, len(names))
	now := r.Now()
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, raw := range names {
		key := normalise(raw)
		if key == "" {
			continue
		}
		e, ok := r.ents[key]
		if ok && e.fresh(now) {
			out[raw] = Result{Kind: e.Kind, Source: e.Source, Slug: e.Slug}
			continue
		}
		// Stale but present: keep serving the old answer while the refresh runs,
		// so a monthly re-check never flickers an icon back to native.
		if ok && e.Kind != KindNone && !e.Err {
			out[raw] = Result{Kind: e.Kind, Source: e.Source, Slug: e.Slug}
		} else {
			out[raw] = Result{Kind: KindPending}
		}
		r.enqueue(key)
	}
	return out
}

// enqueue must be called with the lock held. A full queue simply drops the name
// — the next Resolve will offer it again.
func (r *Resolver) enqueue(key string) {
	if r.inflight[key] {
		return
	}
	select {
	case r.queue <- key:
		r.inflight[key] = true
	default:
	}
}

// SVG returns the cached artwork for a name, if any.
func (r *Resolver) SVG(name string) ([]byte, string, bool) {
	key := normalise(name)
	r.mu.Lock()
	e, ok := r.ents[key]
	r.mu.Unlock()
	if !ok || e.File == "" {
		return nil, "", false
	}
	b, err := os.ReadFile(filepath.Join(r.dir, e.File))
	if err != nil {
		return nil, "", false
	}
	return b, e.Kind, true
}

// Stats reports the cache's shape for the diagnostics card.
func (r *Resolver) Stats() map[string]int {
	r.mu.Lock()
	defer r.mu.Unlock()
	s := map[string]int{"total": len(r.ents), "glyph": 0, "color": 0, "none": 0, "error": 0}
	for _, e := range r.ents {
		if e.Err {
			s["error"]++
			continue
		}
		switch e.Kind {
		case KindGlyph:
			s["glyph"]++
		case KindColor:
			s["color"]++
		default:
			s["none"]++
		}
	}
	return s
}

func (r *Resolver) worker() {
	defer r.wg.Done()
	for {
		select {
		case <-r.closed:
			return
		case key := <-r.queue:
			r.lookup(key)
			r.mu.Lock()
			delete(r.inflight, key)
			dirty := r.dirty
			r.mu.Unlock()
			if dirty {
				r.save()
			}
		}
	}
}

// lookup probes both icon sets for one already-normalised name and records the
// outcome. Every exit path writes an entry, so a name is never probed twice in
// quick succession — including the failure paths.
func (r *Resolver) lookup(key string) {
	now := r.Now().Unix()
	probes := 0
	transportErr := false

	try := func(bases []string, slug, source, kind string) (entry, bool) {
		if slug == "" || probes >= maxProbes {
			return entry{}, false
		}
		probes++
		for _, base := range bases {
			body, status, err := r.get(base + slug + ".svg")
			if err != nil {
				transportErr = true
				continue // the other host may still answer
			}
			if status == http.StatusNotFound {
				return entry{}, false // an authoritative "no such icon": don't ask the mirror
			}
			if status != http.StatusOK || !looksLikeSVG(body) {
				continue
			}
			file, werr := r.store(body)
			if werr != nil {
				file = ""
			}
			return entry{Kind: kind, Source: source, Slug: slug, File: file, At: now}, true
		}
		return entry{}, false
	}

	for _, slug := range simpleSlugs(key) {
		if e, ok := try(r.SimpleBase, slug, SrcSimple, KindGlyph); ok {
			r.put(key, e)
			return
		}
	}
	for _, slug := range dashSlugs(key) {
		if e, ok := try(r.DashBase, slug, SrcDashboard, KindColor); ok {
			r.put(key, e)
			return
		}
	}
	// Nothing found. A transport error is recorded as an ERROR (retried in
	// minutes) rather than a miss (retried weekly), so a flaky moment can't
	// blackhole an icon that really does exist upstream.
	r.put(key, entry{Kind: KindNone, At: now, Err: transportErr})
}

func (r *Resolver) get(url string) ([]byte, int, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Accept", "image/svg+xml,*/*")
	req.Header.Set("User-Agent", "CannonadeCommand-icons/1")
	resp, err := r.client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4<<10))
		return nil, resp.StatusCode, nil
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxSVG+1))
	if err != nil {
		return nil, 0, err
	}
	if len(body) > maxSVG {
		return nil, http.StatusRequestEntityTooLarge, nil
	}
	return body, http.StatusOK, nil
}

// store writes the artwork content-addressed, so two names resolving to the same
// slug share one file and a re-fetch of unchanged bytes is a no-op.
func (r *Resolver) store(body []byte) (string, error) {
	sum := sha1.Sum(body)
	name := hex.EncodeToString(sum[:]) + ".svg"
	path := filepath.Join(r.dir, name)
	if _, err := os.Stat(path); err == nil {
		return name, nil
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, body, 0o644); err != nil {
		return "", err
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return "", err
	}
	return name, nil
}

func (r *Resolver) put(key string, e entry) {
	r.mu.Lock()
	r.ents[key] = e
	r.dirty = true
	r.mu.Unlock()
}

func (r *Resolver) load() {
	b, err := os.ReadFile(filepath.Join(r.dir, "index.json"))
	if err != nil {
		return
	}
	var m map[string]entry
	if json.Unmarshal(b, &m) != nil || m == nil {
		return
	}
	r.mu.Lock()
	r.ents = m
	r.mu.Unlock()
}

func (r *Resolver) save() {
	r.mu.Lock()
	if !r.dirty {
		r.mu.Unlock()
		return
	}
	b, err := json.Marshal(r.ents)
	r.dirty = false
	r.mu.Unlock()
	if err != nil {
		return
	}
	path := filepath.Join(r.dir, "index.json")
	tmp := path + ".tmp"
	if os.WriteFile(tmp, b, 0o644) != nil {
		return
	}
	if os.Rename(tmp, path) != nil {
		_ = os.Remove(tmp)
	}
}

// ── name → slug ─────────────────────────────────────────────────────────────

// nonSlug matches every run of characters that is not a lowercase alphanumeric;
// it both splits a name into tokens and scrubs a token down to a slug.
var nonSlug = regexp.MustCompile(`[^a-z0-9]+`)

// vendorPrefixes are the image-maintainer prefixes Unraid container names carry
// so often that leaving them in would miss nearly every glyph ("binhex-plex").
var vendorPrefixes = []string{"binhex-", "binhex", "linuxserver-", "lsio-", "ls-", "official-", "docker-", "hotio-"}

// normalise is the cache key: lowercase, trimmed, vendor prefix removed.
func normalise(name string) string {
	s := strings.ToLower(strings.TrimSpace(name))
	if s == "" {
		return ""
	}
	for _, p := range vendorPrefixes {
		if strings.HasPrefix(s, p) && len(s) > len(p)+1 {
			s = s[len(p):]
			break
		}
	}
	return strings.Trim(s, "-_. ")
}

// variants yields the name, then the name with trailing tokens progressively
// dropped ("plex-media-server" → "plex-media" → "plex"), which is how a
// container called "Nextcloud-AIO" or "BombVault-Test" still finds its icon.
func variants(key string) []string {
	toks := nonSlug.Split(key, -1)
	clean := toks[:0]
	for _, t := range toks {
		if t != "" {
			clean = append(clean, t)
		}
	}
	if len(clean) == 0 {
		return nil
	}
	out := make([]string, 0, 4)
	for n := len(clean); n >= 1 && len(out) < 4; n-- {
		out = append(out, strings.Join(clean[:n], "-"))
	}
	return out
}

// simpleSlugs are Simple Icons' slugs: lowercase alphanumerics, nothing else.
func simpleSlugs(key string) []string {
	seen := map[string]bool{}
	var out []string
	for _, v := range variants(key) {
		s := nonSlug.ReplaceAllString(v, "")
		if len(s) < 2 || seen[s] {
			continue
		}
		seen[s] = true
		out = append(out, s)
	}
	return out
}

// dashSlugs are dashboard-icons' slugs: kebab-case.
func dashSlugs(key string) []string {
	seen := map[string]bool{}
	var out []string
	for _, v := range variants(key) {
		s := strings.Trim(nonSlug.ReplaceAllString(v, "-"), "-")
		if len(s) < 2 || seen[s] {
			continue
		}
		seen[s] = true
		out = append(out, s)
	}
	return out
}

// looksLikeSVG rejects a 200 that is not actually artwork (a CDN error page, an
// HTML redirect stub), which would otherwise be cached and served as an icon.
func looksLikeSVG(b []byte) bool {
	head := strings.ToLower(strings.TrimSpace(string(b[:min(len(b), 512)])))
	if strings.HasPrefix(head, "<?xml") {
		return strings.Contains(head, "<svg")
	}
	return strings.HasPrefix(head, "<svg")
}
