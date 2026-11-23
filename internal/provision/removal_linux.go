//go:build linux

package provision

import (
	"context"
	"errors"
	"slices"
	"sort"
	"time"

	"golang.org/x/sys/unix"
)

// Removing a person (ADR 0037) is the one way an account leaves the broker's
// ledger, and the broker's only account deletion. Its bounds: only a committed
// binding with a durable removal entry, only a subject no admission source
// admits, only on the gateway's administrator request, root's control socket
// or the broker's own due-time check, and never a name, path or UID from a
// request: every host step takes the binding's committed UID and name.
//
// Every step observes before it acts and is skipped when already done, so a
// removal is repeated rather than resumed from a journal. The entry with its
// last stage is the durable intent; nothing else records progress.

// RemovalExecutor performs the host side of a removal for one committed
// identity. Each method is repeatable and reports an error carrying a fixed
// removal reason (removalHold) when it cannot finish.
type RemovalExecutor interface {
	// CloseOut ends everything of the person on the host without touching
	// their data: it expires the account, disables lingering, stops the user
	// manager, terminates sessions and kills what remains, then confirms that
	// no process runs as the UID. It tolerates an account already deleted.
	CloseOut(context.Context, ExecutorIdentity) error
	// Reopen unexpires the account after a cancelled removal.
	Reopen(context.Context, ExecutorIdentity) error
	// RemoveOutside deletes the person's files outside the home.
	RemoveOutside(context.Context, ExecutorIdentity) error
	// RemoveHome deletes the home by descriptor, never following a link or
	// crossing a mount.
	RemoveHome(context.Context, ExecutorIdentity) error
	// RemoveArtifacts removes what the broker created for the binding: the
	// socket directory, named ACL entries, daemon configuration, and finally
	// the passwd and group entries.
	RemoveArtifacts(context.Context, ExecutorIdentity) error
}

// removalHold is a host step's fixed reason for holding a removal.
type removalHold string

func (h removalHold) Error() string { return "removal held: " + string(h) }

func holdReason(err error, fallback string) string {
	var h removalHold
	if errors.As(err, &h) && removalReason(string(h)) && h != "" {
		return string(h)
	}
	return fallback
}

// removalState serializes every removal operation in one broker: a cancel
// must not unexpire an account a concurrent close-out is about to expire.
// kick asks the broker's runner to look for due removals now.
type removalState struct {
	slot chan struct{}
	kick chan struct{}
}

func newRemovalState() *removalState {
	return &removalState{slot: make(chan struct{}, 1), kick: make(chan struct{}, 1)}
}

func (w Writer) removalNow() time.Time {
	if w.Now != nil {
		return w.Now().UTC()
	}
	return time.Now().UTC()
}

func stamp(t time.Time) string { return t.UTC().Truncate(time.Second).Format(time.RFC3339) }

func (w Writer) removalEvent(e removalEntry, stage, outcome, reason string) {
	if w.RemovalEvent != nil {
		w.RemovalEvent(e.ID, e.Username, stage, outcome, reason)
	}
}

func (e removalEntry) identity() ExecutorIdentity {
	return ExecutorIdentity{provider: "github", id: e.ID, username: e.Username, uid: e.UID}
}

// ledger is the committed state read under the directory lock.
type ledger struct {
	fd     int
	a      allowFile
	l      ledgerFile
	ab, lb []byte
	h      head
}

func (g *ledger) close() {
	unix.Flock(g.fd, unix.LOCK_UN)
	unix.Close(g.fd)
}

