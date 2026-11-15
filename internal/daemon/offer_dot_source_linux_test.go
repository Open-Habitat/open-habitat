//go:build linux

package daemon

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"golang.org/x/sys/unix"
)

func TestFileOfferDotSource(t *testing.T) {
	h := viewFixture(t)
	root := filepath.Join(h.root, "src", "project")
	source := ".pi/skills/test-guide/SKILL.md"
	dir := filepath.Dir(filepath.Join(root, source))
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, source), []byte("guide"), 0600); err != nil {
		t.Fatal(err)
	}
	for _, p := range []string{source, filepath.Join(root, source)} {
		body := map[string]any{"idempotency_key": "22222222-2222-4222-8222-222222222222", "workspace_id": h.ws, "paths": []string{p}, "dry_run": true}
		if code, v := offerFiles(t, h.c, h.q, body); code != 200 || !v.DryRun {
			t.Fatalf("%s: %d %+v", p, code, v)
		}
	}
	// The final file remains regular: a symlink in an ancestor is sufficient.
	if err := os.Rename(filepath.Join(root, ".pi"), filepath.Join(root, "real")); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink("real", filepath.Join(root, ".pi")); err != nil {
		t.Fatal(err)
	}
	body := map[string]any{"idempotency_key": "22222222-2222-4222-8222-222222222222", "workspace_id": h.ws, "paths": []string{filepath.Join(root, source)}}
	if code, v := offerFiles(t, h.c, h.q, body); code != 400 || v.Error.Code != "unsafe_file_source" {
		t.Fatalf("ancestor link: %d %+v", code, v)
	}
}

func TestUnsafeFileSourceCause(t *testing.T) {
	for _, cause := range []error{unix.ELOOP, unix.EXDEV} {
		var refusal viewError
		if err := fileOfferError(viewOpenError(cause)); !errors.As(err, &refusal) || refusal.status != 400 || refusal.code != "unsafe_file_source" {
			t.Fatalf("%v: %v", cause, err)
		}
	}
}
