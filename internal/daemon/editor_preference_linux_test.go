//go:build linux

package daemon

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

func TestEditorPreferenceNativeConfiguration(t *testing.T) {
	home, other := t.TempDir(), t.TempDir()
	value, err := readEditorPreference(home)
	if err != nil || value.Engine != "codemirror6" {
		t.Fatalf("default: %+v %v", value, err)
	}
	if _, err := os.Stat(filepath.Join(home, ".config")); !os.IsNotExist(err) {
		t.Fatal("read created configuration")
	}
	if err := saveEditorPreference(home, editorPreference{"vscode"}); err != nil {
		t.Fatal(err)
	}
	// A new reader, independent of daemon lifetime or browser/device state.
	value, err = readEditorPreference(home)
	if err != nil || value.Engine != "vscode" {
		t.Fatalf("persistent choice: %+v %v", value, err)
	}
	value, err = readEditorPreference(other)
	if err != nil || value.Engine != "codemirror6" {
		t.Fatalf("other person: %+v %v", value, err)
	}
	file := filepath.Join(home, ".config/open-habitat/editor.json")
	st, err := os.Stat(file)
	if err != nil || st.Mode().Perm() != 0600 {
		t.Fatalf("permissions: %v %v", st, err)
	}
	for _, invalid := range []string{`{"engine":"monaco"}`, `{"engine":"vscode","path":"secret"}`, `null`, `{}`, `{"engine":"vscode"} {}`, strings.Repeat(" ", 4097)} {
		if err := os.WriteFile(file, []byte(invalid), 0600); err != nil {
			t.Fatal(err)
		}
		if _, err := readEditorPreference(home); err == nil {
			t.Fatalf("accepted %q", invalid)
		}
	}
}

func TestEditorPreferenceRefusesUnsafeFilesAndDirectories(t *testing.T) {
	for _, location := range []string{".config", ".config/open-habitat", ".config/open-habitat/editor.json"} {
		t.Run(location, func(t *testing.T) {
			home, outside := t.TempDir(), t.TempDir()
			if err := os.MkdirAll(filepath.Dir(filepath.Join(home, location)), 0700); err != nil {
				t.Fatal(err)
			}
			if err := os.Symlink(outside, filepath.Join(home, location)); err != nil {
				t.Fatal(err)
			}
			if _, err := readEditorPreference(home); err == nil {
				t.Fatal("read followed symlink")
			}
			if location != ".config/open-habitat/editor.json" {
				if err := saveEditorPreference(home, editorPreference{"vscode"}); err == nil {
					t.Fatal("write followed directory symlink")
				}
			} else {
				// Atomic replacement replaces the link, never writes its target.
				if err := saveEditorPreference(home, editorPreference{"vscode"}); err != nil {
					t.Fatal(err)
				}
			}
			entries, _ := os.ReadDir(outside)
			if len(entries) != 0 {
				t.Fatal("modified outside target")
			}
		})
	}
	home := t.TempDir()
	if err := saveEditorPreference(home, editorPreference{"vscode"}); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(filepath.Join(home, ".config/open-habitat"), 0777); err != nil {
		t.Fatal(err)
	}
	if _, err := readEditorPreference(home); err == nil {
		t.Fatal("accepted writable directory")
	}
	if err := saveEditorPreference(home, editorPreference{"codemirror6"}); err == nil {
		t.Fatal("wrote unsafe directory")
	}
}

func TestEditorPreferenceHTTPBoundary(t *testing.T) {
	home := t.TempDir()
	cfg := transport.Config{Home: home, Provider: "github", Subject: "42"}
	trusted := true
	handler := EditorPreferenceHandler(cfg, func(*http.Request) bool { return trusted })
	for _, tc := range []struct {
		method, suffix, body string
		status               int
	}{
		{"GET", "", "", 200}, {"PUT", "", `{"engine":"vscode"}`, 200},
		{"GET", "?uid=123", "", 400}, {"POST", "", `{"engine":"vscode"}`, 400},
		{"PUT", "", `{"engine":"monaco"}`, 400}, {"PUT", "", `{"engine":"vscode","uid":123}`, 400},
		{"PUT", "", `{"engine":"vscode"} {}`, 400}, {"PUT", "", `{}`, 400},
	} {
		r := httptest.NewRequest(tc.method, "http://unix"+EditorPreferencePath+tc.suffix, strings.NewReader(tc.body))
		if tc.body != "" {
			r.Header.Set("Content-Type", "application/json")
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if w.Code != tc.status {
			t.Fatalf("%+v: %d %s", tc, w.Code, w.Body.String())
		}
	}
	trusted = false
	r := httptest.NewRequest("GET", "http://unix"+EditorPreferencePath, nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != 403 {
		t.Fatalf("untrusted peer: %d", w.Code)
	}
}
