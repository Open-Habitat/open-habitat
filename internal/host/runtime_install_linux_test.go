//go:build linux

package host

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// Minimal inventory exercises publication independently of RequireCoreRuntime's
// production component qualification, which has its own tests.
func runtimeInstallFixture(t *testing.T) (ReleaseArtifact, []byte) {
	t.Helper()
	var raw, compressed bytes.Buffer
	tw := tar.NewWriter(&raw)
	c := &RuntimeClosure{}
	records := ""
	for _, f := range []struct{ path, data string }{{"LICENSE", "xxxx"}, {"runtime/package-lock.json", `{"packages":{"":{},"node_modules/mac":{"version":"1","os":["darwin"]}}}`}} {
		if err := tw.WriteHeader(&tar.Header{Name: f.path, Mode: 0644, Size: int64(len(f.data)), Typeflag: tar.TypeReg}); err != nil {
			t.Fatal(err)
		}
		if _, err := tw.Write([]byte(f.data)); err != nil {
			t.Fatal(err)
		}
		sum := closureSum(f.data)
		c.Files = append(c.Files, RuntimeFile{Path: f.path, SHA256: sum, Component: "license", Mode: 0644})
		records += sum + " " + f.path + "\n"
	}
	if err := tw.Close(); err != nil {
		t.Fatal(err)
	}
	gz := gzip.NewWriter(&compressed)
	if _, err := gz.Write(raw.Bytes()); err != nil {
		t.Fatal(err)
	}
	if err := gz.Close(); err != nil {
		t.Fatal(err)
	}
	c.Components = []RuntimeComponent{{Name: "license", Version: "1.0.0", Kind: "license", SHA256: closureSum(records), LicenseFiles: []string{"LICENSE"}}}
	b := compressed.Bytes()
	return ReleaseArtifact{Profile: "core", Archive: "core.tar.gz", SHA256: releaseDigest(b), Size: int64(len(b)), ExpandedSize: int64(raw.Len()), Entries: 2, Closure: c, Requires: []string{}, Packages: []RuntimePackage{}}, b
}

func TestRuntimeInstallRequiresRoot(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("requires unprivileged caller")
	}
	if err := InstallRuntime(context.Background(), nil, Release{}, "/unused", nil); !errors.Is(err, ErrTrust) {
		t.Fatalf("non-root caller: %v", err)
	}
}