// openLedger takes the directory lock and reads committed state as every
// other writer does, refusing interrupted staging and recording a newer
// admission epoch in the watermark.
func (w Writer) openLedger(ctx context.Context) (*ledger, error) {
	fd, err := lockedDir(ctx, w.Dir, w.owner)
	if err != nil {
		return nil, err
	}
	g := &ledger{fd: fd}
	fail := func() (*ledger, error) { g.close(); return nil, ErrInvalid }
	for _, n := range []string{"pending.json", "pending.json.next", "bindings.json.next", "head.json.next", "allowlist.json.next"} {
		if !absent(fd, n) {
			return fail()
		}
	}
	if g.a, g.l, g.ab, g.lb, err = stateAt(ctx, fd, w.owner); err != nil {
		return fail()
	}
	hb, err := readAt(fd, "head.json", w.owner)
	if err != nil || decode(hb, &g.h, "version", "epoch", "generation") != nil || g.h.Version != 1 || g.h.Epoch == 0 || g.h.Generation == 0 || g.a.Epoch < g.h.Epoch || g.l.Generation != g.h.Generation {
		return fail()
	}
	if g.a.Epoch > g.h.Epoch {
		g.h.Epoch = g.a.Epoch
		if replace(fd, "head.json", marshal(g.h)) != nil {
			return fail()
		}
	}
	return g, ctx.Err()
}

// commitAllow publishes next as the admission file with epoch+1. The
// admission file is the commit point; the watermark follows.
func (g *ledger) commitAllow(ctx context.Context, next allowFile) error {
	if g.a.Epoch == ^uint64(0) || ctx.Err() != nil {
		return ErrInvalid
	}
	sort.Slice(next.Runtime, func(i, j int) bool { return idLess(next.Runtime[i].ID, next.Runtime[j].ID) })
	sort.Slice(next.Members, func(i, j int) bool { return idLess(next.Members[i].ID, next.Members[j].ID) })
	sort.Slice(next.Removals, func(i, j int) bool { return idLess(next.Removals[i].ID, next.Removals[j].ID) })
	if len(next.Runtime) == 0 {
		next.Runtime = nil
	}
	if len(next.Members) == 0 {
		next.Members = nil
	}
	if len(next.Removals) == 0 {
		next.Removals = nil
	}
	if len(next.Revoked) == 0 {
		next.Revoked = nil
	}
	next.Epoch = g.a.Epoch + 1
	b := marshal(next)
	if len(b) > maxAllowlist {
		return ErrInvalid
	}
	if replace(g.fd, "allowlist.json", b) != nil {
		return ErrInvalid
	}
	g.a, g.ab = next, b
	g.h.Epoch = next.Epoch
	return replace(g.fd, "head.json", marshal(g.h))
}

// copyAllow returns a with its slices copied, ready to change.
func copyAllow(a allowFile) allowFile {
	next := a
	next.Runtime = append([]runtimeEntry{}, a.Runtime...)
	next.Members = append([]teamMember{}, a.Members...)
	next.Revoked = append([]string{}, a.Revoked...)
	next.Removals = append([]removalEntry{}, a.Removals...)
	return next
}

// forget drops every admission record of id: the runtime entry, member
// record, root's revocation and the removal entry.
func forget(next *allowFile, id string) {
	next.Runtime = slices.DeleteFunc(next.Runtime, func(x runtimeEntry) bool { return x.ID == id })
	next.Members = slices.DeleteFunc(next.Members, func(x teamMember) bool { return x.ID == id })
	next.Revoked = slices.DeleteFunc(next.Revoked, func(x string) bool { return x == id })
	next.Removals = slices.DeleteFunc(next.Removals, func(x removalEntry) bool { return x.ID == id })
}

func (g *ledger) binding(id string) (binding, bool) {
	for _, b := range g.l.Bindings {
		if b.ID == id {
			return b, true
		}
	}
	return binding{}, false
}

func (g *ledger) operator(id string) bool {
	for _, x := range g.a.IDs {
		if x.ID == id {
			return true
		}
	}
	return false
}

// handleRemoval serves removal_schedule and removal_cancel. Both wait for the
// broker's one removal slot.
func (w Writer) handleRemoval(ctx context.Context, r Request) Reply {
	if ctx == nil || !w.valid() || w.removal == nil || w.RemovalHost == nil {
		return failure(StateUnavailable)
	}
	if _, e := EncodeRequest(r); e != nil {
		return failure(Invalid)
	}
	if w.AdmitAny {
		// Everyone is admitted on a test installation; nobody can be removed.
		return failure(AdmissionOpen)
	}
	select {
	case w.removal.slot <- struct{}{}:
		defer func() { <-w.removal.slot }()
	case <-ctx.Done():
		return failure(StateUnavailable)
	}
	if r.Operation == OpRemovalCancel {
		return w.cancelRemoval(ctx, r)
	}
	return w.scheduleRemoval(ctx, r)
}

