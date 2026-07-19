// Package unraidtmpl mirrors a live CPU/RAM/cpuset limit into the container's Unraid
// template XML (<ExtraParams>), so a limit set through the plugin survives an Unraid
// "Apply" (which recreates the container from that template). It edits ONLY the
// ExtraParams flags it owns, validates the result, and writes atomically — a failure
// is best-effort and never undoes the live update.
package unraidtmpl

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

// DefaultDir is where Unraid's dockerMan stores user container templates.
const DefaultDir = "/boot/config/plugins/dockerMan/templates-user"

var (
	nameRe = regexp.MustCompile(`(?s)<Name>\s*([^<]*?)\s*</Name>`)
	// matches a self-closing <ExtraParams/> OR an open/close <ExtraParams …>inner</ExtraParams>
	// (with or without attributes). Group 1 = inner text (unset for the self-closing form).
	epRe = regexp.MustCompile(`(?s)<ExtraParams\b[^>]*/>|<ExtraParams\b[^>]*>(.*?)</ExtraParams>`)
)

// SetExtraParams finds the template under dir whose <Name> equals name and upserts the
// given docker flags into its <ExtraParams> (a non-empty value replaces any prior value
// of that flag; an empty value removes the flag). Returns nil if it updated a template,
// or an error (no matching template / read / write). dir == "" is a no-op (nil).
func SetExtraParams(dir, name string, kv map[string]string) error {
	if dir == "" || name == "" || len(kv) == 0 {
		return nil
	}
	files, err := filepath.Glob(filepath.Join(dir, "*.xml"))
	if err != nil {
		return err
	}
	// Update EVERY template whose <Name> matches (templates-user can accumulate stale
	// duplicates from renames/reinstalls; whichever one Unraid actually uses then still
	// carries the limit). Matching none is the error.
	matched := false
	for _, f := range files {
		data, rerr := os.ReadFile(f)
		if rerr != nil {
			continue
		}
		out, ok := applyExtraParams(string(data), name, kv)
		if !ok {
			continue
		}
		if err := writeAtomic(f, []byte(out)); err != nil {
			return err
		}
		matched = true
	}
	if !matched {
		return os.ErrNotExist
	}
	return nil
}

// applyExtraParams is the pure transform (unit-testable without files): if the doc's
// <Name> equals name, upsert kv into <ExtraParams> and return the new doc + true.
func applyExtraParams(doc, name string, kv map[string]string) (string, bool) {
	m := nameRe.FindStringSubmatch(doc)
	if m == nil || strings.TrimSpace(m[1]) != name {
		return doc, false
	}
	loc := epRe.FindStringSubmatchIndex(doc)
	var inner string
	if loc != nil && loc[2] >= 0 { // group 1 present = open/close form; -1 = self-closing (empty)
		inner = doc[loc[2]:loc[3]]
	}
	// deterministic order so the output is stable (and testable)
	keys := make([]string, 0, len(kv))
	for k := range kv {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	// strip EVERY key first (token-aware: "=" and space forms, quoted args opaque),
	// then append the new values — CC's value always wins over a template-written flag.
	inner = strings.TrimSpace(StripFlags(inner, keys...))
	for _, flag := range keys {
		if v := kv[flag]; v != "" {
			if inner != "" {
				inner += " "
			}
			inner += flag + "=" + v
		}
	}
	newEP := "<ExtraParams>" + inner + "</ExtraParams>"
	if loc != nil {
		return doc[:loc[0]] + newEP + doc[loc[1]:], true
	}
	if i := strings.LastIndex(doc, "</Container>"); i >= 0 {
		return doc[:i] + "  " + newEP + "\n" + doc[i:], true
	}
	return doc + "\n" + newEP + "\n", true
}

// StripFlags removes every occurrence of the given docker CLI flags from a
// space-separated ExtraParams string, in BOTH forms: "--flag=value" (one token)
// and "--flag value" (flag + separate value token; the value is eaten unless it
// starts with '-', i.e. is the next flag). Short flags ("-m") also match their
// attached form ("-m2g"). Quoted segments are opaque — flag text inside quotes
// (e.g. an --env value) is never touched. Everything not removed stays
// byte-identical; whitespace collapses only where a token was removed.
func StripFlags(s string, flags ...string) string {
	if s == "" || len(flags) == 0 {
		return s
	}
	spans := tokenize(s)
	remove := make([]bool, len(spans))
	for i, sp := range spans {
		if remove[i] {
			continue // already consumed as a preceding flag's value
		}
		tok := s[sp[0]:sp[1]]
		for _, f := range flags {
			if f == "" || !matchFlag(tok, f) {
				continue
			}
			remove[i] = true
			if tok == f && i+1 < len(spans) { // bare flag → space-form value follows
				if next := s[spans[i+1][0]:spans[i+1][1]]; !strings.HasPrefix(next, "-") {
					remove[i+1] = true
				}
			}
			break
		}
	}
	// merge runs of removed tokens (only whitespace sits between tokens) so a run
	// that ends the string drops its LEADING gap too — no trailing space left over.
	type rng struct{ start, end int }
	var rngs []rng
	for i := 0; i < len(spans); i++ {
		if !remove[i] {
			continue
		}
		start, end := spans[i][0], spans[i][1]
		for i+1 < len(spans) && remove[i+1] {
			i++
			end = spans[i][1]
		}
		rngs = append(rngs, rng{start, end})
	}
	var b strings.Builder
	b.Grow(len(s))
	prev := 0
	for _, r := range rngs {
		start, end := r.start, r.end
		for end < len(s) && isSpace(s[end]) { // eat the gap AFTER the run…
			end++
		}
		if end == len(s) { // …unless it ends the string: then eat the gap BEFORE
			for start > prev && isSpace(s[start-1]) {
				start--
			}
		}
		b.WriteString(s[prev:start])
		prev = end
	}
	b.WriteString(s[prev:])
	return b.String()
}

// matchFlag reports whether token tok IS flag f: exact ("--cpus"), '='-joined
// ("--cpus=2"), or — short flags like "-m" only — attached value ("-m2g").
// "--memory" never matches "--memory-swap": no exact/'='/short rule fires.
func matchFlag(tok, f string) bool {
	if tok == f || strings.HasPrefix(tok, f+"=") {
		return true
	}
	short := len(f) == 2 && f[0] == '-' && f[1] != '-'
	return short && len(tok) > 2 && strings.HasPrefix(tok, f) && tok[2] != '-'
}

// tokenize returns [start,end) byte spans of whitespace-separated tokens. A
// quote (double or single) opens a run in which spaces do NOT split, also
// mid-token (FOO="a b" is ONE token), matching how dockerMan hands ExtraParams to sh.
func tokenize(s string) [][2]int {
	var spans [][2]int
	for i := 0; i < len(s); {
		for i < len(s) && isSpace(s[i]) {
			i++
		}
		if i >= len(s) {
			break
		}
		start := i
		var q byte
		for i < len(s) {
			c := s[i]
			switch {
			case q != 0:
				if c == q {
					q = 0
				}
			case c == '"' || c == '\'':
				q = c
			}
			if q == 0 && isSpace(c) {
				break
			}
			i++
		}
		spans = append(spans, [2]int{start, i})
	}
	return spans
}

func isSpace(c byte) bool { return c == ' ' || c == '\t' || c == '\n' || c == '\r' }

func writeAtomic(path string, data []byte) error {
	tmp := path + ".cc.tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		_ = os.Remove(tmp) // don't leave a partial file on the flash
		return err
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	return nil
}
