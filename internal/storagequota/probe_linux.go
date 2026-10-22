//go:build linux

package storagequota

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"

	"golang.org/x/sys/unix"
)

// End before systemd's DynamicUser allocator (61184..65519). An interrupted
// probe's residual hard limit must never become a future dynamic service's.
const probeUIDMin, probeUIDMax = 61000, 61184

// ProbeRecord is recovery evidence, not permission to replay a probe. The
// caller must durably store it before invoking ProbeFD and keep its operation
// fenced until Cleanup is verified. No account is created or adopted.
type ProbeRecord struct {
	UID     uint32 `json:"uid"`
	Hard    uint64 `json:"hard"`
	Soft    uint64 `json:"soft"`
	MountID uint64 `json:"mount_id"`
	Device  uint64 `json:"device"`
}

// VacantProbeFD selects only a zero-usage, unlimited, non-account UID outside
// the product's supported account range. NSS uncertainty is not absence.
// Deliberate maintenance must exclude concurrent account administration.
func VacantProbeFD(ctx context.Context, fd int) (ProbeRecord, error) {
	if os.Geteuid() != 0 || EnabledFD(fd) != nil {
		return ProbeRecord{}, ErrUnavailable
	}
	var st unix.Stat_t
	var sx unix.Statx_t
	if unix.Fstat(fd, &st) != nil || unix.Statx(fd, "", unix.AT_EMPTY_PATH, unix.STATX_MNT_ID, &sx) != nil || sx.Mask&unix.STATX_MNT_ID == 0 {
		return ProbeRecord{}, ErrUnavailable
	}
	for uid := uint32(probeUIDMin); uid < probeUIDMax; uid++ {
		if ctx.Err() != nil {
			return ProbeRecord{}, ctx.Err()
		}
		// getent has an explicit missing-key status; os/user cannot distinguish all
		// unavailable NSS backends from an unknown numeric identity.
		cmd := exec.CommandContext(ctx, "/usr/bin/getent", "passwd", strconv.FormatUint(uint64(uid), 10))
		cmd.Env = []string{"PATH=/usr/bin:/bin", "LC_ALL=C"}
		out, err := cmd.Output()
		var exit *exec.ExitError
		if err == nil {
			continue
		}
		if !errors.As(err, &exit) || exit.ExitCode() != 2 || len(out) != 0 {
			return ProbeRecord{}, ErrUnavailable
		}
		group := exec.CommandContext(ctx, "/usr/bin/getent", "group", strconv.FormatUint(uint64(uid), 10))
		group.Env = []string{"PATH=/usr/bin:/bin", "LC_ALL=C"}
		gout, gerr := group.Output()
		if gerr == nil {
			continue
		}
		if !errors.As(gerr, &exit) || exit.ExitCode() != 2 || len(gout) != 0 {
			return ProbeRecord{}, ErrUnavailable
		}
		var q dqblk
		if quotaCall(fd, getQuota, uid, &q) != nil {
			return ProbeRecord{}, ErrUnavailable
		}
		if q.Hard != 0 || q.Soft != 0 || q.Current != 0 || q.ICurrent != 0 || q.IHard != 0 || q.ISoft != 0 {
			continue
		}
		if err := probeUIDUnused(ctx, uid); err != nil {
			continue
		}
		return ProbeRecord{uid, q.Hard, q.Soft, sx.Mnt_id, st.Dev}, nil
	}
	return ProbeRecord{}, ErrUnavailable
}

func probeMount(fd int, r ProbeRecord) error {
	var st unix.Stat_t
	var sx unix.Statx_t
	if os.Geteuid() != 0 || r.UID < probeUIDMin || r.UID >= probeUIDMax || r.Hard != 0 || r.Soft != 0 || unix.Fstat(fd, &st) != nil || st.Dev != r.Device || unix.Statx(fd, "", unix.AT_EMPTY_PATH, unix.STATX_MNT_ID, &sx) != nil || sx.Mask&unix.STATX_MNT_ID == 0 || sx.Mnt_id != r.MountID || EnabledFD(fd) != nil {
		return ErrUnavailable
	}
	return nil
}

