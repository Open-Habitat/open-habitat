//go:build linux

package daemon

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/open-habitat/open-habitat/internal/transport"
)

func TestAccountPreferencesNativeConfiguration(t *testing.T) {
	home, other := t.TempDir(), t.TempDir()
	value, err := readPreferences(home)
	if err != nil || value.Engine != "codemirror6" {
		t.Fatalf("default: %+v %v", value, err)
	}
	if _, err := os.Stat(filepath.Join(home, ".config")); !os.IsNotExist(err) {
		t.Fatal("read created configuration")
	}
	if err := savePreferences(home, accountPreferences{Engine: "vscode"}); err != nil {
		t.Fatal(err)
	}
	// A new reader, independent of daemon lifetime or browser/device state.
	value, err = readPreferences(home)
	if err != nil || value.Engine != "vscode" {
		t.Fatalf("persistent choice: %+v %v", value, err)
	}
	value, err = readPreferences(other)
	if err != nil || value.Engine != "codemirror6" {
		t.Fatalf("other person: %+v %v", value, err)
	}
	file := filepath.Join(home, ".config/open-habitat/preferences.json")
	st, err := os.Stat(file)
	if err != nil || st.Mode().Perm() != 0600 {
		t.Fatalf("permissions: %v %v", st, err)
	}
	for _, invalid := range []string{`{"engine":"monaco"}`, `{"engine":"vscode","experimental":{"Bad_ID":true}}`, `{"engine":"vscode","experimental":{"next-waiting-row":false}}`, `{"engine":"vscode","path":"secret"}`, `{"engine":"vscode","language":"sv"}`, `null`, `{}`, `{"engine":"vscode"} {}`, strings.Repeat(" ", 4097)} {
		if err := os.WriteFile(file, []byte(invalid), 0600); err != nil {
			t.Fatal(err)
		}
		if _, err := readPreferences(home); err == nil {
			t.Fatalf("accepted %q", invalid)
		}
	}
}

