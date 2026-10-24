//go:build linux

package provision

import (
	"sort"
	"strconv"
	"time"

	"context"

	"golang.org/x/sys/unix"
)

// handleAccess serves the site_admin source: admit, withdraw and the two
// read-only views. It takes the same directory lock as every ledger and
// admission writer, so an ensure in progress finishes or fails before an
// entry changes, and refuses any interrupted staging write like Handle.
// Neither write creates or removes an account: withdrawal ends admission
// only, and ensure stays the one account creator. Restore may rebuild the
// absent runtime directory of a committed binding, as startup does.
func (w Writer) handleAccess(ctx context.Context, r Request) Reply {
	if ctx == nil || !w.valid() {
		return failure(StateUnavailable)
	}
	if _, e := EncodeRequest(r); e != nil {
		return failure(Invalid)
	}
	fd, e := lockedDir(ctx, w.Dir, w.owner)
	if e != nil {
		return failure(StateUnavailable)
	}
	defer unix.Close(fd)
	defer unix.Flock(fd, unix.LOCK_UN)
	for _, n := range []string{"pending.json", "pending.json.next", "bindings.json.next", "head.json.next", "allowlist.json.next"} {
		if !absent(fd, n) {
			return failure(StateUnavailable)
		}
	}
	a, l, ab, lb, e := stateAt(ctx, fd, w.owner)
	if e != nil {
		return failure(StateUnavailable)
	}
	hb, e := readAt(fd, "head.json", w.owner)
	var h head
	if e != nil || decode(hb, &h, "version", "epoch", "generation") != nil || h.Version != 1 || h.Epoch == 0 || h.Generation == 0 || a.Epoch < h.Epoch || l.Generation != h.Generation {
		return failure(StateUnavailable)
	}
	if a.Epoch > h.Epoch {
		h.Epoch = a.Epoch
		if replace(fd, "head.json", marshal(h)) != nil {
			return failure(StateUnavailable)
		}
	}
	if ctx.Err() != nil {
		return failure(StateUnavailable)
	}
	mode := "allowlist"
	if w.AdmitAny {
		mode = "any"
	}
	bound := map[string]binding{}
	for _, b := range l.Bindings {
		bound[b.ID] = b
	}
	page := func(rows []AccessRow, epoch uint64, next string) Reply {
		reply := Reply{Version: 1, Access: &AccessPage{Mode: mode, RuntimeAdmission: a.RuntimeAdmission, Rows: rows}, Generation: l.Generation, Epoch: epoch, Next: next}
		if _, err := EncodeReply(reply); err != nil {
			return failure(StateUnavailable)
		}
		return reply
	}
	switch r.Operation {
	case "access_list":
		rows := accessRows(a, bound)
		offset := 0
		if r.Candidate != "" {
			offset, _ = strconv.Atoi(r.Candidate)
		}
		if offset > len(rows) {
			return failure(Invalid)
		}
		end := offset + AccessPageSize
		next := ""
		if end < len(rows) {
			next = strconv.Itoa(end)
		} else {
			end = len(rows)
		}
		return page(rows[offset:end], a.Epoch, next)
	case "access_read":
		for _, row := range accessRows(a, bound) {
			if row.ID == r.ID {
				return page([]AccessRow{row}, a.Epoch, "")
			}
		}
		return page([]AccessRow{}, a.Epoch, "")
	}
	// Writes. With admission "any" the runtime list has no meaning.
	if w.AdmitAny {
		return failure(AdmissionOpen)
	}
	operator := false
	for _, x := range a.IDs {
		operator = operator || x.ID == r.ID
	}
	index := -1
	for i, x := range a.Runtime {
		if x.ID == r.ID {
			index = i
		}
	}
	now := time.Now
	if w.Now != nil {
		now = w.Now
	}
	stamp := now().UTC().Truncate(time.Second).Format(time.RFC3339)
	next := a
	next.Runtime = append([]runtimeEntry{}, a.Runtime...)
	var result AccessRow
	var restore *ExecutorIdentity
	switch r.Operation {
	case "admit":
		// The operator source already admits the id; the switch governs only
		// what the gateway may add, so a restore of an operator id succeeds.
		if operator {
			return page([]AccessRow{rowFor(a, bound, r.ID)}, a.Epoch, "")
		}
		// An entry that already admits adds nothing, so the switch, which
		// bounds what the gateway may add, does not refuse it.
		if index >= 0 && a.Runtime[index].State == "admitted" {
			// A repeat after an unavailable reply finishes the runtime rebuild.
			if b, ok := bound[r.ID]; ok {
				if native, ok := w.Executor.(*LinuxHostExecutor); ok && native.startupIdentity(ctx, ExecutorIdentity{provider: "github", id: b.ID, username: b.Username, uid: b.UID}, true) != nil {
					return failure(Drift)
				}
			}
			return page([]AccessRow{rowFor(a, bound, r.ID)}, a.Epoch, "")
		}
		if !a.RuntimeAdmission {
			return failure(RuntimeDisabled)
		}
		// A restore names a still-committed binding. Its persistent account
		// must verify as the same one; drift is left for the operator, never
		// adopted. Runtime state a withdrawn binding lost at boot is rebuilt
		// after the commit, as the broker does at startup.
		if b, ok := bound[r.ID]; ok {
			i := ExecutorIdentity{provider: "github", id: b.ID, username: b.Username, uid: b.UID}
			verify := w.Executor.Verify
			if native, ok := w.Executor.(*LinuxHostExecutor); ok {
				verify = native.persistentIdentity
			}
			if b.UID < w.UIDMin || b.UID > w.UIDMax || verify(ctx, i) != nil {
				return failure(Drift)
			}
			if ctx.Err() != nil || !sameState(ctx, fd, w.owner, ab, lb, a.Epoch) {
				return failure(StateUnavailable)
			}
			restore = &i
		}
		entry := runtimeEntry{ID: r.ID, State: "admitted", LoginHint: r.LoginHint, Actor: r.Actor, At: stamp}
		if index >= 0 {
			next.Runtime[index] = entry
		} else {
			if len(next.Runtime) >= MaxRuntimeAdmission {
				return failure(RuntimeFull)
			}
			next.Runtime = append(next.Runtime, entry)
		}
	case "withdraw":
		// Anyone root's site.json admits, administrators included, is
		// outside the gateway's reach even if a runtime entry also exists.
		if operator {
			return failure(OperatorOwned)
		}
		if index < 0 {
			return page([]AccessRow{{ID: r.ID, Source: SourceSiteAdmin, State: StateRemoved}}, a.Epoch, "")
		}
		if a.Runtime[index].State == "withdrawn" {
			return page([]AccessRow{rowFor(a, bound, r.ID)}, a.Epoch, "")
		}
		entry := a.Runtime[index]
		entry.State, entry.Actor, entry.At = "withdrawn", r.Actor, stamp
		if _, ok := bound[r.ID]; ok {
			next.Runtime[index] = entry
		} else {
			next.Runtime = append(next.Runtime[:index], next.Runtime[index+1:]...)
			result = AccessRow{ID: r.ID, Source: SourceSiteAdmin, State: StateRemoved, LoginHint: entry.LoginHint, Actor: entry.Actor, At: entry.At}
		}
	}
	if a.Epoch == ^uint64(0) {
		return failure(StateUnavailable)
	}
	sort.Slice(next.Runtime, func(i, j int) bool { return idLess(next.Runtime[i].ID, next.Runtime[j].ID) })
	next.Epoch = a.Epoch + 1
	if len(next.Runtime) == 0 {
		next.Runtime = nil
	}
	b := marshal(next)
	if len(b) > maxAllowlist || ctx.Err() != nil {
		return failure(StateUnavailable)
	}
	// The admission file is the commit point. A later head failure leaves
	// epoch above the watermark, which the next exchange records; it is
	// reported as unavailable, and the gateway treats that as uncertain.
	if replace(fd, "allowlist.json", b) != nil {
		return failure(StateUnavailable)
	}
	h.Epoch = next.Epoch
	if replace(fd, "head.json", marshal(h)) != nil {
		return failure(StateUnavailable)
	}
	// The admission is committed; reconstruct an absent runtime directory and
	// its named ACLs from it under the same lock, refusing partial drift. A
	// failure here is reported as unavailable: admitted, but not yet usable.
	if native, ok := w.Executor.(*LinuxHostExecutor); ok && restore != nil {
		if native.startupIdentity(ctx, *restore, true) != nil {
			return failure(StateUnavailable)
		}
	}
	if result.ID == "" {
		result = rowFor(next, bound, r.ID)
	}
	return page([]AccessRow{result}, next.Epoch, "")
}

