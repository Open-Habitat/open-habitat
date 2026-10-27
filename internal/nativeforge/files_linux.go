//go:build linux

package nativeforge

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"os"
	"strings"
	"time"

	"golang.org/x/sys/unix"
)

// Files is the safe lifecycle of a native tool's configuration file in one
// person's home: directories opened without following a symlink and owned by
// the person, the tool's own flock protocol on a sibling lock file, a private
// regular file read through a descriptor, and an atomic replacement of
// exactly the inode that was read. It holds no file contents between calls.
type Files struct {
	// Home is the person's home; every directory is below it.
	Home string
	// UID is the owner every checked directory and file must have.
	UID int
	// LockTimeout is how long the tool's lock is waited for; LockPoll how
	// often it is tried.
	LockTimeout, LockPoll time.Duration
	// Fault injects a failure at a named write step (tests only).
	Fault func(step string) error
}

// ErrMissing: a directory level does not exist (and was not to be created).
var ErrMissing = errors.New("missing")

// OpenDir opens Home/<dir...> without following a symlink at any level.
// Home and every level below it must belong to the person and not be
// writable by group or others. With create, missing levels are made 0700.
func (f *Files) OpenDir(dir []string, create bool) (int, error) {
	fd, err := unix.Open(f.Home, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err != nil {
		return -1, ErrUnavailable
	}
	if !f.safeDir(fd) {
		unix.Close(fd)
		return -1, ErrUnavailable
	}
	for _, name := range dir {
		if name == "" || name == "." || name == ".." || strings.Contains(name, "/") {
			unix.Close(fd)
			return -1, ErrUnavailable
		}
		next, err := unix.Openat(fd, name, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
		if errors.Is(err, unix.ENOENT) && create {
			if err = unix.Mkdirat(fd, name, 0o700); err == nil || errors.Is(err, unix.EEXIST) {
				next, err = unix.Openat(fd, name, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
			}
		}
		unix.Close(fd)
		if errors.Is(err, unix.ENOENT) {
			return -1, ErrMissing
		}
		if err != nil {
			return -1, ErrUnavailable
		}
		if !f.safeDir(next) {
			unix.Close(next)
			return -1, ErrUnavailable
		}
		fd = next
	}
	return fd, nil
}

func (f *Files) safeDir(fd int) bool {
	var st unix.Stat_t
	return unix.Fstat(fd, &st) == nil && st.Mode&unix.S_IFMT == unix.S_IFDIR && int(st.Uid) == f.UID && st.Mode&0o022 == 0
}

// Present reports whether name exists in dir in any form; a symlink counts,
// and is refused later rather than followed.
func Present(dir int, name string) (bool, error) {
	var st unix.Stat_t
	err := unix.Fstatat(dir, name, &st, unix.AT_SYMLINK_NOFOLLOW)
	if errors.Is(err, unix.ENOENT) {
		return false, nil
	}
	return err == nil, err
}

// CloseFD closes fd when it is open.
func CloseFD(fd int) {
	if fd >= 0 {
		unix.Close(fd)
	}
}

// Wipe overwrites b, which held native file bytes and so a token.
func Wipe(b []byte) {
	for i := range b {
		b[i] = 0
	}
}

// Acquire takes the tool's own lock, an flock on dir/name (shared for
// reads, exclusive for edits), within LockTimeout. The lock file is created
// 0600 when missing and must be the person's regular file.
func (f *Files) Acquire(dir int, name string, exclusive bool) (int, error) {
	fd, err := unix.Openat(dir, name, unix.O_RDWR|unix.O_CREAT|unix.O_NOFOLLOW|unix.O_CLOEXEC|unix.O_NONBLOCK, 0o600)
	if err != nil {
		return -1, ErrUnavailable
	}
	var st unix.Stat_t
	if unix.Fstat(fd, &st) != nil || st.Mode&unix.S_IFMT != unix.S_IFREG || int(st.Uid) != f.UID {
		unix.Close(fd)
		return -1, ErrUnavailable
	}
	how := unix.LOCK_SH
	if exclusive {
		how = unix.LOCK_EX
	}
	poll := f.LockPoll
	if poll <= 0 {
		poll = 50 * time.Millisecond
	}
	deadline := time.Now().Add(f.LockTimeout)
	for {
		err := unix.Flock(fd, how|unix.LOCK_NB)
		if err == nil {
			return fd, nil
		}
		if !errors.Is(err, unix.EWOULDBLOCK) || time.Now().After(deadline) {
			unix.Close(fd)
			if errors.Is(err, unix.EWOULDBLOCK) {
				return -1, ErrBusy
			}
			return -1, ErrUnavailable
		}
		time.Sleep(poll)
	}
}

// Release unlocks and closes a lock Acquire returned.
func Release(lock int) {
	if lock >= 0 {
		_ = unix.Flock(lock, unix.LOCK_UN)
		unix.Close(lock)
	}
}

// Observed is the file a session read: whether it existed and, if so, the
// identity a replacement must still find.
type Observed struct {
	Exists bool
	Stat   unix.Stat_t
}

// Read reads dir/name through a descriptor: a regular file of the person's
// own, one link, private mode and at most max bytes. A missing file is nil
// data with Exists false.
func (f *Files) Read(dir int, name string, max int64) ([]byte, Observed, error) {
	var obs Observed
	fd, err := unix.Openat(dir, name, unix.O_RDONLY|unix.O_NOFOLLOW|unix.O_NONBLOCK|unix.O_CLOEXEC, 0)
	if errors.Is(err, unix.ENOENT) {
		return nil, obs, nil
	}
	if err != nil {
		return nil, obs, ErrUnavailable
	}
	file := os.NewFile(uintptr(fd), name)
	defer file.Close()
	if unix.Fstat(fd, &obs.Stat) != nil || obs.Stat.Mode&unix.S_IFMT != unix.S_IFREG || int(obs.Stat.Uid) != f.UID ||
		obs.Stat.Nlink != 1 || obs.Stat.Mode&0o077 != 0 || obs.Stat.Size > max {
		return nil, Observed{}, ErrUnavailable
	}
	data, err := io.ReadAll(io.LimitReader(file, max+1))
	if err != nil || int64(len(data)) > max {
		Wipe(data)
		return nil, Observed{}, ErrUnavailable
	}
	obs.Exists = true
	return data, obs, nil
}

func (f *Files) step(name string) error {
	if f.Fault != nil {
		return f.Fault(name)
	}
	return nil
}

// Commit atomically replaces dir/name, as observed under the lock, with
// data, mode 0600. Every failure before the rename leaves the previous bytes
// in place (ErrWriteFailed, or ErrChanged when the file is no longer the one
// read under the lock). A failure after it is ErrUncertain: reread, never
// replay. data is wiped.
func (f *Files) Commit(dir int, name string, obs Observed, data []byte) error {
	defer Wipe(data)
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		return ErrWriteFailed
	}
	tmp := "." + name + "." + hex.EncodeToString(b[:]) + ".tmp"
	fd, err := unix.Openat(dir, tmp, unix.O_WRONLY|unix.O_CREAT|unix.O_EXCL|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0o600)
	if err != nil {
		return ErrWriteFailed
	}
	file := os.NewFile(uintptr(fd), tmp)
	err = f.step("write")
	if err == nil {
		_, err = file.Write(data)
	}
	if err == nil {
		if err = f.step("sync"); err == nil {
			err = file.Sync()
		}
	}
	if cerr := file.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		_ = unix.Unlinkat(dir, tmp, 0)
		return ErrWriteFailed
	}
	// Same-UID editors that ignore the tool's lock can still change the
	// file; only replace the exact inode and contents observed under it.
	var now unix.Stat_t
	statErr := unix.Fstatat(dir, name, &now, unix.AT_SYMLINK_NOFOLLOW)
	st := obs.Stat
	switch {
	case obs.Exists && (statErr != nil || now.Dev != st.Dev || now.Ino != st.Ino || now.Size != st.Size || now.Mtim != st.Mtim || now.Ctim != st.Ctim):
		_ = unix.Unlinkat(dir, tmp, 0)
		return ErrChanged
	case !obs.Exists && !errors.Is(statErr, unix.ENOENT):
		_ = unix.Unlinkat(dir, tmp, 0)
		return ErrChanged
	}
	if err = f.step("rename"); err == nil {
		if obs.Exists {
			err = unix.Renameat(dir, tmp, dir, name)
		} else {
			err = unix.Renameat2(dir, tmp, dir, name, unix.RENAME_NOREPLACE)
		}
	}
	if err != nil {
		_ = unix.Unlinkat(dir, tmp, 0)
		if errors.Is(err, unix.EEXIST) {
			return ErrChanged
		}
		return ErrWriteFailed
	}
	if err = f.step("dirsync"); err == nil {
		err = unix.Fsync(dir)
	}
	if err != nil {
		return ErrUncertain
	}
	return nil
}
