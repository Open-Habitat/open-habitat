//go:build linux

package daemon

import (
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"syscall"
	"testing"
)

// fullAtInfo makes the Trash info file's content fail as a full quota or
// disk fails it: the name can be created, its first block cannot.
func fullAtInfo(errno error) func(string) error {
	return func(stage string) error {
		if stage == "info_opened" {
			return errno
		}
		return nil
	}
}

func trashNames(t *testing.T, f *trashFixture, part string) []string {
	t.Helper()
	entries, err := os.ReadDir(filepath.Dir(f.trash(part, "x")))
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		t.Fatal(err)
	}
	var names []string
	for _, e := range entries {
		names = append(names, e.Name())
	}
	return names
}

// A person at a full quota must be able to free space without the agent
// (Jari 16.11.2026). Neither deletion may need new space: the info file
// cannot be written, so the move goes ahead without it. Moving to the Trash
// leaves an entry that cannot be restored from the browser but can be deleted
// there; an outright deletion removes what it moved.
func TestWorkspaceDeleteAtFullStorage(t *testing.T) {
	for _, tc := range []struct {
		errno error
		code  string
	}{{syscall.EDQUOT, "quota_full"}, {syscall.ENOSPC, "storage_full"}} {
		t.Run(tc.code, func(t *testing.T) {
			f := newTrashFixture(t)
			f.pushedClone("clone")
			f.pushedClone("work")
			trashHook = fullAtInfo(tc.errno)
			before := inode(t, f.src("work"))

			code, body := f.remove("work", "trash")
			if code != 200 || body["state"] != "trashed" || body["entry"] != "work" || body["restore"] != "unavailable" {
				t.Fatalf("trash at full storage: %d %v", code, body)
			}
			if exists(f.src("work")) || inode(t, f.trash("files", "work")) != before || len(trashNames(t, f, "info")) != 0 {
				t.Fatal("the workspace was not moved whole into the Trash without an info file")
			}
			var listed map[string]any
			for _, e := range f.list() {
				if e["entry"] == "work" {
					listed = e
				}
			}
			if listed == nil || listed["kind"] != "unlabelled" || listed["restore"] != "unavailable" {
				t.Fatalf("the moved workspace is not a deletable Trash entry: %v", f.list())
			}
			if code, body := f.request(map[string]any{"action": "trash_delete", "entry": "work", "listing_token": f.listingToken()}); code != 200 || body["state"] != "deleted" {
				t.Fatalf("delete from the Trash at full storage: %d %v", code, body)
			}

			code, body = f.remove("clone", "permanent")
			if code != 200 || body["state"] != "deleted" {
				t.Fatalf("outright delete at full storage: %d %v", code, body)
			}
			if exists(f.src("clone")) || len(trashNames(t, f, "files")) != 0 || len(trashNames(t, f, "info")) != 0 {
				t.Fatal("outright deletion at full storage left something behind")
			}
		})
	}
}

// A full disk that also refuses the rename (Trash/files needs a new
// directory block) moves nothing and says the storage is full.
func TestWorkspaceDeleteAtFullStorageRefusesWhatCannotMove(t *testing.T) {
	f := newTrashFixture(t)
	f.pushedClone("clone")
	trashHook = fullAtInfo(syscall.EDQUOT)
	oldRename := renameNoReplace
	renameNoReplace = func(int, string, int, string) error { return syscall.EDQUOT }
	t.Cleanup(func() { renameNoReplace = oldRename })
	before := inode(t, f.src("clone"))
	for _, disposal := range []string{"trash", "permanent"} {
		code, body := f.remove("clone", disposal)
		if code != 507 || errorCode(body) != "quota_full" {
			t.Fatalf("%s when nothing can move: %d %v", disposal, code, body)
		}
		if !exists(f.src("clone")) || inode(t, f.src("clone")) != before || len(trashNames(t, f, "files")) != 0 || len(trashNames(t, f, "info")) != 0 {
			t.Fatal("a refused move changed the workspace or the Trash")
		}
	}
}

