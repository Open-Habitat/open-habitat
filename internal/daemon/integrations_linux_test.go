//go:build linux

package daemon

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// A removed account's folder goes to the person's Trash with an info file
// that names where it was, so it can be restored; a symlink on the way is
// refused rather than followed out of ~/cloud.
func TestTrashCloudDirectory(t *testing.T) {
	home := t.TempDir()
	os.Chmod(home, 0o700)
	synced := filepath.Join(home, "cloud/google-drive/person@example.test")
	if err := os.MkdirAll(synced, 0o700); err != nil {
		t.Fatal(err)
	}
	os.WriteFile(filepath.Join(synced, "note.txt"), []byte("synthetic"), 0o600)
	if err := TrashCloudDirectory(home, "cloud/google-drive/person@example.test"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(synced); !os.IsNotExist(err) {
		t.Fatal("directory still in place")
	}
	if b, err := os.ReadFile(filepath.Join(home, ".local/share/Trash/files/person@example.test/note.txt")); err != nil || string(b) != "synthetic" {
		t.Fatalf("trashed content: %q %v", b, err)
	}
	info, _ := os.ReadFile(filepath.Join(home, ".local/share/Trash/info/person@example.test.trashinfo"))
	if !strings.Contains(string(info), "Path="+home+"/cloud/google-drive/person%40example.test") && !strings.Contains(string(info), "Path="+home+"/cloud/google-drive/person@example.test") {
		t.Fatalf("info: %s", info)
	}

	outside := t.TempDir()
	os.MkdirAll(filepath.Join(outside, "svc/acct"), 0o700)
	os.RemoveAll(filepath.Join(home, "cloud"))
	os.Symlink(outside, filepath.Join(home, "cloud"))
	if err := TrashCloudDirectory(home, "cloud/svc/acct"); err == nil {
		t.Fatal("followed a symlinked ~/cloud")
	}
	if _, err := os.Stat(filepath.Join(outside, "svc/acct")); err != nil {
		t.Fatal("moved a directory outside the home")
	}
	for _, bad := range []string{"src/x/y", "cloud/../src/x", "cloud/x"} {
		if TrashCloudDirectory(home, bad) == nil {
			t.Fatalf("accepted %q", bad)
		}
	}
}
