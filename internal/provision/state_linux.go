//go:build linux

package provision

import (
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/sys/unix"
)

// Store names a root-only state directory. The service must serialize reads
// with its writer and check authorization again before use; this is not a
// transaction or a gateway-side session cache.
type Store struct{ Dir string }
type allowed struct {
	ID        string `json:"id"`
	Alternate string `json:"alternate,omitempty"`
}
type binding struct {
	ID       string `json:"id"`
	UID      uint32 `json:"uid"`
	Username string `json:"username"`
}
type allowFile struct {
	Version int       `json:"version"`
	Epoch   uint64    `json:"epoch"`
	IDs     []allowed `json:"ids"`
	// RuntimeAdmission is root's switch from site.json; Runtime is the
	// site_admin source. Both share this file's epoch and lock with the
	// operator source, so every admission change advances one watermark.
	RuntimeAdmission bool           `json:"runtime_admission,omitempty"`
	Runtime          []runtimeEntry `json:"runtime,omitempty"`
	// Teams is the team source an administrator chose, and Members what the
	// gateway observed at each member's sign-in. Both belong to the broker
	// like Runtime: host apply carries them over and never converges them.
	Teams   []teamSource `json:"teams,omitempty"`
	Members []teamMember `json:"members,omitempty"`
	// Revoked are bound ids root's publication dropped from the operator
	// source while no other source admitted them. It is the only record that
	// root revoked someone: a person whom only a removed or forgotten team
	// admitted is equally unadmitted, but team changes leave their daemon
	// running. An id goes when any source admits it again.
	Revoked []string `json:"revoked,omitempty"`
}

// teamSource is one GitHub team whose active members may sign in. The org id
// came from GitHub's public organisation API when it was added; TeamID is
// pinned from the first member check that resolved the slug inside that
// organisation, so a later team that takes over the slug never inherits it.
// UnavailableAt is set while GitHub could not answer the membership question
// at the latest sign-in that asked it.
type teamSource struct {
	OrgID         string `json:"org_id"`
	Org           string `json:"org"`
	Slug          string `json:"slug"`
	TeamID        string `json:"team_id,omitempty"`
	Actor         string `json:"actor"`
	At            string `json:"at"`
	UnavailableAt string `json:"unavailable_at,omitempty"`
}

// teamMember is the latest sign-in's answer for one person who was, or is,
// an active member of a listed team. member admits; left (every listed team
// answered not a member) and unconfirmed (GitHub did not answer for a team
// the person was in) do not. Teams names the pinned team ids the person was
// last confirmed in. A record never coexists with a withdrawn runtime entry:
// withdrawal deletes it, and sign-in records nothing for a withdrawn id.
type teamMember struct {
	ID        string   `json:"id"`
	LoginHint string   `json:"login_hint"`
	Teams     []string `json:"teams"`
	State     string   `json:"state"`
	At        string   `json:"at"`
}

// runtimeEntry is one site_admin admission. A withdrawn entry is kept only
// while its id has a committed binding, so that restore returns the person
// to the same account; a never-bound withdrawal is deleted.
type runtimeEntry struct {
	ID        string `json:"id"`
	State     string `json:"state"`
	LoginHint string `json:"login_hint"`
	Actor     string `json:"actor"`
	At        string `json:"at"`
}

// admits is the effective admission: the union of every source.
func (a allowFile) admits(id string) bool {
	for _, x := range a.IDs {
		if x.ID == id {
			return true
		}
	}
	return a.runtimeAdmits(id)
}

// runtimeAdmits is what the broker's own sources admit: an admitted
// site_admin entry, or a member record of a still-listed team.
func (a allowFile) runtimeAdmits(id string) bool {
	for _, x := range a.Runtime {
		if x.ID == id {
			// A withdrawal overrides team membership too.
			return x.State == "admitted"
		}
	}
	return a.teamAdmits(id)
}

func (a allowFile) teamAdmits(id string) bool {
	m := a.member(id)
	if m == nil || m.State != "member" {
		return false
	}
	for _, t := range m.Teams {
		if a.team(t) != nil {
			return true
		}
	}
	return false
}

