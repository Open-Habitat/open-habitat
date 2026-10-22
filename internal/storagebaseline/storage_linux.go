//go:build linux

// Package storagebaseline observes the supported home volume without preparing
// or repairing it. Both maintenance and boot verification use these predicates.
package storagebaseline

import (
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"github.com/Open-Habitat/open-habitat/internal/storagequota"
	"golang.org/x/sys/unix"
	"io"
	"os"
	"strconv"
	"strings"
)

var ErrStorage = errors.New("home storage unavailable")

type Mount struct{ ID, Device string }

func MountFrom(b []byte) (Mount, string, string) {
	if len(b) > 4<<20 {
		return Mount{}, "unavailable", "observation_unavailable"
	}
	rootDevice := ""
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
		case "/home":
			homes = append(homes, f)
		}
	}
	if roots != 1 || len(homes) > 1 {
		return Mount{}, "unavailable", "ambiguous_home_mount"
	}
	if len(homes) == 0 {
		return Mount{}, "fail", "separate_home_required"
	}
	f := homes[0]
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
	if f[2] == rootDevice || f[3] != "/" || f[split+1] != "ext4" || !hasOption(f[5], "rw") || hasOption(f[5], "ro") || !hasOption(f[split+3], "rw") || hasOption(f[split+3], "ro") {
		return Mount{}, "fail", "unsupported_home_mount"
	}
	// Mounted descendants could put product homes on unverified storage. This
	// slice supports one dedicated volume, not per-user/shared overmounts.
	for _, line := range strings.Split(string(b), "\n") {
		fields := strings.Fields(line)
		if len(fields) >= 5 && strings.HasPrefix(fields[4], "/home/") {
			return Mount{}, "fail", "nested_home_mount"
		}
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

func QuotaFormat(b []byte, uuid string) (string, string) {
	if len(b) != 1024 || binary.LittleEndian.Uint16(b[0x38:]) != 0xef53 {
		return "fail", "invalid_ext4_superblock"
	}
	u := hex.EncodeToString(b[0x68:0x78])
	actual := u[:8] + "-" + u[8:12] + "-" + u[12:16] + "-" + u[16:20] + "-" + u[20:]
	if actual != uuid {
		return "fail", "home_uuid_mismatch"
	}
	// EXT4_FEATURE_COMPAT_HAS_JOURNAL and RO_COMPAT_QUOTA, with an internal
	// user quota inode. External aquota files are deliberately not qualified.
	if binary.LittleEndian.Uint32(b[0x5c:])&0x4 == 0 || binary.LittleEndian.Uint32(b[0x64:])&0x100 == 0 || binary.LittleEndian.Uint32(b[0x240:]) == 0 {
		return "fail", "offline_journaled_user_quota_required"
	}
	return "pass", "journaled_user_quota_observed"
}

func Enforcement(m Mount) error {
	fd, err := unix.Open("/home", unix.O_PATH|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err != nil {
		return err
	}
	defer unix.Close(fd)
	var st unix.Stat_t
	var sx unix.Statx_t
	if unix.Fstat(fd, &st) != nil || fmtDevice(st.Dev) != m.Device || unix.Statx(fd, "", unix.AT_EMPTY_PATH, unix.STATX_MNT_ID, &sx) != nil || sx.Mask&unix.STATX_MNT_ID == 0 || strconv.FormatUint(sx.Mnt_id, 10) != m.ID {
		return ErrStorage
	}
	return storagequota.EnabledFD(fd)
}

func fmtDevice(dev uint64) string { return fmt.Sprintf("%d:%d", unix.Major(dev), unix.Minor(dev)) }
