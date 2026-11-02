//go:build linux

package provision

import (
	"slices"
	"sort"
	"strconv"
	"time"

	"context"

	"golang.org/x/sys/unix"
)

// handleAccess serves the broker's own admission sources: admit and withdraw
// of site_admin entries, the team source and its sign-in observations, and
// the read-only views. It takes the same directory lock as every ledger and
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
		if row := rowFor(a, bound, r.ID); row.ID != "" {
			return page([]AccessRow{row}, a.Epoch, "")
		}
		return page([]AccessRow{}, a.Epoch, "")
	case OpTeamList:
		return teamPage(a, mode, l.Generation, a.Epoch)
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
	next.Teams = append([]teamSource{}, a.Teams...)
	next.Members = append([]teamMember{}, a.Members...)
	var result AccessRow
	var restore *ExecutorIdentity
	teams := false
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
		// after the commit, as the broker does at startup. A team member
		// admitted one by one keeps the member record: two reasons.
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
		m := memberIndex(a, r.ID)
		if index < 0 && m < 0 {
			return page([]AccessRow{{ID: r.ID, Source: SourceSiteAdmin, State: StateRemoved}}, a.Epoch, "")
		}
		if index >= 0 && a.Runtime[index].State == "withdrawn" && m < 0 {
			return page([]AccessRow{rowFor(a, bound, r.ID)}, a.Epoch, "")
		}
		// Withdrawal also ends what a team membership gives: the member
		// record goes, and a bound person keeps a withdrawn entry that
		// refuses every later sign-in observation until a restore.
		var entry runtimeEntry
		if index >= 0 {
			entry = a.Runtime[index]
		} else {
			entry = runtimeEntry{ID: r.ID, LoginHint: a.Members[m].LoginHint}
		}
		if m >= 0 {
			next.Members = append(next.Members[:m], next.Members[m+1:]...)
		}
		entry.State, entry.Actor, entry.At = "withdrawn", r.Actor, stamp
		if _, ok := bound[r.ID]; ok {
			if index >= 0 {
				next.Runtime[index] = entry
			} else {
				if len(next.Runtime) >= MaxRuntimeAdmission {
					return failure(RuntimeFull)
				}
				next.Runtime = append(next.Runtime, entry)
			}
		} else {
			if index >= 0 {
				next.Runtime = append(next.Runtime[:index], next.Runtime[index+1:]...)
			}
			result = AccessRow{ID: r.ID, Source: SourceSiteAdmin, State: StateRemoved, LoginHint: entry.LoginHint, Actor: entry.Actor, At: entry.At}
		}
	case OpTeamAdd:
		teams = true
		for _, t := range a.Teams {
			if t.OrgID == r.ID && t.Slug == r.Slug {
				return teamPage(a, mode, l.Generation, a.Epoch)
			}
		}
		// A team admits people, so adding one is bounded like any runtime
		// admission.
		if !a.RuntimeAdmission {
			return failure(RuntimeDisabled)
		}
		if len(a.Teams) >= MaxTeams {
			return failure(RuntimeFull)
		}
		next.Teams = append(next.Teams, teamSource{OrgID: r.ID, Org: r.LoginHint, Slug: r.Slug, Actor: r.Actor, At: stamp})
	case OpTeamRemove:
		teams = true
		at := -1
		for i, t := range a.Teams {
			if t.OrgID == r.ID && t.Slug == r.Slug {
				at = i
			}
		}
		if at < 0 {
			return teamPage(a, mode, l.Generation, a.Epoch)
		}
		gone := a.Teams[at].TeamID
		next.Teams = append(next.Teams[:at], next.Teams[at+1:]...)
		// Removing a source is not leaving it: records that named only this
		// team go without a leaver notice.
		kept := []teamMember{}
		for _, m := range next.Members {
			m.Teams = slices.DeleteFunc(append([]string{}, m.Teams...), func(t string) bool { return t == gone })
			if len(m.Teams) > 0 {
				kept = append(kept, m)
			}
		}
		next.Members = kept
	case OpTeamSignIn:
		changed, f := signIn(&next, r, stamp, index >= 0 && a.Runtime[index].State == "withdrawn")
		if f != "" {
			return failure(f)
		}
		// A bound person whom only the team now admits needs the runtime
		// state a non-admitted binding loses at boot, as a restore does:
		// verified before a readmitting commit and rebuilt after it, and
		// on an unchanged answer rebuilt again in case an earlier
		// reconstruction was interrupted.
		if b, ok := bound[r.ID]; ok && next.teamAdmits(r.ID) && !operator && !(index >= 0 && a.Runtime[index].State == "admitted") {
			i := ExecutorIdentity{provider: "github", id: b.ID, username: b.Username, uid: b.UID}
			native, isNative := w.Executor.(*LinuxHostExecutor)
			switch {
			case changed && !a.admits(r.ID):
				verify := w.Executor.Verify
				if isNative {
					verify = native.persistentIdentity
				}
				if b.UID < w.UIDMin || b.UID > w.UIDMax || verify(ctx, i) != nil {
					return failure(Drift)
				}
				if ctx.Err() != nil || !sameState(ctx, fd, w.owner, ab, lb, a.Epoch) {
					return failure(StateUnavailable)
				}
				restore = &i
			case !changed && isNative:
				if native.startupIdentity(ctx, i, true) != nil {
					return failure(Drift)
				}
			}
		}
		if !changed {
			if row := rowFor(a, bound, r.ID); row.ID != "" {
				return page([]AccessRow{row}, a.Epoch, "")
			}
			return page([]AccessRow{}, a.Epoch, "")
		}
	case OpForget:
		m := memberIndex(a, r.ID)
		if m < 0 {
			return page([]AccessRow{{ID: r.ID, Source: SourceTeam, State: StateRemoved}}, a.Epoch, "")
		}
		// A record that admits is not a notice to dismiss.
		if a.teamAdmits(r.ID) {
			return page([]AccessRow{rowFor(a, bound, r.ID)}, a.Epoch, "")
		}
		next.Members = append(next.Members[:m], next.Members[m+1:]...)
		if rowFor(next, bound, r.ID).ID == "" {
			result = AccessRow{ID: r.ID, Source: SourceTeam, State: StateRemoved}
		}
	}
	if a.Epoch == ^uint64(0) {
		return failure(StateUnavailable)
	}
	sort.Slice(next.Runtime, func(i, j int) bool { return idLess(next.Runtime[i].ID, next.Runtime[j].ID) })
	sort.Slice(next.Members, func(i, j int) bool { return idLess(next.Members[i].ID, next.Members[j].ID) })
	next.Epoch = a.Epoch + 1
	if len(next.Runtime) == 0 {
		next.Runtime = nil
	}
	if len(next.Teams) == 0 {
		next.Teams = nil
	}
	if len(next.Members) == 0 {
		next.Members = nil
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
	if teams {
		return teamPage(next, mode, l.Generation, next.Epoch)
	}
	if result.ID == "" {
		result = rowFor(next, bound, r.ID)
	}
	if result.ID == "" {
		// A sign-in that only pinned a team or recorded GitHub's silence
		// says nothing about a person no source names.
		return page([]AccessRow{}, next.Epoch, "")
	}
	return page([]AccessRow{result}, next.Epoch, "")
}