func (a allowFile) member(id string) *teamMember {
	for i := range a.Members {
		if a.Members[i].ID == id {
			return &a.Members[i]
		}
	}
	return nil
}

// team finds a listed team by its pinned id.
func (a allowFile) team(teamID string) *teamSource {
	for i := range a.Teams {
		if a.Teams[i].TeamID != "" && a.Teams[i].TeamID == teamID {
			return &a.Teams[i]
		}
	}
	return nil
}

// maxAllowlist bounds the admission file, which holds every source; every
// other broker file stays within one protocol message.
const maxAllowlist = 1 << 17

func fileLimit(name string) int64 {
	if strings.HasPrefix(name, "allowlist.json") {
		return maxAllowlist
	}
	return MaxMessage
}

// allowFields are the admission file's keys, checked before any typed decode.
var allowFields = []string{"version", "epoch", "ids", "runtime_admission", "runtime", "teams", "members", "revoked"}

// validRevoked checks root's revocation record: canonical ids, no
// duplicate, at most one per identity in the largest pool.
func validRevoked(raw json.RawMessage) error {
	if len(raw) == 0 {
		return nil
	}
	entries, err := checkArray(raw, "revoked")
	if err != nil || len(entries) > 4096 {
		return ErrInvalid
	}
	seen := map[string]bool{}
	for _, entry := range entries {
		var id string
		if json.Unmarshal(entry, &id) != nil || !numericID(id) || seen[id] {
			return ErrInvalid
		}
		seen[id] = true
	}
	return nil
}

// validRuntime checks the site_admin source as strictly as the operator ids.
func validRuntime(raw json.RawMessage) error {
	if len(raw) == 0 {
		return nil
	}
	entries, err := checkArray(raw, "runtime")
	if err != nil || len(entries) > MaxRuntimeAdmission {
		return ErrInvalid
	}
	seen := map[string]bool{}
	for _, entry := range entries {
		var x runtimeEntry
		if decode(entry, &x, "id", "state", "login_hint", "actor", "at") != nil || !numericID(x.ID) || seen[x.ID] || x.State != "admitted" && x.State != "withdrawn" || !githubLogin(x.LoginHint) || !validActor(x.Actor) || !validStamp(x.At) {
			return ErrInvalid
		}
		seen[x.ID] = true
	}
	return nil
}

// validTeams checks the team source and member records as strictly as the
// runtime entries: bounded, canonical, no duplicate team or person, every
// recorded team id unique.
func validTeams(teamsRaw, membersRaw json.RawMessage) error {
	if len(teamsRaw) != 0 {
		entries, err := checkArray(teamsRaw, "teams")
		if err != nil || len(entries) > MaxTeams {
			return ErrInvalid
		}
		seen := map[string]bool{}
		for _, entry := range entries {
			var x teamSource
			if decode(entry, &x, "org_id", "org", "slug", "team_id", "actor", "at", "unavailable_at") != nil || !numericID(x.OrgID) || !githubLogin(x.Org) || !teamSlug(x.Slug) || x.TeamID != "" && !numericID(x.TeamID) || !validActor(x.Actor) || !validStamp(x.At) || x.UnavailableAt != "" && !validStamp(x.UnavailableAt) {
				return ErrInvalid
			}
			key := x.OrgID + "/" + x.Slug
			if seen[key] || x.TeamID != "" && seen["#"+x.TeamID] {
				return ErrInvalid
			}
			seen[key] = true
			if x.TeamID != "" {
				seen["#"+x.TeamID] = true
			}
		}
	}
	if len(membersRaw) != 0 {
		entries, err := checkArray(membersRaw, "members")
		if err != nil || len(entries) > MaxTeamMembers {
			return ErrInvalid
		}
		seen := map[string]bool{}
		for _, entry := range entries {
			var x teamMember
			if decode(entry, &x, "id", "login_hint", "teams", "state", "at") != nil || !numericID(x.ID) || seen[x.ID] || !githubLogin(x.LoginHint) || !validStamp(x.At) || x.State != "member" && x.State != "left" && x.State != "unconfirmed" || x.Teams == nil || len(x.Teams) > MaxTeams || x.State == "member" && len(x.Teams) == 0 {
				return ErrInvalid
			}
			teams := map[string]bool{}
			for _, t := range x.Teams {
				if !numericID(t) || teams[t] {
					return ErrInvalid
				}
				teams[t] = true
			}
			seen[x.ID] = true
		}
	}
	return nil
}

