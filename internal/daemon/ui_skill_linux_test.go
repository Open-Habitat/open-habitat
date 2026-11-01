//go:build linux

package daemon

import (
	"bytes"
	"io/fs"
	"os"
	"path/filepath"
	"testing"
)

func TestUISkillRestoresAllReferences(t *testing.T) {
	dir := t.TempDir()
	for round := 0; round < 2; round++ {
		path, err := installUISkill(dir)
		if err != nil {
			t.Fatal(err)
		}
		if err := fs.WalkDir(uiSkill, "ui-skill", func(source string, entry fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if entry.IsDir() {
				return nil
			}
			relative, err := filepath.Rel("ui-skill", source)
			if err != nil {
				return err
			}
			dest := filepath.Join(filepath.Dir(path), relative)
			want, err := uiSkill.ReadFile(source)
			if err != nil {
				return err
			}
			got, err := os.ReadFile(dest)
			if err != nil {
				return err
			}
			if !bytes.Equal(want, got) {
				t.Errorf("changed shipped file %s", relative)
			}
			info, err := os.Stat(dest)
			if err != nil {
				return err
			}
			if info.Mode().Perm() != 0600 {
				t.Errorf("nonprivate file %s", relative)
			}
			// Simulate tmpfiles losing references while the daemon keeps its bridge.
			return os.Remove(dest)
		}); err != nil {
			t.Fatal(err)
		}
	}
}
