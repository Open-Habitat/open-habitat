//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/open-habitat/open-habitat/internal/transport"
)

func TestDiscoveryOmitsConventionalContainersWithoutNativeRecords(t *testing.T) {
	home := t.TempDir()
	cfg := transport.Config{Home: home, UID: os.Geteuid()}
	for _, name := range []string{"removed__worktrees", "empty__worktrees", "busy__worktrees/checkout"} {
		mkdir(t, filepath.Join(home, "src", name))
	}
	// Neither metadata nor unrelated contents makes the reserved container a workspace.
	mkdir(t, filepath.Join(home, "src", "busy__worktrees", ".agent-host"))
	put(t, filepath.Join(home, "src", "busy__worktrees", ".agent-host", "workspace.json"), `{"schema_version":1,"workspace_id":"ws_container00"}`)
	for _, discover := range []func(transport.Config) Discovery{Discover, DiscoverListing} {
		if got := discover(cfg); got.State != "empty" || len(got.Entries) != 0 {
			t.Fatalf("containers alone: %+v", got)
		}
	}
	mkdir(t, filepath.Join(home, "src", "ordinary-empty"))
	mkdir(t, filepath.Join(home, "src", "notes__worktrees-backup"))
	for _, got := range []Discovery{Discover(cfg), DiscoverListing(cfg), DiscoverFixtureRoot(home, os.Geteuid())} {
		if got.State != "present" || len(got.Entries) != 2 || got.Entries[0].Name != "notes__worktrees-backup" || got.Entries[1].Name != "ordinary-empty" {
			t.Fatalf("ordinary directories must remain: %+v", got)
		}
	}
	w := httptest.NewRecorder()
	agentWorkspaceList(w, cfg)
	var reply struct{ Workspaces []struct{ Name string } }
	if err := json.Unmarshal(w.Body.Bytes(), &reply); err != nil || w.Code != 200 || len(reply.Workspaces) != 2 {
		t.Fatalf("agent listing: %d %s (%v)", w.Code, w.Body.String(), err)
	}
	for _, entry := range reply.Workspaces {
		if strings.HasSuffix(entry.Name, "__worktrees") {
			t.Fatal(entry.Name)
		}
	}
	iconTree(t, filepath.Join(home, "src", "busy__worktrees"), map[string]string{".open-habitat.yaml": "icon: 🤖\n"})
	iconTree(t, filepath.Join(home, "src", "ordinary-empty"), map[string]string{".open-habitat.yaml": "icon: 🌿\n"})
	c := &ConversationController{cfg: cfg, home: home}
	if icons := c.otherWorkspaceIcons(""); len(icons) != 1 || icons[0] != "🌿" {
		t.Fatalf("icon suggestions counted a container: %v", icons)
	}
}

func TestContainerStaysExcludedAfterLastWorktreeRemoval(t *testing.T) {
	f := newWorktreeFixture(t)
	f.add("last", false)
	assertAbsent := func() {
		t.Helper()
		for _, d := range []Discovery{Discover(f.cfg), DiscoverListing(f.cfg)} {
			for _, entry := range d.Entries {
				if entry.Name == "app__worktrees" {
					t.Fatalf("container discovered: %+v", d)
				}
			}
		}
		for _, raw := range f.snapshot()["workspaces"].([]any) {
			if raw.(map[string]any)["name"] == "app__worktrees" {
				t.Fatal("container in snapshot")
			}
		}
	}
	assertAbsent()
	f.git(f.src("app"), "worktree", "remove", f.wt("last"))
	if entries, err := os.ReadDir(f.src("app__worktrees")); err != nil || len(entries) != 0 {
		t.Fatal(entries, err)
	}
	assertAbsent()
}

func TestCloneRefusesReservedContainerBeforeWriting(t *testing.T) {
	cfg := transport.Config{Home: t.TempDir(), UID: os.Geteuid()}
	jobs := &CloneJobs{cfg: cfg, home: cfg.Home}
	released := false
	cloneWriter.Lock()
	job, status, code := jobs.reserve(context.Background(), cloneTarget{fullName: "owner/project__worktrees", release: func() { released = true }})
	if job != nil || status != 409 || code != "checkout_unavailable" || !released || exists(filepath.Join(cfg.Home, "src")) {
		t.Fatalf("reserved clone admitted: %v %d %q release=%v", job, status, code, released)
	}
}

func TestTrashRestoresContainerWithoutWorkspaceIdentity(t *testing.T) {
	f := newTrashFixture(t)
	name := "old__worktrees"
	write(t, f.trash("files", name)+"/notes.txt", "keep\n")
	write(t, f.trash("info", name+".trashinfo"), "[Trash Info]\nPath="+trashURLPath(f.src(name))+"\nDeletionDate=2026-10-01T10:00:00\n")
	rows := f.list()
	if len(rows) != 1 || rows[0]["kind"] != "directory" || rows[0]["restore"] != "available" {
		t.Fatalf("container advertised as workspace: %v", rows)
	}
	code, body := f.request(map[string]any{"action": "trash_restore", "entry": name})
	if code != 200 || body["state"] != "restored" || body["workspace_id"] != nil || !exists(f.src(name)+"/notes.txt") {
		t.Fatalf("container restore: %d %v", code, body)
	}
}

func TestDiscoveryRecognizesNonstandardRegisteredContainer(t *testing.T) {
	f := newWorktreeFixture(t)
	custom := f.src("custom-checkouts")
	f.git(f.src("app"), "worktree", "add", "-q", "-b", "custom", filepath.Join(custom, "branch"))
	for _, entry := range Discover(f.cfg).Entries {
		if entry.Name == "custom-checkouts" {
			t.Fatal("registered container discovered")
		}
	}
	// A nonstandard directory is not reserved: preserve it when it holds other work.
	write(t, filepath.Join(custom, "notes.txt"), "notes\n")
	for _, entry := range Discover(f.cfg).Entries {
		if entry.Name == "custom-checkouts" {
			return
		}
	}
	t.Fatal("ordinary mixed-use directory excluded")
}
