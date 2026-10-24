//go:build linux

package host

import (
	"archive/tar"
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
)

func releaseParent(t *testing.T) *os.Root {
	t.Helper()
	p := t.TempDir()
	if e := os.Chmod(p, 0700); e != nil {
		t.Fatal(e)
	}
	r, e := os.OpenRoot(p)
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { r.Close() })
	return r
}
func archiveOpener(b []byte) func(string) (io.ReadCloser, error) {
	return func(string) (io.ReadCloser, error) { return io.NopCloser(bytes.NewReader(b)), nil }
}
func requireEmptyStage(t *testing.T, p *os.Root) {
	t.Helper()
	entries, e := fsReadDir(p)
	if e != nil || len(entries) != 0 {
		t.Fatalf("staging leftovers: %v %v", entries, e)
	}
}
func fsReadDir(p *os.Root) ([]os.DirEntry, error) {
	f, e := p.Open(".")
	if e != nil {
		return nil, e
	}
	defer f.Close()
	return f.ReadDir(-1)
}

func TestReleaseStagingAndFailureBoundaries(t *testing.T) {
	a, b := releaseFixture(t)
	r := authenticatedFixture(t, releaseManifest(a))
	ctx := context.Background()
	owner := uint32(os.Geteuid())
	t.Run("stage no activation", func(t *testing.T) {
		p := releaseParent(t)
		oldMask := syscall.Umask(0077)
		defer syscall.Umask(oldMask)
		name, e := r.stageRelease(ctx, nil, p, archiveOpener(b), owner)
		if e != nil {
			t.Fatal(e)
		}
		raw, e := p.ReadFile(name + "/payloads/core/bin/tool")
		if e != nil || string(raw) != "xxxx" {
			t.Fatalf("extraction: %q %v", raw, e)
		}
		if _, e := p.Stat(name + "/archives"); !os.IsNotExist(e) {
			t.Fatal("archive spool retained")
		}
		st, _ := p.Stat(name)
		if st.Mode().Perm() != 0700 {
			t.Fatal("stage exposed")
		}
		st, _ = p.Stat(name + "/payloads/core/bin/tool")
		if st.Mode().Perm() != 0755 {
			t.Fatal("mode")
		}
	})
	for name, mutate := range map[string]func([]byte) []byte{
		"tamper": func(b []byte) []byte { b = append([]byte{}, b...); b[len(b)/2] ^= 1; return b },
		"short":  func(b []byte) []byte { return b[:len(b)-1] },
		"long":   func(b []byte) []byte { return append(append([]byte{}, b...), 0) },
	} {
		t.Run(name, func(t *testing.T) {
			p := releaseParent(t)
			if _, e := r.stageRelease(ctx, nil, p, archiveOpener(mutate(b)), owner); !errors.Is(e, ErrReleaseArchive) {
				t.Fatalf("accepted bad bytes: %v", e)
			}
			requireEmptyStage(t, p)
		})
	}
	t.Run("all hashes before payload", func(t *testing.T) {
		p := releaseParent(t)
		second := a
		second.Profile = "editor"
		second.Archive = "editor.tar.gz"
		second.SHA256 = strings.Repeat("0", 64)
		r := authenticatedFixture(t, releaseManifest(a, second))
		calls := 0
		opener := func(string) (io.ReadCloser, error) {
			calls++
			entries, _ := fsReadDir(p)
			if len(entries) != 1 {
				t.Fatal("missing private stage")
			}
			payload, _ := p.OpenRoot(entries[0].Name() + "/payloads")
			defer payload.Close()
			entries, _ = fsReadDir(payload)
			if len(entries) != 0 {
				t.Fatal("extracted before all archive hashes")
			}
			return io.NopCloser(bytes.NewReader(b)), nil
		}
		if _, e := r.stageRelease(ctx, []string{"editor"}, p, opener, owner); !errors.Is(e, ErrReleaseArchive) || calls != 2 {
			t.Fatalf("all digests: %d %v", calls, e)
		}
		requireEmptyStage(t, p)
	})
	t.Run("cancel", func(t *testing.T) {
		p := releaseParent(t)
		ctx, cancel := context.WithCancel(ctx)
		cancel()
		if _, e := r.stageRelease(ctx, nil, p, archiveOpener(b), owner); !errors.Is(e, context.Canceled) {
			t.Fatal(e)
		}
		requireEmptyStage(t, p)
	})
	t.Run("unsafe parent", func(t *testing.T) {
		p := releaseParent(t)
		if e := p.Chmod(".", 0755); e != nil {
			t.Fatal(e)
		}
		if _, e := r.stageRelease(ctx, nil, p, archiveOpener(b), owner); !errors.Is(e, ErrReleaseStage) {
			t.Fatal(e)
		}
		requireEmptyStage(t, p)
	})
	t.Run("source error redaction", func(t *testing.T) {
		p := releaseParent(t)
		_, e := r.stageRelease(ctx, nil, p, func(string) (io.ReadCloser, error) { return nil, errors.New("secret") }, owner)
		if e != ErrReleaseStage {
			t.Fatal(e)
		}
		requireEmptyStage(t, p)
	})
}

