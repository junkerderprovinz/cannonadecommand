package store

import (
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/junkerderprovinz/cannonadecommand/internal/model"
)

func TestLoadMissingIsEmpty(t *testing.T) {
	s := New(filepath.Join(t.TempDir(), "nope", "plan.json"))
	p, err := s.Load()
	if err != nil {
		t.Fatalf("load of a missing file must not error: %v", err)
	}
	if len(p.Nodes) != 0 {
		t.Fatalf("missing file should yield an empty plan, got %d nodes", len(p.Nodes))
	}
}

func TestSaveLoadRoundTrip(t *testing.T) {
	s := New(filepath.Join(t.TempDir(), "sub", "plan.json"))
	want := model.Plan{Nodes: []model.Node{
		{Name: "gluetun", Probe: model.Probe{Kind: model.ProbeTCP, Port: 8000, TimeoutSeconds: 60}, Policy: model.PolicyAbort},
		{Name: "qbittorrent", After: []string{"gluetun"}, Probe: model.Probe{Kind: model.ProbeHealth}, Policy: model.PolicyDegrade},
	}}
	if err := s.Save(want); err != nil {
		t.Fatalf("save: %v", err)
	}
	got, err := s.Load()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if len(got.Nodes) != 2 || got.Nodes[0].Name != "gluetun" || got.Nodes[1].After[0] != "gluetun" {
		t.Fatalf("round-trip mismatch: %+v", got)
	}
	if got.Nodes[0].Probe.Port != 8000 || got.Nodes[1].Policy != model.PolicyDegrade {
		t.Fatalf("fields not preserved: %+v", got)
	}
}

func TestLoadConfigNamesTheOldMotionDigits(t *testing.T) {
	for digit, name := range map[string]string{"0": "off", "1": "subtle", "2": "wild", "wild": "wild"} {
		s := New(filepath.Join(t.TempDir(), "plan.json"))
		if err := s.SaveConfig(model.Config{UISettings: map[string]string{"cc.anim": digit, "cc.accent": "#123456"}}); err != nil {
			t.Fatalf("save: %v", err)
		}
		c, err := s.LoadConfig()
		if err != nil {
			t.Fatalf("load: %v", err)
		}
		if c.UISettings["cc.anim"] != name {
			t.Errorf("cc.anim %q loaded as %q, want %q", digit, c.UISettings["cc.anim"], name)
		}
		if c.UISettings["cc.accent"] != "#123456" {
			t.Errorf("an unrelated setting changed: %q", c.UISettings["cc.accent"])
		}
	}
}

func TestLoadConfigWithoutUISettings(t *testing.T) {
	s := New(filepath.Join(t.TempDir(), "plan.json"))
	if err := s.SaveConfig(model.Config{}); err != nil {
		t.Fatalf("save: %v", err)
	}
	if _, err := s.LoadConfig(); err != nil {
		t.Fatalf("load: %v", err)
	}
}

func TestLoadConfigNamesTheOldShapes(t *testing.T) {
	for old, name := range map[string]string{"pill": "round", "rounded": "soft", "square": "square", "circle": "round", "soft": "soft"} {
		s := New(filepath.Join(t.TempDir(), "plan.json"))
		if err := s.SaveConfig(model.Config{UISettings: map[string]string{"cc.badgeshape": old}}); err != nil {
			t.Fatalf("save: %v", err)
		}
		c, err := s.LoadConfig()
		if err != nil {
			t.Fatalf("load: %v", err)
		}
		if c.UISettings["cc.badgeshape"] != name {
			t.Errorf("cc.badgeshape %q loaded as %q, want %q", old, c.UISettings["cc.badgeshape"], name)
		}
	}
}

func TestConcurrentConfigSavesAllSucceed(t *testing.T) {
	dir := t.TempDir()
	s := New(filepath.Join(dir, "plan.json"))
	const writers = 16
	errs := make(chan error, writers)
	var wg sync.WaitGroup
	for i := range writers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			errs <- s.SaveConfig(model.Config{UISettings: map[string]string{"cc.accent": fmt.Sprintf("#%06d", i)}})
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Errorf("save: %v", err)
		}
	}
	c, err := s.LoadConfig()
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if !strings.HasPrefix(c.UISettings["cc.accent"], "#") {
		t.Errorf("config.json holds no whole write: %+v", c.UISettings)
	}
	left, _ := filepath.Glob(filepath.Join(dir, "*.tmp"))
	if len(left) != 0 {
		t.Errorf("temp files left behind: %v", left)
	}
}
