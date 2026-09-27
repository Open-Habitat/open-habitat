//go:build linux

package provision

import (
	"errors"

	"golang.org/x/sys/unix"
)

// sourceDir operates relative to a verified home descriptor. An existing src
// is accepted only if it already meets the complete policy; it is never
// chowned, chmodded, or followed. The helper is idempotent for safe state,
// but the JIT journal still denies retries of interrupted provisioning.
func sourceDir(home string, uid uint32, create bool) error {
	h, err := unix.Open(home, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err != nil {
		return ErrInvalid
	}
	defer unix.Close(h)
	if !sourceOwner(h, uid) || !sourceNoACL(h) {
		return ErrInvalid
	}
	created := false
	if create {
		err = unix.Mkdirat(h, "src", 0700)
		if err == nil {
			created = true
		} else if !errors.Is(err, unix.EEXIST) {
			return ErrInvalid
		}
	}
	s, err := unix.Openat(h, "src", unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err != nil {
		return ErrInvalid
	}
	defer unix.Close(s)
	if created {
		// A fresh directory inherits the home GID (e.g. setgid home).
		// Change only the inode opened through the verified parent, never a
		// pathname which could have been replaced between mkdir and chown.
		if err := unix.Fchown(s, int(uid), int(uid)); err != nil {
			return ErrInvalid
		}
	}
	if !sourceOwner(s, uid) || !sourceOwner(h, uid) || !sameSourceEntry(h, s) {
		return ErrInvalid
	}
	if !sourceNoACL(s) {
		return ErrInvalid
	}
	if create && unix.Fsync(h) != nil {
		return ErrInvalid
	}
	// Reject a home swapped out while working through the pinned descriptor.
	var pathStat, fdStat unix.Stat_t
	if unix.Fstatat(unix.AT_FDCWD, home, &pathStat, unix.AT_SYMLINK_NOFOLLOW) != nil || unix.Fstat(h, &fdStat) != nil || pathStat.Dev != fdStat.Dev || pathStat.Ino != fdStat.Ino || !sourceOwner(h, uid) {
		return ErrInvalid
	}
	return nil
}

func sourceNoACL(fd int) bool {
	for _, name := range []string{"system.posix_acl_access", "system.posix_acl_default"} {
		if _, err := unix.Fgetxattr(fd, name, nil); err != unix.ENODATA {
			return false
		}
	}
	return true
}

func sourceOwner(fd int, uid uint32) bool {
	var st unix.Stat_t
	return unix.Fstat(fd, &st) == nil && st.Mode&unix.S_IFMT == unix.S_IFDIR && st.Mode&07777 == 0700 && st.Uid == uid && st.Gid == uid
}

func sameSourceEntry(home, src int) bool {
	var entry, opened unix.Stat_t
	return unix.Fstatat(home, "src", &entry, unix.AT_SYMLINK_NOFOLLOW) == nil && unix.Fstat(src, &opened) == nil && entry.Dev == opened.Dev && entry.Ino == opened.Ino && entry.Mode&unix.S_IFMT == unix.S_IFDIR
}

func ensureSource(home string, uid uint32) error { return sourceDir(home, uid, true) }
func verifySource(home string, uid uint32) error { return sourceDir(home, uid, false) }