type ledgerFile struct {
	Version    int       `json:"version"`
	Generation uint64    `json:"generation"`
	Bindings   []binding `json:"bindings"`
}

// privateDir opens the private state directory dir, each component without
// following links and none writable by others, and returns its descriptor.
func privateDir(dir string, owner uint32) (int, error) {
	if !filepath.IsAbs(dir) || filepath.Clean(dir) != dir {
		return -1, ErrInvalid
	}
	fd, err := unix.Open("/", unix.O_DIRECTORY|unix.O_RDONLY|unix.O_CLOEXEC, 0)
	if err != nil {
		return -1, err
	}
	ok := false
	defer func() {
		if !ok {
			unix.Close(fd)
		}
	}()
	parts := strings.Split(strings.TrimPrefix(dir, "/"), "/")
	if dir == "/" {
		parts = nil
	}
	for _, p := range parts {
		if p == "" || p == "." || p == ".." {
			return -1, ErrInvalid
		}
		next, e := unix.Openat(fd, p, unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_RDONLY|unix.O_CLOEXEC, 0)
		if e != nil {
			return -1, ErrInvalid
		}
		unix.Close(fd)
		fd = next
		var st unix.Stat_t
		if unix.Fstat(fd, &st) != nil || (st.Uid != owner && st.Uid != 0) || st.Mode&unix.S_IFMT != unix.S_IFDIR || st.Mode&0022 != 0 {
			return -1, ErrInvalid
		}
	}
	// The state directory is private even when its ancestors are traversable.
	var st unix.Stat_t
	if unix.Fstat(fd, &st) != nil || st.Uid != owner || st.Mode&unix.S_IFMT != unix.S_IFDIR || st.Mode&0077 != 0 {
		return -1, ErrInvalid
	}
	ok = true
	return fd, nil
}

// secureFile opens each path component without following links, then reads a
// bounded regular root-owned single-link file from its fd, not its path.
func secureFile(dir, name string, owner uint32) ([]byte, error) {
	if name == "" || strings.ContainsAny(name, "/\\") {
		return nil, ErrInvalid
	}
	fd, err := privateDir(dir, owner)
	if err != nil {
		return nil, err
	}
	defer unix.Close(fd)
	var st unix.Stat_t
	// A pending mutation is never a committed binding. The future writer must
	// hold its lock across this check and publication of a new ledger.
	if e := unix.Fstatat(fd, "pending.json", &st, unix.AT_SYMLINK_NOFOLLOW); e != unix.ENOENT {
		return nil, ErrInvalid
	}
	f, err := unix.Openat(fd, name, unix.O_RDONLY|unix.O_NOFOLLOW|unix.O_CLOEXEC|unix.O_NONBLOCK, 0)
	if err != nil {
		return nil, ErrInvalid
	}
	if unix.Fstat(f, &st) != nil || st.Uid != owner || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Mode&0077 != 0 || st.Nlink != 1 || st.Size < 1 || st.Size > fileLimit(name) {
		unix.Close(f)
		return nil, ErrInvalid
	}
	file := os.NewFile(uintptr(f), name)
	defer file.Close()
	b := make([]byte, st.Size+1)
	n, e := io.ReadFull(file, b[:st.Size])
	if e != nil {
		return nil, ErrInvalid
	}
	if int64(n) != st.Size {
		return nil, ErrInvalid
	}
	return b[:n], nil
}

