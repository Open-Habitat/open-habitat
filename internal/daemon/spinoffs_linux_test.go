//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

const spinoffFixtureID = "01m521vczarx5bkx086n64t1t2"
const spinoffSession = "11111111-1111-4111-8111-111111111111"
const spinoffParent = "22222222-2222-4222-8222-222222222222"

func spinoffFixture(t *testing.T) (transport.Config, spinoffNode) {
	t.Helper()
	home := t.TempDir()
	cfg := transport.Config{Home: home, UID: os.Getuid(), Provider: "github", Subject: "42"}
	attempt := 0
	n := spinoffNode{NodeID: "n-0001", Harness: "pi", SessionID: spinoffSession, Attempt: &attempt, OriginalCwd: "/invented/removed-checkout", Worktree: "/invented/removed-checkout", Support: "supported", Original: spinoffTranscriptPath{Anchor: "run-root", Path: strptr("evidence/n-0001/pi-session.original.jsonl"), Availability: "available"}, Live: spinoffTranscriptPath{Anchor: "state-root", Path: strptr(".creating/pi-sessions/" + spinoffFixtureID + "/worker.jsonl"), Availability: "available"}}
	return cfg, n
}
func strptr(s string) *string { return &s }
func writeSpinoffFile(t *testing.T, cfg transport.Config, path, session, cwd string) {
	t.Helper()
	p := filepath.Join(cfg.Home, ".taskfleet", path)
	if e := os.MkdirAll(filepath.Dir(p), 0700); e != nil {
		t.Fatal(e)
	}
	b := fmt.Sprintf("{\"type\":\"session\",\"version\":3,\"id\":%q,\"cwd\":%q}\n{\"id\":\"msg-1\",\"type\":\"message\",\"parentId\":null,\"message\":{\"role\":\"assistant\",\"content\":[{\"type\":\"text\",\"text\":\"Archived answer\"}]}}\n", session, cwd)
	if e := os.WriteFile(p, []byte(b), 0600); e != nil {
		t.Fatal(e)
	}
}
func TestSpinoffTranscriptConfinement(t *testing.T) {
	for _, mode := range []string{"archive", "live", "wrong-session", "wrong-cwd", "symlink", "parent-symlink", "escape", "foreign-owner"} {
		t.Run(mode, func(t *testing.T) {
			cfg, n := spinoffFixture(t)
			path := filepath.Join("runs", spinoffFixtureID, *n.Original.Path)
			if mode == "live" {
				path = *n.Live.Path
				n.Original.Availability = "missing"
			}
			session, cwd := n.SessionID, n.OriginalCwd
			if mode == "wrong-session" {
				session = spinoffParent
			}
			if mode == "wrong-cwd" {
				cwd = "/different/checkout"
			}
			writeSpinoffFile(t, cfg, path, session, cwd)
			expected := "unavailable"
			if mode == "archive" || mode == "live" {
				expected = "available"
			}
			if mode == "escape" {
				n.Original.Path = strptr("../../../../secret.jsonl")
			}
			target := filepath.Join(cfg.Home, ".taskfleet", path)
			if mode == "symlink" {
				b, _ := os.ReadFile(target)
				outside := filepath.Join(cfg.Home, "outside")
				_ = os.WriteFile(outside, b, 0600)
				_ = os.Remove(target)
				_ = os.Symlink(outside, target)
			}
			if mode == "parent-symlink" {
				dir := filepath.Dir(target)
				_ = os.Rename(dir, dir+"-moved")
				_ = os.Symlink(dir+"-moved", dir)
			}
			if mode == "foreign-owner" {
				cfg.UID = os.Getuid() + 1
			}
			got := readSpinoffTranscript(cfg, spinoffFixtureID, n)
			if got.Availability != expected {
				t.Fatalf("%s: %+v", mode, got)
			}
			if expected == "available" && (len(got.Entries) != 1 || got.Entries[0].Blocks[0].Text != "Archived answer") {
				t.Fatalf("lost native content: %+v", got)
			}
		})
	}
}
func TestSpinoffAttributionAndReadOnlyHTTP(t *testing.T) {
	cfg, n := spinoffFixture(t)
	parent := nativeSession{id: spinoffParent, cwd: "/invented/source", state: "readable"}
	creator := struct {
		Harness   string `json:"harness"`
		SessionID string `json:"session_id"`
	}{"pi", spinoffParent}
	run := nativeSpinoff{ID: spinoffFixtureID, Kind: "spinoff", Title: "Fixture child", Status: "running", SourceRepo: "/invented/sibling", Creator: &creator, Nodes: []spinoffNode{n}, CreatedAt: "2026-10-16T10:00:00Z"}
	for _, mode := range []string{"match", "other-session", "other-workspace", "relative-repo", "nested", "other-kind", "malformed-id"} {
		t.Run(mode, func(t *testing.T) {
			r := run
			c := creator
			r.Creator = &c
			want := false
			switch mode {
			case "match":
				want = true
			case "other-session":
				c.SessionID = spinoffSession
			case "other-workspace":
				r.SourceRepo = "/elsewhere"
				want = true
			case "relative-repo":
				r.SourceRepo = "."
			case "nested":
				r.CreatorRun = strptr(spinoffFixtureID)
			case "other-kind":
				r.Kind = "unknown-kind"
			case "malformed-id":
				r.ID = "--help"
			}
			if belongsSpinoff(r, parent) != want {
				t.Fatal("incorrect grouping")
			}
		})
	}
	for _, kind := range []string{"research", "technical-decision", "fan-out"} {
		r := run
		r.Kind = kind
		if !belongsSpinoff(r, parent) {
			t.Fatalf("direct native worker kind hidden: %s", kind)
		}
	}
	caller := run
	caller.AgentOwner = "caller"
	if belongsSpinoff(caller, parent) {
		t.Fatal("caller-owned run treated as Taskfleet worker")
	}
	bin := filepath.Join(cfg.Home, ".local", "bin", "taskfleet")
	if e := os.MkdirAll(filepath.Dir(bin), 0700); e != nil {
		t.Fatal(e)
	}
	b, _ := json.Marshal(map[string]any{"schema_version": 1, "data": map[string]any{"runs": []nativeSpinoff{run}}})
	run.Report.Reason = "Synthetic merge conflict"
	run.WorktreePath = "/invented/worker-checkout"
	detail, _ := json.Marshal(map[string]any{"schema_version": 1, "data": run})
	script := "#!/bin/sh\nfor arg; do [ \"$arg\" != --repo ] || exit 1; done\ncase \"$1\" in version) printf '%s' '{\"schema_version\":1,\"data\":{\"version\":\"0.15.0\"}}';; *) if [ \"$2\" = show ]; then printf '%s' '" + string(detail) + "'; else printf '%s' '" + string(b) + "'; fi;; esac\n"
	if e := os.WriteFile(bin, []byte(script), 0700); e != nil {
		t.Fatal(e)
	}
	t.Setenv("PATH", filepath.Dir(bin))
	h := historyHandlerWithReader(cfg, func(*http.Request) bool { return true }, func(transport.Config) ([]nativeSession, error) { return []nativeSession{parent}, nil })
	for _, method := range []string{"GET", "POST", "DELETE"} {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(method, "http://unix/api/v1/agents/pi:"+spinoffParent+"/spinoffs", nil)
		r.Header.Set("X-Agent-Host-Identity", opaque("wid_", "github:42"))
		h.ServeHTTP(w, r)
		if method == "GET" {
			if w.Code != 200 || !strings.Contains(w.Body.String(), "Fixture child") {
				t.Fatalf("%d %s", w.Code, w.Body.String())
			}
		} else if w.Code == 200 {
			t.Fatal("spinoff write accepted")
		}
	}
	selected := httptest.NewRecorder()
	h.ServeHTTP(selected, httptest.NewRequest("GET", "http://unix/api/v1/agents/pi:"+spinoffParent+"/spinoffs?run="+spinoffFixtureID, nil))
	if selected.Code != 200 || !strings.Contains(selected.Body.String(), "Synthetic merge conflict") || !strings.Contains(selected.Body.String(), "/invented/worker-checkout") {
		t.Fatalf("native result fields lost: %d %s", selected.Code, selected.Body.String())
	}
	h = historyHandlerWithReader(cfg, func(*http.Request) bool { return false }, func(transport.Config) ([]nativeSession, error) {
		t.Fatal("read before peer authorization")
		return nil, nil
	})
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("GET", "/api/v1/agents/pi:"+spinoffParent+"/spinoffs", nil))
	if w.Code != 403 {
		t.Fatal(w.Code)
	}
}
func TestSpinoffUnavailableTaskfleet(t *testing.T) {
	home := t.TempDir()
	binary := filepath.Join(home, ".local", "bin", "taskfleet")
	if err := os.MkdirAll(filepath.Dir(binary), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(binary, []byte("#!/bin/sh\nexit 127\n"), 0700); err != nil {
		t.Fatal(err)
	}
	var result any
	if taskfleetRead(context.Background(), home, []string{"run", "list", "--output", "json"}, &result) {
		t.Fatal("unavailable native reader appeared available")
	}
}
func TestSpinoffStateHonesty(t *testing.T) {
	for _, c := range []struct {
		r    nativeSpinoff
		want string
	}{{nativeSpinoff{Status: "running"}, "working"}, {nativeSpinoff{Status: "running", Lifecycle: "interactive", Attention: true}, "waiting_parent"}, {nativeSpinoff{Status: "failed", Landed: true}, "merged"}, {nativeSpinoff{Status: "failed"}, "unmerged"}, {nativeSpinoff{Status: "running", Stalled: true}, "unknown"}, {nativeSpinoff{Status: "running", Attention: true}, "unknown"}} {
		if got := spinoffState(c.r); got != c.want {
			t.Fatalf("%+v -> %s", c.r, got)
		}
	}
}

func TestSpinoffArchivePreferredAndLiveFallback(t *testing.T) {
	cfg, n := spinoffFixture(t)
	archive := filepath.Join("runs", spinoffFixtureID, *n.Original.Path)
	writeSpinoffFile(t, cfg, archive, n.SessionID, n.OriginalCwd)
	writeSpinoffFile(t, cfg, *n.Live.Path, spinoffParent, n.Worktree) // stale/wrong worker must not be substituted
	if got := readSpinoffTranscript(cfg, spinoffFixtureID, n); got.Availability != "available" {
		t.Fatal(got)
	}
	_ = os.Remove(filepath.Join(cfg.Home, ".taskfleet", archive))
	if got := readSpinoffTranscript(cfg, spinoffFixtureID, n); got.Availability != "unavailable" {
		t.Fatal("wrong live worker accepted", got)
	}
	writeSpinoffFile(t, cfg, *n.Live.Path, n.SessionID, n.Worktree)
	if got := readSpinoffTranscript(cfg, spinoffFixtureID, n); got.Availability != "available" {
		t.Fatal("valid live fallback refused", got)
	}
}

func TestSpinoffCreatorHintDoesNotBreakUppercaseNativeID(t *testing.T) {
	for _, id := range []string{"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA", "------------------------------------"} {
		t.Run(id, func(t *testing.T) {
			home := t.TempDir()
			script := filepath.Join(home, "pi")
			_ = os.WriteFile(script, []byte("#!/bin/sh\ncat >/dev/null\n"), 0700)
			lock, e := os.CreateTemp(home, "owner")
			if e != nil {
				t.Fatal(e)
			}
			defer lock.Close()
			owner := &piOwnership{file: lock, id: id}
			p, e := launchPiRPCWithOwnership(script, home, home, "", []string{"PATH=/usr/bin:/bin"}, owner)
			if e != nil {
				t.Fatal(e)
			}
			defer p.close()
			found := false
			for _, v := range p.cmd.Env {
				if strings.HasPrefix(v, "TASKFLEET_CREATOR_SESSION=") {
					found = true
					if v != "TASKFLEET_CREATOR_SESSION=pi:"+id {
						t.Fatal(v)
					}
				}
			}
			if found != (id == "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa") {
				t.Fatalf("exported invalid creator: %v", found)
			}
		})
	}
}

func TestSpinoffWorktreeContainersAreNotOrdinaryWorkspaces(t *testing.T) {
	home := t.TempDir()
	entries := []Workspace{{Name: "source", Kind: "git_main_worktree", Metadata: "absent"}, {Name: "source__worktrees", Kind: "directory", Metadata: "absent"}, {Name: "personal__worktrees", Kind: "directory", Metadata: "absent"}, {Name: "annotated", Kind: "directory", Metadata: "valid"}, {Name: "direct-worker", Kind: "git_linked_worktree", Metadata: "absent"}}
	run := nativeSpinoff{ID: spinoffFixtureID, Kind: "spinoff", SourceRepo: filepath.Join(home, "src", "source"), Nodes: []spinoffNode{{Worktree: filepath.Join(home, "src", "source__worktrees", "wt-worker")}, {Worktree: filepath.Join(home, "src", "source", "nested-worker")}, {Worktree: filepath.Join(home, "src", "annotated", "worker")}, {Worktree: filepath.Join(home, "src", "direct-worker")}}}
	got := filterTaskfleetWorkspaces(home, entries, []nativeSpinoff{run})
	names := []string{}
	for _, e := range got {
		names = append(names, e.Name)
	}
	if strings.Join(names, ",") != "source,personal__worktrees,annotated" {
		t.Fatal(names)
	}
}

// The sidebar's working mark follows the parent's own working runs, not its
// wait process: a sibling checkout, another session, a settled or stalled
// run and a caller-owned run do not count.
func TestWorkingSpinoffsCountsOnlyTheParentsWorkingRuns(t *testing.T) {
	creator := func(id string) *struct {
		Harness   string `json:"harness"`
		SessionID string `json:"session_id"`
	} {
		return &struct {
			Harness   string `json:"harness"`
			SessionID string `json:"session_id"`
		}{"pi", id}
	}
	parent := nativeSession{id: spinoffParent, cwd: "/home/fixture/src/source"}
	run := func(edit func(*nativeSpinoff)) nativeSpinoff {
		r := nativeSpinoff{ID: spinoffFixtureID, Kind: "spinoff", Status: "running", SourceRepo: parent.cwd, Creator: creator(spinoffParent)}
		edit(&r)
		return r
	}
	runs := []nativeSpinoff{
		run(func(*nativeSpinoff) {}),
		run(func(r *nativeSpinoff) { r.Status = "pending"; r.SourceRepo = parent.cwd + "/web" }),
		run(func(r *nativeSpinoff) { r.SourceRepo = parent.cwd + "-sibling" }),
		run(func(r *nativeSpinoff) { r.Creator = creator("11111111-1111-4111-8111-111111111111") }),
		run(func(r *nativeSpinoff) { r.Status = "done" }),
		run(func(r *nativeSpinoff) { r.Stalled = true }),
		run(func(r *nativeSpinoff) { r.AgentOwner = "caller" }),
	}
	if got := workingSpinoffs(runs, parent); got != 3 {
		t.Fatalf("working spinoffs = %d, want 3", got)
	}
	if got := workingSpinoffs(nil, parent); got != 0 {
		t.Fatalf("no runs = %d", got)
	}
}

// Birch pilot.12: the conductor created an interactive Claude run in another
// repository (~/Sources, outside ~/src). Taskfleet 0.17.1 read its live
// supervisor as dead. The run still belongs to the conversation, also when a
// restarted daemon holds no wait for it, and reads as unknown, not settled.
func TestCrossRepositoryRunWithDoubtedSupervisorStaysTheConversations(t *testing.T) {
	native := `{"run_id":"01m5w60pxynq08hyrxde3s1dyn","kind":"spinoff","lifecycle":"interactive","status":"pending",
	"title":"release pilot.12","created_at":"2026-10-26T13:22:23.301499092Z","source_repo":"/home/fixture/Sources/fleetrepo",
	"source_branch":"main","worktree_path":"/home/fixture/Sources/fleetrepo__worktrees/wt-release","harness":"claude",
	"node_transcripts":[{"node_id":"n-0001","harness":"claude","attempt":null,"session_id":null,"original_cwd":null,
	"worktree_path":"/home/fixture/Sources/fleetrepo__worktrees/wt-release","support":"unsupported",
	"live":{"anchor":"state-root","path":null,"availability":"unsupported"},"original":{"anchor":"run-root","path":null,"availability":"unsupported"}}],
	"created_by_run_id":null,"created_by_session":{"harness":"pi","session_id":"` + spinoffParent + `"},
	"supervisor":{"pid":1643413,"state":"dead","alive":false},"stalled":false,"attention_required":false}`
	var r nativeSpinoff
	if err := json.Unmarshal([]byte(native), &r); err != nil {
		t.Fatal(err)
	}
	parent := nativeSession{id: spinoffParent, cwd: "/home/fixture/src/open-habitat", state: "readable"}
	if !belongsSpinoff(r, parent) {
		t.Fatal("cross-repository run not attributed to its creator conversation")
	}
	if got := spinoffState(r); got != "unknown" {
		t.Fatalf("state = %s, want unknown", got)
	}
	r.Supervisor.State = "alive"
	if got := workingSpinoffs([]nativeSpinoff{r}, parent); got != 1 {
		t.Fatalf("working = %d, want 1", got)
	}
}