// rowFor describes one id that at least one source names. The operator
// source wins, because only root can change it.
func rowFor(a allowFile, bound map[string]binding, id string) AccessRow {
	b, joined := bound[id]
	state := StateAllowed
	if joined {
		state = StateJoined
	}
	for _, x := range a.IDs {
		if x.ID == id {
			return AccessRow{ID: id, Source: SourceOperator, State: state, Username: b.Username}
		}
	}
	for _, x := range a.Runtime {
		if x.ID == id {
			if x.State == "withdrawn" {
				state = StateWithdrawn
			}
			return AccessRow{ID: id, Source: SourceSiteAdmin, State: state, Username: b.Username, LoginHint: x.LoginHint, Actor: x.Actor, At: x.At}
		}
	}
	return AccessRow{}
}

func accessRows(a allowFile, bound map[string]binding) []AccessRow {
	ids := []string{}
	seen := map[string]bool{}
	for _, x := range a.IDs {
		if !seen[x.ID] {
			seen[x.ID] = true
			ids = append(ids, x.ID)
		}
	}
	for _, x := range a.Runtime {
		if !seen[x.ID] {
			seen[x.ID] = true
			ids = append(ids, x.ID)
		}
	}
	sort.Slice(ids, func(i, j int) bool { return idLess(ids[i], ids[j]) })
	rows := make([]AccessRow, 0, len(ids))
	for _, id := range ids {
		rows = append(rows, rowFor(a, bound, id))
	}
	return rows
}

// idLess orders canonical decimal ids numerically.
func idLess(a, b string) bool {
	if len(a) != len(b) {
		return len(a) < len(b)
	}
	return a < b
}
