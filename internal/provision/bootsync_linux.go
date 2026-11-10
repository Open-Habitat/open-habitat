//go:build linux

package provision

import (
	"context"
	"errors"
	"os"
	"time"

	"golang.org/x/sys/unix"
)

// bootSignal is the integrations boot signal under a person's home,
// ".local/state/open-habitat/sync-at-boot" (ADR 0026). The person's daemon
// keeps it as an empty directory exactly while they have a syncing account.
// It is the one thing the broker looks at in a home, and only for whether it
// exists. The broker does not import the daemon side; a test keeps the two
// names equal.
var bootSignal = [...]string{".local", "state", "open-habitat", "sync-at-boot"}

// errBootSignalUnsafe means some component exists but is not a directory
// owned by the person on their home's filesystem: a link, another type,
// another owner or a mount. It never leads to a start.
var errBootSignalUnsafe = errors.New("boot signal unsafe")

// bootSignalAt reports whether base/name/bootSignal is a chain of
// directories owned by uid. Every component is opened with O_PATH relative
// to the descriptor of its checked parent and without following links, and
// each descriptor is checked with fstat, so a component swapped during the
// walk is either rejected or ignored, never followed: renaming a checked
// directory away leaves the walk in it, which is still the person's own. An O_PATH descriptor
// cannot read: nothing is listed and nothing inside the signal is opened.
// The test hook runs after each component has been checked.
func bootSignalAt(base, name string, uid uint32, checked func(int)) (bool, error) {
	if !username(name) || uid < 1000 || uid > 60000 {
		return false, ErrInvalid
	}
	const flags = unix.O_PATH | unix.O_DIRECTORY | unix.O_NOFOLLOW | unix.O_CLOEXEC
	dir, err := unix.Open(base, flags, 0)
	if err != nil {
		return false, ErrInvalid
	}
	components := append([]string{name}, bootSignal[:]...)
	var home unix.Stat_t
	for n, component := range components {
		next, err := unix.Openat(dir, component, flags, 0)
		unix.Close(dir)
		if errors.Is(err, unix.ENOENT) {
			return false, nil
		}
		if err != nil {
			// ENOTDIR or ELOOP: a file, a link or anything else in the
			// signal's place is unsafe, not absent.
			return false, errBootSignalUnsafe
		}
		dir = next
		var st unix.Stat_t
		if unix.Fstat(dir, &st) != nil || st.Mode&unix.S_IFMT != unix.S_IFDIR || st.Uid != uid {
			unix.Close(dir)
			return false, errBootSignalUnsafe
		}
		if n == 0 {
			home = st
		} else if st.Dev != home.Dev {
			unix.Close(dir)
			return false, errBootSignalUnsafe
		}
		if checked != nil {
			checked(n)
		}
	}
	unix.Close(dir)
	return true, nil
}

// SyncAtBoot is broker-boot only and called only for a committed, admitted
// binding whose socket has just been restored. A syscall into a person's
// home can block (a FUSE mount, for example), so the walk has its own
// deadline and a stuck one leaves this person's daemon unstarted without
// holding up the others.
func (e *LinuxHostExecutor) SyncAtBoot(ctx context.Context, i ExecutorIdentity) (bool, error) {
	if os.Geteuid() != 0 || ctx == nil || ctx.Err() != nil || e == nil {
		return false, ErrInvalid
	}
	type result struct {
		present bool
		err     error
	}
	done := make(chan result, 1)
	go func() {
		present, err := bootSignalAt(homeBase, i.username, i.uid, nil)
		done <- result{present, err}
	}()
	timeout := time.NewTimer(5 * time.Second)
	defer timeout.Stop()
	select {
	case r := <-done:
		return r.present, r.err
	case <-timeout.C:
		return false, errBootSignalUnsafe
	case <-ctx.Done():
		return false, ErrInvalid
	}
}

// StartDaemon widens the broker's systemd authority by exactly one action:
// starting the daemon service of a committed person whose verified socket is
// already active. The socket went through the installation's activation gate; the
// service only accepts on it, exactly as a gateway connection would start
// it. An inactive socket is refused rather than pulled in by the service's
// dependency.
func (e *LinuxHostExecutor) StartDaemon(ctx context.Context, i ExecutorIdentity) error {
	if os.Geteuid() != 0 || ctx == nil || ctx.Err() != nil || e.Verify(ctx, i) != nil {
		return ErrInvalid
	}
	return e.startOnActiveSocket(ctx, i)
}

func (e *LinuxHostExecutor) startOnActiveSocket(ctx context.Context, i ExecutorIdentity) error {
	if e.RouteReady(ctx, i) != nil {
		return ErrInvalid
	}
	if _, err := e.command(ctx, systemctl, "start", "open-habitat-daemon@"+i.username+".service"); err != nil {
		return ErrInvalid
	}
	return nil
}

// startSyncing runs after a successful socket restore. The person's own
// daemon is the only thing a signal can start, and an unsafe or absent one
// starts nothing.
func (w Writer) startSyncing(ctx context.Context, b ExecutorIdentity) (bool, error) {
	present, err := w.Executor.SyncAtBoot(ctx, b)
	if err != nil || !present {
		return false, err
	}
	start, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	if err := w.Executor.StartDaemon(start, b); err != nil {
		return false, errDaemonStart
	}
	return true, nil
}

var errDaemonStart = errors.New("daemon start failed")
