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

// Filesystem is a point-in-time observation of the same home filesystem.
// Free counts blocks available to ordinary users, not root-reserved blocks.
type Filesystem struct{ Capacity, Free uint64 }

func Capacity() (Filesystem, error) {
	fd, err := homeFD()
	if err != nil {
		return Filesystem{}, err
	}
	defer unix.Close(fd)
	var fs unix.Statfs_t
	if unix.Fstatfs(fd, &fs) != nil || fs.Frsize <= 0 || fs.Blocks == 0 || fs.Bavail > fs.Blocks || fs.Blocks > ^uint64(0)/uint64(fs.Frsize) {
		return Filesystem{}, ErrUnavailable
	}
	return Filesystem{Capacity: fs.Blocks * uint64(fs.Frsize), Free: fs.Bavail * uint64(fs.Frsize)}, nil
}

type dqblk struct {
	Hard, Soft, Current, IHard, ISoft, ICurrent, BTime, ITime uint64
	Valid                                                     uint32
}

const (
	xGetQuotaStatV = ((('X' << 8) + 8) << 8) // QCMD(Q_XGETQSTATV, USRQUOTA)
	userAcct       = 1 << 0                  // FS_QUOTA_UDQ_ACCT
	userEnforced   = 1 << 1                  // FS_QUOTA_UDQ_ENFD
	getQuota       = (0x800007 << 8)         // QCMD(Q_GETQUOTA, USRQUOTA)
	setQuota       = (0x800008 << 8)         // QCMD(Q_SETQUOTA, USRQUOTA)
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

// fs_quota_statv version 1 from linux/dqblk_xfs.h. Q_GETINFO only proves
// accounting; ext4 can account usage while silently allowing writes beyond
// the hard limit. The kernel reports enforcement independently in Flags.
type quotaFileStat struct {
	Inode, Blocks uint64
	Extents, Pad  uint32
}
type quotaStat struct {
	Version int8
	Pad1    uint8
	Flags   uint16
	Incore  uint32
	Files   [3]quotaFileStat
	Timers  [3]int32
	Warns   [4]uint16
	Pad4    uint32
	Pad2    [7]uint64
}

func quotaEnforced(flags uint16) bool { return flags&(userAcct|userEnforced) == userAcct|userEnforced }

func enforcedFD(fd int) error {
	q := quotaStat{Version: 1}
	_, _, errno := unix.Syscall6(unix.SYS_QUOTACTL_FD, uintptr(fd), uintptr(xGetQuotaStatV), 0, uintptr(unsafe.Pointer(&q)), 0, 0)
	if errno != 0 || q.Version != 1 || !quotaEnforced(q.Flags) {
		return ErrUnavailable
	}
	return nil
}

// EnabledFD checks a caller-pinned ext4 filesystem without reopening /home.
// It only reads kernel accounting/enforcement flags, never changes limits.
// Callers must separately establish mount and UUID identity; these flags do
// not prove journaled quota format, boot ordering or an EDQUOT write probe.
func EnabledFD(fd int) error {
	var fs unix.Statfs_t
	if unix.Fstatfs(fd, &fs) != nil || fs.Type != unix.EXT4_SUPER_MAGIC {
		return ErrUnavailable
	}
	return enforcedFD(fd)
}

// Enabled checks accounting AND enforcement on the host-selected home
// filesystem. It does not need an unused UID or mutate kernel quota state.
func Enabled() error {
	fd, err := homeFD()
	if err != nil {
		return err
	}
	defer unix.Close(fd)
	return enforcedFD(fd)
}

func quotaCall(fd, cmd int, uid uint32, block *dqblk) error {
	_, _, errno := unix.Syscall6(unix.SYS_QUOTACTL_FD, uintptr(fd), uintptr(cmd), uintptr(uid), uintptr(unsafe.Pointer(block)), 0, 0)
	if errno != 0 {
		return ErrUnavailable
	}
	return nil
}

func readFD(fd int, uid uint32) (Quota, error) {
	if enforcedFD(fd) != nil {
		return Quota{}, ErrUnavailable
	}
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

// Set changes the block hard limit. It preserves any existing soft limit
// unless the new hard limit is lower, in which case it clamps the soft limit
// to the hard limit. Inode limits remain untouched. Readback uses the same
// descriptor, avoiding a filesystem switch between setting and checking.
func Set(uid uint32, bytes uint64) error {
	if uid < 1000 || uid > 60000 || bytes < 1<<20 || bytes > 1<<50 || bytes%1024 != 0 {
		return ErrUnavailable
	}
	fd, err := homeFD()
	if err != nil {
		return err
	}
	defer unix.Close(fd)
	if enforcedFD(fd) != nil {
		return ErrUnavailable
	}
	// QIF_BLIMITS updates *both* block limits. An unreadable existing
	// record is not safe to overwrite.
	var current dqblk
	if quotaCall(fd, getQuota, uid, &current) != nil {
		return ErrUnavailable
	}
	soft := current.Soft
	if soft > bytes/1024 {
		soft = bytes / 1024
	}
	b := dqblk{Hard: bytes / 1024, Soft: soft, Valid: qifBlockLimits}
	if quotaCall(fd, setQuota, uid, &b) != nil {
		return ErrUnavailable
	}
	q, err := readFD(fd, uid)
	if err != nil || q.Limit != bytes {
		return ErrUnavailable
	}
	return nil
}
