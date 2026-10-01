//go:build linux

package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"github.com/maintainer/native-agent-host/internal/transport"
	"golang.org/x/sys/unix"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"strconv"
	"testing"
)

func TestSnapshotNativeStatusOnlyAfterTrust(t *testing.T) {
	u, err := user.Current()
	if err != nil {
		t.Fatal(err)
	}
	uid, _ := strconv.Atoi(u.Uid)
	cfg := transport.Config{GatewayUID: uid, UID: uid, Username: u.Username, Home: u.HomeDir, Provider: "github", Subject: "42", Socket: "/run/native-agent-host/users/" + u.Username + "/daemon.sock"}
	calls := 0
	status := "connected"
	h := snapshotHandlerWithStatus(cfg, func(*http.Request) bool { return true }, func(transport.Config) Discovery { return Discovery{State: "empty"} }, func(transport.Config) ([]nativeSession, error) { return nil, nil }, t.TempDir(), func(context.Context) string { calls++; return status })
	request := func(id string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("GET", "http://unix/api/v1/snapshot", nil)
		r.RequestURI = SnapshotPath
		r.Header.Set("X-Agent-Host-Identity", id)
		r.Header.Set("X-Agent-Host-Display-Name", "GitHub user 42")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	if w := request(opaque("wid_", "github:99")); w.Code != 200 || calls != 1 {
		t.Fatalf("untrusted probe: %d calls=%d", w.Code, calls)
	}
	deniedHandler := snapshotHandlerWithStatus(cfg, func(*http.Request) bool { return false }, func(transport.Config) Discovery { t.Fatal("untrusted peer reached discovery"); return Discovery{} }, func(transport.Config) ([]nativeSession, error) { return nil, nil }, t.TempDir(), func(context.Context) string { t.Fatal("untrusted peer reached native status"); return "unknown" })
	denied := httptest.NewRecorder()
	untrusted := httptest.NewRequest("GET", "http://unix/api/v1/snapshot", nil)
	untrusted.RequestURI = SnapshotPath
	deniedHandler.ServeHTTP(denied, untrusted)
	if denied.Code != 403 {
		t.Fatalf("peer accepted: %d", denied.Code)
	}
	for _, state := range []string{"connected", "disconnected", "partial", "unknown", "invalid"} {
		status = state
		w := request(opaque("wid_", "github:42"))
		if w.Code != 200 {
			t.Fatalf("%s: %d", state, w.Code)
		}
		var doc struct {
			Auth struct {
				NativeGitHub struct {
					State string `json:"state"`
				} `json:"native_github"`
			} `json:"auth"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &doc); err != nil {
			t.Fatal(err)
		}
		want := state
		if state == "invalid" {
			want = "unknown"
		}
		if doc.Auth.NativeGitHub.State != want || bytes.Contains(w.Body.Bytes(), []byte("oauth_token")) {
			t.Fatalf("state=%s body=%s", state, w.Body.String())
		}
	}
	if calls != 6 {
		t.Fatal(calls)
	}
}

func TestSnapshotDiscoveryAndSchema(t *testing.T) {
	u, err := user.Current()
	if err != nil {
		t.Fatal(err)
	}
	uid, _ := strconv.Atoi(u.Uid)
	home := t.TempDir()
	if err := os.Mkdir(filepath.Join(home, "src"), 0700); err != nil {
		t.Fatal(err)
	}
	src := filepath.Join(home, "src")
	for _, name := range []string{"ordinary", "repository", "annotated"} {
		if err := os.Mkdir(filepath.Join(src, name), 0700); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.Mkdir(filepath.Join(src, "repository", ".git"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(src, "annotated", ".agent-host"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(src, "annotated", ".agent-host", "workspace.json"), []byte(`{"schema_version":1,"workspace_id":"ws_known123","display_name":"Named"}`), 0600); err != nil {
		t.Fatal(err)
	}
	cfg := transport.Config{GatewayUID: uid, UID: uid, Username: u.Username, Home: u.HomeDir, Provider: "github", Subject: "42"}
	cfg.Socket = "/run/native-agent-host/users/" + u.Username + "/daemon.sock"
	// The discovery seam uses a disposable root; production always calls Discover(cfg).
	state := func(_ transport.Config) Discovery { return scan(home, uid, unix.Openat2) }
	h := SnapshotHandlerWithNativeRoot(cfg, func(*http.Request) bool { return true }, state, home)
	request := func() *httptest.ResponseRecorder {
		r := httptest.NewRequest("GET", "http://unix/api/v1/snapshot", nil)
		r.RequestURI = SnapshotPath
		r.Header.Set("X-Agent-Host-Identity", opaque("wid_", "github:42"))
		r.Header.Set("X-Agent-Host-Display-Name", "GitHub user 42")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	check := func(w *httptest.ResponseRecorder, want int) map[string]any {
		t.Helper()
		if w.Code != want {
			t.Fatalf("status %d: %s", w.Code, w.Body.String())
		}
		if bytes.Contains(w.Body.Bytes(), []byte(home)) || bytes.Contains(w.Body.Bytes(), []byte(u.HomeDir)) {
			t.Fatal("absolute path leaked")
		}
		if want != 200 {
			return nil
		}
		python := os.Getenv("PYTHON")
		if python == "" {
			python = "python3"
		}
		cmd := exec.Command(python, "-c", `import sys,runpy,json; m=runpy.run_path('../../issues/define-host-contracts/validate_contracts.py'); m['Draft202012Validator'](m['schemas']['snapshot.schema.json'],registry=m['registry'],format_checker=m['format_checker']).validate(json.load(sys.stdin))`)
		cmd.Stdin = bytes.NewReader(w.Body.Bytes())
		if out, e := cmd.CombinedOutput(); e != nil {
			t.Fatalf("schema: %s: %v", out, e)
		}
		var doc map[string]any
		if e := json.Unmarshal(w.Body.Bytes(), &doc); e != nil {
			t.Fatal(e)
		}
		return doc
	}
	doc := check(request(), 200)
	ws := doc["workspaces"].([]any)
	if len(ws) != 3 {
		t.Fatal(ws)
	}
	if ws[0].(map[string]any)["workspace_id"] != "ws_known123" || ws[1].(map[string]any)["kind"] != "directory" || ws[2].(map[string]any)["kind"] != "git_main_worktree" {
		t.Fatal(ws)
	}
	if doc["write_state"] != "read_only" {
		t.Fatal(doc)
	}
	if request().Body.String() == "" {
		t.Fatal("empty")
	}
	state = func(_ transport.Config) Discovery {
		return Discovery{State: "partial", Entries: []Workspace{{Name: "ordinary", Kind: "unknown", Metadata: "error"}}}
	}
	h = SnapshotHandlerWithNativeRoot(cfg, func(*http.Request) bool { return true }, state, home)
	partial := check(request(), 200)
	if partial["sources"].([]any)[0].(map[string]any)["state"] != "unknown" || partial["workspaces"].([]any)[0].(map[string]any)["kind"] != "unknown" {
		t.Fatal(partial)
	}
	state = func(_ transport.Config) Discovery { return scan(home, uid, unix.Openat2) }
	h = SnapshotHandlerWithNativeRoot(cfg, func(*http.Request) bool { return true }, state, home)
	for _, name := range []string{"ordinary", "repository", "annotated"} {
		if err := os.RemoveAll(filepath.Join(src, name)); err != nil {
			t.Fatal(err)
		}
	}
	if d := check(request(), 200); len(d["workspaces"].([]any)) != 0 || d["sources"].([]any)[0].(map[string]any)["state"] != "confirmed" {
		t.Fatal(d)
	}
	if err := os.Remove(src); err != nil {
		t.Fatal(err)
	}
	if d := check(request(), 200); d["sources"].([]any)[0].(map[string]any)["state"] != "absent" {
		t.Fatal(d)
	}
	state = func(transport.Config) Discovery { return Discovery{State: "error"} }
	// Closure replacement requires a fresh handler, never a request field.
	h = SnapshotHandlerWithNativeRoot(cfg, func(*http.Request) bool { return true }, state, home)
	check(request(), 503)
}