// removalPage answers with the subject's access row as committed now.
func (w Writer) removalPage(ctx context.Context, id string, row *AccessRow) Reply {
	g, err := w.openLedger(ctx)
	if err != nil {
		return failure(StateUnavailable)
	}
	defer g.close()
	bound := map[string]binding{}
	for _, b := range g.l.Bindings {
		bound[b.ID] = b
	}
	rows := []AccessRow{}
	if row != nil {
		rows = append(rows, *row)
	} else if x := rowFor(g.a, bound, id); x.ID != "" {
		rows = append(rows, x)
	}
	reply := Reply{Version: 1, Access: &AccessPage{Mode: "allowlist", RuntimeAdmission: g.a.RuntimeAdmission, Rows: rows}, Generation: g.l.Generation, Epoch: g.a.Epoch}
	if _, err := EncodeReply(reply); err != nil {
		return failure(StateUnavailable)
	}
	return reply
}

// scheduleRemoval commits the removal entry together with the withdrawal it
// implies, then closes the person out. A repeat continues: it repeats the
// close-out, and "now" brings a pending due time forward. A subject without
// a binding has nothing on the host; its admission records are dropped and
// the reply says removed.
func (w Writer) scheduleRemoval(ctx context.Context, r Request) Reply {
	now := w.removalNow()
	g, err := w.openLedger(ctx)
	if err != nil {
		return failure(StateUnavailable)
	}
	if g.operator(r.ID) {
		g.close()
		return failure(OperatorOwned)
	}
	b, bound := g.binding(r.ID)
	if !bound {
		next := copyAllow(g.a)
		forget(&next, r.ID)
		changed := len(next.Runtime) != len(g.a.Runtime) || len(next.Members) != len(g.a.Members) || len(next.Revoked) != len(g.a.Revoked) || len(next.Removals) != len(g.a.Removals)
		if changed && g.commitAllow(ctx, next) != nil {
			g.close()
			return failure(StateUnavailable)
		}
		g.close()
		return w.removalPage(ctx, r.ID, &AccessRow{ID: r.ID, Source: SourceSiteAdmin, State: StateRemoved})
	}
	if b.UID < w.UIDMin || b.UID > w.UIDMax {
		g.close()
		return failure(Drift)
	}
	entry := g.a.removal(r.ID)
	var e removalEntry
	switch {
	case entry != nil && (entry.UID != b.UID || entry.Username != b.Username):
		g.close()
		return failure(Drift)
	case entry != nil:
		e = *entry
		if r.When == RemovalNow && e.Stage != RemovalRemoving && e.Due > stamp(now) {
			e.Due = stamp(now)
			next := copyAllow(g.a)
			*next.removal(r.ID) = e
			if g.commitAllow(ctx, next) != nil {
				g.close()
				return failure(StateUnavailable)
			}
		}
	default:
		due := now
		if r.When == RemovalGrace {
			due = now.Add(RemovalGracePeriod)
		}
		e = removalEntry{ID: r.ID, UID: b.UID, Username: b.Username, Due: stamp(due), Actor: r.Actor, At: stamp(now), Stage: RemovalClosing}
		next := copyAllow(g.a)
		withdrawn(&next, r.ID, r.LoginHint, r.Actor, stamp(now))
		if len(next.Runtime) > MaxRuntimeAdmission {
			g.close()
			return failure(RuntimeFull)
		}
		next.Removals = append(next.Removals, e)
		if g.commitAllow(ctx, next) != nil {
			g.close()
			return failure(StateUnavailable)
		}
	}
	g.close()
	w.removalEvent(e, "scheduled", "committed", "")
	if e.Stage != RemovalRemoving {
		w.closeOut(ctx, e)
	}
	if e.Due <= stamp(w.removalNow()) {
		w.kickRemoval()
	}
	return w.removalPage(ctx, r.ID, nil)
}

