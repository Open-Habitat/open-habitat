//go:build linux

package daemon

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/transport"
)

// bashProvider is a synthetic model whose tool calls are shell commands:
// a person's message gets the commands chosen by its text, and the tools'
// results get a short reply.
func bashProvider(t *testing.T, commands map[string][]string) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Messages []struct {
				Role    string          `json:"role"`
				Content json.RawMessage `json:"content"`
			} `json:"messages"`
		}
		if r.URL.Path != "/v1/chat/completions" || json.NewDecoder(r.Body).Decode(&body) != nil || len(body.Messages) == 0 {
			w.WriteHeader(400)
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		chunk := func(delta string, finish string) {
			f := "null"
			if finish != "" {
				f = `"` + finish + `"`
			}
			fmt.Fprintf(w, "data: {\"id\":\"synthetic\",\"object\":\"chat.completion.chunk\",\"created\":0,\"model\":\"fake\",\"choices\":[{\"index\":0,\"delta\":%s,\"finish_reason\":%s}]}\n\n", delta, f)
		}
		last := body.Messages[len(body.Messages)-1]
		var calls []string
		if last.Role != "tool" {
			for key, list := range commands {
				if strings.Contains(string(last.Content), key) {
					for i, command := range list {
						args, _ := json.Marshal(map[string]string{"command": command})
						quoted, _ := json.Marshal(string(args))
						calls = append(calls, fmt.Sprintf(`{"index":%d,"id":"call_%s_%d","type":"function","function":{"name":"bash","arguments":%s}}`, i, key, i, quoted))
					}
				}
			}
		}
		if len(calls) == 0 {
			chunk(`{"role":"assistant","content":"Valmis."}`, "")
			chunk(`{}`, "stop")
		} else {
			chunk(`{"role":"assistant","tool_calls":[`+strings.Join(calls, ",")+`]}`, "")
			chunk(`{}`, "tool_calls")
		}
		fmt.Fprint(w, "data: [DONE]\n\n")
	}))
}

