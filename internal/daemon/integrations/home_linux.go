//go:build linux

package integrations

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/sys/unix"
)

// BootSignal is the person's integration directory that the root broker
// looks for at boot (ADR 0026): it exists exactly while the person has at
// least one syncing account, and then the broker starts their daemon so sync
// resumes without waiting for a sign-in. The broker checks only that each
// component is a directory owned by the person, without following links or
// reading anything inside. The daemon derives it from the tools' own
// configuration every time it starts and whenever an account changes, so it
// is a signal, not a record: a stale one heals at the next daemon start.
const BootSignal = ".local/state/open-habitat/sync-at-boot"

var errUnsafeHome = errors.New("unsafe home path")

// openHomeDir opens home/<components...> as a directory without following a
// symlink at any level. Every level below home must belong to the daemon's
// UID and not be writable by others. Missing levels are created 0700 when
// create is set.
func openHomeDir(home string, create bool, components ...string) (int, error) {
	fd, err := unix.Open(home, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err != nil {
		return -1, errUnsafeHome
	}
	for _, name := range components {
		if name == "" || name == "." || name == ".." || strings.Contains(name, "/") {
			unix.Close(fd)
			return -1, errUnsafeHome
		}
		next, err := unix.Openat(fd, name, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
		if errors.Is(err, unix.ENOENT) && create {
			if err = unix.Mkdirat(fd, name, 0o700); err == nil || errors.Is(err, unix.EEXIST) {
				next, err = unix.Openat(fd, name, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
			}
		}
		unix.Close(fd)
		if err != nil {
			if errors.Is(err, unix.ENOENT) {
				return -1, os.ErrNotExist
			}
			return -1, errUnsafeHome
		}
		var st unix.Stat_t
		if unix.Fstat(next, &st) != nil || st.Uid != uint32(os.Geteuid()) || st.Mode&0o022 != 0 {
			unix.Close(next)
			return -1, errUnsafeHome
		}
		fd = next
	}
	return fd, nil
}

// listHomeDir lists up to 256 names in home/rel. A missing directory, also one
// removed while it is read, is an empty list with dir -1; otherwise the caller
// closes dir.
func listHomeDir(home, rel string) ([]string, int, error) {
	dir, err := openHomeDir(home, false, splitPath(rel)...)
	if errors.Is(err, os.ErrNotExist) {
		return nil, -1, nil
	}
	if err != nil {
		return nil, -1, err
	}
	// Reading the names through a duplicate leaves dir open for the caller.
	fd, err := unix.Dup(dir)
	if err != nil {
		unix.Close(dir)
		return nil, -1, err
	}
	f := os.NewFile(uintptr(fd), rel)
	defer f.Close()
	names, err := f.Readdirnames(256)
	// Linux reads a directory removed after it was opened as ENOENT; it is
	// missing like one never there (an abandoned login's Cancel removes its
	// staging while a removal lists it).
	if errors.Is(err, unix.ENOENT) {
		unix.Close(dir)
		return nil, -1, nil
	}
	if err != nil && !errors.Is(err, io.EOF) {
		unix.Close(dir)
		return nil, -1, err
	}
	return names, dir, nil
}

func splitPath(rel string) []string {
	return strings.Split(filepath.Clean(rel), "/")
}

// writeFileAt replaces name in dir atomically with a new private file. The
// temporary name is random and created exclusively, and the rename replaces
// a symlink itself rather than writing through it.
func writeFileAt(dir int, name string, data []byte, perm uint32) error {
	var b [8]byte
	_, _ = rand.Read(b[:])
	tmp := "." + name + "." + hex.EncodeToString(b[:]) + ".tmp"
	if err := writeNewFileAt(dir, tmp, data, perm); err != nil {
		return err
	}
	if err := unix.Renameat(dir, tmp, dir, name); err != nil {
		_ = unix.Unlinkat(dir, tmp, 0)
		return err
	}
	return unix.Fsync(dir)
}

// writeNewFileAt creates name exclusively; it never replaces anything.
func writeNewFileAt(dir int, name string, data []byte, perm uint32) error {
	fd, err := unix.Openat(dir, name, unix.O_WRONLY|unix.O_CREAT|unix.O_EXCL|unix.O_NOFOLLOW|unix.O_CLOEXEC, perm)
	if err != nil {
		return err
	}
	f := os.NewFile(uintptr(fd), name)
	if _, err = f.Write(data); err == nil {
		err = f.Sync()
	}
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		_ = unix.Unlinkat(dir, name, 0)
	}
	return err
}

// readFileAt reads a regular file below dir without following a symlink.
func readFileAt(dir int, name string, max int64) ([]byte, error) {
	fd, err := unix.Openat(dir, name, unix.O_RDONLY|unix.O_NOFOLLOW|unix.O_NONBLOCK|unix.O_CLOEXEC, 0)
	if err != nil {
		return nil, err
	}
	f := os.NewFile(uintptr(fd), name)
	defer f.Close()
	var st unix.Stat_t
	if unix.Fstat(fd, &st) != nil || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Size > max {
		return nil, errUnsafeHome
	}
	data, err := io.ReadAll(io.LimitReader(f, max+1))
	if err != nil || int64(len(data)) > max {
		return nil, errUnsafeHome
	}
	return data, nil
}

// procPath names an opened directory for a tool that wants a path. The
// directory was opened without following links, and a tool running as the
// same person could follow anything anyway; this only keeps the daemon's own
// view consistent.
func procPath(home string, components ...string) string {
	return filepath.Join(append([]string{home}, components...)...)
}

func setBootSignal(home string, on bool) error {
	parts := splitPath(BootSignal)
	if on {
		fd, err := openHomeDir(home, true, parts...)
		if err == nil {
			unix.Close(fd)
		}
		return err
	}
	parent, err := openHomeDir(home, false, parts[:len(parts)-1]...)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	defer unix.Close(parent)
	// Only an empty directory is removed: whatever someone put inside is
	// theirs, and the broker never reads it anyway.
	if err := unix.Unlinkat(parent, parts[len(parts)-1], unix.AT_REMOVEDIR); err != nil && !errors.Is(err, unix.ENOENT) {
		return err
	}
	return nil
}

func bytesReader(b []byte) *bytes.Reader { return bytes.NewReader(b) }
