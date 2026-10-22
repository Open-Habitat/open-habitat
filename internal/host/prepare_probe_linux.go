//go:build linux

package host

import (
	"context"
	"encoding/json"
	"errors"
	"os"

	"github.com/Open-Habitat/open-habitat/internal/storagequota"
	"golang.org/x/sys/unix"
)

// ProbeEvidence is written before any filesystem/quota mutation. A running
// operation always fences a subsequent preparation, even if cleanup succeeded;
// diagnosis reobserves the mount, quota and files, never replays this intent.
type ProbeEvidence struct {
	SchemaVersion int                      `json:"schema_version"`
	OperationID   string                   `json:"operation_id"`
	Reservation   storagequota.ProbeRecord `json:"reservation"`
	Directory     string                   `json:"directory"`
	EDQUOT        bool                     `json:"edquot"`
	Cleaned       bool                     `json:"cleaned"`
}

type quotaProbeOps struct {
	reserve func(context.Context, int) (storagequota.ProbeRecord, error)
	write   func(context.Context, int, *os.File, storagequota.ProbeRecord, string) error
	restore func(int, storagequota.ProbeRecord) error
	// crash is a test-only process-loss seam. Returning an error simulates loss
	// of the writer: no defer cleanup, but the durable operation stays fenced.
	crash func(string) error
}

func nativeQuotaProbeOps() quotaProbeOps {
	return quotaProbeOps{reserve: storagequota.VacantProbeFD, write: storagequota.ProbeFD, restore: storagequota.RestoreProbeFD}
}

// prepareQuotaProbe is deliberately not yet wired into Prepare. Preparation
// must have a complete executable policy plan before it is permitted to run
// this write probe. This executor owns only the probe, not boot readiness.
func prepareQuotaProbe(ctx context.Context, l *Lock, o Operation, home int, executable string, ops quotaProbeOps) (Operation, ProbeEvidence, error) {
	ev := ProbeEvidence{SchemaVersion: 1, OperationID: o.ID, Directory: ".open-habitat-probe-" + o.ID}
	if o.Kind != "prepare" || o.Status != "running" || o.Phase != "started" {
		return o, ev, ErrRecovery
	}
	if err := ctx.Err(); err != nil {
		return o, ev, err
	}
	record, err := ops.reserve(ctx, home)
	if err != nil {
		return o, ev, err
	}
	ev.Reservation = record
	persist := func() error {
		b, e := json.Marshal(ev)
		if e != nil {
			return e
		}
		return replacePrivateAt(l.fd, o.ID+"-probe.json", b)
	}
	if err = persist(); err != nil {
		return o, ev, err
	}
	checkpoint := func(phase string) error {
		next, e := l.Advance(o, phase, "running", "")
		if e != nil {
			return e
		}
		o = next
		if ops.crash != nil {
			return ops.crash(phase)
		}
		return nil
	}
	if err = checkpoint("probe_reserved"); err != nil {
		return o, ev, err
	}
	if err = unix.Mkdirat(home, ev.Directory, 0700); err != nil {
		return o, ev, ErrRecovery
	}
	if unix.Fsync(home) != nil {
		return o, ev, ErrRecovery
	}
	dir, err := unix.Openat(home, ev.Directory, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err != nil {
		return o, ev, ErrRecovery
	}
	defer unix.Close(dir)
	fd, err := unix.Openat(dir, "data", unix.O_CREAT|unix.O_EXCL|unix.O_RDWR|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0600)
	if err != nil {
		return o, ev, ErrRecovery
	}
	file := os.NewFile(uintptr(fd), "probe-data")
	if unix.Fsync(dir) != nil {
		file.Close()
		return o, ev, ErrRecovery
	}
	// All subsequent failures have inspectable intent and an active fence. Real
	// cancellation cleans up; the crash seam intentionally leaves the same native
	// residue a SIGKILL/power loss would leave.
	if err = checkpoint("probe_armed"); err != nil {
		file.Close()
		return o, ev, err
	}
	probeErr := ops.write(ctx, home, file, record, executable)
	ev.EDQUOT = probeErr == nil
	// Preserve the observation separately from cleanup. A cleanup failure must
	// not erase the fact that the kernel did (or did not) report EDQUOT.
	if err = persist(); err != nil {
		file.Close()
		return o, ev, ErrRecovery
	}
	if err = checkpoint("probe_cleanup"); err != nil {
		file.Close()
		return o, ev, err
	}
	// Close after unlink: outstanding descriptors otherwise keep charged blocks
	// alive, making a zero-usage quota readback meaningless.
	unlinkErr := unix.Unlinkat(dir, "data", 0)
	closeErr := file.Close()
	if unlinkErr != nil || closeErr != nil || unix.Fsync(dir) != nil {
		return o, ev, ErrRecovery
	}
	if unix.Unlinkat(home, ev.Directory, unix.AT_REMOVEDIR) != nil || unix.Fsync(home) != nil {
		return o, ev, ErrRecovery
	}
	if ops.restore(home, record) != nil {
		return o, ev, ErrRecovery
	}
	ev.Cleaned = true
	if err = persist(); err != nil {
		return o, ev, ErrRecovery
	}
	if err = checkpoint("probe_verified"); err != nil {
		return o, ev, err
	}
	if probeErr != nil {
		if errors.Is(probeErr, context.Canceled) || errors.Is(probeErr, context.DeadlineExceeded) {
			return o, ev, probeErr
		}
		return o, ev, ErrPrepareBlocked
	}
	return o, ev, nil
}
