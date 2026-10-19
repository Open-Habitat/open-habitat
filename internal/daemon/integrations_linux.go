//go:build linux

package daemon

import (
	"errors"
	"strings"

	"golang.org/x/sys/unix"
)

var errNotCloudDirectory = errors.New("not a synced directory")

// trashCloudDirectory moves a removed account's synced directory, home/<rel>
// below ~/cloud/, to the person's freedesktop Trash, as a workspace deletion
// does: no symlink is followed, no filesystem is crossed, and the directory
// that moves is the one observed. Nothing is deleted outright; emptying the
// Trash stays the person's own act.
func trashCloudDirectory(home, rel string) error {
	parts := strings.Split(rel, "/")
	if len(parts) < 3 || parts[0] != "cloud" || !strings.HasPrefix(home, "/") || strings.Contains(home, "..") {
		return errNotCloudDirectory
	}
	for _, p := range parts {
		if p == "" || p == "." || p == ".." {
			return errNotCloudDirectory
		}
	}
	trashWriter.Lock()
	defer trashWriter.Unlock()
	root, e := unix.Open("/", unix.O_PATH|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if e != nil {
		return e
	}
	defer unix.Close(root)
	parent, e := dir(unix.Openat2, root, strings.TrimPrefix(home, "/"), false)
	if e != nil {
		return e
	}
	defer func() { unix.Close(parent) }()
	for _, p := range parts[:len(parts)-1] {
		next, e := dir(unix.Openat2, parent, p, true)
		if e != nil {
			return e
		}
		unix.Close(parent)
		parent = next
	}
	name := parts[len(parts)-1]
	child, e := dir(unix.Openat2, parent, name, true)
	if e != nil {
		return e
	}
	observed, e := stat(child)
	unix.Close(child)
	if e != nil || observed.Uid != uint32(unix.Geteuid()) {
		return errNotCloudDirectory
	}
	t, e := openTrash(home, true)
	if e != nil {
		return e
	}
	defer t.close()
	if t.dev != uint64(observed.Dev) {
		return unix.EXDEV
	}
	_, moved, e := moveToTrashFrom(parent, name, home+"/"+rel, observed, t)
	if moved >= 0 {
		unix.Close(moved)
	}
	return e
}
