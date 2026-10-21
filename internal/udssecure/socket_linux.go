//go:build linux

// Package udssecure validates the systemd-created route before connecting.
// SO_PEERCRED on a socket created by PID 1 names root (the listening socket's
// creator), not the daemon UID that later accepts from the inherited fd.
package udssecure

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"syscall"
)

var ErrUntrusted = errors.New("untrusted systemd socket")

// Mapped requires a root-controlled traversal and a socket owned by the
// mapped UID, in the gateway's group. This is paired with SO_PEERCRED UID 0
// on the connected socket and daemon-side SO_PEERCRED of the gateway UID.
func Mapped(path string, uid int) error { return mapped(path, uid, "daemon.sock", 0660, true) }

// Agent validates the own-UID endpoint; no gateway group is granted access.
func Agent(path string, uid int) error { return mapped(path, uid, "agent.sock", 0600, false) }

func mapped(path string, uid int, base string, mode os.FileMode, gateway bool) error {
	if uid <= 0 || !strings.HasPrefix(path, "/run/open-habitat/users/") || filepath.Clean(path) != path || filepath.Base(path) != base {
		return ErrUntrusted
	}
	for dir := filepath.Dir(path); ; dir = filepath.Dir(dir) {
		info, e := os.Lstat(dir)
		if e != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 || info.Mode().Perm()&0022 != 0 {
			return ErrUntrusted
		}
		st, ok := info.Sys().(*syscall.Stat_t)
		if !ok || st.Uid != 0 {
			return ErrUntrusted
		}
		if dir == "/" {
			break
		}
	}
	info, e := os.Lstat(path)
	if e != nil || info.Mode()&os.ModeSocket == 0 || info.Mode()&os.ModeSymlink != 0 || info.Mode().Perm() != mode {
		return ErrUntrusted
	}
	st, ok := info.Sys().(*syscall.Stat_t)
	if !ok || int(st.Uid) != uid || (gateway && int(st.Gid) != os.Getegid()) {
		return ErrUntrusted
	}
	return nil
}
