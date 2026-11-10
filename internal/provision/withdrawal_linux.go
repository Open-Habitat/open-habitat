//go:build linux

package provision

import (
	"context"
	"os"

	"golang.org/x/sys/unix"
)

// Withdrawal and root's revocation stop what Habitat started for the web:
// the person's daemon service, and with it the Pi conversations in its
// cgroup, and both of their sockets (Jari, 2026-11-10). It is the
// counterpart of the socket restore and nothing more. The account, home,
// credentials, the person's own user manager with its terminal tmux and
// other units, lingering and SSH stay. A listener left running for a person
// no source admits would keep the daemon's processes alive with no route to
// them, and an installation's activation gate may rightly refuse every later
// socket start while one is.

// revoked is a committed binding's subject that no admission source admits
// any more: withdrawn, or dropped from root's site.json with nothing else
// admitting them. A team member record, whether left, unconfirmed or of an
// unlisted team, keeps the listeners: GitHub's silence at one sign-in is not
// a revocation, and the team source's changes are not root's.
func (a allowFile) revoked(id string) bool {
	return !a.admits(id) && a.member(id) == nil
}

// stopRevoked stops the listeners of id's committed binding, or of every
// revoked binding when id is empty. Which bindings qualify is read again
// from committed state under the ledger lock, so the stop never acts on a
// name or path a request carried, nor on anyone some source admits. The
// stop itself runs outside the ledger lock, because the daemon may take a
// while to end, but holds the activation slot: a socket start the broker
// asks for, such as an ensure after a concurrent restore, waits until the
// stop has finished instead of being undone by it. report, when given,
// receives each binding's outcome. The returned state is what the bindings
// were chosen from.
func (w Writer) stopRevoked(ctx context.Context, id string, report func(string, error)) (revokedState, error) {
	if ctx == nil || w.activation == nil || !w.valid() {
		return revokedState{}, ErrInvalid
	}
	select {
	case w.activation.slot <- struct{}{}:
		defer func() { <-w.activation.slot }()
	case <-ctx.Done():
		return revokedState{}, ctx.Err()
	}
	state, bindings, err := w.revokedBindings(ctx, id)
	if err != nil {
		return revokedState{}, err
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
	return state, failed
}

// revokedState is the committed state a stop chose its bindings from.
type revokedState struct {
	runtimeAdmission  bool
	generation, epoch uint64
}

// revokedBindings reads, under the ledger lock, the committed bindings whose
// subject is revoked.
func (w Writer) revokedBindings(ctx context.Context, id string) (revokedState, []ExecutorIdentity, error) {
	var none revokedState
	fd, err := lockedDir(ctx, w.Dir, w.owner)
	if err != nil {
		return none, nil, err
	}
	defer unix.Close(fd)
	defer unix.Flock(fd, unix.LOCK_UN)
	for _, n := range []string{"pending.json", "pending.json.next", "bindings.json.next", "head.json.next", "allowlist.json.next"} {
		if !absent(fd, n) {
			return none, nil, ErrInvalid
		}
	}
	a, l, _, _, err := stateAt(ctx, fd, w.owner)
	if err != nil {
		return none, nil, ErrInvalid
	}
	// A rolled-back admission file could name as revoked someone since
	// restored; refuse it as every other reader does.
	hb, err := readAt(fd, "head.json", w.owner)
	var h head
	if err != nil || decode(hb, &h, "version", "epoch", "generation") != nil || h.Version != 1 || h.Epoch == 0 || h.Epoch > a.Epoch || h.Generation != l.Generation {
		return none, nil, ErrInvalid
	}
	state := revokedState{runtimeAdmission: a.RuntimeAdmission, generation: l.Generation, epoch: a.Epoch}
	if w.AdmitAny {
		return state, nil, nil
	}
	var out []ExecutorIdentity
	for _, b := range l.Bindings {
		if id != "" && b.ID != id || !a.revoked(b.ID) {
			continue
		}
		if b.UID < w.UIDMin || b.UID > w.UIDMax {
			return none, nil, ErrInvalid
		}
		out = append(out, ExecutorIdentity{provider: "github", id: b.ID, username: b.Username, uid: b.UID})
	}
	return state, out, ctx.Err()
}

func listenerUnits(name string) []string {
	return []string{"open-habitat-daemon@" + name + ".service", "open-habitat-daemon@" + name + ".socket", "open-habitat-agent@" + name + ".socket"}
}

// StopListeners widens the broker's systemd authority by exactly the stop
// of one committed person's daemon service and two sockets. It takes the
// name only from the committed binding and does not verify the account
// first: ending a revoked person's daemon must not depend on their home
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

// handleStopRevoked answers root's revocation, relayed by the gateway after
// host apply published a site.json that no longer admits someone: it stops
// every revoked binding's listeners and replies with an empty access page.
// The request names nobody, so the gateway can ask for nothing the broker's
// own start would not do. A failed stop is unavailable; the revocation is
// already committed and stays, and asking again repeats only the stop.
func (w Writer) handleStopRevoked(ctx context.Context) Reply {
	state, err := w.stopRevoked(ctx, "", w.stopReport)
	if err != nil {
		return failure(StateUnavailable)
	}
	mode := "allowlist"
	if w.AdmitAny {
		mode = "any"
	}
	return Reply{Version: 1, Access: &AccessPage{Mode: mode, RuntimeAdmission: state.runtimeAdmission, Rows: []AccessRow{}}, Generation: state.generation, Epoch: state.epoch}
}
