//go:build linux

package daemon

import (
	"embed"
	"io/fs"
	"os"
	"path/filepath"
)

//go:embed ui-skill/SKILL.md ui-skill/references/*.md
var uiSkill embed.FS

func installUISkill(dir string) (string, error) {
	target := filepath.Join(dir, "open-habitat-ui")
	err := fs.WalkDir(uiSkill, "ui-skill", func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		relative, err := filepath.Rel("ui-skill", path)
		if err != nil {
			return err
		}
		dest := filepath.Join(target, relative)
		if entry.IsDir() {
			return os.MkdirAll(dest, 0700)
		}
		data, err := uiSkill.ReadFile(path)
		if err != nil {
			return err
		}
		return os.WriteFile(dest, data, 0600)
	})
	return filepath.Join(target, "SKILL.md"), err
}