func TestReleaseHostileAuthenticatedArchives(t *testing.T) {
	regular := func(name string) *tar.Header {
		return &tar.Header{Name: name, Typeflag: tar.TypeReg, Mode: 0644, Size: 4}
	}
	for name, headers := range map[string][]*tar.Header{
		"traversal": {regular("../escape")}, "absolute": {regular("/escape")}, "dot": {regular("a/./b")}, "backslash": {regular(`a\b`)},
		"duplicate": {regular("a"), regular("a")}, "parent file": {regular("a"), regular("a/b")}, "reverse parent file": {regular("a/b"), regular("a")},
		"symlink":        {{Name: "link", Typeflag: tar.TypeSymlink, Linkname: "/etc/passwd", Mode: 0777}},
		"hardlink":       {{Name: "link", Typeflag: tar.TypeLink, Linkname: "target", Mode: 0644}},
		"fifo":           {{Name: "fifo", Typeflag: tar.TypeFifo, Mode: 0644}},
		"suid":           {{Name: "bin/tool", Typeflag: tar.TypeReg, Mode: 04755, Size: 4}},
		"world writable": {{Name: "bin/tool", Typeflag: tar.TypeReg, Mode: 0666, Size: 4}},
		"pax":            {{Name: "file", Typeflag: tar.TypeReg, Mode: 0644, PAXRecords: map[string]string{"comment": "hidden"}, Format: tar.FormatPAX}},
	} {
		t.Run(name, func(t *testing.T) {
			a, b := releaseFixture(t, headers...)
			r := authenticatedFixture(t, releaseManifest(a))
			p := releaseParent(t)
			if _, e := r.stageRelease(context.Background(), nil, p, archiveOpener(b), uint32(os.Geteuid())); !errors.Is(e, ErrReleaseArchive) {
				t.Fatalf("hostile archive accepted: %v", e)
			}
			requireEmptyStage(t, p)
		})
	}
	a, b := releaseFixture(t)
	for name, mutate := range map[string]func(*ReleaseArtifact, *[]byte){
		"expanded short":     func(a *ReleaseArtifact, _ *[]byte) { a.ExpandedSize-- },
		"expanded long":      func(a *ReleaseArtifact, _ *[]byte) { a.ExpandedSize++ },
		"entry count":        func(a *ReleaseArtifact, _ *[]byte) { a.Entries++ },
		"gzip checksum":      func(_ *ReleaseArtifact, b *[]byte) { *b = append([]byte{}, (*b)...); (*b)[len(*b)-8] ^= 1 },
		"second gzip member": func(_ *ReleaseArtifact, b *[]byte) { *b = append(append([]byte{}, (*b)...), (*b)...) },
		"trailing bytes":     func(_ *ReleaseArtifact, b *[]byte) { *b = append(append([]byte{}, (*b)...), 1, 2, 3) },
	} {
		t.Run(name, func(t *testing.T) {
			a, b := a, b
			mutate(&a, &b)
			a.SHA256 = releaseDigest(b)
			a.Size = int64(len(b))
			r := authenticatedFixture(t, releaseManifest(a))
			p := releaseParent(t)
			if _, e := r.stageRelease(context.Background(), nil, p, archiveOpener(b), uint32(os.Geteuid())); !errors.Is(e, ErrReleaseArchive) {
				t.Fatalf("bad stream accepted: %v", e)
			}
			requireEmptyStage(t, p)
		})
	}
}