// signIn applies one sign-in's team observations to next and reports
// whether anything changed. Only an active answer for a listed, pinned team
// admits; a team the observations do not name (added since the gateway read
// the list) or GitHub could not answer for is unknown. Unknown never records
// leaving: a member becomes unconfirmed, which does not admit either, so a
// sign-in GitHub could not confirm is refused unless another source admits.
func signIn(next *allowFile, r Request, stamp string, withdrawn bool) (bool, Failure) {
	changed := false
	observed := map[string]TeamObservation{}
	for _, o := range r.Teams {
		observed[o.OrgID+"/"+o.Slug] = o
	}
	var active, none []string
	unknown := false
	for i := range next.Teams {
		t := &next.Teams[i]
		o, ok := observed[t.OrgID+"/"+t.Slug]
		state := o.State
		switch {
		case !ok:
			state = "unknown"
		case state == "unknown":
		case t.TeamID == "" && o.TeamID != "":
			// Pin the slug to the team it resolved to, unless another listed
			// team already holds that id.
			if next.team(o.TeamID) != nil {
				state = "unknown"
			} else {
				t.TeamID, changed = o.TeamID, true
			}
		case t.TeamID == "" && state == "active", o.TeamID != "" && o.TeamID != t.TeamID:
			// The slug now names another team than the one pinned.
			state = "unknown"
		}
		if !ok {
			unknown = true
			continue
		}
		if state == "unknown" {
			unknown = true
			if t.UnavailableAt == "" {
				t.UnavailableAt, changed = stamp, true
			}
			continue
		}
		if t.UnavailableAt != "" {
			t.UnavailableAt, changed = "", true
		}
		if t.TeamID == "" {
			continue
		}
		if state == "active" {
			active = append(active, t.TeamID)
		} else {
			none = append(none, t.TeamID)
		}
	}
	// A withdrawn person stays withdrawn until a restore; their sign-in
	// records nothing about them.
	if withdrawn {
		return changed, ""
	}
	at := memberIndex(*next, r.ID)
	var prev *teamMember
	if at >= 0 {
		prev = &next.Members[at]
	}
	var record *teamMember
	switch {
	case len(active) > 0:
		slices.SortFunc(active, func(a, b string) int {
			if idLess(a, b) {
				return -1
			}
			return 1
		})
		record = &teamMember{ID: r.ID, LoginHint: r.LoginHint, Teams: active, State: "member", At: stamp}
		if prev != nil && prev.State == "member" && slices.Equal(prev.Teams, active) {
			record.At = prev.At
		}
		// The switch bounds what the gateway may add: a stranger or a
		// leaver rejoining is a new admission through a team. A member
		// GitHub could not confirm last time was already admitted.
		if (prev == nil || prev.State == "left") && !next.RuntimeAdmission {
			return changed, ""
		}
	case prev == nil:
	case unknown:
		kept := slices.DeleteFunc(append([]string{}, prev.Teams...), func(t string) bool { return slices.Contains(none, t) })
		state := "unconfirmed"
		if prev.State == "left" {
			state = "left"
		}
		record = &teamMember{ID: r.ID, LoginHint: r.LoginHint, Teams: kept, State: state, At: prev.At}
		if state != prev.State {
			record.At = stamp
		}
	case prev.State != "left":
		// Every listed team answered: the person is in none of them.
		record = &teamMember{ID: r.ID, LoginHint: r.LoginHint, Teams: prev.Teams, State: "left", At: stamp}
	}
	if record == nil {
		return changed, ""
	}
	if prev != nil {
		if prev.State == record.State && prev.LoginHint == record.LoginHint && prev.At == record.At && slices.Equal(prev.Teams, record.Teams) {
			return changed, ""
		}
		next.Members[at] = *record
		return true, ""
	}
	if len(next.Members) >= MaxTeamMembers {
		return false, RuntimeFull
	}
	next.Members = append(next.Members, *record)
	return true, ""
}