// withdrawn makes id's runtime entry withdrawn, as a withdrawal of a bound
// person does, and drops the member record.
func withdrawn(next *allowFile, id, hint, actor, at string) {
	next.Members = slices.DeleteFunc(next.Members, func(x teamMember) bool { return x.ID == id })
	for i := range next.Runtime {
		if next.Runtime[i].ID == id {
			next.Runtime[i].State, next.Runtime[i].Actor, next.Runtime[i].At = "withdrawn", actor, at
			return
		}
	}
	next.Runtime = append(next.Runtime, runtimeEntry{ID: id, State: "withdrawn", LoginHint: hint, Actor: actor, At: at})
}

// closeOut runs stage 1 for e outside the ledger lock and records its
// outcome on the entry: closed, or held with close_failed. The listener stop
// is the withdrawal's own, so it holds the activation slot as that does.
func (w Writer) closeOut(ctx context.Context, e removalEntry) {
	i := e.identity()
	_, err := w.stopRevoked(ctx, e.ID, w.stopReport)
	if err == nil {
		bounded, cancel := context.WithTimeout(ctx, 2*time.Minute)
		err = w.RemovalHost.CloseOut(bounded, i)
		cancel()
	}
	stage, reason := RemovalClosed, ""
	if err != nil {
		stage, reason = RemovalClosing, holdReason(err, RemovalCloseFailed)
	}
	// The outcome is recorded even when the exchange's own budget ran out
	// during the close-out.
	record, cancel := context.WithTimeout(context.WithoutCancel(ctx), 10*time.Second)
	w.recordStage(record, e, stage, reason)
	cancel()
	if err != nil {
		w.removalEvent(e, "close_out", "held", reason)
	} else {
		w.removalEvent(e, "close_out", "closed", "")
	}
}

// recordStage commits stage and reason on e's entry if it still names the
// same binding and has not moved on to the data stage behind our back.
func (w Writer) recordStage(ctx context.Context, e removalEntry, stage, reason string) bool {
	g, err := w.openLedger(ctx)
	if err != nil {
		return false
	}
	defer g.close()
	cur := g.a.removal(e.ID)
	if cur == nil || cur.UID != e.UID || cur.Username != e.Username {
		return false
	}
	if cur.Stage == RemovalRemoving && stage != RemovalRemoving {
		stage = RemovalRemoving
	}
	if cur.Stage == stage && cur.Reason == reason {
		return true
	}
	next := copyAllow(g.a)
	x := next.removal(e.ID)
	x.Stage, x.Reason = stage, reason
	return g.commitAllow(ctx, next) == nil
}

// cancelRemoval ends a removal that has not reached the data stage. The
// account is unexpired first, so a lost reply leaves at worst an expired
// account with its entry still in place, which the repeat finishes. Access
// stays withdrawn; restoring it is the separate admit.
func (w Writer) cancelRemoval(ctx context.Context, r Request) Reply {
	g, err := w.openLedger(ctx)
	if err != nil {
		return failure(StateUnavailable)
	}
	entry := g.a.removal(r.ID)
	if entry == nil {
		g.close()
		return w.removalPage(ctx, r.ID, nil)
	}
	e := *entry
	if e.Stage == RemovalRemoving {
		g.close()
		return failure(RemovalStarted)
	}
	g.close()
	if w.RemovalHost.Reopen(ctx, e.identity()) != nil {
		return failure(StateUnavailable)
	}
	g, err = w.openLedger(ctx)
	if err != nil {
		return failure(StateUnavailable)
	}
	cur := g.a.removal(r.ID)
	if cur == nil || cur.Stage == RemovalRemoving || cur.UID != e.UID {
		g.close()
		if cur != nil && cur.Stage == RemovalRemoving {
			return failure(RemovalStarted)
		}
		return w.removalPage(ctx, r.ID, nil)
	}
	next := copyAllow(g.a)
	next.Removals = slices.DeleteFunc(next.Removals, func(x removalEntry) bool { return x.ID == r.ID })
	err = g.commitAllow(ctx, next)
	g.close()
	if err != nil {
		return failure(StateUnavailable)
	}
	w.removalEvent(e, "cancelled", "committed", "")
	return w.removalPage(ctx, r.ID, nil)
}