// When the checks after the move keep the directory (here the fetch fails,
// which a full quota makes likely), it goes back where it was: without an
// info file the Trash could not offer a restore.
func TestWorkspaceDeleteAtFullQuotaPutsBackWhatItKeeps(t *testing.T) {
	f := newTrashFixture(t)
	f.pushedClone("clone")
	trashHook = fullAtInfo(syscall.EDQUOT)
	oldFetch := deletionFetch
	deletionFetch = func(string, int) string { return "fetch_failed" }
	t.Cleanup(func() { deletionFetch = oldFetch })
	before := inode(t, f.src("clone"))
	code, body := f.remove("clone", "permanent")
	if code != 507 || errorCode(body) != "quota_full" {
		t.Fatalf("kept at full quota: %d %v", code, body)
	}
	if !exists(f.src("clone")) || inode(t, f.src("clone")) != before || len(trashNames(t, f, "files")) != 0 {
		t.Fatal("the kept workspace was not put back")
	}
}

// An outright deletion that stops partway leaves the rest in the Trash as an
// unlabelled entry, which the person can delete again from there.
func TestWorkspaceDeleteAtFullQuotaLeavesARemovableRest(t *testing.T) {
	f := newTrashFixture(t)
	f.pushedClone("clone")
	// A name an earlier deletion's info file still holds is not reused.
	write(t, f.trash("info", "clone.trashinfo"), "[Trash Info]\nPath=/elsewhere/clone\nDeletionDate=2026-11-01T10:00:00\n")
	walks := 0
	trashHook = func(stage string) error {
		if stage == "info_opened" {
			return syscall.EDQUOT
		}
		if stage == "walk" {
			if walks++; walks == 1 {
				return errors.New("interrupted")
			}
		}
		return nil
	}
	code, body := f.remove("clone", "permanent")
	if code != 200 || body["state"] != "partial" || body["entry"] != "clone.2" {
		t.Fatalf("interrupted outright delete: %d %v", code, body)
	}
	trashHook = func(string) error { return nil }
	var rest map[string]any
	for _, e := range f.list() {
		if e["entry"] == "clone.2" {
			rest = e
		}
	}
	if rest == nil || rest["kind"] != "unlabelled" || rest["restore"] != "unavailable" {
		t.Fatalf("the rest is not an unlabelled Trash entry: %v", f.list())
	}
}

// Optional kernel evidence: OH_FULL_QUOTA_DIR names an empty directory, owned
// by the test's user, on a filesystem that enforces a small user quota (for
// example tmpfs mounted with usrquota,usrquota_block_hardlimit=4M). The test
// fills the quota and deletes a clean clone outright, then shows that moving
// to the Trash is refused. Ordinary runs skip it; TestWorkspaceDeleteAtFullStorage
// is the gate.
func TestWorkspaceDeleteAtRealFullQuota(t *testing.T) {
	dir := os.Getenv("OH_FULL_QUOTA_DIR")
	if dir == "" {
		t.Skip("OH_FULL_QUOTA_DIR not set")
	}
	f := newTrashFixture(t)
	home, err := os.MkdirTemp(dir, "home")
	if err != nil {
		t.Fatal(err)
	}
	f.cfg.Home = home
	f.c.cfg, f.c.home = f.cfg, home
	f.handler = WorkspaceHandlerWithArchive(f.cfg, func(*http.Request) bool { return true }, f.c)
	if e := os.MkdirAll(filepath.Join(home, "src", "toinen"), 0700); e != nil {
		t.Fatal(e)
	}
	// The Trash exists, as it does once anything has been trashed.
	for _, part := range []string{"files", "info"} {
		if e := os.MkdirAll(filepath.Join(home, ".local", "share", "Trash", part), 0700); e != nil {
			t.Fatal(e)
		}
	}
	f.pushedClone("clone")
	f.pushedClone("kept")
	fill, err := os.Create(filepath.Join(home, "fill"))
	if err != nil {
		t.Fatal(err)
	}
	block := make([]byte, 4096)
	for {
		if _, err = fill.Write(block); err != nil {
			break
		}
	}
	fill.Close()
	if storageFailure(err) == "" {
		t.Fatalf("filling did not reach the quota: %v", err)
	}
	if code, body := f.remove("kept", "trash"); code != 200 || body["restore"] != "unavailable" {
		t.Fatalf("trash at a real full quota: %d %v", code, body)
	}
	if code, body := f.request(map[string]any{"action": "trash_empty", "listing_token": f.listingToken()}); code != 200 || body["deleted"] != float64(1) {
		t.Fatalf("empty the Trash at a real full quota: %d %v", code, body)
	}
	code, body := f.remove("clone", "permanent")
	if code != 200 || body["state"] != "deleted" || exists(f.src("clone")) {
		t.Fatalf("outright delete at a real full quota: %d %v", code, body)
	}
}
