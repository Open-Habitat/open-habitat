//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/transport"
)

// Exercise the production route table over an actual own-UID listener, while
// browser trust is false. No fabricated transport context or gateway capability.
func agentWorkspaceClient(t *testing.T, f *trashFixture, supplied ...*CloneJobs) func(string, string, any, int) map[string]any {
	t.Helper()
	f.c.trusted = func(*http.Request) bool { return false }
	f.cfg.Socket = filepath.Join(f.cfg.Home, "daemon.sock")
	socket := filepath.Join(f.cfg.Home, "agent.sock")
	ln, err := net.ListenUnix("unix", &net.UnixAddr{Name: socket, Net: "unix"})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	clones := NewCloneJobs(ctx, f.cfg, func(*http.Request) bool { return false })
	if len(supplied) > 0 {
		clones = supplied[0]
	}
	done := make(chan error, 1)
	go func() {
		done <- transport.ServeAgent(ctx, ln, f.cfg, agentHandler(f.cfg, f.c, "test", "", nil, clones))
	}()
	tr := &http.Transport{DialContext: func(context.Context, string, string) (net.Conn, error) { return net.Dial("unix", socket) }}
	t.Cleanup(func() {
		tr.CloseIdleConnections()
		cancel()
		if err := <-done; err != nil {
			t.Error(err)
		}
	})
	client := &http.Client{Transport: tr, Timeout: 30 * time.Second}
	return func(method, path string, body any, want int) map[string]any {
		t.Helper()
		var text string
		if raw, ok := body.(string); ok {
			text = raw
		} else if body != nil {
			b, _ := json.Marshal(body)
			text = string(b)
		}
		r, _ := http.NewRequest(method, "http://unix"+path, strings.NewReader(text))
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("X-UID", "0")
		r.Header.Set("X-Username", "other")
		res, err := client.Do(r)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		b, _ := io.ReadAll(res.Body)
		if res.StatusCode != want {
			t.Fatalf("%s %s %s: %d %s", method, path, text, res.StatusCode, b)
		}
		var out map[string]any
		if json.Unmarshal(b, &out) != nil {
			t.Fatal(string(b))
		}
		return out
	}
}

func TestAgentWorkspaceSafety(t *testing.T) {
	f := newTrashFixture(t)
	request := agentWorkspaceClient(t, f)
	post := func(body any, want int) map[string]any {
		return request("POST", AgentWorkspaceOperationsPath, body, want)
	}
	listing := request("GET", AgentWorkspacesPath, nil, 200)
	post(map[string]any{"action": "create", "name": "example", "git": false, "user_observation_token": "obs_stale"}, 409)
	created := post(map[string]any{"action": "create", "name": "example", "git": false, "user_observation_token": listing["user_observation_token"]}, 200)
	post(map[string]any{"action": "create", "name": "example", "git": false, "user_observation_token": listing["user_observation_token"]}, 409)
	id, token := f.target("example")
	if id != created["workspace_id"] {
		t.Fatal(created)
	}
	post(map[string]any{"action": "settings", "workspace_id": id, "observation_token": "obs_stale", "display_name": "Label"}, 409)
	post(map[string]any{"action": "settings", "workspace_id": id, "observation_token": token, "display_name": "Label"}, 200)
	post(map[string]any{"action": "visibility", "workspace_id": id, "observation_token": token, "hidden": true}, 200)
	rows := request("GET", AgentWorkspacesPath, nil, 200)["workspaces"].([]any)
	found := false
	for _, row := range rows {
		m := row.(map[string]any)
		if m["workspace_id"] == id {
			found = m["hidden"] == true && m["display_name"] == "Label" && m["observation_token"] == token
		}
	}
	if !found {
		t.Fatal(rows)
	}
	post(map[string]any{"action": "delete", "workspace_id": id, "observation_token": "obs_stale", "disposal": "trash"}, 409)
	post(map[string]any{"action": "delete_check", "workspace_id": id, "observation_token": token}, 200)
	removed := post(map[string]any{"action": "delete", "workspace_id": id, "observation_token": token, "disposal": "trash"}, 200)
	if removed["state"] != "trashed" {
		t.Fatal(removed)
	}
	entry := removed["entry"]
	post(map[string]any{"action": "trash_inspect", "entry": entry}, 200)
	post(map[string]any{"action": "trash_delete", "entry": entry, "confirmation": "wrong"}, 409)
	if _, err := os.Stat(f.trash("files", entry.(string))); err != nil {
		t.Fatal("typed confirmation removed data", err)
	}
	post(map[string]any{"action": "trash_empty", "listing_token": "listing_stale1234567890123456"}, 400)
	post(map[string]any{"action": "trash_restore", "entry": entry}, 200)
	post(map[string]any{"action": "trash_empty", "listing_token": strings.Repeat("0", 64)}, 409)
	if _, err := os.Stat(f.src("example")); err != nil {
		t.Fatal(err)
	}
	// Unknown/duplicate fields and browser operations stay absent, even for owner.
	for _, body := range []string{`{"action":"trash_list","uid":0}`, `{"action":"trash_list","action":"trash_empty"}`, `{"action":"delete","workspace_id":"/other/home"}`} {
		post(body, 400)
	}
	for _, action := range []string{"git_init", "conversation_archive", "publish", "handoff", "terminal", "provision"} {
		post(fmt.Sprintf(`{"action":%q}`, action), 404)
	}
	request("GET", AgentWorkspacesPath, `{}`, 400)
	request("POST", AgentWorkspaceOperationsPath+"?uid=0", `{"action":"trash_list"}`, 400)
	request("GET", AgentRepositoriesPath+"?uid=0", nil, 400)
	request("GET", AgentRepositoryPath+"?full_name=example%2Fproject&uid=0", nil, 400)
	request("GET", AgentCheckoutPath+"?full_name=example%2Fproject&uid=0", nil, 400)
	request("POST", AgentClonesPath, `{"action":"start","full_name":"example/project","mode":"full","token":"never-echo"}`, 400)
	request("POST", AgentClonesPath, `{"action":"cancel","job_id":"00000000000000000000000000000000"}`, 404)
	request("GET", AgentClonesPath, nil, 200)
	for _, path := range []string{RepoCatalogPath, RepoClonesPath, "/agent/v1/repositories/publish", "/api/v1/onboarding/github/token"} {
		request("POST", path, `{}`, 404)
	}
}