func (w Writer) kickRemoval() {
	if w.removal == nil {
		return
	}
	select {
	case w.removal.kick <- struct{}{}:
	default:
	}
}

// RunRemovals is the broker's own due-time check: at start, hourly and when
// a schedule asks for it. It repeats each unfinished close-out and runs each
// due data stage, one removal at a time.
func (w Writer) RunRemovals(ctx context.Context) {
	if ctx == nil || w.removal == nil || w.RemovalHost == nil || !w.valid() || w.AdmitAny {
		return
	}
	select {
	case w.removal.slot <- struct{}{}:
		defer func() { <-w.removal.slot }()
	case <-ctx.Done():
		return
	}
	g, err := w.openLedger(ctx)
	if err != nil {
		return
	}
	entries := append([]removalEntry{}, g.a.Removals...)
	g.close()
	for _, e := range entries {
		if ctx.Err() != nil {
			return
		}
		w.runRemoval(ctx, e.ID)
	}
}

// removalLoop runs RunRemovals at start, every hour and on a kick, until ctx
// ends.
func (w Writer) removalLoop(ctx context.Context) {
	if w.removal == nil {
		return
	}
	tick := time.NewTicker(time.Hour)
	defer tick.Stop()
	for {
		run, cancel := context.WithTimeout(ctx, 30*time.Minute)
		w.RunRemovals(run)
		cancel()
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
		case <-w.removal.kick:
		}
	}
}

// runRemoval advances one subject's removal as far as it can.
func (w Writer) runRemoval(ctx context.Context, id string) {
	g, err := w.openLedger(ctx)
	if err != nil {
		return
	}
	entry := g.a.removal(id)
	if entry == nil {
		g.close()
		return
	}
	e := *entry
	b, bound := g.binding(id)
	if !bound {
		// The binding was dropped and the admission cleanup did not follow.
		next := copyAllow(g.a)
		forget(&next, id)
		err := g.commitAllow(ctx, next)
		g.close()
		if err == nil {
			w.removalEvent(e, "forgotten", "completed", "")
		}
		return
	}
	if b.UID != e.UID || b.Username != e.Username {
		g.close()
		w.recordHeld(ctx, e, RemovalStepFailed)
		return
	}
	if g.operator(id) || g.a.admits(id) {
		g.close()
		w.recordHeld(ctx, e, RemovalAdmitted)
		return
	}
	due := e.Due <= stamp(w.removalNow())
	g.close()
	if !due {
		// Before the due time only the close-out is repeated, when it has
		// not been confirmed or was held.
		if e.Stage == RemovalClosing || e.Reason != "" {
			w.closeOut(ctx, e)
		}
		return
	}
	if e.Stage != RemovalRemoving {
		if !w.recordStage(ctx, e, RemovalRemoving, "") {
			return
		}
		e.Stage, e.Reason = RemovalRemoving, ""
		w.removalEvent(e, "data", "started", "")
	}
	w.removeData(ctx, e)
}

func (w Writer) recordHeld(ctx context.Context, e removalEntry, reason string) {
	stage := e.Stage
	if w.recordStage(ctx, e, stage, reason) && e.Reason != reason {
		w.removalEvent(e, stage, "held", reason)
	}
}