func readState(dir string, owner uint32) (allowFile, ledgerFile, error) {
	var a allowFile
	var l ledgerFile
	ab, err := secureFile(dir, "allowlist.json", owner)
	if err != nil {
		return a, l, err
	}
	lb, err := secureFile(dir, "bindings.json", owner)
	if err != nil {
		return a, l, err
	}
	ar, err := objectSized(ab, maxAllowlist, allowFields...)
	if err != nil {
		return a, l, err
	}
	if err = validRuntime(ar["runtime"]); err != nil {
		return a, l, err
	}
	if err = validTeams(ar["teams"], ar["members"]); err != nil {
		return a, l, err
	}
	if err = validRevoked(ar["revoked"]); err != nil {
		return a, l, err
	}
	lr, err := object(lb, "version", "generation", "bindings")
	if err != nil {
		return a, l, err
	}
	if json.Unmarshal(ab, &a) != nil || json.Unmarshal(lb, &l) != nil || a.Version != 1 || l.Version != 1 || a.Epoch == 0 || l.Generation == 0 {
		return a, l, ErrInvalid
	}
	aa, err := checkArray(ar["ids"], "ids")
	if err != nil {
		return a, l, err
	}
	bb, err := checkArray(lr["bindings"], "bindings")
	if err != nil {
		return a, l, err
	}
	ids := map[string]bool{}
	alternates := map[string]bool{}
	for _, raw := range aa {
		var x allowed
		if decode(raw, &x, "id", "alternate") != nil || !numericID(x.ID) || ids[x.ID] || x.Alternate != "" && (!username(x.Alternate) || alternates[x.Alternate]) {
			return a, l, ErrInvalid
		}
		ids[x.ID] = true
		if x.Alternate != "" {
			alternates[x.Alternate] = true
		}
	}
	ids = map[string]bool{}
	uids := map[uint32]bool{}
	names := map[string]bool{}
	for _, raw := range bb {
		var x binding
		if decode(raw, &x, "id", "uid", "username") != nil || !numericID(x.ID) || x.UID == 0 || !username(x.Username) || ids[x.ID] || uids[x.UID] || names[x.Username] {
			return a, l, ErrInvalid
		}
		ids[x.ID] = true
		uids[x.UID] = true
		names[x.Username] = true
	}
	return a, l, nil
}

// Evaluate is a legacy policy-only probe, NOT a broker transport handler: it
// does not lock, enforce the high-water mark, or verify host drift. Only
// Writer.Handle may return a routable broker reply. A new ensure here returns
// name_collision when its candidate is unsafe or occupied; otherwise denied.
func (s Store) Evaluate(r Request) Reply { return evaluate(s.Dir, 0, r) }

func evaluate(dir string, owner uint32, r Request) Reply {
	fail := func(f Failure) Reply { return Reply{Version: 1, Failure: f} }
	if _, err := EncodeRequest(r); err != nil {
		return fail(Invalid)
	}
	a, l, err := readState(dir, owner)
	if err != nil {
		return fail(StateUnavailable)
	}
	var entry *allowed
	for i := range a.IDs {
		if a.IDs[i].ID == r.ID {
			entry = &a.IDs[i]
			break
		}
	}
	if entry == nil && a.runtimeAdmits(r.ID) {
		entry = &allowed{ID: r.ID}
	}
	if entry == nil {
		return fail(Denied)
	}
	for _, b := range l.Bindings {
		if b.ID == r.ID {
			return Reply{Version: 1, Route: &Route{UID: b.UID, Username: b.Username, Socket: socketFor(b.Username)}, Generation: l.Generation, Epoch: a.Epoch}
		}
	}
	if r.Operation == "authorize" {
		return fail(Denied)
	}
	name := r.Candidate
	if entry.Alternate != "" {
		name = entry.Alternate
	}
	if !username(name) {
		return fail(NameCollision)
	}
	for _, b := range l.Bindings {
		if b.Username == name {
			return fail(NameCollision)
		}
	}
	for _, x := range a.IDs {
		if x.ID != r.ID && x.Alternate == name {
			return fail(NameCollision)
		}
	}
	// Occupancy is not enough to admit: the writer must check NSS, home,
	// sockets, unit instances, journal and UID pool under its root lock.
	return fail(Denied)
}