// TestTurnSnapshotsThroughPinnedPi loads the turn-snapshot recorder and the
// rewind extension into the pinned Pi, as the daemon does with Palaa tähän
// on, against a model that changes a Git workspace only through shell
// commands (a Python script, sed -i, rm). The daemon's turn-changes read and
// preview name those files from the snapshots, and going back, returning to
// the replaced continuation, a files-only restore and its undo put them back
// byte for byte.
func TestTurnSnapshotsThroughPinnedPi(t *testing.T) {
	cli, err := filepath.Abs(filepath.Join("pi-device-test", "node_modules", "@earendil-works", "pi-coding-agent", "dist", "bundle", "cli.js"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(cli); err != nil {
		t.Skip("pinned Pi test dependency not installed")
	}
	for _, tool := range []string{"/usr/bin/git", "/usr/bin/python3"} {
		if _, err := os.Stat(tool); err != nil {
			t.Skip(tool + " not installed")
		}
	}
	provider := bashProvider(t, map[string][]string{
		"skripti": {
			`python3 -c "open('notes.txt','w').write('changed by python\nsecond line\n')"`,
			`sed -i 's/alpha/beta/' config.txt`,
			`rm old.txt`,
			`mkdir -p gen && printf 'generated\n' > gen/out.txt`,
		},
		"lisää": {`printf 'more\n' >> notes.txt`},
	})
	defer provider.Close()
	home := t.TempDir()
	cwd := filepath.Join(home, "src", "fixture")
	for _, dir := range []string{filepath.Join(home, ".pi", "agent"), filepath.Join(home, ".config", "open-habitat"), cwd} {
		if err := os.MkdirAll(dir, 0700); err != nil {
			t.Fatal(err)
		}
	}
	git := func(args ...string) {
		t.Helper()
		cmd := exec.Command("/usr/bin/git", append([]string{"-C", cwd}, args...)...)
		cmd.Env = []string{"HOME=" + home, "PATH=/usr/bin:/bin", "GIT_CONFIG_NOSYSTEM=1"}
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %s %v", args, out, err)
		}
	}
	files := map[string]string{"notes.txt": "original notes\n", "config.txt": "name=alpha\n", "old.txt": "to be removed\nby rm\n", ".gitignore": "ignored/\n"}
	for name, content := range files {
		if err := os.WriteFile(filepath.Join(cwd, name), []byte(content), 0600); err != nil {
			t.Fatal(err)
		}
	}
	git("init", "--quiet", "--initial-branch=main")
	git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "add", ".")
	git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "initial")
	models := map[string]any{"providers": map[string]any{"fixture": map[string]any{"baseUrl": provider.URL + "/v1", "api": "openai-completions", "apiKey": "synthetic", "authHeader": true, "models": []any{map[string]any{"id": "fake", "name": "Fake"}}}}}
	data, _ := json.Marshal(models)
	if err := os.WriteFile(filepath.Join(home, ".pi", "agent", "models.json"), data, 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(home, ".config", "open-habitat", "preferences.json"), []byte(`{"engine":"codemirror6","experimental":{"rewind-conversation":true}}`), 0600); err != nil {
		t.Fatal(err)
	}
	// The extensions as the daemon installs them, recorder included while the
	// switch is on.
	install := t.TempDir()
	ext, err := installRewindExtension(install)
	if err != nil {
		t.Fatal(err)
	}
	recorder := turnSnapshotArgs(home, install)
	if len(recorder) != 2 {
		t.Fatalf("recorder not loaded with the switch on: %v", recorder)
	}
	id, _ := uuid()
	owner, err := acquirePiOwnership(home, id)
	if err != nil {
		t.Fatal(err)
	}
	defer owner.release()
	if err := owner.markBrowser("ws_example123", cwd); err != nil {
		t.Fatal(err)
	}
	ws, err := os.Open(cwd)
	if err != nil {
		t.Fatal(err)
	}
	defer ws.Close()
	args := append([]string{cli, "--provider", "fixture", "--model", "fake", "--extension", ext}, recorder...)
	p, err := launchPiRPCCommand(nativeNodePath(t), args, home, cwd, []string{"PATH=/usr/bin:/bin"}, owner, ws, "ws_example123")
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	settled := make(chan struct{}, 8)
	go func() {
		for event := range p.events {
			if strings.Contains(string(event), `"type":"agent_settled"`) {
				settled <- struct{}{}
			}
		}
	}()
	sessionPath := func() string {
		matches, _ := filepath.Glob(filepath.Join(home, ".pi", "agent", "sessions", "*", "*.jsonl"))
		if len(matches) != 1 {
			return ""
		}
		return matches[0]
	}
	ends := func() int {
		raw, _ := os.ReadFile(sessionPath())
		return strings.Count(string(raw), `"phase":"end"`)
	}
	turn := func(text string) {
		t.Helper()
		want := ends() + 1
		if accepted, err := p.request("prompt", text, 15*time.Second); !accepted || err != nil {
			t.Fatalf("prompt %q: %v %v", text, accepted, err)
		}
		select {
		case <-settled:
		case <-time.After(30 * time.Second):
			t.Fatalf("native Pi did not settle after %q", text)
		}
		// The recorder appends the run's end entry in its settle handler.
		for deadline := time.Now().Add(10 * time.Second); ends() < want; {
			if time.Now().After(deadline) {
				raw, _ := os.ReadFile(sessionPath())
				t.Fatalf("no end snapshot after %q:\n%s", text, raw)
			}
			time.Sleep(50 * time.Millisecond)
		}
	}
	read := func(name string) string {
		b, err := os.ReadFile(filepath.Join(cwd, name))
		if os.IsNotExist(err) {
			return "<missing>"
		}
		if err != nil {
			t.Fatal(err)
		}
		return string(b)
	}
	turn("Aja skripti")
	if read("notes.txt") != "changed by python\nsecond line\n" || read("config.txt") != "name=beta\n" || read("old.txt") != "<missing>" || read("gen/out.txt") != "generated\n" {
		t.Fatalf("the synthetic commands did not run: %q %q %q", read("notes.txt"), read("config.txt"), read("old.txt"))
	}
	turn("Yksi lisää")

	controller := &ConversationController{home: home, cfg: transport.Config{Home: home, UID: os.Geteuid()}, sessions: map[string]*conversation{}}
	s := &conversation{id: id, cwd: cwd, rpc: p, state: "idle"}
	controller.sessions[id] = s
	sessions, err := nativeSessions(controller.nativeCfg())
	if err != nil || len(sessions) != 1 {
		t.Fatalf("native sessions: %+v %v", sessions, err)
	}
	page := readNativeWindowSettled(sessions[0].path, os.Geteuid(), "", 1000, "")
	var keys []string
	for _, e := range page.entries {
		if e.Kind == "user" {
			keys = append(keys, e.Key)
		}
	}
	if len(keys) != 2 {
		t.Fatalf("user messages %v", keys)
	}
	get := func(query string) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		controller.rewindRead(w, httptest.NewRequest(http.MethodGet, "http://unix/api/v1/conversations/"+id+"/rewind?"+query, nil), id)
		return w
	}
	post := func(body string) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodPost, "http://unix/api/v1/conversations/"+id+"/rewind", strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		controller.rewind(w, r, id)
		return w
	}

	// Muutokset for the script's turn, from its snapshots.
	w := get("turn=" + keys[0])
	var changes turnChangesReply
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &changes) != nil {
		t.Fatalf("turn changes: %d %s", w.Code, w.Body.String())
	}
	validateRewind(t, w.Body.Bytes())
	byPath := map[string]turnChangeFile{}
	for _, f := range changes.Files {
		byPath[f.Path] = f
	}
	if !changes.Snapshot || !changes.Settled || len(changes.Files) != 4 {
		t.Fatalf("turn changes %+v", changes)
	}
	count := func(f turnChangeFile, add, del int) bool {
		return f.Additions != nil && *f.Additions == add && f.Deletions != nil && *f.Deletions == del
	}
	if f := byPath["notes.txt"]; f.Change != "modified" || !count(f, 2, 1) {
		t.Fatalf("notes.txt: %+v", f)
	}
	if f := byPath["config.txt"]; f.Change != "modified" || !count(f, 1, 1) {
		t.Fatalf("config.txt: %+v", f)
	}
	if f := byPath["old.txt"]; f.Change != "deleted" || !count(f, 0, 2) {
		t.Fatalf("old.txt: %+v", f)
	}
	if f := byPath["gen/out.txt"]; f.Change != "added" {
		t.Fatalf("gen/out.txt: %+v", f)
	}
	w = get("turn=" + keys[0] + "&path=config.txt")
	if w.Code != 200 || !strings.Contains(w.Body.String(), `-name=alpha\n+name=beta`) {
		t.Fatalf("turn diff: %d %s", w.Code, w.Body.String())
	}
	validateRewind(t, w.Body.Bytes())
	if w := get("turn=" + keys[0] + "&path=keep.txt"); w.Code != 404 {
		t.Fatalf("a file outside the turn's list: %d", w.Code)
	}
	// The second turn's own window holds only its own change.
	if w := get("turn=" + keys[1]); !strings.Contains(w.Body.String(), `"path":"notes.txt"`) || strings.Contains(w.Body.String(), "config.txt") {
		t.Fatalf("second turn: %s", w.Body.String())
	}

	// The preview before the script's message names every file the runs
	// changed since, against the files as they are now.
	w = get("entry=" + keys[0])
	var preview rewindPreview
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &preview) != nil {
		t.Fatalf("preview: %d %s", w.Code, w.Body.String())
	}
	validateRewind(t, w.Body.Bytes())
	got := map[string]string{}
	for _, f := range preview.Files {
		got[f.Path] = f.Change
	}
	if !preview.Checkpoint || got["notes.txt"] != "modified" || got["config.txt"] != "modified" || got["old.txt"] != "deleted" || got["gen/out.txt"] != "created" || len(got) != 4 {
		t.Fatalf("preview %+v", preview)
	}

	// Conversation and files back to before the script.
	if w := post(`{"action":"rewind","entry_key":"` + keys[0] + `","conversation":true,"files":true}`); w.Code != 200 || !strings.Contains(w.Body.String(), `"restored":4`) {
		t.Fatalf("rewind: %d %s", w.Code, w.Body.String())
	}
	original := func(when string) {
		t.Helper()
		if read("notes.txt") != files["notes.txt"] || read("config.txt") != files["config.txt"] || read("old.txt") != files["old.txt"] || read("gen/out.txt") != "<missing>" {
			t.Fatalf("files %s: %q %q %q %q", when, read("notes.txt"), read("config.txt"), read("old.txt"), read("gen/out.txt"))
		}
	}
	original("after rewind")
	entries := readNativeWindowSettled(sessions[0].path, os.Geteuid(), "", 1000, "").entries
	marker := entries[len(entries)-1]
	if marker.Rewind == nil || !marker.Rewind.FilesReturn {
		t.Fatalf("marker %+v", marker.Rewind)
	}
	// Back to the replaced continuation, with its files.
	if w := post(`{"action":"switch","marker_key":"` + marker.Key + `","files":true}`); w.Code != 200 {
		t.Fatalf("switch: %d %s", w.Code, w.Body.String())
	}
	changed := func(when string) {
		t.Helper()
		if read("notes.txt") != "changed by python\nsecond line\nmore\n" || read("config.txt") != "name=beta\n" || read("old.txt") != "<missing>" || read("gen/out.txt") != "generated\n" {
			t.Fatalf("files %s: %q %q %q %q", when, read("notes.txt"), read("config.txt"), read("old.txt"), read("gen/out.txt"))
		}
	}
	changed("after switch")

	// Files only, then undone.
	if w := post(`{"action":"rewind","entry_key":"` + keys[0] + `","conversation":false,"files":true}`); w.Code != 200 {
		t.Fatalf("files only: %d %s", w.Code, w.Body.String())
	}
	original("after files-only restore")
	entries = readNativeWindowSettled(sessions[0].path, os.Geteuid(), "", 1000, "").entries
	filesMarker := entries[len(entries)-1]
	if filesMarker.Rewind == nil || filesMarker.Rewind.Action != "files" {
		t.Fatalf("files marker %+v", filesMarker)
	}
	if w := post(`{"action":"undo","marker_key":"` + filesMarker.Key + `"}`); w.Code != 200 {
		t.Fatalf("undo: %d %s", w.Code, w.Body.String())
	}
	changed("after undo")
	// The workspace repository was only read: no commit, branch or index
	// change, and the ignored directory untouched.
	cmd := exec.Command("/usr/bin/git", "-C", cwd, "status", "--porcelain")
	cmd.Env = []string{"HOME=" + home, "PATH=/usr/bin:/bin", "GIT_CONFIG_NOSYSTEM=1"}
	out, _ := cmd.Output()
	if !strings.Contains(string(out), " M notes.txt") || !strings.Contains(string(out), " D old.txt") {
		t.Fatalf("workspace status: %s", out)
	}
}
