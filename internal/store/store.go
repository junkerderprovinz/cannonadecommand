// Package store persists the orchestration plan and the automation config as JSON
// on the Unraid flash (/boot/config/plugins/cannonadecommand), so they survive
// reboots.
package store

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"

	"github.com/junkerderprovinz/cannonadecommand/internal/model"
)

// Store reads and writes the plan and the config, which live next to each other.
type Store struct {
	path    string // plan.json
	cfgPath string // config.json (in the same dir)
	mu      sync.Mutex
}

// New builds a store backed by the given plan JSON file path; the config lives in
// config.json in the same directory.
func New(path string) *Store {
	return &Store{path: path, cfgPath: filepath.Join(filepath.Dir(path), "config.json")}
}

// Load reads the plan. A missing or empty file yields an empty plan, not an
// error, so a fresh install starts clean.
func (s *Store) Load() (model.Plan, error) {
	var p model.Plan
	err := readJSON(s.path, &p)
	return p, err
}

// Save writes the plan atomically (temp file + rename).
func (s *Store) Save(p model.Plan) error { return s.write(s.path, p) }

// LoadConfig reads the automation config. A missing or empty file yields the
// zero Config, with nothing scheduled or watched.
func (s *Store) LoadConfig() (model.Config, error) {
	var c model.Config
	err := readJSON(s.cfgPath, &c)
	renameUIValues(c.UISettings)
	return c, err
}

// uiValueNames maps UI setting values stored under an older name to the current
// one, so a browser adopting the mirror on a new origin gets the current name.
var uiValueNames = map[string]map[string]string{
	"cc.anim":       {"0": "off", "1": "subtle", "2": "wild"},
	"cc.badgeshape": {"pill": "round", "rounded": "soft", "circle": "round"},
}

func renameUIValues(ui map[string]string) {
	for key, names := range uiValueNames {
		if name, ok := names[ui[key]]; ok {
			ui[key] = name
		}
	}
}

// SaveConfig writes the automation config atomically.
func (s *Store) SaveConfig(c model.Config) error { return s.write(s.cfgPath, c) }

// write serialises the saves, so two requests landing together replace the file
// one after the other and the last one wins whole.
func (s *Store) write(path string, v any) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return writeJSON(path, v)
}

func readJSON(path string, v any) error {
	b, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) || (err == nil && len(b) == 0) {
		return nil // fresh: leave v at its zero value
	}
	if err != nil {
		return err
	}
	return json.Unmarshal(b, v)
}

// writeJSON writes to a temp file, fsyncs it and renames it over the target. The
// fsync has to happen before the rename: the Unraid flash is unjournaled FAT32,
// so without it a power loss can leave a present but half-written file. Each
// write gets its own temp name, so two writers never share one temp file.
func writeJSON(path string, v any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(path), filepath.Base(path)+".*.tmp")
	if err != nil {
		return err
	}
	tmp := f.Name()
	if err := f.Chmod(0o644); err != nil {
		_ = f.Close()
		_ = os.Remove(tmp)
		return err
	}
	if _, err := f.Write(b); err != nil {
		_ = f.Close()
		_ = os.Remove(tmp)
		return err
	}
	if err := f.Sync(); err != nil {
		_ = f.Close()
		_ = os.Remove(tmp)
		return err
	}
	if err := f.Close(); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp) // don't leave an orphaned .tmp on the flash
		return err
	}
	return nil
}
