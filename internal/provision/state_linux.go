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
}
type ledgerFile struct {
	Version    int       `json:"version"`
	Generation uint64    `json:"generation"`
	Bindings   []binding `json:"bindings"`
}

// secureFile opens each path component without following links, then reads a
// bounded regular root-owned single-link file from its fd, not its path.
func secureFile(dir, name string, owner uint32) ([]byte, error) {
	if !filepath.IsAbs(dir) || filepath.Clean(dir) != dir || name == "" || strings.ContainsAny(name, "/\\") {
		return nil, ErrInvalid
	}
	fd, err := unix.Open("/", unix.O_DIRECTORY|unix.O_RDONLY|unix.O_CLOEXEC, 0)
	if err != nil {
		return nil, err
	}
	defer unix.Close(fd)
	parts := strings.Split(strings.TrimPrefix(dir, "/"), "/")
	if dir == "/" {
		parts = nil
	}
	for _, p := range parts {
		if p == "" || p == "." || p == ".." {
			return nil, ErrInvalid
		}
		next, e := unix.Openat(fd, p, unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_RDONLY|unix.O_CLOEXEC, 0)
		if e != nil {
			return nil, ErrInvalid
		}
		unix.Close(fd)
		fd = next
		var st unix.Stat_t
		if unix.Fstat(fd, &st) != nil || (st.Uid != owner && st.Uid != 0) || st.Mode&unix.S_IFMT != unix.S_IFDIR || st.Mode&0022 != 0 {
			return nil, ErrInvalid
		}
	}
	// The state directory is private even when its ancestors are traversable.
	var st unix.Stat_t
	if unix.Fstat(fd, &st) != nil || st.Uid != owner || st.Mode&unix.S_IFMT != unix.S_IFDIR || st.Mode&0077 != 0 {
		return nil, ErrInvalid
	}
	// A pending mutation is never a committed binding. The future writer must
	// hold its lock across this check and publication of a new ledger.
	if e := unix.Fstatat(fd, "pending.json", &st, unix.AT_SYMLINK_NOFOLLOW); e != unix.ENOENT {
		return nil, ErrInvalid
	}
	f, err := unix.Openat(fd, name, unix.O_RDONLY|unix.O_NOFOLLOW|unix.O_CLOEXEC|unix.O_NONBLOCK, 0)
	if err != nil {
		return nil, ErrInvalid
	}
	if unix.Fstat(f, &st) != nil || st.Uid != owner || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Mode&0077 != 0 || st.Nlink != 1 || st.Size < 1 || st.Size > MaxMessage {
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
	ar, err := object(ab, "version", "epoch", "ids")
	if err != nil {
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
