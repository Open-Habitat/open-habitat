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
		{"PUT", "", `{"yours_workspace":"ws_example123"}`, 200}, {"PUT", "", `{"running_workspace":null}`, 200},
		{"PUT", "", `{"yours_workspace":"ws_short"}`, 400}, {"PUT", "", `{"running_workspace":true}`, 400},
		{"PUT", "", `{"Yours_workspace":"ws_example123"}`, 400}, {"PUT", "", `{"yours_workspace":null,"running_workspace":null}`, 400},
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
		{"PUT", "", `{"sound":{"enabled":false}}`, 200}, {"PUT", "", `{"sound":{"night":true}}`, 200},
		{"PUT", "", `{"sound":{"default":"jaapuikot"}}`, 200}, {"PUT", "", `{"sound":{"length":"long"}}`, 200},
		{"PUT", "", `{"sound":{"in_view":"play"}}`, 200},
		{"PUT", "", `{"sound":{"enabled":null}}`, 400}, {"PUT", "", `{"sound":{"enabled":"false"}}`, 400},
		{"PUT", "", `{"sound":{"default":"harppu"}}`, 400}, {"PUT", "", `{"sound":{"default":"../x"}}`, 400},
		{"PUT", "", `{"sound":{"length":"medium"}}`, 400}, {"PUT", "", `{"sound":{"in_view":"loud"}}`, 400},
		{"PUT", "", `{"sound":{"volume":50}}`, 400}, {"PUT", "", `{"sound":{"muted":true}}`, 400},
		{"PUT", "", `{"sound":{}}`, 400}, {"PUT", "", `{"sound":null}`, 400},
		{"PUT", "", `{"sound":{"enabled":true,"night":true}}`, 400}, {"PUT", "", `{"Sound":{"enabled":true}}`, 400},
		{"PUT", "", `{"sound":{"enabled":true},"engine":"vscode"}`, 400},
		{"PUT", "", `{"workspace_sound":{"ws_example123":"pisara"}}`, 200}, {"PUT", "", `{"workspace_sound":{"ws_example123":null}}`, 200},
		{"PUT", "", `{"workspace_sound":{"ws_short":"pisara"}}`, 400}, {"PUT", "", `{"workspace_sound":{"ws_example123":"harppu"}}`, 400},
		{"PUT", "", `{"workspace_sound":{"ws_example123":"pisara","ws_example456":"lasit"}}`, 400},
		{"PUT", "", `{"workspace_sound":{}}`, 400}, {"PUT", "", `{"workspace_sound":null}`, 400},
		{"PUT", "", `{"workspace_sound":{"ws_example123":5}}`, 400},
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
	// Sinun vuorosi and Käynnissä keep a narrowing each, apart from Hiljaiset.
	if reply := put(`{"engine":"vscode"}`); reply["yours_workspace"] != nil || reply["running_workspace"] != nil {
		t.Fatalf("unchosen section workspaces are not null: %v", reply)
	}
	put(`{"yours_workspace":"ws_example123"}`)
	if reply = put(`{"running_workspace":"ws_example456"}`); reply["yours_workspace"] != "ws_example123" || reply["running_workspace"] != "ws_example456" || reply["quiet_workspace"] != nil {
		t.Fatalf("section workspaces: %v", reply)
	}
	put(`{"yours_workspace":null}`)
	if reply = put(`{"running_workspace":null}`); reply["yours_workspace"] != nil || reply["running_workspace"] != nil {
		t.Fatalf("section every workspace: %v", reply)
	}
	if raw, _ = os.ReadFile(filepath.Join(home, ".config/open-habitat/preferences.json")); strings.Contains(string(raw), "_workspace") {
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

func TestAccountPreferencesSoundLegacyNight(t *testing.T) {
	for _, off := range []bool{false, true} {
		home := t.TempDir()
		dir := filepath.Join(home, ".config", "open-habitat")
		if err := os.MkdirAll(dir, 0700); err != nil {
			t.Fatal(err)
		}
		raw := fmt.Sprintf(`{"engine":"codemirror6","sound":{"night_off":%t,"default":"lasit"}}`, off)
		if err := os.WriteFile(filepath.Join(dir, "preferences.json"), []byte(raw), 0600); err != nil {
			t.Fatal(err)
		}
		value, err := readPreferences(home)
		if err != nil {
			t.Fatal(err)
		}
		reply := soundReply(value.Sound)
		if reply["night"] != !off || reply["night_start"] != 22 || reply["night_end"] != 7 || reply["default"] != "lasit" {
			t.Fatalf("legacy choice changed: %v", reply)
		}
	}
}

func TestAccountPreferencesSound(t *testing.T) {
	home := t.TempDir()
	cfg := transport.Config{Home: home, Provider: "github", Subject: "42"}
	handler := AccountPreferencesHandler(cfg, func(*http.Request) bool { return true })
	put := func(body string, status int) map[string]any {
		t.Helper()
		r := httptest.NewRequest("PUT", "http://unix"+AccountPreferencesPath, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		if w.Code != status {
			t.Fatalf("%s: %d %s", body, w.Code, w.Body.String())
		}
		var reply map[string]any
		_ = json.Unmarshal(w.Body.Bytes(), &reply)
		return reply
	}
	file := filepath.Join(home, ".config/open-habitat/preferences.json")
	defaults := map[string]any{"enabled": true, "default": "kalimba", "length": "short", "in_view": "quiet", "night": true, "night_start": float64(22), "night_end": float64(7), "workspaces": map[string]any{}}
	if reply := put(`{"engine":"vscode"}`, 200); !reflect.DeepEqual(reply["sound"], defaults) {
		t.Fatalf("defaults: %v", reply["sound"])
	}
	if raw, _ := os.ReadFile(file); strings.Contains(string(raw), `"sound"`) {
		t.Fatalf("defaults stored a key: %s", raw)
	}
	put(`{"sound":{"enabled":false}}`, 200)
	put(`{"sound":{"default":"kulho"}}`, 200)
	put(`{"sound":{"length":"long"}}`, 200)
	put(`{"sound":{"in_view":"play"}}`, 200)
	put(`{"sound":{"night":false}}`, 200)
	put(`{"sound":{"night_start":0}}`, 200)
	put(`{"sound":{"night_end":9}}`, 200)
	for _, invalid := range []string{
		`{"night_start":-1}`, `{"night_start":24}`, `{"night_start":12}`,
		`{"night_end":0}`, `{"night_end":12}`, `{"night_start":22.5}`,
		`{"night_start":null}`, `{"night_end":"7"}`, `{"night_end":true}`,
		`{"night_start":22,"night_end":7}`,
	} {
		put(`{"sound":`+invalid+`}`, 400)
	}
	put(`{"workspace_sound":{"ws_example123":"pisara"}}`, 200)
	reply := put(`{"experimental":{"attention-sound":true}}`, 200)
	want := map[string]any{"enabled": false, "default": "kulho", "length": "long", "in_view": "play", "night": false, "night_start": float64(0), "night_end": float64(9), "workspaces": map[string]any{"ws_example123": "pisara"}}
	if !reflect.DeepEqual(reply["sound"], want) || reply["engine"] != "vscode" {
		t.Fatalf("merge lost a sound choice: %v", reply)
	}
	// A new reader sees the same, independent of the browser.
	if value, err := readPreferences(home); err != nil || value.Sound == nil || value.Sound.Default != "kulho" || value.Sound.Workspaces["ws_example123"] != "pisara" {
		t.Fatalf("stored: %+v %v", value.Sound, err)
	}
	// Back to every default: the file keeps no sound key.
	put(`{"sound":{"night_start":22}}`, 200)
	put(`{"sound":{"night_end":7}}`, 200)
	put(`{"sound":{"enabled":true}}`, 200)
	put(`{"sound":{"default":"kalimba"}}`, 200)
	put(`{"sound":{"length":"short"}}`, 200)
	put(`{"sound":{"in_view":"quiet"}}`, 200)
	put(`{"sound":{"night":true}}`, 200)
	if reply = put(`{"workspace_sound":{"ws_example123":null}}`, 200); !reflect.DeepEqual(reply["sound"], defaults) {
		t.Fatalf("back to defaults: %v", reply["sound"])
	}
	if raw, _ := os.ReadFile(file); strings.Contains(string(raw), `"sound"`) {
		t.Fatalf("defaults stored a key: %s", raw)
	}
	// The map has a bound; one past it is refused and changes nothing, and
	// clearing one still works on a full map.
	for i := 0; i < maxWorkspaceSounds; i++ {
		put(fmt.Sprintf(`{"workspace_sound":{"ws_example%03d":"lasit"}}`, i), 200)
	}
	put(`{"workspace_sound":{"ws_onetoomany":"lasit"}}`, 503)
	if value, err := readPreferences(home); err != nil || len(value.Sound.Workspaces) != maxWorkspaceSounds {
		t.Fatalf("after refusal: %+v %v", value.Sound, err)
	}
	put(`{"workspace_sound":{"ws_example000":null}}`, 200)
	// With every other field at its bound too, the document stays under the
	// size the reader accepts.
	// attention-sound is already on: fill the rest.
	for i := 1; i < maxExperimentalFeatures; i++ {
		put(fmt.Sprintf(`{"experimental":{"%s":true}}`, strings.Repeat("f", 40)+fmt.Sprint(1000000+i)), 200)
	}
	put(fmt.Sprintf(`{"workspace_sound":{"ws_%s":"tunnus-puu"}}`, strings.Repeat("x", 64)), 200)
	if raw, _ := os.ReadFile(file); len(raw) > maxPreferencesSize/2+1024 {
		t.Fatalf("full document is %d bytes", len(raw))
	}
	if _, err := readPreferences(home); err != nil {
		t.Fatal(err)
	}
	// A stored file is read as strictly as a write.
	for _, invalid := range []string{
		`{"engine":"vscode","sound":{"default":"harppu"}}`,
		`{"engine":"vscode","sound":{"length":"short"}}`,
		`{"engine":"vscode","sound":{"in_view":"quiet"}}`,
		`{"engine":"vscode","sound":{"volume":3}}`,
		`{"engine":"vscode","sound":{"night_start":12}}`,
		`{"engine":"vscode","sound":{"night_end":24}}`,
		`{"engine":"vscode","sound":{"workspaces":{"ws_short":"lasit"}}}`,
		`{"engine":"vscode","sound":{"workspaces":{"ws_example123":"harppu"}}}`,
	} {
		if err := os.WriteFile(file, []byte(invalid), 0600); err != nil {
			t.Fatal(err)
		}
		if _, err := readPreferences(home); err == nil {
			t.Fatalf("accepted %q", invalid)
		}
	}
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

// The workflow opt-in: off until chosen and stored only while on. A
// reconnect whose token has the scope sets it; one without the scope, or
// with unread scopes, leaves it alone; only the person's write clears it.
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
	if value, err = readPreferences(home); err != nil || !value.GitHubWorkflow {
		t.Fatalf("a token without the scope cleared the wish: %+v %v", value, err)
	}
	off := false
	if value, err = applyPreferences(home, preferencesWrite{GitHubWorkflow: &off}); err != nil || value.GitHubWorkflow {
		t.Fatalf("the person's write: %+v %v", value, err)
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
