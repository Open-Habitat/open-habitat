//go:build linux

// Package storagebaseline observes the supported home volume without preparing
// or repairing it. Both maintenance and boot verification use these predicates.
package storagebaseline

import (
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"github.com/open-habitat/open-habitat/internal/storagequota"
	"golang.org/x/sys/unix"
	"io"
	"os"
	"strconv"
	"strings"
)

var ErrStorage = errors.New("home storage unavailable")

type Mount struct{ ID, Device string }

// MountFrom finds the dedicated /home mount a user-quota installation needs.
func MountFrom(b []byte) (Mount, string, string) { return mountFrom(b, false) }

// HomeFilesystemFrom finds the filesystem holding /home for an installation
// without user quotas: a dedicated /home mount or, on an ordinary
// single-filesystem server, the root filesystem itself.
func HomeFilesystemFrom(b []byte) (Mount, string, string) { return mountFrom(b, true) }

func mountFrom(b []byte, onRoot bool) (Mount, string, string) {
	if len(b) > 4<<20 {
		return Mount{}, "unavailable", "observation_unavailable"
	}
	rootDevice := ""
	var root []string
	var homes [][]string
	roots := 0
	for _, line := range strings.Split(string(b), "\n") {
		f := strings.Fields(line)
		if len(f) < 6 {
			continue
		}
		switch f[4] {
		case "/":
			roots++
			rootDevice = f[2]
			root = f
		case "/home":
			homes = append(homes, f)
		}
	}
	if roots != 1 || len(homes) > 1 {
		return Mount{}, "unavailable", "ambiguous_home_mount"
	}
	f := root
	if len(homes) == 1 {
		f = homes[0]
	} else if !onRoot {
		return Mount{}, "fail", "separate_home_required"
	}
	split := -1
	for i := 6; i < len(f); i++ {
		if f[i] == "-" {
			split = i
			break
		}
	}
	id, err := strconv.ParseUint(f[0], 10, 64)
	if err != nil || id == 0 || split < 6 || split+4 != len(f) {
		return Mount{}, "unavailable", "observation_unavailable"
	}
	if len(homes) == 1 && f[2] == rootDevice || f[3] != "/" || f[split+1] != "ext4" || !hasOption(f[5], "rw") || hasOption(f[5], "ro") || !hasOption(f[split+3], "rw") || hasOption(f[split+3], "ro") {
		return Mount{}, "fail", "unsupported_home_mount"
	}
	// Mounted descendants could put product homes on unverified storage. This
	// slice supports one home filesystem, not per-user/shared overmounts.
	for _, line := range strings.Split(string(b), "\n") {
		fields := strings.Fields(line)
		if len(fields) >= 5 && strings.HasPrefix(fields[4], "/home/") {
			return Mount{}, "fail", "nested_home_mount"
		}
	}
	if len(homes) == 0 {
		return Mount{f[0], f[2]}, "pass", "home_on_root_filesystem_observed"
	}
	return Mount{f[0], f[2]}, "pass", "home_mount_observed"
}
func hasOption(options, want string) bool {
	for _, v := range strings.Split(options, ",") {
		if v == want {
			return true
		}
	}
	return false
}

// Read exactly the primary ext4 superblock. No tune2fs, quotaon, filesystem
// conversion or device write is allowed in check/plan. Feature changes are
// customer-performed offline work; the later prepare command must not infer
// permission to convert from an observed missing feature.
func ReadSuperblock(path, device string) ([]byte, error) {
	fd, err := unix.Open(path, unix.O_RDONLY|unix.O_NONBLOCK|unix.O_CLOEXEC, 0)
	if err != nil {
		return nil, err
	}
	f := os.NewFile(uintptr(fd), "home-device")
	defer f.Close()
	var st unix.Stat_t
	if unix.Fstat(fd, &st) != nil || st.Mode&unix.S_IFMT != unix.S_IFBLK || fmtDevice(st.Rdev) != device {
		return nil, ErrStorage
	}
	b := make([]byte, 1024)
	_, err = io.ReadFull(io.NewSectionReader(f, 1024, 1024), b)
	return b, err
}

// Identity checks that the primary superblock is ext4 with the declared UUID.
func Identity(b []byte, uuid string) (string, string) {
	if len(b) != 1024 || binary.LittleEndian.Uint16(b[0x38:]) != 0xef53 {
		return "fail", "invalid_ext4_superblock"
	}
	u := hex.EncodeToString(b[0x68:0x78])
	actual := u[:8] + "-" + u[8:12] + "-" + u[12:16] + "-" + u[16:20] + "-" + u[20:]
	if actual != uuid {
		return "fail", "home_uuid_mismatch"
	}
	return "pass", "home_uuid_observed"
}

