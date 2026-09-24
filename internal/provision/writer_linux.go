//go:build linux

package provision

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/sys/unix"
)

// HostExecutor is deliberately not implemented by this package. Available must
// inspect NSS (user AND group), home, socket, config and unit instance for both
// the name and UID/GID; Verify must check the committed account's NSS identity,
// home, socket ACL, config and unit, without repairing any of them. Operators
// must reserve the configured UID range from independent account creation.
// Each Step must perform only its named operation, and fail on existing state.
type HostExecutor interface {
	Available(context.Context, string, uint32) (bool, error)
	Step(context.Context, string, string, uint32) error
	Verify(context.Context, string, uint32) error
}

var phases = []string{"account", "home", "config", "socket", "unit"}

type journal struct {
	Version    int    `json:"version"`
	ID         string `json:"id"`
	Username   string `json:"username"`
	UID        uint32 `json:"uid"`
	Phase      string `json:"phase"`
	Epoch      uint64 `json:"epoch"`
	Generation uint64 `json:"generation"`
}
type head struct {
	Version    int    `json:"version"`
	Epoch      uint64 `json:"epoch"`
	Generation uint64 `json:"generation"`
}

// Writer is inert without a separately reviewed executor and service wiring.
// NewWriter requires an explicit server-selected UID/GID range. The unexported
// owner override below exists solely for hermetic tests; production requires root.
type Writer struct {
	Dir            string
	UIDMin, UIDMax uint32
	Executor       HostExecutor
	owner          uint32
}

func NewWriter(dir string, min, max uint32, executor HostExecutor) Writer {
	return Writer{Dir: dir, UIDMin: min, UIDMax: max, Executor: executor}
}
func failure(f Failure) Reply { return Reply{Version: 1, Failure: f} }