func memberIndex(a allowFile, id string) int {
	for i := range a.Members {
		if a.Members[i].ID == id {
			return i
		}
	}
	return -1
}

func teamPage(a allowFile, mode string, generation, epoch uint64) Reply {
	rows := make([]TeamRow, 0, len(a.Teams))
	for _, t := range a.Teams {
		rows = append(rows, TeamRow{OrgID: t.OrgID, Org: t.Org, Slug: t.Slug, TeamID: t.TeamID, Actor: t.Actor, At: t.At, UnavailableAt: t.UnavailableAt})
	}
	reply := Reply{Version: 1, Access: &AccessPage{Mode: mode, RuntimeAdmission: a.RuntimeAdmission, Rows: []AccessRow{}, Teams: rows}, Generation: generation, Epoch: epoch}
	if _, err := EncodeReply(reply); err != nil {
		return failure(StateUnavailable)
	}
	return reply
}

// rowFor describes one id that at least one source names. The operator
// source wins, because only root can change it; a team row is one only a
// member record names.
func rowFor(a allowFile, bound map[string]binding, id string) AccessRow {
	b, joined := bound[id]
	state := StateAllowed
	if joined {
		state = StateJoined
	}
	var row AccessRow
	for _, x := range a.IDs {
		if x.ID == id {
			row = AccessRow{ID: id, Source: SourceOperator, State: state, Username: b.Username}
		}
	}
	if row.ID == "" {
		for _, x := range a.Runtime {
			if x.ID == id {
				s := state
				if x.State == "withdrawn" {
					s = StateWithdrawn
				}
				row = AccessRow{ID: id, Source: SourceSiteAdmin, State: s, Username: b.Username, LoginHint: x.LoginHint, Actor: x.Actor, At: x.At}
			}
		}
	}
	m := a.member(id)
	if m == nil {
		return row
	}
	teamState := m.State
	if teamState == "member" && !a.teamAdmits(id) {
		teamState = "unconfirmed"
	}
	if row.ID == "" {
		s := state
		if teamState != "member" {
			s = teamState
		}
		row = AccessRow{ID: id, Source: SourceTeam, State: s, Username: b.Username, LoginHint: m.LoginHint, At: m.At}
	}
	row.TeamState = teamState
	if len(m.Teams) > 0 {
		row.Teams = append([]string{}, m.Teams...)
	}
	return row
}

func accessRows(a allowFile, bound map[string]binding) []AccessRow {
	ids := []string{}
	seen := map[string]bool{}
	add := func(id string) {
		if !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}
	for _, x := range a.IDs {
		add(x.ID)
	}
	for _, x := range a.Runtime {
		add(x.ID)
	}
	for _, x := range a.Members {
		add(x.ID)
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
