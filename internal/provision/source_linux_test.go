//go:build linux

package provision

import (
	"os"
	"path/filepath"
	"testing"
)

// All paths are under Go's disposable test root; no account, NSS, or real
// home is used. The caller's synthetic fixture UID is used even when tests
// run as root.
func sourceFixture(t *testing.T) (string, uint32) {
	t.Helper()
	home := filepath.Join(t.TempDir(), "synthetic-home")
	if os.Geteuid() != 0 && os.Geteuid() != os.Getegid() {
		t.Skip("fixture requires matching uid/gid or isolated root")
	}
	if err := os.Mkdir(home, 0700); err != nil {
		t.Fatal(err)
	}
	return home, uint32(os.Geteuid())
}

func TestSourceFirstCreationAndRepeat(t *testing.T) {
	home, uid := sourceFixture(t)
	if verifySource(home, uid) == nil {
		t.Fatal("absent source accepted before provisioning")
	}
	for n := 0; n < 2; n++ {
		if err := ensureSource(home, uid); err != nil {
			t.Fatal(err)
		}
		if err := verifySource(home, uid); err != nil {
			t.Fatal(err)
		}
	}
	st, err := os.Lstat(filepath.Join(home, "src"))
	if err != nil || !st.IsDir() || st.Mode().Perm() != 0700 {
		t.Fatal(st, err)
	}
	// Later deletion remains visible to daemon discovery as source absent;
	// the provisioning helper does not run on the authorization path.
	if err := os.Remove(filepath.Join(home, "src")); err != nil {
		t.Fatal(err)
	}
	if verifySource(home, uid) == nil {
		t.Fatal("post-provision disappearance accepted")
	}
}

func TestSourceRejectsUnsafeExistingAndIncompleteState(t *testing.T) {
	for _, tc := range []struct {
		name  string
		setup func(*testing.T, string)
	}{
		{"symlink", func(t *testing.T, home string) {
			outside := t.TempDir()
			if err := os.Symlink(outside, filepath.Join(home, "src")); err != nil {
				t.Fatal(err)
			}
		}},
		{"replacement symlink", func(t *testing.T, home string) {
			uid := uint32(os.Geteuid())
			if err := ensureSource(home, uid); err != nil {
				t.Fatal(err)
			}
			if err := os.Remove(filepath.Join(home, "src")); err != nil {
				t.Fatal(err)
			}
			if err := os.Symlink(t.TempDir(), filepath.Join(home, "src")); err != nil {
				t.Fatal(err)
			}
		}},
		{"file", func(t *testing.T, home string) {
			if err := os.WriteFile(filepath.Join(home, "src"), nil, 0600); err != nil {
				t.Fatal(err)
			}
		}},
		{"partial wrong mode", func(t *testing.T, home string) {
			if err := os.Mkdir(filepath.Join(home, "src"), 0700); err != nil {
				t.Fatal(err)
			}
			if err := os.Chmod(filepath.Join(home, "src"), 0755); err != nil {
				t.Fatal(err)
			}
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			home, uid := sourceFixture(t)
			tc.setup(t, home)
			if ensureSource(home, uid) == nil || verifySource(home, uid) == nil {
				t.Fatal("adopted unsafe source")
			}
		})
	}
	t.Run("wrong home mode", func(t *testing.T) {
		home, uid := sourceFixture(t)
		if err := os.Chmod(home, 0755); err != nil {
			t.Fatal(err)
		}
		if ensureSource(home, uid) == nil {
			t.Fatal("accepted unsafe home")
		}
		if _, err := os.Lstat(filepath.Join(home, "src")); !os.IsNotExist(err) {
			t.Fatal("created under unsafe home", err)
		}
	})
	t.Run("wrong UID and per-UID isolation", func(t *testing.T) {
		home, uid := sourceFixture(t)
		if ensureSource(home, uid) != nil {
			t.Fatal("fixture creation failed")
		}
		other := uid + 1
		if ensureSource(home, other) == nil || verifySource(home, other) == nil {
			t.Fatal("other UID adopted first UID's home")
		}
		if verifySource(home, uid) != nil {
			t.Fatal("first UID damaged")
		}
	})
	t.Run("wrong src owner", func(t *testing.T) {
		home, uid := sourceFixture(t)
		if err := os.Mkdir(filepath.Join(home, "src"), 0700); err != nil {
			t.Fatal(err)
		}
		if os.Geteuid() != 0 {
			t.Skip("chown requires isolated root test runner")
		}
		if err := os.Chown(filepath.Join(home, "src"), int(uid+1), int(uid+1)); err != nil {
			t.Fatal(err)
		}
		if ensureSource(home, uid) == nil || verifySource(home, uid) == nil {
			t.Fatal("adopted wrong owner")
		}
	})
	t.Run("home symlink", func(t *testing.T) {
		home, uid := sourceFixture(t)
		other := filepath.Join(t.TempDir(), "link")
		if err := os.Symlink(home, other); err != nil {
			t.Fatal(err)
		}
		if ensureSource(other, uid) == nil {
			t.Fatal("followed home symlink")
		}
	})
}
