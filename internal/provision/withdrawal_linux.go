//go:build linux

package provision

import (
	"context"
	"os"

	"golang.org/x/sys/unix"
)

// Withdrawal stops what Habitat started for the web: the person's daemon
// service, and with it the Pi conversations in its cgroup, and both of their
// sockets (Jari, 2026-11-10). It is the counterpart of the socket restore
// and nothing more. The account, home, credentials, the person's own user
// manager with its terminal tmux and other units, lingering and SSH stay.
// A listener left running for a person no source admits would keep the
// daemon's processes alive with no route to them, and an installation's
// activation gate may rightly refuse every later socket start while one is.

// stopWithdrawn stops the listeners of id's committed binding, or of every
// withdrawn binding when id is empty. Which bindings qualify is read again
// from committed state under the ledger lock, so the stop never acts on a
// name or path a request carried, nor on anyone some source admits. The
// stop itself runs outside the ledger lock, because the daemon may take a
// while to end, but holds the activation slot: a socket start the broker
// asks for, such as an ensure after a concurrent restore, waits until the
// stop has finished instead of being undone by it. report, when given,
// receives each binding's outcome.
func (w Writer) stopWithdrawn(ctx context.Context, id string, report func(string, error)) error {
	if ctx == nil || w.activation == nil || !w.valid() {
		return ErrInvalid
	}
	select {
	case w.activation.slot <- struct{}{}:
		defer func() { <-w.activation.slot }()
	case <-ctx.Done():
		return ctx.Err()
	}
	bindings, err := w.withdrawnBindings(ctx, id)
	if err != nil {
		return err
	}
	var failed error
	for _, b := range bindings {
		err := w.Executor.StopListeners(ctx, b)
		if report != nil {
			report(b.username, err)
		}
		if err != nil {
			failed = err
		}
	}
	return failed
}

// withdrawnBindings reads, under the ledger lock, the committed bindings
// whose runtime entry is withdrawn and that no admission source admits.
func (w Writer) withdrawnBindings(ctx context.Context, id string) ([]ExecutorIdentity, error) {
	fd, err := lockedDir(ctx, w.Dir, w.owner)
	if err != nil {
		return nil, err
	}
	defer unix.Close(fd)
	defer unix.Flock(fd, unix.LOCK_UN)
	for _, n := range []string{"pending.json", "pending.json.next", "bindings.json.next", "head.json.next", "allowlist.json.next"} {
		if !absent(fd, n) {
			return nil, ErrInvalid
		}
	}
	a, l, _, _, err := stateAt(ctx, fd, w.owner)
	if err != nil {
		return nil, ErrInvalid
	}
	// A rolled-back admission file could name as withdrawn someone since
	// restored; refuse it as every other reader does.
	hb, err := readAt(fd, "head.json", w.owner)
	var h head
	if err != nil || decode(hb, &h, "version", "epoch", "generation") != nil || h.Version != 1 || h.Epoch == 0 || h.Epoch > a.Epoch || h.Generation != l.Generation {
		return nil, ErrInvalid
	}
	if w.AdmitAny {
		return nil, nil
	}
	withdrawn := map[string]bool{}
	for _, x := range a.Runtime {
		if x.State == "withdrawn" {
			withdrawn[x.ID] = true
		}
	}
	var out []ExecutorIdentity
	for _, b := range l.Bindings {
		if id != "" && b.ID != id || !withdrawn[b.ID] || a.admits(b.ID) {
			continue
		}
		if b.UID < w.UIDMin || b.UID > w.UIDMax {
			return nil, ErrInvalid
		}
		out = append(out, ExecutorIdentity{provider: "github", id: b.ID, username: b.Username, uid: b.UID})
	}
	return out, ctx.Err()
}

func listenerUnits(name string) []string {
	return []string{"open-habitat-daemon@" + name + ".service", "open-habitat-daemon@" + name + ".socket", "open-habitat-agent@" + name + ".socket"}
}

// StopListeners widens the broker's systemd authority by exactly the stop
// of one committed person's daemon service and two sockets. It takes the
// name only from the committed binding and does not verify the account
// first: ending a withdrawn person's daemon must not depend on their home
// or NSS entry being intact. A stop that ran into the service's stop
// timeout can leave a unit failed; resetting that lets a later restore and
// the broker's startup see an ordinary inactive binding. The person counts
// as stopped only when all three units are inactive.
func (e *LinuxHostExecutor) StopListeners(ctx context.Context, i ExecutorIdentity) error {
	if os.Geteuid() != 0 || ctx == nil || ctx.Err() != nil || !username(i.username) || i.uid < 1000 || i.uid > 60000 {
		return ErrInvalid
	}
	units := listenerUnits(i.username)
	_, _ = e.command(ctx, systemctl, append([]string{"stop"}, units...)...)
	_, _ = e.command(ctx, systemctl, append([]string{"reset-failed"}, units...)...)
	for _, unit := range units {
		b, err := e.command(ctx, systemctl, "show", unit, "--property=ActiveState", "--no-pager")
		if err != nil || string(b) != "ActiveState=inactive\n" {
			return ErrInvalid
		}
	}
	return ctx.Err()
}

func (w Writer) stopReport(user string, err error) {
	if w.StopEvent != nil {
		w.StopEvent(user, err == nil)
	}
}
