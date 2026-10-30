//go:build linux

package daemon

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestMarkClaudeOnboarded(t *testing.T) {
	read := func(t *testing.T, home string) map[string]any {
		t.Helper()
		raw, err := os.ReadFile(filepath.Join(home, ".claude.json"))
		var config map[string]any
		if err != nil || json.Unmarshal(raw, &config) != nil {
			t.Fatalf("config: %q %v", raw, err)
		}
		return config
	}
	t.Run("absent config is created private", func(t *testing.T) {
		home := t.TempDir()
		if err := markClaudeOnboarded(home); err != nil {
			t.Fatal(err)
		}
		st, err := os.Stat(filepath.Join(home, ".claude.json"))
		if err != nil || st.Mode().Perm() != 0600 || read(t, home)["hasCompletedOnboarding"] != true {
			t.Fatal("not created private", st, err)
		}
	})
	t.Run("other members are kept and a marked config is not rewritten", func(t *testing.T) {
		home := t.TempDir()
		config := filepath.Join(home, ".claude.json")
		if err := os.WriteFile(config, []byte(`{"projects":{"/w":{"allowedTools":["Bash"]}},"theme":"light","hasCompletedOnboarding":false}`), 0600); err != nil {
			t.Fatal(err)
		}
		if err := markClaudeOnboarded(home); err != nil {
			t.Fatal(err)
		}
		got := read(t, home)
		if got["hasCompletedOnboarding"] != true || got["theme"] != "light" || got["projects"].(map[string]any)["/w"] == nil {
			t.Fatalf("members lost: %v", got)
		}
		before, _ := os.Stat(config)
		if err := markClaudeOnboarded(home); err != nil {
			t.Fatal(err)
		}
		if after, _ := os.Stat(config); !os.SameFile(before, after) {
			t.Fatal("already marked config rewritten")
		}
		if entries, _ := os.ReadDir(home); len(entries) != 1 {
			t.Fatalf("left behind: %v", entries)
		}
	})
	t.Run("unsafe or unreadable configs are left alone", func(t *testing.T) {
		for name, setup := range map[string]func(home, config string) error{
			"unparsable": func(_, config string) error { return os.WriteFile(config, []byte(`{"truncated`), 0600) },
			"not object": func(_, config string) error { return os.WriteFile(config, []byte(`[]`), 0600) },
			"readable": func(_, config string) error {
				if err := os.WriteFile(config, []byte(`{}`), 0600); err != nil {
					return err
				}
				return os.Chmod(config, 0644)
			},
			"symlink": func(home, config string) error {
				target := filepath.Join(home, "elsewhere.json")
				if err := os.WriteFile(target, []byte(`{}`), 0600); err != nil {
					return err
				}
				return os.Symlink(target, config)
			},
		} {
			t.Run(name, func(t *testing.T) {
				home := t.TempDir()
				config := filepath.Join(home, ".claude.json")
				if err := setup(home, config); err != nil {
					t.Fatal(err)
				}
				before, _ := os.Lstat(config)
				if markClaudeOnboarded(home) == nil {
					t.Fatal("accepted")
				}
				if after, _ := os.Lstat(config); !os.SameFile(before, after) {
					t.Fatal("replaced")
				}
				if _, err := os.Stat(config + ".lock"); !os.IsNotExist(err) {
					t.Fatal("lock left behind")
				}
			})
		}
	})
	t.Run("Claude Code's lock is honoured", func(t *testing.T) {
		home := t.TempDir()
		lock := filepath.Join(home, ".claude.json.lock")
		if err := os.Mkdir(lock, 0700); err != nil {
			t.Fatal(err)
		}
		if markClaudeOnboarded(home) == nil {
			t.Fatal("wrote under a foreign lock")
		}
		if _, err := os.Stat(lock); err != nil {
			t.Fatal("foreign lock removed")
		}
		if _, err := os.Stat(filepath.Join(home, ".claude.json")); !os.IsNotExist(err) {
			t.Fatal("wrote under a foreign lock")
		}
	})
	t.Run("legacy config is left alone only when Claude Code reads it", func(t *testing.T) {
		for name, c := range map[string]struct {
			legacy  string
			mode    os.FileMode
			current bool
			marked  bool
		}{
			"non-empty legacy":            {legacy: `{}`, mode: 0600, current: true},
			"empty writable, no current":  {mode: 0600},
			"empty legacy beside current": {mode: 0600, current: true, marked: true},
			"empty read-only, no current": {mode: 0400, marked: true},
		} {
			t.Run(name, func(t *testing.T) {
				home := t.TempDir()
				if err := os.MkdirAll(filepath.Join(home, ".claude"), 0700); err != nil {
					t.Fatal(err)
				}
				legacy := filepath.Join(home, ".claude", ".config.json")
				if err := os.WriteFile(legacy, []byte(c.legacy), 0600); err != nil {
					t.Fatal(err)
				}
				if err := os.Chmod(legacy, c.mode); err != nil {
					t.Fatal(err)
				}
				if c.current {
					if err := os.WriteFile(filepath.Join(home, ".claude.json"), []byte(`{}`), 0600); err != nil {
						t.Fatal(err)
					}
				}
				if err := markClaudeOnboarded(home); err != nil {
					t.Fatal(err)
				}
				raw, _ := os.ReadFile(filepath.Join(home, ".claude.json"))
				var config map[string]any
				_ = json.Unmarshal(raw, &config)
				if (config["hasCompletedOnboarding"] == true) != c.marked {
					t.Fatalf("marked = %v, want %v", config["hasCompletedOnboarding"], c.marked)
				}
			})
		}
	})
}