func TestRuntimeInstallPublicationAndRetry(t *testing.T) {
	dir, owner := operationFixture(t)
	prefix := filepath.Dir(dir) + "/runtime"
	a, archive := runtimeInstallFixture(t)
	r := authenticatedFixture(t, releaseManifest(a))
	ctx := context.Background()
	if err := os.MkdirAll(prefix+"/current", 0755); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if err := installRuntime(ctx, r, prefix, archiveOpener(archive), owner); err != nil {
			t.Fatal(err)
		}
	}
	want := prefix + "/generations/runtime-" + r.digest + "/payloads/core/runtime"
	if got, err := os.Readlink(prefix + "/core"); err != nil || got != want {
		t.Fatalf("link %q: %v", got, err)
	}
	before, err := os.ReadFile(prefix + "/pi-runtime.json")
	if err != nil {
		t.Fatal(err)
	}
	if err := installRuntime(ctx, r, prefix, archiveOpener([]byte("corrupt")), owner); err == nil {
		t.Fatal("accepted corrupt archive")
	}
	after, _ := os.ReadFile(prefix + "/pi-runtime.json")
	if string(after) != string(before) {
		t.Fatal("failed archive changed selection")
	}
	m := releaseManifest(a)
	m.Version = "1.2.4"
	next := authenticatedFixture(t, m)
	if err := os.WriteFile(prefix+"/pi-runtime.json.next", []byte("unrelated"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := installRuntime(ctx, next, prefix, archiveOpener(archive), owner); err == nil {
		t.Fatal("accepted foreign selector stage")
	}
	if got, _ := os.Readlink(prefix + "/core"); got != want {
		t.Fatal("failed selection left changed alias")
	}
	after, _ = os.ReadFile(prefix + "/pi-runtime.json")
	if string(after) != string(before) {
		t.Fatal("failed selection changed selector")
	}
	if err := os.Remove(prefix + "/pi-runtime.json.next"); err != nil {
		t.Fatal(err)
	}
	if err := installRuntime(ctx, next, prefix, archiveOpener(archive), owner); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(prefix+"/generations/runtime-"+r.digest+"/payloads/core/LICENSE", []byte("bad"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := installRuntime(ctx, r, prefix, archiveOpener(archive), owner); err == nil {
		t.Fatal("accepted changed generation")
	}
	if st, err := os.Lstat(prefix + "/current"); err != nil || !st.IsDir() {
		t.Fatal("changed product current")
	}
}

func TestRuntimeSelectionPostRenameFailureRestoresBoth(t *testing.T) {
	for _, initial := range []bool{true, false} {
		for _, failLink := range []bool{true, false} {
			dir, owner := operationFixture(t)
			prefix := filepath.Dir(dir)
			old := ""
			oldGen := prefix + "/generations/old"
			dest := prefix + "/generations/new"
			if !initial {
				old = oldGen + "/payloads/core/runtime"
				if err := publishLink(prefix+"/core", old); err != nil {
					t.Fatal(err)
				}
				if err := publishPiRuntime(prefix, oldGen, owner); err != nil {
					t.Fatal(err)
				}
			}
			before, _ := os.ReadFile(prefix + "/pi-runtime.json")
			injected := errors.New("injected directory fsync failure after rename")
			err := selectRuntime(prefix, dest, old, owner, func() error {
				var e error
				if initial {
					e = publishLink(prefix+"/core", dest+"/payloads/core/runtime")
				} else {
					e = replaceUpgradeLink(prefix+"/core", old, dest+"/payloads/core/runtime")
				}
				if e != nil {
					return e
				}
				if failLink {
					return injected
				}
				return nil
			}, func() error {
				if e := publishPiRuntime(prefix, dest, owner); e != nil {
					return e
				}
				return injected
			})
			if !errors.Is(err, injected) {
				t.Fatal(err)
			}
			if got, e := os.Readlink(prefix + "/core"); initial && !os.IsNotExist(e) || !initial && (e != nil || got != old) {
				t.Fatalf("alias not restored %q %v", got, e)
			}
			after, e := os.ReadFile(prefix + "/pi-runtime.json")
			if initial && !os.IsNotExist(e) || !initial && (e != nil || string(after) != string(before)) {
				t.Fatal("selector not restored")
			}
		}
	}
}

func TestRuntimeSelectionRefusesUnrestorableMode(t *testing.T) {
	dir, owner := operationFixture(t)
	prefix := filepath.Dir(dir)
	if err := os.WriteFile(prefix+"/pi-runtime.json", []byte("old"), 0444); err != nil {
		t.Fatal(err)
	}
	write := func() error { t.Fatal("wrote before refusing unrestorable mode"); return nil }
	if err := selectRuntime(prefix, prefix+"/generations/new", "", owner, write, write); !errors.Is(err, ErrTrust) {
		t.Fatal(err)
	}
}

func TestRuntimeInstallJournalAndMissingClosure(t *testing.T) {
	dir, owner := operationFixture(t)
	l, err := openOperationLock(context.Background(), dir, owner, time.Now)
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()
	if err := runtimeInstallJournalClear(l); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(dir+"/active.json.next", []byte("interrupted"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := runtimeInstallJournalClear(l); err == nil {
		t.Fatal("accepted interrupted operation")
	}
	a, archive := releaseFixture(t)
	r := authenticatedFixture(t, releaseManifest(a))
	prefix := filepath.Dir(dir) + "/runtime"
	if err := installRuntime(context.Background(), r, prefix, archiveOpener(archive), owner); err == nil {
		t.Fatal("accepted missing closure")
	}
	if _, err := os.Lstat(prefix); !os.IsNotExist(err) {
		t.Fatal("created prefix before validating closure")
	}
}

func TestRuntimeInstallRefusesProductAndUntrustedSelector(t *testing.T) {
	for _, name := range []string{"current", "pi-runtime.json"} {
		t.Run(name, func(t *testing.T) {
			dir, owner := operationFixture(t)
			prefix := filepath.Dir(dir)
			if err := os.Symlink(prefix+"/generations/host-generation", prefix+"/"+name); err != nil {
				t.Fatal(err)
			}
			a, archive := runtimeInstallFixture(t)
			r := authenticatedFixture(t, releaseManifest(a))
			if err := installRuntime(context.Background(), r, prefix, archiveOpener(archive), owner); err == nil {
				t.Fatal("accepted foreign installation")
			}
			if _, err := os.Lstat(prefix + "/core"); !os.IsNotExist(err) {
				t.Fatal("changed selection")
			}
		})
	}
}
