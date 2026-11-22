//go:build linux

package daemon

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/open-habitat/open-habitat/internal/core"
)

func TestRecapDirectoryReusedAcrossControllers(t *testing.T) {
	home, root := t.TempDir(), t.TempDir()
	// A conventional symlinked home cache must not prevent Pi from starting.
	if err := os.Symlink(t.TempDir(), filepath.Join(home, ".cache")); err != nil {
		t.Fatal(err)
	}
	runtime := &core.PiRuntimeConfig{Node: filepath.Join(home, "runtime/bin/node"), Entry: filepath.Join(home, "runtime/pi/index.js")}
	var first string
	for i := 0; i < 3; i++ {
		c := &ConversationController{home: home, runtime: runtime, recapRoot: root}
		if _, err := c.piArgs(); err != nil {
			t.Fatal(err)
		}
		if i == 0 {
			first = c.recapPath
		} else if c.recapPath != first {
			t.Fatalf("new directory on controller restart: %s != %s", c.recapPath, first)
		}
		data, err := os.ReadFile(c.recapPath)
		if err != nil || string(data) != string(recapExtension) {
			t.Fatalf("bridge not refreshed: %v", err)
		}
		if _, err := c.piArgs(); err != nil {
			t.Fatal(err)
		}
		c.shutdown()
		if _, err := os.Stat(first); err != nil {
			t.Fatalf("shutdown removed reusable bridge: %v", err)
		}
		// A new daemon must replace bytes from an older product version.
		if err := os.WriteFile(first, []byte("old bridge"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	entries, err := os.ReadDir(filepath.Dir(filepath.Dir(first)))
	if err != nil || len(entries) != 1 {
		t.Fatalf("cache accumulated directories: %v %v", entries, err)
	}
	// Deleting disposable cache must not prevent another Pi launch.
	c := &ConversationController{home: home, runtime: runtime, recapPath: first, recapRoot: root}
	if err := os.RemoveAll(filepath.Dir(first)); err != nil {
		t.Fatal(err)
	}
	if _, err := c.piArgs(); err != nil {
		t.Fatal(err)
	}
}

func TestRecapCacheRejectsSymlink(t *testing.T) {
	root, outside := t.TempDir(), t.TempDir()
	path, err := recapDirectory(root)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, path); err != nil {
		t.Fatal(err)
	}
	if _, err := recapDirectory(root); err == nil {
		t.Fatal("accepted symlinked cache")
	}
	entries, err := os.ReadDir(outside)
	if err != nil || len(entries) != 0 {
		t.Fatalf("wrote outside cache: %v %v", entries, err)
	}
}

func TestCleanupLegacyRecapDirs(t *testing.T) {
	parent, outside := t.TempDir(), t.TempDir()
	for _, name := range []string{"oh-recap-123456", "oh-recap-", "oh-recap-notes", "oh-recap-123-backup", "other-123"} {
		if err := os.Mkdir(filepath.Join(parent, name), 0700); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join(outside, "keep"), []byte("keep"), 0600); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"oh-recap-234567", "oh-recap-123456/link"} {
		if err := os.Symlink(outside, filepath.Join(parent, name)); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join(parent, "oh-recap-345678"), []byte("not a directory"), 0600); err != nil {
		t.Fatal(err)
	}
	// An ownership mismatch must leave even an exactly named directory alone.
	if err := cleanupLegacyRecapDirs(parent, os.Geteuid()+1); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(parent, "oh-recap-123456")); err != nil {
		t.Fatalf("removed foreign-owner directory: %v", err)
	}
	for i := 0; i < 2; i++ {
		if err := cleanupLegacyRecapDirs(parent, os.Geteuid()); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := os.Lstat(filepath.Join(parent, "oh-recap-123456")); !os.IsNotExist(err) {
		t.Fatalf("legacy directory remains: %v", err)
	}
	for _, name := range []string{"oh-recap-", "oh-recap-notes", "oh-recap-123-backup", "other-123", "oh-recap-234567", "oh-recap-345678"} {
		if _, err := os.Lstat(filepath.Join(parent, name)); err != nil {
			t.Fatalf("removed non-target %s: %v", name, err)
		}
	}
	if data, err := os.ReadFile(filepath.Join(outside, "keep")); err != nil || string(data) != "keep" {
		t.Fatalf("followed a symlink: %q %v", data, err)
	}
}