func QuotaFormat(b []byte, uuid string) (string, string) {
	if status, reason := Identity(b, uuid); status != "pass" {
		return status, reason
	}
	// EXT4_FEATURE_COMPAT_HAS_JOURNAL and RO_COMPAT_QUOTA, with an internal
	// user quota inode. External aquota files are deliberately not qualified.
	if binary.LittleEndian.Uint32(b[0x5c:])&0x4 == 0 || binary.LittleEndian.Uint32(b[0x64:])&0x100 == 0 || binary.LittleEndian.Uint32(b[0x240:]) == 0 {
		return "fail", "offline_journaled_user_quota_required"
	}
	return "pass", "journaled_user_quota_observed"
}

func pinnedHome(m Mount) (int, error) {
	fd, err := unix.Open("/home", unix.O_PATH|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err != nil {
		return -1, err
	}
	var st unix.Stat_t
	var sx unix.Statx_t
	if unix.Fstat(fd, &st) != nil || fmtDevice(st.Dev) != m.Device || unix.Statx(fd, "", unix.AT_EMPTY_PATH, unix.STATX_MNT_ID, &sx) != nil || sx.Mask&unix.STATX_MNT_ID == 0 || strconv.FormatUint(sx.Mnt_id, 10) != m.ID {
		unix.Close(fd)
		return -1, ErrStorage
	}
	return fd, nil
}

func Enforcement(m Mount) error {
	fd, err := pinnedHome(m)
	if err != nil {
		return err
	}
	defer unix.Close(fd)
	return storagequota.EnabledFD(fd)
}

// Pinned checks that /home itself resolves to the observed mount, as
// Enforcement does, without asking for quota state.
func Pinned(m Mount) error {
	fd, err := pinnedHome(m)
	if err != nil {
		return err
	}
	return unix.Close(fd)
}

// PolicyPath is the installed storage policy that preparation writes.
const PolicyPath = "/etc/open-habitat/storage-policy.json"

// Installed reads the installed policy through root-owned, non-writable
// ancestry. Runtimes that change behaviour by mode (broker, daemon) must treat
// an error as the user-quota mode, never as permission to skip limits.
func Installed() (Policy, error) {
	b, err := ReadPolicy(PolicyPath)
	if err != nil {
		return Policy{}, err
	}
	p, ok := ParsePolicy(b)
	if !ok {
		return Policy{}, ErrStorage
	}
	return p, nil
}

// ReadPolicy reads a fixed non-secret policy through root-owned, non-writable
// ancestry. openat prevents a link at any component from selecting another one.
func ReadPolicy(path string) ([]byte, error) {
	fd, e := unix.Open("/", unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if e != nil {
		return nil, e
	}
	defer func() { unix.Close(fd) }()
	parts := strings.Split(strings.TrimPrefix(path, "/"), "/")
	for n, part := range parts {
		flags := unix.O_RDONLY | unix.O_NOFOLLOW | unix.O_NONBLOCK | unix.O_CLOEXEC
		if n < len(parts)-1 {
			// Search permission is enough for the 0711 /etc/open-habitat.
			flags = unix.O_PATH | unix.O_NOFOLLOW | unix.O_CLOEXEC | unix.O_DIRECTORY
		}
		next, e := unix.Openat(fd, part, flags, 0)
		if e != nil {
			return nil, e
		}
		unix.Close(fd)
		fd = next
		var st unix.Stat_t
		if unix.Fstat(fd, &st) != nil || st.Uid != 0 || st.Mode&0022 != 0 {
			return nil, ErrStorage
		}
		if n == len(parts)-1 && (st.Mode&unix.S_IFMT != unix.S_IFREG || st.Nlink != 1 || st.Size > 4096) {
			return nil, ErrStorage
		}
	}
	// The duplicate belongs to File; the original stays with the directory walk.
	dup, e := unix.Dup(fd)
	if e != nil {
		return nil, e
	}
	f := os.NewFile(uintptr(dup), "storage-policy")
	defer f.Close()
	return io.ReadAll(io.LimitReader(f, 4097))
}

func fmtDevice(dev uint64) string { return fmt.Sprintf("%d:%d", unix.Major(dev), unix.Minor(dev)) }
