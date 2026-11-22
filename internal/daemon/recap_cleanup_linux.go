//go:build linux

package daemon

import (
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
)

// Use the same temporary filesystem as the old private directories, without
// making a person's pre-existing ~/.cache layout a Pi launch prerequisite.
// Installed daemons have a private /var/tmp bind; the UID suffix also separates
// users when run without that service namespace.
func recapDirectory(parent string) (string, error) {
	if parent == "" {
		parent = "/var/tmp"
	}
	name := "oh-pi-companion-" + strconv.Itoa(os.Geteuid())
	dir, err := personalDir(parent, true, name)
	if err != nil {
		return "", err
	}
	defer dir.Close()
	return filepath.Join(parent, name), nil
}

// MkdirTemp's suffix is decimal. Do not sweep similarly named user files,
// symlinks, or another Unix user's directories in the shared temporary root.
var legacyRecapName = regexp.MustCompile(`^oh-recap-[0-9]+$`)

// Called only at production startup, before this daemon starts Pi children.
// The old daemon's children belong to its service and have stopped with it.
func cleanupLegacyRecapDirs(parent string, uid int) error {
	root, err := os.OpenRoot(parent)
	if err != nil {
		return err
	}
	defer root.Close()
	dir, err := root.Open(".")
	if err != nil {
		return err
	}
	defer dir.Close()
	entries, err := dir.ReadDir(-1)
	if err != nil {
		return err
	}
	var failures []error
	for _, entry := range entries {
		if !legacyRecapName.MatchString(entry.Name()) {
			continue
		}
		info, err := root.Lstat(entry.Name())
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil {
			failures = append(failures, err)
			continue
		}
		owner, ok := fileOwner(info)
		if !info.IsDir() || !ok || owner != uid {
			continue
		}
		if err := root.RemoveAll(entry.Name()); err != nil {
			failures = append(failures, err)
		}
	}
	return errors.Join(failures...)
}
