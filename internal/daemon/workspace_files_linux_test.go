//go:build linux

package daemon

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/sys/unix"
)

func TestWorkspaceFilesStayUnderPinnedSource(t *testing.T) {
	cfg, _ := cloneFixture(t)
	cfg.Home = t.TempDir()
	if err := os.Mkdir(filepath.Join(cfg.Home, "src"), 0700); err != nil {
		t.Fatal(err)
	}
	src, _, err := workspaceSource(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer unix.Close(src)
	for _, n := range []string{"", ".hidden", "-option", "a/b", "bad\x00name", "bad\nname", strings.Repeat("a", 256)} {
		if validWorkspaceName(n) {
			t.Errorf("admitted %q", n)
		}
	}
	if !validWorkspaceName("Case and space ") {
		t.Fatal("ordinary directory name refused")
	}
	outside := t.TempDir()
	if err := os.Symlink(outside, filepath.Join(cfg.Home, "src", "redirect")); err != nil {
		t.Fatal(err)
	}
	if fd, _, err := openWorkspace(src, "redirect"); err == nil {
		unix.Close(fd)
		t.Fatal("followed symlink")
	}
	if err := os.Mkdir(filepath.Join(cfg.Home, "src", "ordinary"), 0700); err != nil {
		t.Fatal(err)
	}
	child, initial, err := openWorkspace(src, "ordinary")
	if err != nil {
		t.Fatal(err)
	}
	defer unix.Close(child)
	id, err := newWorkspaceID()
	if err != nil {
		t.Fatal(err)
	}
	if err := writeWorkspaceSettings(child, id, "Nice name"); err != nil {
		t.Fatal(err)
	}
	state, gotID, display := metadata(unix.Openat2, child)
	if state != "valid" || gotID != id || display != "Nice name" {
		t.Fatalf("metadata %q %q %q", state, gotID, display)
	}
	if err := os.Rename(filepath.Join(cfg.Home, "src", "ordinary"), filepath.Join(cfg.Home, "src", "moved")); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(cfg.Home, "src", "ordinary")); err != nil {
		t.Fatal(err)
	}
	if workspaceStillNamed(src, "ordinary", initial) {
		t.Fatal("accepted replacement")
	}
	if _, err := os.Stat(filepath.Join(outside, ".agent-host")); !os.IsNotExist(err) {
		t.Fatalf("outside changed: %v", err)
	}
}

func TestWorkspaceSettingsDoNotOverwriteCorruptAnnotation(t *testing.T) {
	cfg, _ := cloneFixture(t)
	cfg.Home = t.TempDir()
	path := filepath.Join(cfg.Home, "src", "ordinary")
	if err := os.MkdirAll(filepath.Join(path, ".agent-host"), 0700); err != nil {
		t.Fatal(err)
	}
	file := filepath.Join(path, ".agent-host", "workspace.json")
	if err := os.WriteFile(file, []byte("not json"), 0600); err != nil {
		t.Fatal(err)
	}
	src, _, err := workspaceSource(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer unix.Close(src)
	fd, _, err := openWorkspace(src, "ordinary")
	if err != nil {
		t.Fatal(err)
	}
	defer unix.Close(fd)
	if err := writeWorkspaceSettings(fd, "ws_12345678", "New"); err == nil {
		t.Fatal("overwrote unknown metadata")
	}
	got, err := os.ReadFile(file)
	if err != nil || string(got) != "not json" {
		t.Fatalf("corrupted original: %q %v", got, err)
	}
}