func TestAgentWorktreeFreshnessAndTypedForce(t *testing.T) {
	f := newWorktreeFixture(t)
	f.add("dirty", false)
	write(t, filepath.Join(f.wt("dirty"), "untracked"), "precious")
	request := agentWorkspaceClient(t, f.trashFixture)
	post := func(body any, want int) map[string]any {
		return request("POST", AgentWorkspaceOperationsPath, body, want)
	}
	listing := post(map[string]any{"action": "worktree_list", "workspace_id": f.id}, 200)
	row := listing["worktrees"].([]any)[0].(map[string]any)
	body := map[string]any{"action": "worktree_remove", "workspace_id": f.id, "entry": row["entry"], "observation_token": row["observation_token"], "disposal": "force", "confirmation": "wrong"}
	post(body, 409)
	body["confirmation"] = "dirty"
	// Changing native contents invalidates the observed worktree before force.
	write(t, filepath.Join(f.wt("dirty"), "second"), "new")
	post(body, 409)
	if _, err := os.Stat(f.wt("dirty")); err != nil {
		t.Fatal("stale/typed safety lost data", err)
	}
	listing = post(map[string]any{"action": "worktree_list", "workspace_id": f.id}, 200)
	row = listing["worktrees"].([]any)[0].(map[string]any)
	body["observation_token"] = row["observation_token"]
	result := post(body, 200)
	if result["state"] != "removed" {
		t.Fatal(result)
	}
	if _, err := os.Stat(f.wt("dirty")); !os.IsNotExist(err) {
		t.Fatal("explicit force did not remove", err)
	}
	// A prior listing cannot authorize cleaning a newly merged entry.
	f.add("fresh", false)
	post(map[string]any{"action": "worktree_clean_merged", "workspace_id": f.id, "listing_token": listing["listing_token"]}, 409)
}

func TestAgentWorkspaceRoutesWithoutPeer(t *testing.T) {
	h := agentHandler(transport.Config{Home: "/must-not-read"}, nil, "test", "", nil)
	for _, path := range []string{AgentWorkspaceOperationsPath, AgentRepositoriesPath, AgentRepositoryPath, AgentCheckoutPath, AgentClonesPath} {
		r := httptest.NewRequest("POST", path, strings.NewReader(`{"action":"trash_empty"}`))
		r.Header.Set("X-UID", fmt.Sprint(os.Geteuid()))
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != 403 {
			t.Fatalf("no peer: %s %d", path, w.Code)
		}
	}
}

func TestAgentCloneJobsNativeOutcome(t *testing.T) {
	for _, fail := range []bool{false, true} {
		t.Run(fmt.Sprint(fail), func(t *testing.T) {
			f := newTrashFixture(t)
			program := gitWrapper(t, t.TempDir(), seedBare(t), fail)
			jobs := newCloneJobsFixture(t, f.cfg.Home, program)
			jobs.jobs.trusted = func(*http.Request) bool { return false }
			request := agentWorkspaceClient(t, f, jobs.jobs)
			started := request("POST", AgentClonesPath, map[string]any{"action": "start", "full_name": "org/repo", "mode": "full"}, 200)
			id := started["job"].(map[string]any)["job_id"]
			jobs.settle()
			listing := request("GET", AgentClonesPath, nil, 200)
			rows := listing["jobs"].([]any)
			if len(rows) != 1 {
				t.Fatal(listing)
			}
			job := rows[0].(map[string]any)
			want := "confirmed"
			if fail {
				want = "failed"
			}
			if job["state"] != want || job["job_id"] != id {
				t.Fatal(job)
			}
			raw, _ := json.Marshal(listing)
			if strings.Contains(string(raw), "secret") || strings.Contains(string(raw), "user:") {
				t.Fatal("native failure leaked credentials")
			}
			request("POST", AgentClonesPath, map[string]any{"action": "dismiss", "job_id": id}, 200)
			if len(request("GET", AgentClonesPath, nil, 200)["jobs"].([]any)) != 0 {
				t.Fatal("dismiss did not forget finished job")
			}
		})
	}
}

func TestAgentWorkspaceCorruptAnnotationsStillObserveNative(t *testing.T) {
	f := newTrashFixture(t)
	request := agentWorkspaceClient(t, f)
	before := request("GET", AgentWorkspacesPath, nil, 200)
	write(t, filepath.Join(f.cfg.Home, ".local", "state", "open-habitat", "user-state.json"), "truncated")
	after := request("GET", AgentWorkspacesPath, nil, 200)
	if after["annotation_state"] != "unreadable" || len(after["workspaces"].([]any)) != len(before["workspaces"].([]any)) {
		t.Fatal(after)
	}
	row := after["workspaces"].([]any)[0].(map[string]any)
	if row["hidden"] != nil || row["observation_token"] == nil {
		t.Fatal("unknown annotations disguised as visible or lost native observation", row)
	}
	// Corrupt presentation state still cannot authorize a visibility overwrite.
	request("POST", AgentWorkspaceOperationsPath, map[string]any{"action": "visibility", "workspace_id": row["workspace_id"], "observation_token": row["observation_token"], "hidden": true}, 409)
}