// removeData is stage 2: each step observes and acts, and a failure leaves
// the entry with its reason for the next hourly repeat.
func (w Writer) removeData(ctx context.Context, e removalEntry) {
	i := e.identity()
	hold := func(step string, err error, fallback string) {
		reason := holdReason(err, fallback)
		record, cancel := context.WithTimeout(context.WithoutCancel(ctx), 10*time.Second)
		w.recordStage(record, e, RemovalRemoving, reason)
		cancel()
		w.removalEvent(e, step, "held", reason)
	}
	if _, err := w.stopRevoked(ctx, e.ID, w.stopReport); err != nil {
		hold("close_out", err, RemovalCloseFailed)
		return
	}
	steps := []struct {
		name     string
		run      func(context.Context, ExecutorIdentity) error
		budget   time.Duration
		fallback string
	}{
		{"close_out", w.RemovalHost.CloseOut, 2 * time.Minute, RemovalCloseFailed},
		{"outside_home", w.RemovalHost.RemoveOutside, 10 * time.Minute, RemovalStepFailed},
		{"home", w.RemovalHost.RemoveHome, 20 * time.Minute, RemovalStepFailed},
	}
	for _, s := range steps {
		bounded, cancel := context.WithTimeout(ctx, s.budget)
		err := s.run(bounded, i)
		cancel()
		if err != nil {
			hold(s.name, err, s.fallback)
			return
		}
	}
	// Under user quotas the kernel must charge the UID nothing on the home
	// filesystem before the UID may return to the pool.
	if !w.NoUserQuota {
		bytes, inodes, err := w.Quota.Charged(e.UID)
		if err != nil {
			hold("quota", nil, RemovalStepFailed)
			return
		}
		if bytes != 0 || inodes != 0 {
			hold("quota", nil, RemovalFilesRemain)
			return
		}
		if w.Quota.Clear(e.UID) != nil {
			hold("quota", nil, RemovalStepFailed)
			return
		}
	}
	bounded, cancel := context.WithTimeout(ctx, 2*time.Minute)
	err := w.RemovalHost.RemoveArtifacts(bounded, i)
	cancel()
	if err != nil {
		hold("artifacts", err, RemovalStepFailed)
		return
	}
	if err := w.dropBinding(ctx, e); err != nil {
		hold("binding", nil, RemovalStepFailed)
		return
	}
	w.removalEvent(e, "data", "completed", "")
}

// dropBinding removes the binding from the ledger (generation+1) and then
// every admission record of the subject. The UID returns to the pool here.
func (w Writer) dropBinding(ctx context.Context, e removalEntry) error {
	g, err := w.openLedger(ctx)
	if err != nil {
		return err
	}
	defer g.close()
	cur := g.a.removal(e.ID)
	b, bound := g.binding(e.ID)
	if cur == nil || cur.Stage != RemovalRemoving || cur.UID != e.UID || cur.Username != e.Username || bound && (b.UID != e.UID || b.Username != e.Username) {
		return ErrInvalid
	}
	if bound {
		if g.l.Generation == ^uint64(0) {
			return ErrInvalid
		}
		next := g.l
		next.Generation++
		next.Bindings = slices.DeleteFunc(append([]binding{}, g.l.Bindings...), func(x binding) bool { return x.ID == e.ID })
		if replace(g.fd, "bindings.json", marshal(next)) != nil {
			return ErrInvalid
		}
		g.h.Generation = next.Generation
		if replace(g.fd, "head.json", marshal(g.h)) != nil {
			return ErrInvalid
		}
		g.l = next
	}
	next := copyAllow(g.a)
	forget(&next, e.ID)
	return g.commitAllow(ctx, next)
}

// removalQuotaRow describes a binding under removal on the administrator's
// storage page: its usage as the kernel charges it, and its limit while the
// quota record still exists.
func (w Writer) removalQuotaRow(b binding, e removalEntry) QuotaRow {
	row := QuotaRow{BoundUser: BoundUser{ID: b.ID, Username: b.Username}, Unavailable: true, RemovalDue: e.Due}
	bytes, _, err := w.Quota.Charged(b.UID)
	if err != nil {
		return row
	}
	row.UsageBytes, row.Unavailable = bytes, false
	if q, err := w.Quota.Read(b.UID); err == nil && validLimit(q.Limit) {
		row.LimitBytes = q.Limit
	}
	return row
}

// removalRow is the access row's view of e.
func removalRow(e *removalEntry) *RemovalState {
	if e == nil {
		return nil
	}
	return &RemovalState{Stage: e.Stage, Due: e.Due, Actor: e.Actor, At: e.At, Reason: e.Reason}
}