// ProbeFD changes only the reserved UID's block limits. The caller owns the
// already-open, empty, single-link file on this pinned filesystem and records
// its name before calling. A child with no groups or capabilities writes at
// most 2 MiB. Only the helper's kernel EDQUOT result counts, not dd's text or a
// read of quota flags. Cleanup must run even when this method returns an error.
func ProbeFD(ctx context.Context, home int, file *os.File, r ProbeRecord, executable string) error {
	if probeMount(home, r) != nil {
		return ErrUnavailable
	}
	var fs, hs unix.Stat_t
	if unix.Fstat(home, &hs) != nil || unix.Fstat(int(file.Fd()), &fs) != nil || fs.Mode&unix.S_IFMT != unix.S_IFREG || fs.Dev != hs.Dev || fs.Size != 0 || fs.Nlink != 1 || fs.Uid != 0 || fs.Mode&0077 != 0 {
		return ErrUnavailable
	}
	var before dqblk
	if quotaCall(home, getQuota, r.UID, &before) != nil || before.Hard != r.Hard || before.Soft != r.Soft || before.Current != 0 || before.ICurrent != 0 {
		return ErrUnavailable
	}
	q := dqblk{Hard: 1024, Soft: 1024, Valid: qifBlockLimits}
	if quotaCall(home, setQuota, r.UID, &q) != nil {
		return ErrUnavailable
	}
	var check dqblk
	if quotaCall(home, getQuota, r.UID, &check) != nil || check.Hard != 1024 || check.Soft != 1024 {
		return ErrUnavailable
	}
	if file.Chown(int(r.UID), int(r.UID)) != nil {
		return ErrUnavailable
	}
	cmd := exec.CommandContext(ctx, executable, "quota-probe-write")
	cmd.Env = []string{"PATH=/usr/bin:/bin", "LC_ALL=C"}
	cmd.ExtraFiles = []*os.File{file}
	cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: r.UID, Gid: r.UID, Groups: []uint32{}}, Pdeathsig: syscall.SIGKILL}
	err := cmd.Run()
	if ctx.Err() != nil {
		return ctx.Err()
	}
	var exit *exec.ExitError
	if !errors.As(err, &exit) || exit.ExitCode() != 42 {
		return ErrUnavailable
	}
	return nil
}

// ProbeWrite is an unprivileged fixed-FD helper, not a path-based file API.
// It never opens a supplied filename and cannot exceed its fixed write budget.
// 42 means the kernel returned EDQUOT, 1 means any other result.
func ProbeWrite() int {
	if os.Geteuid() < probeUIDMin || os.Geteuid() >= probeUIDMax {
		return 1
	}
	var st unix.Stat_t
	if unix.Fstat(3, &st) != nil || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Uid != uint32(os.Geteuid()) || st.Nlink != 1 || st.Size != 0 {
		return 1
	}
	block := make([]byte, 4096)
	for n := 0; n < 512; n++ {
		written, err := unix.Write(3, block)
		if err == unix.EDQUOT {
			return 42
		}
		if err != nil || written != len(block) {
			return 1
		}
	}
	if unix.Fsync(3) == unix.EDQUOT {
		return 42
	}
	return 1
}

// RestoreProbeFD is called only after the probe file has been unlinked and
// closed. Readback of both limits AND zero block/inode usage is required. It
// cannot be used as an arbitrary quota editor: records require zero originals.
func RestoreProbeFD(home int, r ProbeRecord) error {
	if probeMount(home, r) != nil {
		return ErrUnavailable
	}
	// A changed reservation is not ours to reset. After closing/unlinking the
	// only probe file, either our exact limits or the unchanged originals must
	// remain, with no other charged inode or blocks.
	var current dqblk
	if quotaCall(home, getQuota, r.UID, &current) != nil || current.Current != 0 || current.ICurrent != 0 || current.IHard != 0 || current.ISoft != 0 ||
		!((current.Hard == 1024 && current.Soft == 1024) || (current.Hard == r.Hard && current.Soft == r.Soft)) {
		return ErrUnavailable
	}
	q := dqblk{Hard: r.Hard, Soft: r.Soft, Valid: qifBlockLimits}
	if quotaCall(home, setQuota, r.UID, &q) != nil {
		return ErrUnavailable
	}
	var after dqblk
	if quotaCall(home, getQuota, r.UID, &after) != nil || after.Hard != r.Hard || after.Soft != r.Soft || after.Current != 0 || after.ICurrent != 0 {
		return ErrUnavailable
	}
	return nil
}

// Reject a UID/GID already used by a process even without an NSS account. All
// four kernel UID/GID slots and supplementary groups matter, not just euid.
func probeUIDUnused(ctx context.Context, uid uint32) error {
	entries, err := os.ReadDir("/proc")
	if err != nil || len(entries) > 131072 {
		return ErrUnavailable
	}
	want := strconv.FormatUint(uint64(uid), 10)
	for _, entry := range entries {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if _, err := strconv.ParseUint(entry.Name(), 10, 32); err != nil {
			continue
		}
		b, err := os.ReadFile(filepath.Join("/proc", entry.Name(), "status"))
		if errors.Is(err, os.ErrNotExist) || errors.Is(err, syscall.ESRCH) {
			continue
		}
		if err != nil || len(b) > 65536 {
			return ErrUnavailable
		}
		for _, line := range strings.Split(string(b), "\n") {
			f := strings.Fields(line)
			if len(f) < 2 || (f[0] != "Uid:" && f[0] != "Gid:" && f[0] != "Groups:") {
				continue
			}
			for _, v := range f[1:] {
				if v == want {
					return ErrUnavailable
				}
			}
		}
	}
	return nil
}
