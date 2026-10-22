//go:build linux

package bootguard

import (
	"errors"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/sys/unix"
)

// Upgrade is a read-only cold-start fence. Only a live deliberate root
// operation holding the existing kernel lock can exercise listeners while an
// upgrade fence exists. A dead writer, including after reboot, grants nothing.
// The gate neither parses/replays maintenance journals nor repairs anything.
func Upgrade() string {
	if os.Geteuid() != 0 {
		return "root_required"
	}
	return upgradeGate("/etc/open-habitat/upgrade-closed", "/var/lib/open-habitat/host")
}
func upgradeGate(path, lock string) string {
	// An unpublished deny marker is evidence of interrupted closure, never
	// absence. Its contents confer no startup authority, even on a live lease.
	if _, e := readPolicy(path + ".next"); !errors.Is(e, os.ErrNotExist) {
		if e != nil {
			return "upgrade_fence_unavailable"
		}
		return "upgrade_closed"
	}
	b, e := readPolicy(path)
	if errors.Is(e, os.ErrNotExist) {
		return "verified"
	}
	if e != nil || string(b) != "closed\n" {
		return "upgrade_fence_unavailable"
	}
	return upgradeLock(lock)
}
func upgradeLock(path string) string {
	if !filepath.IsAbs(path) || filepath.Clean(path) != path {
		return "upgrade_fence_unavailable"
	}
	fd, e := unix.Open("/", unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if e != nil {
		return "upgrade_fence_unavailable"
	}
	defer func() { unix.Close(fd) }()
	for _, part := range strings.Split(strings.TrimPrefix(path, "/"), "/") {
		next, e := unix.Openat(fd, part, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
		if e != nil {
			return "upgrade_fence_unavailable"
		}
		unix.Close(fd)
		fd = next
		var st unix.Stat_t
		if unix.Fstat(fd, &st) != nil || st.Uid != 0 || st.Mode&0022 != 0 {
			return "upgrade_fence_unavailable"
		}
	}
	var st unix.Stat_t
	if unix.Fstat(fd, &st) != nil || st.Mode&0077 != 0 {
		return "upgrade_fence_unavailable"
	}
	if e = unix.Flock(fd, unix.LOCK_SH|unix.LOCK_NB); e == unix.EWOULDBLOCK || e == unix.EAGAIN {
		lease, e := unix.Openat(fd, "upgrade-live", unix.O_RDONLY|unix.O_NOFOLLOW|unix.O_NONBLOCK|unix.O_CLOEXEC, 0)
		if e != nil {
			return "upgrade_closed"
		}
		defer unix.Close(lease)
		var st unix.Stat_t
		if unix.Fstat(lease, &st) != nil || st.Uid != 0 || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Mode&0777 != 0600 || st.Nlink != 1 || st.Size != 0 {
			return "upgrade_fence_unavailable"
		}
		e = unix.Flock(lease, unix.LOCK_SH|unix.LOCK_NB)
		if e == unix.EWOULDBLOCK || e == unix.EAGAIN {
			return "verified"
		}
		if e == nil {
			unix.Flock(lease, unix.LOCK_UN)
		}
		return "upgrade_closed"
	}
	if e == nil {
		unix.Flock(fd, unix.LOCK_UN)
	}
	return "upgrade_closed"
}
