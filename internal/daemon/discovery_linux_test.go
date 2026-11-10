//go:build linux

package daemon

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/open-habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

func mkdir(t *testing.T, p string) {
	t.Helper()
	if e := os.MkdirAll(p, 0700); e != nil {
		t.Fatal(e)
	}
}
func put(t *testing.T, p, s string) {
	t.Helper()
	if e := os.WriteFile(p, []byte(s), 0600); e != nil {
		t.Fatal(e)
	}
}
func testScan(t *testing.T, home string) Discovery {
	t.Helper()
	return scan(home, -1, unix.Openat2, false)
}

// Discovery is independent of filesystem capacity: a workspace must remain
// visible even when a source filesystem grows beyond the old clone ceiling.
func TestDiscoveryOnLargeFilesystem(t *testing.T) {
	h := t.TempDir()
	src := filepath.Join(h, "src")
	mkdir(t, filepath.Join(src, "project"))
	fd, err := unix.Open(src, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if err != nil {
		t.Fatal(err)
	}
	defer unix.Close(fd)
	var fs unix.Statfs_t
	if err := unix.Fstatfs(fd, &fs); err != nil {
		t.Fatal(err)
	}
	if fs.Frsize <= 0 || fs.Blocks <= (20<<30)/uint64(fs.Frsize) {
		t.Skip("test requires a filesystem larger than the retired 20 GiB limit")
	}
	r := testScan(t, h)
	if len(r.Entries) != 1 || r.Entries[0].Name != "project" || r.State != "present" {
		t.Fatalf("large filesystem must not hide workspaces: %+v", r)
	}
}

func TestDiscoveryStatesAndFacts(t *testing.T) {
	h := t.TempDir()
	if r := testScan(t, h); r.State != "missing" {
		t.Fatalf("missing: %+v", r)
	}
	src := filepath.Join(h, "src")
	mkdir(t, src)
	if r := testScan(t, h); r.State != "empty" {
		t.Fatalf("empty: %+v", r)
	}
	for _, n := range []string{"z", "a", "main", "linked", "sibling", "broken"} {
		mkdir(t, filepath.Join(src, n))
	}
	mkdir(t, filepath.Join(src, "main/.git"))
	mkdir(t, filepath.Join(src, "linked/target"))
	mkdir(t, filepath.Join(src, "main/.git/worktrees/sibling"))
	put(t, filepath.Join(src, "linked/.git"), "gitdir: target\n")
	put(t, filepath.Join(src, "sibling/.git"), "gitdir: ../main/.git/worktrees/sibling\n")
	mkdir(t, filepath.Join(src, "a/.agent-host"))
	put(t, filepath.Join(src, "a/.agent-host/workspace.json"), `{"schema_version":1,"workspace_id":"ws_abcdefgh","display_name":"Alpha"}`)
	mkdir(t, filepath.Join(src, "broken/.agent-host"))
	put(t, filepath.Join(src, "broken/.agent-host/workspace.json"), `{"schema_version":1,"schema_version":1,"workspace_id":"ws_abcdefgh"}`)
	put(t, filepath.Join(src, "file"), "unused")
	mkdir(t, filepath.Join(src, "z/nested"))
	if e := os.Symlink("main", filepath.Join(src, "alias")); e != nil {
		t.Fatal(e)
	}
	r := testScan(t, h)
	if r.State != "partial" || len(r.Entries) != 6 {
		t.Fatalf("partial entries: %+v", r)
	}
	for i, n := range []string{"a", "broken", "linked", "main", "sibling", "z"} {
		if r.Entries[i].Name != n {
			t.Fatalf("ordering: %+v", r)
		}
	}
	if r.Entries[0].WorkspaceID != "ws_abcdefgh" || r.Entries[0].DisplayName != "Alpha" || r.Entries[1].Metadata != "error" || r.Entries[2].Kind != "git_linked_worktree" || r.Entries[3].Kind != "git_main_worktree" || r.Entries[4].Kind != "git_linked_worktree" || r.Entries[5].Kind != "directory" || r.Entries[5].Metadata != "absent" {
		t.Fatalf("facts: %+v", r)
	}
	// The internal model is deliberately path-free, including error text.
	if strings.Contains(r.StringForTest(), h) {
		t.Fatal("absolute home leak")
	}
}
func (r Discovery) StringForTest() string {
	s := r.State + r.Error
	for _, e := range r.Entries {
		s += e.Name + e.Kind + e.Metadata + e.WorkspaceID + e.DisplayName + e.Error
	}
	return s
}
func TestDiscoveryUnsafeAndStrict(t *testing.T) {
	h := t.TempDir()
	outside := t.TempDir()
	mkdir(t, filepath.Join(outside, "src"))
	if e := os.Symlink(filepath.Join(outside, "src"), filepath.Join(h, "src")); e != nil {
		t.Fatal(e)
	}
	if r := testScan(t, h); r.State != "error" {
		t.Fatalf("source symlink: %+v", r)
	}
	if e := os.Remove(filepath.Join(h, "src")); e != nil {
		t.Fatal(e)
	}
	src := filepath.Join(h, "src")
	mkdir(t, src)
	mkdir(t, filepath.Join(src, "w"))
	if e := os.Symlink(outside, filepath.Join(src, "w/.agent-host")); e != nil {
		t.Fatal(e)
	}
	put(t, filepath.Join(src, "w/.git"), "gitdir: ../../escape\n")
	r := testScan(t, h)
	if r.State != "partial" || r.Entries[0].Metadata != "error" || r.Entries[0].Kind != "unknown" {
		t.Fatalf("unsafe: %+v", r)
	}
	for _, s := range []string{`{"schema_version":1,"workspace_id":"ws_abcdefgh","unexpected":2}`, `{"schema_version":1,"workspace_id":"ws_abcdefgh"} true`, `{"schema_version":1,"workspace_id":"bad"}`, `{"schema_version":1.0,"workspace_id":"ws_abcdefgh"}`, `{"schema_version":1,"workspace_id":"ws_abcdefgh","display_name":null}`} {
		if _, _, ok := parseMetadata([]byte(s)); ok {
			t.Fatalf("accepted %s", s)
		}
	}
	if e := os.Remove(filepath.Join(src, "w/.agent-host")); e != nil {
		t.Fatal(e)
	}
	mkdir(t, filepath.Join(src, "w/.agent-host"))
	if e := os.Symlink(filepath.Join(outside, "secret"), filepath.Join(src, "w/.agent-host/workspace.json")); e != nil {
		t.Fatal(e)
	}
	if r := testScan(t, h); r.Entries[0].Metadata != "error" {
		t.Fatalf("metadata symlink: %+v", r)
	}
	if e := os.Remove(filepath.Join(src, "w/.agent-host/workspace.json")); e != nil {
		t.Fatal(e)
	}
	if e := unix.Mkfifo(filepath.Join(src, "w/.agent-host/workspace.json"), 0600); e != nil {
		t.Fatal(e)
	}
	if r := testScan(t, h); r.Entries[0].Metadata != "error" {
		t.Fatalf("FIFO: %+v", r)
	}
	if e := os.Symlink(outside, filepath.Join(src, "alias")); e != nil {
		t.Fatal(e)
	}
	if r := testScan(t, h); len(r.Entries) != 1 {
		t.Fatalf("symlink child followed: %+v", r)
	}
	if r := scan(h, os.Geteuid()+1, unix.Openat2, false); r.Error != "invalid_identity" {
		t.Fatalf("wrong owner: %+v", r)
	}
}
func TestDiscoveryBoundsMountAndRace(t *testing.T) {
	if r := Discover(transport.Config{}); r.State != "error" || r.Error != "invalid_identity" {
		t.Fatalf("untrusted config: %+v", r)
	}
	h := t.TempDir()
	src := filepath.Join(h, "src")
	mkdir(t, src)
	long := strings.Repeat("n", 255)
	mkdir(t, filepath.Join(src, long))
	if r := testScan(t, h); r.State != "present" || len(r.Entries) != 1 || r.Entries[0].Name != long {
		t.Fatalf("maximum filename: %+v", r)
	}
	if e := os.Mkdir(filepath.Join(src, long+"n"), 0700); !errors.Is(e, unix.ENAMETOOLONG) {
		t.Fatalf("kernel accepted too-long name: %v", e)
	}
	for i := 0; i < 513; i++ {
		name := "entry" + strings.Repeat("x", i%40) + string(rune(0x1000+i))
		if i%3 == 0 {
			if err := os.WriteFile(filepath.Join(src, name), nil, 0600); err != nil {
				t.Fatal(err)
			}
		} else {
			mkdir(t, filepath.Join(src, name))
		}
	}
	if r := testScan(t, h); r.State != "present" || len(r.Entries) != 343 {
		t.Fatalf("batched mixed discovery: state=%s count=%d error=%s", r.State, len(r.Entries), r.Error)
	}
	if e := os.RemoveAll(src); e != nil {
		t.Fatal(e)
	}
	mkdir(t, src)
	mkdir(t, filepath.Join(src, "w"))
	inject := func(fd int, name string, how *unix.OpenHow) (int, error) {
		if name == "src" {
			return -1, unix.EXDEV
		}
		return unix.Openat2(fd, name, how)
	}
	if r := scan(h, -1, inject, false); r.State != "error" || r.Error != "unsafe_path" {
		t.Fatalf("mount: %+v", r)
	}
	inject = func(fd int, name string, how *unix.OpenHow) (int, error) {
		if name == "src" {
			return -1, unix.EACCES
		}
		return unix.Openat2(fd, name, how)
	}
	if r := scan(h, -1, inject, false); r.State != "error" || r.Error != "inaccessible" {
		t.Fatalf("source denial: %+v", r)
	}
	inject = func(fd int, name string, how *unix.OpenHow) (int, error) {
		if name == "w" {
			return -1, unix.EACCES
		}
		return unix.Openat2(fd, name, how)
	}
	if r := scan(h, -1, inject, false); r.State != "partial" || r.Entries[0].Error != "inaccessible" {
		t.Fatalf("child denial: %+v", r)
	}
	replaced := false
	inject = func(fd int, name string, how *unix.OpenHow) (int, error) {
		if name == "w" && !replaced {
			replaced = true
			_ = os.Rename(filepath.Join(src, "w"), filepath.Join(src, "old"))
			mkdir(t, filepath.Join(src, "w"))
		}
		return unix.Openat2(fd, name, how)
	}
	if r := scan(h, -1, inject, false); r.State != "partial" || r.Entries[0].Error != "raced_entry" {
		t.Fatalf("replacement: %+v", r)
	}
	if _, _, ok := parseMetadata([]byte(strings.Repeat("x", maxMetadata+1))); ok {
		t.Fatal("oversize parser")
	}
	// A source path swapped while the descriptor is open cannot be reported as
	// a successful observation of the new source.
	changed := false
	inject = func(fd int, name string, how *unix.OpenHow) (int, error) {
		if name == "src" && changed {
			return unix.Openat2(fd, name, how)
		}
		if name == "w" && !changed {
			changed = true
			_ = os.Rename(src, src+"-old")
			mkdir(t, src)
		}
		return unix.Openat2(fd, name, how)
	}
	if r := scan(h, -1, inject, false); r.State != "partial" || r.Error != "raced_source" {
		t.Fatalf("source replacement: %+v", r)
	}
	if _, e := unix.Openat2(unix.AT_FDCWD, "../escape", &unix.OpenHow{Flags: unix.O_RDONLY, Resolve: resolve}); e == nil {
		t.Fatal("openat2 accepted escape")
	}
	if _, e := unix.Openat2(unix.AT_FDCWD, "bad\\x00name", &unix.OpenHow{Flags: unix.O_RDONLY, Resolve: resolve}); e == nil {
		t.Fatal("openat2 accepted NUL")
	}
	if reason(errors.New("opaque /private/home")) != "io_error" {
		t.Fatal("leaked error")
	}
}