func TestAccountPreferencesRefusesUnsafeFilesAndDirectories(t *testing.T) {
	for _, location := range []string{".config", ".config/open-habitat", ".config/open-habitat/preferences.json"} {
		t.Run(location, func(t *testing.T) {
			home, outside := t.TempDir(), t.TempDir()
			if err := os.MkdirAll(filepath.Dir(filepath.Join(home, location)), 0700); err != nil {
				t.Fatal(err)
			}
			if err := os.Symlink(outside, filepath.Join(home, location)); err != nil {
				t.Fatal(err)
			}
			if _, err := readPreferences(home); err == nil {
				t.Fatal("read followed symlink")
			}
			if location != ".config/open-habitat/preferences.json" {
				if err := savePreferences(home, accountPreferences{Engine: "vscode"}); err == nil {
					t.Fatal("write followed directory symlink")
				}
			} else {
				// Atomic replacement replaces the link, never writes its target.
				if err := savePreferences(home, accountPreferences{Engine: "vscode"}); err != nil {
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
	if err := savePreferences(home, accountPreferences{Engine: "vscode"}); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(filepath.Join(home, ".config/open-habitat"), 0777); err != nil {
		t.Fatal(err)
	}
	if _, err := readPreferences(home); err == nil {
		t.Fatal("accepted writable directory")
	}
	if err := savePreferences(home, accountPreferences{Engine: "codemirror6"}); err == nil {
		t.Fatal("wrote unsafe directory")
	}
}

func TestAccountPreferencesHTTPBoundary(t *testing.T) {
	home := t.TempDir()
	cfg := transport.Config{Home: home, Provider: "github", Subject: "42"}
	trusted := true
	handler := AccountPreferencesHandler(cfg, func(*http.Request) bool { return trusted })
	for _, tc := range []struct {
		method, suffix, body string
		status               int
	}{
		{"PUT", "", `{"quiet_sort":"newest"}`, 200}, {"PUT", "", `{"quiet_sort":"workspace"}`, 200},
		{"PUT", "", `{"quiet_sort":"name"}`, 200}, {"PUT", "", `{"quiet_sort":"oldest"}`, 400},
		{"PUT", "", `{"quiet_sort":null}`, 400}, {"PUT", "", `{"quiet_sort":""}`, 400},
		{"PUT", "", `{"Quiet_Sort":"name"}`, 400}, {"PUT", "", `{"quiet_sort":"name","language":"en"}`, 400},
		{"PUT", "", `{"quiet_workspace":"ws_example123"}`, 200}, {"PUT", "", `{"quiet_workspace":null}`, 200},
		{"PUT", "", `{"quiet_workspace":""}`, 400}, {"PUT", "", `{"quiet_workspace":"ws_short"}`, 400},
		{"PUT", "", `{"quiet_workspace":"ws_../../etc"}`, 400}, {"PUT", "", `{"quiet_workspace":"wx_example123"}`, 400},
		{"PUT", "", `{"quiet_workspace":5}`, 400}, {"PUT", "", `{"recent_count":5}`, 400},
		{"GET", "", "", 200}, {"PUT", "", `{"engine":"vscode"}`, 200},
		{"GET", "?uid=123", "", 400}, {"POST", "", `{"engine":"vscode"}`, 400},
		{"PUT", "", `{"engine":"monaco"}`, 400}, {"PUT", "", `{"engine":"vscode","uid":123}`, 400},
		{"PUT", "", `{"engine":"vscode"} {}`, 400}, {"PUT", "", `{}`, 400},
		{"PUT", "", `{"experimental":{"worker-row-sentence":true}}`, 200},
		{"PUT", "", `{"engine":"vscode","experimental":{"worker-row-sentence":true}}`, 400},
		{"PUT", "", `{"experimental":{"a":true,"b":true}}`, 400}, {"PUT", "", `{"experimental":{}}`, 400},
		{"PUT", "", `{"experimental":{"../x":true}}`, 400}, {"PUT", "", `{"experimental":{"x-":true}}`, 400},
		{"PUT", "", `{"experimental":{"x":"yes"}}`, 400}, {"PUT", "", `{"experimental":null}`, 400},
		{"PUT", "", `{"experimental":{"worker-row-sentence":null}}`, 400}, {"PUT", "", `{"engine":"vscode","experimental":null}`, 400},
		{"PUT", "", `{"language":"en"}`, 200},
		{"PUT", "", `{"language":"en-US"}`, 200}, {"PUT", "", `{"language":"en-GB"}`, 200},
		{"PUT", "", `{"language":"en-AU"}`, 400}, {"PUT", "", `{"language":"system"}`, 200},
		{"PUT", "", `{"language":"sv"}`, 400}, {"PUT", "", `{"language":""}`, 400}, {"PUT", "", `{"language":null}`, 400},
		{"PUT", "", `{"language":"en","engine":"vscode"}`, 400}, {"PUT", "", `{"Language":"en"}`, 400},
		{"PUT", "", `{"Engine":"vscode"}`, 400}, {"PUT", "", `{"engine":null}`, 400}, {"PUT", "", `[]`, 400},
		{"PUT", "", `{"github_workflow":true}`, 200}, {"PUT", "", `{"github_workflow":false}`, 200},
		{"PUT", "", `{"github_workflow":null}`, 400}, {"PUT", "", `{"github_workflow":"true"}`, 400},
		{"PUT", "", `{"GitHub_Workflow":true}`, 400}, {"PUT", "", `{"github_workflow":true,"engine":"vscode"}`, 400},
	} {
		r := httptest.NewRequest(tc.method, "http://unix"+AccountPreferencesPath+tc.suffix, strings.NewReader(tc.body))
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
	r := httptest.NewRequest("GET", "http://unix"+AccountPreferencesPath, nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != 403 {
		t.Fatalf("untrusted peer: %d", w.Code)
	}
}

func TestAccountPreferencesMergeOneChange(t *testing.T) {
	home := t.TempDir()
	cfg := transport.Config{Home: home, Provider: "github", Subject: "42"}
	handler := AccountPreferencesHandler(cfg, func(*http.Request) bool { return true })
	put := func(body string) map[string]any {
		t.Helper()
		r := httptest.NewRequest("PUT", "http://unix"+AccountPreferencesPath, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if w.Code != 200 {
			t.Fatalf("%s: %d %s", body, w.Code, w.Body.String())
		}
		var reply map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &reply); err != nil {
			t.Fatal(err)
		}
		return reply
	}
	if reply := put(`{"engine":"vscode"}`); reply["quiet_sort"] != "newest" || reply["quiet_workspace"] != nil || reply["language"] != "system" {
		t.Fatalf("unchosen values are not their defaults: %v", reply)
	}
	if v, ok := put(`{"engine":"vscode"}`)["quiet_workspace"]; !ok || v != nil {
		t.Fatalf("an unchosen workspace is not null: %v", v)
	}
	if reply := put(`{"quiet_sort":"workspace"}`); reply["quiet_sort"] != "workspace" {
		t.Fatalf("quiet sort: %v", reply)
	}
	if reply := put(`{"quiet_workspace":"ws_example123"}`); reply["quiet_workspace"] != "ws_example123" || reply["quiet_sort"] != "workspace" {
		t.Fatalf("quiet workspace: %v", reply)
	}
	put(`{"language":"en"}`)
	put(`{"experimental":{"next-waiting-row":true}}`)
	reply := put(`{"experimental":{"worker-row-sentence":true}}`)
	if reply["quiet_sort"] != "workspace" || reply["quiet_workspace"] != "ws_example123" || reply["engine"] != "vscode" || reply["language"] != "en" || !reflect.DeepEqual(reply["experimental"], map[string]any{"next-waiting-row": true, "worker-row-sentence": true}) {
		t.Fatalf("merge lost a change: %v", reply)
	}
	reply = put(`{"experimental":{"next-waiting-row":false}}`)
	if !reflect.DeepEqual(reply["experimental"], map[string]any{"worker-row-sentence": true}) {
		t.Fatalf("off kept the key: %v", reply)
	}
	raw, err := os.ReadFile(filepath.Join(home, ".config/open-habitat/preferences.json"))
	if err != nil || strings.Contains(string(raw), "next-waiting-row") {
		t.Fatalf("stored: %s %v", raw, err)
	}
	// Every workspace is stored as no choice.
	if reply = put(`{"quiet_workspace":null}`); reply["quiet_workspace"] != nil {
		t.Fatalf("every workspace: %v", reply)
	}
	if raw, _ = os.ReadFile(filepath.Join(home, ".config/open-habitat/preferences.json")); strings.Contains(string(raw), "quiet_workspace") {
		t.Fatalf("every workspace stored a key: %s", raw)
	}
	// System is stored as no choice, so the file keeps only what was chosen.
	if reply = put(`{"language":"system"}`); reply["language"] != "system" {
		t.Fatalf("system: %v", reply)
	}
	if raw, _ = os.ReadFile(filepath.Join(home, ".config/open-habitat/preferences.json")); strings.Contains(string(raw), "language") {
		t.Fatalf("system stored a key: %s", raw)
	}
	// The document has a bound; one past it is refused and changes nothing.
	for i := 1; i < maxExperimentalFeatures; i++ {
		put(fmt.Sprintf(`{"experimental":{"f%d":true}}`, i))
	}
	r := httptest.NewRequest("PUT", "http://unix"+AccountPreferencesPath, strings.NewReader(`{"experimental":{"one-too-many":true}}`))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != 503 {
		t.Fatalf("over the bound: %d", w.Code)
	}
	value, err := readPreferences(home)
	if err != nil || len(value.Experimental) != maxExperimentalFeatures || value.Experimental["one-too-many"] {
		t.Fatalf("after refusal: %d %v", len(value.Experimental), err)
	}
	// Turning off a feature never fails on a full document.
	put(`{"experimental":{"f1":false}}`)
}

// A file written while the rail had Viimeisimmät still reads, and the next
// save drops the retired count.
func TestAccountPreferencesDropRetiredRecentCount(t *testing.T) {
	home := t.TempDir()
	dir := filepath.Join(home, ".config/open-habitat")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "preferences.json"), []byte(`{"recent_count":8,"engine":"vscode","language":"en","experimental":{}}`), 0600); err != nil {
		t.Fatal(err)
	}
	value, err := readPreferences(home)
	if err != nil || value.Engine != "vscode" || value.Language != "en" {
		t.Fatalf("read: %+v %v", value, err)
	}
	if _, err = applyPreferences(home, preferencesWrite{QuietSort: new("name")}); err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(filepath.Join(dir, "preferences.json"))
	if err != nil || strings.Contains(string(raw), "recent_count") || !strings.Contains(string(raw), `"quiet_sort":"name"`) {
		t.Fatalf("stored: %s %v", raw, err)
	}
}

// The workflow opt-in: off until chosen and stored only while on; the
// explicit reconnect sets it to whether the installed token has the scope,
// and unread scopes leave it alone.
func TestAccountPreferencesGitHubWorkflow(t *testing.T) {
	home := t.TempDir()
	file := filepath.Join(home, ".config/open-habitat/preferences.json")
	value, err := readPreferences(home)
	if err != nil || value.GitHubWorkflow {
		t.Fatalf("default: %+v %v", value, err)
	}
	if err := rememberGitHubWorkflow(home, []string{"gist", "read:org", "repo", "workflow"}); err != nil {
		t.Fatal(err)
	}
	if value, err = readPreferences(home); err != nil || !value.GitHubWorkflow {
		t.Fatalf("granted: %+v %v", value, err)
	}
	if err := rememberGitHubWorkflow(home, nil); err != nil {
		t.Fatal(err)
	}
	if value, err = readPreferences(home); err != nil || !value.GitHubWorkflow {
		t.Fatalf("unread scopes changed it: %+v %v", value, err)
	}
	if err := rememberGitHubWorkflow(home, []string{"repo"}); err != nil {
		t.Fatal(err)
	}
	if value, err = readPreferences(home); err != nil || value.GitHubWorkflow {
		t.Fatalf("dropped: %+v %v", value, err)
	}
	if raw, _ := os.ReadFile(file); strings.Contains(string(raw), "github_workflow") {
		t.Fatalf("off stored a key: %s", raw)
	}
	cfg := transport.Config{Home: home, Provider: "github", Subject: "42"}
	handler := AccountPreferencesHandler(cfg, func(*http.Request) bool { return true })
	r := httptest.NewRequest("GET", "http://unix"+AccountPreferencesPath, nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	var reply map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &reply); err != nil || reply["github_workflow"] != false {
		t.Fatalf("reply: %s %v", w.Body.String(), err)
	}
}
