//go:build linux

// Package storagequota reads native Linux user quota state. The kernel is the
// only record and enforcement authority; this package stores no accounting.
package storagequota

import (
	"errors"
	"unsafe"

	"golang.org/x/sys/unix"
)

var ErrUnavailable = errors.New("user quota unavailable")

// Usage and Limit are bytes. A zero hard limit means unlimited and is not a
// usable product quota. Quota blocks are 1024 bytes, irrespective of ext4's
// filesystem block size.
type Quota struct{ Usage, Limit uint64 }

type dqblk struct {
	Hard, Soft, Current, IHard, ISoft, ICurrent, BTime, ITime uint64
	Valid                                                     uint32
}

const (
	getQuota       = (0x800007 << 8) // QCMD(Q_GETQUOTA, USRQUOTA)
	setQuota       = (0x800008 << 8) // QCMD(Q_SETQUOTA, USRQUOTA)
	qifBlockLimits = 1
)

// quotactl_fd addresses the filesystem through a descriptor, not a device
// path. The broker's PrivateDevices=yes hides the real block device and an
// unprivileged daemon cannot open it. /home is host-selected and never comes
// from a request; the ext4 check refuses unsupported filesystems. A per-user
// image mounted below /home is separately rejected by clone admission.
func homeFD() (int, error) {
	fd, err := unix.Open("/home", unix.O_PATH|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err != nil {
		return -1, ErrUnavailable
	}
	var fs unix.Statfs_t
	if unix.Fstatfs(fd, &fs) != nil || fs.Type != unix.EXT4_SUPER_MAGIC {
		unix.Close(fd)
		return -1, ErrUnavailable
	}
	return fd, nil
}
func quotaCall(fd, cmd int, uid uint32, block *dqblk) error {
	_, _, errno := unix.Syscall6(unix.SYS_QUOTACTL_FD, uintptr(fd), uintptr(cmd), uintptr(uid), uintptr(unsafe.Pointer(block)), 0, 0)
	if errno != 0 {
		return ErrUnavailable
	}
	return nil
}

func readFD(fd int, uid uint32) (Quota, error) {
	var b dqblk
	if quotaCall(fd, getQuota, uid, &b) != nil || b.Hard == 0 || b.Hard > ^uint64(0)/1024 {
		return Quota{}, ErrUnavailable
	}
	return Quota{Usage: b.Current, Limit: b.Hard * 1024}, nil
}

func Read(uid uint32) (Quota, error) {
	if uid < 1000 || uid > 60000 {
		return Quota{}, ErrUnavailable
	}
	fd, err := homeFD()
	if err != nil {
		return Quota{}, err
	}
	defer unix.Close(fd)
	return readFD(fd, uid)
}

// Set changes only the block hard limit. It leaves inode and soft limits
// untouched. The readback uses the same descriptor, avoiding a filesystem
// switch between setting and checking the applied limit.
func Set(uid uint32, bytes uint64) error {
	if uid < 1000 || uid > 60000 || bytes < 1<<20 || bytes > 1<<50 || bytes%1024 != 0 {
		return ErrUnavailable
	}
	fd, err := homeFD()
	if err != nil {
		return err
	}
	defer unix.Close(fd)
	b := dqblk{Hard: bytes / 1024, Valid: qifBlockLimits}
	if quotaCall(fd, setQuota, uid, &b) != nil {
		return ErrUnavailable
	}
	q, err := readFD(fd, uid)
	if err != nil || q.Limit != bytes {
		return ErrUnavailable
	}
	return nil
}
