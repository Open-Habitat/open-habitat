//go:build linux

// Package storagequota reads native Linux user quota state. It does not keep a
// second accounting record; the kernel remains the enforcement authority.
package storagequota

import (
	"errors"
	"os"
	"strconv"
	"strings"
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

// Linux accepts the mounted block device as the special argument to quotactl.
// Resolve it from the kernel's mount table, not from browser or daemon input.
// A distinct /home mount takes precedence over /; fail closed for bind mounts
// or an unrecognised device rather than applying limits to another filesystem.
func device() (string, error) {
	var home unix.Stat_t
	if unix.Stat("/home", &home) != nil {
		return "", ErrUnavailable
	}
	b, err := os.ReadFile("/proc/self/mountinfo")
	if err != nil {
		return "", ErrUnavailable
	}
	best, depth := "", -1
	for _, line := range strings.Split(string(b), "\n") {
		sides := strings.SplitN(line, " - ", 2)
		if len(sides) != 2 {
			continue
		}
		left, right := strings.Fields(sides[0]), strings.Fields(sides[1])
		if len(left) < 5 || len(right) < 2 {
			continue
		}
		mount := left[4]
		if mount != "/" && mount != "/home" {
			continue
		}
		major, err1 := strconv.ParseUint(strings.Split(left[2], ":")[0], 10, 32)
		parts := strings.Split(left[2], ":")
		if len(parts) != 2 || err1 != nil {
			continue
		}
		minor, err2 := strconv.ParseUint(parts[1], 10, 32)
		if err2 != nil || unix.Mkdev(uint32(major), uint32(minor)) != uint64(home.Dev) || right[0] != "ext4" || left[3] != "/" {
			continue
		}
		path := right[1]
		var st unix.Stat_t
		if !strings.HasPrefix(path, "/dev/") || unix.Stat(path, &st) != nil || st.Mode&unix.S_IFMT != unix.S_IFBLK || uint64(st.Rdev) != uint64(home.Dev) {
			continue
		}
		if len(mount) > depth {
			best, depth = path, len(mount)
		}
	}
	if best == "" {
		return "", ErrUnavailable
	}
	return best, nil
}

func syscall(cmd int, special string, uid uint32, block *dqblk) error {
	p, err := unix.BytePtrFromString(special)
	if err != nil {
		return ErrUnavailable
	}
	_, _, errno := unix.Syscall6(unix.SYS_QUOTACTL, uintptr(cmd), uintptr(unsafe.Pointer(p)), uintptr(uid), uintptr(unsafe.Pointer(block)), 0, 0)
	if errno != 0 {
		return ErrUnavailable
	}
	return nil
}

func Read(uid uint32) (Quota, error) {
	if uid < 1000 || uid > 60000 {
		return Quota{}, ErrUnavailable
	}
	dev, err := device()
	if err != nil {
		return Quota{}, err
	}
	var b dqblk
	if syscall(getQuota, dev, uid, &b) != nil || b.Hard == 0 || b.Hard > ^uint64(0)/1024 || b.Current > ^uint64(0)-1023 {
		return Quota{}, ErrUnavailable
	}
	return Quota{Usage: b.Current, Limit: b.Hard * 1024}, nil
}

// Set changes only the block hard limit. It leaves inode and soft limits
// untouched. No quota value is persisted outside the kernel.
func Set(uid uint32, bytes uint64) error {
	if uid < 1000 || uid > 60000 || bytes < 1<<20 || bytes > 1<<50 || bytes%1024 != 0 {
		return ErrUnavailable
	}
	dev, err := device()
	if err != nil {
		return err
	}
	b := dqblk{Hard: bytes / 1024, Valid: qifBlockLimits}
	if syscall(setQuota, dev, uid, &b) != nil {
		return ErrUnavailable
	}
	q, err := Read(uid)
	if err != nil || q.Limit != bytes {
		return ErrUnavailable
	}
	return nil
}