// lockedDir checks each directory component and takes an exclusive advisory
// lock on the private state directory inode. Fleetrepo must require every
// operator allowlist/ledger writer to take the same lock.
func lockedDir(path string, owner uint32) (int, error) {
	if !filepath.IsAbs(path) || filepath.Clean(path) != path || path == "/" {
		return -1, ErrInvalid
	}
	fd, e := unix.Open("/", unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if e != nil {
		return -1, e
	}
	for _, p := range strings.Split(strings.TrimPrefix(path, "/"), "/") {
		if p == "" || p == "." || p == ".." {
			unix.Close(fd)
			return -1, ErrInvalid
		}
		n, err := unix.Openat(fd, p, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
		unix.Close(fd)
		if err != nil {
			return -1, ErrInvalid
		}
		fd = n
		var st unix.Stat_t
		if unix.Fstat(fd, &st) != nil || st.Mode&unix.S_IFMT != unix.S_IFDIR || (st.Uid != 0 && st.Uid != owner) || st.Mode&0022 != 0 {
			unix.Close(fd)
			return -1, ErrInvalid
		}
	}
	var st unix.Stat_t
	if unix.Fstat(fd, &st) != nil || st.Uid != owner || st.Mode&0077 != 0 || unix.Flock(fd, unix.LOCK_EX) != nil {
		unix.Close(fd)
		return -1, ErrInvalid
	}
	return fd, nil
}
func readAt(fd int, name string, owner uint32) ([]byte, error) {
	f, e := unix.Openat(fd, name, unix.O_RDONLY|unix.O_NOFOLLOW|unix.O_CLOEXEC|unix.O_NONBLOCK, 0)
	if e != nil {
		return nil, ErrInvalid
	}
	defer unix.Close(f)
	var st unix.Stat_t
	if unix.Fstat(f, &st) != nil || st.Uid != owner || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Mode&0077 != 0 || st.Nlink != 1 || st.Size < 1 || st.Size > MaxMessage {
		return nil, ErrInvalid
	}
	b := make([]byte, st.Size)
	off := 0
	for off < len(b) {
		n, e := unix.Read(f, b[off:])
		if e != nil || n <= 0 {
			return nil, ErrInvalid
		}
		off += n
	}
	return b, nil
}
func absent(fd int, name string) bool {
	var st unix.Stat_t
	return unix.Fstatat(fd, name, &st, unix.AT_SYMLINK_NOFOLLOW) == unix.ENOENT
}
func durable(fd int) error { return unix.Fsync(fd) }
func writeNew(fd int, name string, b []byte) error {
	if len(b) == 0 || len(b) > MaxMessage {
		return ErrInvalid
	}
	f, e := unix.Openat(fd, name, unix.O_WRONLY|unix.O_CREAT|unix.O_EXCL|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0600)
	if e != nil {
		return ErrInvalid
	}
	file := os.NewFile(uintptr(f), name)
	n, e := file.Write(b)
	if e == nil && n != len(b) {
		e = io.ErrShortWrite
	}
	if e == nil {
		e = file.Sync()
	}
	if closeErr := file.Close(); e == nil {
		e = closeErr
	}
	if e != nil {
		return e
	}
	return durable(fd)
}

// replace writes a unique fixed staging name. Any interrupted staging file
// blocks subsequent operations; only an operator may reconcile it.
func replace(fd int, name string, b []byte) error {
	next := name + ".next"
	if err := writeNew(fd, next, b); err != nil {
		return err
	}
	if err := unix.Renameat(fd, next, fd, name); err != nil {
		return err
	}
	return durable(fd)
}
func marshal(v any) []byte { b, _ := json.Marshal(v); return b }
func stateAt(fd int, owner uint32) (allowFile, ledgerFile, []byte, []byte, error) {
	var a allowFile
	var l ledgerFile
	// Reuse the strict parser without reopening a possibly replaced directory:
	// parse via the same validation rules below.
	ab, e := readAt(fd, "allowlist.json", owner)
	if e != nil {
		return a, l, nil, nil, e
	}
	lb, e := readAt(fd, "bindings.json", owner)
	if e != nil {
		return a, l, nil, nil, e
	}
	ar, e := object(ab, "version", "epoch", "ids")
	if e != nil {
		return a, l, nil, nil, e
	}
	lr, e := object(lb, "version", "generation", "bindings")
	if e != nil {
		return a, l, nil, nil, e
	}
	if json.Unmarshal(ab, &a) != nil || json.Unmarshal(lb, &l) != nil || a.Version != 1 || l.Version != 1 || a.Epoch == 0 || l.Generation == 0 {
		return a, l, nil, nil, ErrInvalid
	}
	aa, e := checkArray(ar["ids"], "ids")
	if e != nil {
		return a, l, nil, nil, e
	}
	bb, e := checkArray(lr["bindings"], "bindings")
	if e != nil {
		return a, l, nil, nil, e
	}
	ids := map[string]bool{}
	alts := map[string]bool{}
	for _, raw := range aa {
		var x allowed
		if decode(raw, &x, "id", "alternate") != nil || !numericID(x.ID) || ids[x.ID] || x.Alternate != "" && (!username(x.Alternate) || alts[x.Alternate]) {
			return a, l, nil, nil, ErrInvalid
		}
		ids[x.ID] = true
		if x.Alternate != "" {
			alts[x.Alternate] = true
		}
	}
	ids = map[string]bool{}
	uids := map[uint32]bool{}
	names := map[string]bool{}
	for _, raw := range bb {
		var x binding
		if decode(raw, &x, "id", "uid", "username") != nil || !numericID(x.ID) || x.UID == 0 || !username(x.Username) || ids[x.ID] || uids[x.UID] || names[x.Username] {
			return a, l, nil, nil, ErrInvalid
		}
		ids[x.ID] = true
		uids[x.UID] = true
		names[x.Username] = true
	}
	return a, l, ab, lb, nil
}
func (w Writer) valid() bool {
	return w.Executor != nil && w.UIDMin >= 1000 && w.UIDMax >= w.UIDMin && w.UIDMax-w.UIDMin <= 4095
}

// Handle serializes every authorize and ensure. A pending journal or interrupted
// staging write denies ALL routes, including previously committed bindings.
func (w Writer) Handle(ctx context.Context, r Request) Reply {
	if ctx == nil || !w.valid() {
		return failure(StateUnavailable)
	}
	if _, e := EncodeRequest(r); e != nil {
		return failure(Invalid)
	}
	fd, e := lockedDir(w.Dir, w.owner)
	if e != nil {
		return failure(StateUnavailable)
	}
	defer unix.Close(fd)
	defer unix.Flock(fd, unix.LOCK_UN)
	for _, n := range []string{"pending.json", "pending.json.next", "bindings.json.next", "head.json.next"} {
		if !absent(fd, n) {
			return failure(StateUnavailable)
		}
	}
	a, l, ab, lb, e := stateAt(fd, w.owner)
	if e != nil {
		return failure(StateUnavailable)
	}
	hb, e := readAt(fd, "head.json", w.owner)
	if e != nil {
		return failure(StateUnavailable)
	}
	var h head
	if decode(hb, &h, "version", "epoch", "generation") != nil || h.Version != 1 || h.Epoch == 0 || h.Generation == 0 || a.Epoch < h.Epoch || l.Generation != h.Generation {
		return failure(StateUnavailable)
	}
	// Record the highest observed epoch before any route or mutation. Rollbacks
	// below this watermark are rejected even after restart.
	if a.Epoch > h.Epoch {
		h.Epoch = a.Epoch
		if replace(fd, "head.json", marshal(h)) != nil {
			return failure(StateUnavailable)
		}
	}
	var entry *allowed
	for i := range a.IDs {
		if a.IDs[i].ID == r.ID {
			entry = &a.IDs[i]
			break
		}
	}
	if entry == nil {
		return failure(Denied)
	}
	for _, b := range l.Bindings {
		if b.ID == r.ID {
			if b.UID < w.UIDMin || b.UID > w.UIDMax {
				return failure(Drift)
			}
			if e := w.Executor.Verify(ctx, b.Username, b.UID); e != nil {
				return failure(Drift)
			}
			// Do not return a route after a concurrent operator rewrite, even when
			// the executor's verification was in flight.
			if !sameState(fd, w.owner, ab, lb, a.Epoch) {
				return failure(StateUnavailable)
			}
			return Reply{Version: 1, Route: &Route{UID: b.UID, Username: b.Username, Socket: socketFor(b.Username)}, Generation: l.Generation, Epoch: a.Epoch}
		}
	}
	if r.Operation != "ensure" {
		return failure(Denied)
	}
	name := r.Candidate
	if entry.Alternate != "" {
		name = entry.Alternate
	}
	if !username(name) {
		return failure(NameCollision)
	}
	for _, b := range l.Bindings {
		if b.Username == name {
			return failure(NameCollision)
		}
	}
	for _, x := range a.IDs {
		if x.ID != r.ID && x.Alternate == name {
			return failure(NameCollision)
		}
	}
	var uid uint32
	for n := w.UIDMin; ; n++ {
		used := false
		for _, b := range l.Bindings {
			if b.UID == n {
				used = true
				break
			}
		}
		if !used {
			ok, err := w.Executor.Available(ctx, name, n)
			if err != nil {
				return failure(Drift)
			}
			if ok {
				uid = n
				break
			}
		}
		if n == w.UIDMax {
			break
		}
	}
	if uid == 0 {
		return failure(NameCollision)
	}
	if !sameState(fd, w.owner, ab, lb, a.Epoch) {
		return failure(StateUnavailable)
	}
	j := journal{Version: 1, ID: r.ID, Username: name, UID: uid, Epoch: a.Epoch, Generation: l.Generation, Phase: "reserved"}
	if e := writeNew(fd, "pending.json", marshal(j)); e != nil {
		return failure(StateUnavailable)
	}
	for _, phase := range phases {
		j.Phase = phase
		if replace(fd, "pending.json", marshal(j)) != nil {
			return failure(StateUnavailable)
		}
		// Recheck external policy before each irreversible host operation.
		if !sameState(fd, w.owner, ab, lb, a.Epoch) {
			return failure(StateUnavailable)
		}
		if e := w.Executor.Step(ctx, phase, name, uid); e != nil {
			return failure(Drift)
		}
	}
	j.Phase = "verify"
	if replace(fd, "pending.json", marshal(j)) != nil {
		return failure(StateUnavailable)
	}
	if e := w.Executor.Verify(ctx, name, uid); e != nil {
		return failure(Drift)
	}
	if !sameState(fd, w.owner, ab, lb, a.Epoch) {
		return failure(StateUnavailable)
	}
	l.Generation++
	if l.Generation == 0 {
		return failure(StateUnavailable)
	}
	l.Bindings = append(l.Bindings, binding{ID: r.ID, UID: uid, Username: name})
	j.Phase = "publish"
	if replace(fd, "pending.json", marshal(j)) != nil {
		return failure(StateUnavailable)
	}
	if e := replace(fd, "bindings.json", marshal(l)); e != nil {
		return failure(StateUnavailable)
	}
	h.Generation = l.Generation
	if replace(fd, "head.json", marshal(h)) != nil {
		return failure(StateUnavailable)
	}
	if !sameAllow(fd, w.owner, ab) {
		return failure(StateUnavailable)
	}
	if unix.Unlinkat(fd, "pending.json", 0) != nil || durable(fd) != nil {
		return failure(StateUnavailable)
	}
	return Reply{Version: 1, Route: &Route{UID: uid, Username: name, Socket: socketFor(name)}, Generation: l.Generation, Epoch: a.Epoch}
}
func sameAllow(fd int, owner uint32, ab []byte) bool {
	now, e := readAt(fd, "allowlist.json", owner)
	return e == nil && bytes.Equal(now, ab)
}
func sameState(fd int, owner uint32, ab, lb []byte, epoch uint64) bool {
	if !sameAllow(fd, owner, ab) {
		return false
	}
	now, e := readAt(fd, "bindings.json", owner)
	if e != nil || !bytes.Equal(now, lb) {
		return false
	}
	// Epoch is compared via the exact allowlist bytes above.
	return epoch != 0
}