func TestReleaseRootAndDistinctUID(t *testing.T) {
	if os.Getenv("HOST_RELEASE_DENIED_CHILD") == "1" {
		r := authenticatedFixture(t, releaseManifest(func() ReleaseArtifact { a, _ := releaseFixture(t); return a }()))
		_, e := r.StageRelease(context.Background(), nil, nil, func(string) (io.ReadCloser, error) { t.Fatal("foreign UID reached archive input"); return nil, nil })
		if !errors.Is(e, ErrTrust) {
			t.Fatal(e)
		}
		return
	}
	if os.Geteuid() != 0 {
		t.Skip("actual-root/distinct-UID acceptance runs in test-host-initialization-uids.sh")
	}
	a, b := releaseFixture(t)
	r := authenticatedFixture(t, releaseManifest(a))
	p := releaseParent(t)
	name, e := r.StageRelease(context.Background(), nil, p, archiveOpener(b))
	if e != nil {
		t.Fatal(e)
	}
	exe, e := os.Executable()
	if e != nil {
		t.Fatal(e)
	}
	// Use the container's public test binary, not a mode-0700 go-build ancestor.
	child := exec.Command(exe, "-test.run=^TestReleaseRootAndDistinctUID$", "-test.v")
	child.Env = []string{"HOST_RELEASE_DENIED_CHILD=1", "PATH=/usr/bin:/bin", "HOME=/nonexistent"}
	child.Dir = "/"
	child.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: 42001, Gid: 42001}}
	if os.Getenv("HOST_INIT_UID_CONTAINER") != "1" {
		t.Skip("distinct-UID subprocess requires disposable container binary path")
	}
	if output, e := child.CombinedOutput(); e != nil {
		t.Fatalf("foreign child: %s %v", output, e)
	}
	// The child has no authority even with its own signed manifest. Kernel DAC
	// also prevents it reading the authenticated private staging tree.
	child = exec.Command("/bin/sh", "-c", `test ! -r "$1"`, "denial", filepath.Join(p.Name(), name, "payloads/core/bin/tool"))
	child.Env = []string{"PATH=/usr/bin:/bin", "HOME=/nonexistent"}
	child.Dir = "/"
	child.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: 42001, Gid: 42001}}
	if output, e := child.CombinedOutput(); e != nil {
		t.Fatalf("private staging readable: %s %v", output, e)
	}
}

func TestReleaseCancellationAndSpoolIOClassification(t *testing.T) {
	a, b := releaseFixture(t)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	f, err := os.CreateTemp(t.TempDir(), "archive")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if _, err = f.Write(b); err != nil {
		t.Fatal(err)
	}
	if err = walkReleaseTar(ctx, f, a, "ubuntu-24.04-amd64", nil); !errors.Is(err, context.Canceled) {
		t.Fatalf("tar cancellation lost: %v", err)
	}
	if err = spoolReleaseArchive(context.Background(), releaseFailWriter{}, bytes.NewReader(b), a); !errors.Is(err, ErrReleaseStage) {
		t.Fatalf("disk failure called corrupt archive: %v", err)
	}
	if err = spoolReleaseArchive(context.Background(), io.Discard, releaseFailReader{}, a); !errors.Is(err, ErrReleaseStage) {
		t.Fatalf("source failure called corrupt archive: %v", err)
	}
}

type releaseFailWriter struct{}

func (releaseFailWriter) Write([]byte) (int, error) { return 0, syscall.ENOSPC }

type releaseFailReader struct{}

func (releaseFailReader) Read([]byte) (int, error) { return 0, syscall.EIO }

func TestReleaseGNUArchiveLongNames(t *testing.T) {
	// A long component cannot fit USTAR. The release builder must deliberately
	// choose GNU, not silently emit PAX path records outside our accepted policy.
	name := "node_modules/" + strings.Repeat("x", 120) + "/tool"
	a, b := releaseFixture(t, &tar.Header{Name: name, Typeflag: tar.TypeReg, Mode: 0755, Size: 4, Format: tar.FormatGNU})
	r := authenticatedFixture(t, releaseManifest(a))
	p := releaseParent(t)
	stage, err := r.stageRelease(context.Background(), nil, p, archiveOpener(b), uint32(os.Geteuid()))
	if err != nil {
		t.Fatal(err)
	}
	raw, err := p.ReadFile(stage + "/payloads/core/" + name)
	if err != nil || string(raw) != "xxxx" {
		t.Fatalf("long GNU name: %q %v", raw, err)
	}
}
