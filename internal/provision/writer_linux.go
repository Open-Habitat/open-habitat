//go:build linux

package provision

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/storagequota"
	"golang.org/x/sys/unix"
)

// ExecutorIdentity is a value snapshot of the authorized root-owned binding.
// Its fields cannot be changed by an injected executor; the provider is fixed
// by the validated broker protocol, the ID comes from the authenticated gateway request or committed
// ledger, and the name/UID are assigned by the writer, never the browser.
// It is not an independent attestation of the remote GitHub user.
type ExecutorIdentity struct {
	provider string
	id       string
	username string
	uid      uint32
}

func (i ExecutorIdentity) Provider() string { return i.provider }
func (i ExecutorIdentity) ID() string       { return i.id }
func (i ExecutorIdentity) Username() string { return i.username }
func (i ExecutorIdentity) UID() uint32      { return i.uid }

// HostExecutor is deliberately not implemented by this package. Available must
// inspect NSS (user AND group), home, socket, config and unit instance for both
// the name and UID/GID; Verify must check the committed account's NSS identity,
// home, socket ACL, config and unit, without repairing any of them. Operators
// must reserve the configured UID range from independent account creation.
// Each Step must perform only its named operation, and fail on existing state.
// Step and Verify receive the same authorized subject as the journal/ledger;
// Verify on an existing binding uses the committed ID even after login rename.
// An injected executor must honor ctx while waiting and between irreversible
// steps. Cancellation cannot undo a host syscall already in progress; an
// interrupted mutation may leave its journal for operator reconciliation.
type HostExecutor interface {
	Available(context.Context, string, uint32) (bool, error)
	Step(context.Context, string, ExecutorIdentity) error
	Verify(context.Context, ExecutorIdentity) error
	// Ready is called only by ensure, outside the ledger lock: the systemd
	// pre-start policy takes a shared lock and must observe a committed binding.
	Ready(context.Context, ExecutorIdentity) error
	RouteReady(context.Context, ExecutorIdentity) error
}

var phases = []string{"account", "home", "config", "socket", "unit", "quota"}

type QuotaOperations interface {
	Read(uint32) (storagequota.Quota, error)
	Set(uint32, uint64) error
}
type nativeQuota struct{}

func (nativeQuota) Read(uid uint32) (storagequota.Quota, error) { return storagequota.Read(uid) }
func (nativeQuota) Set(uid uint32, limit uint64) error          { return storagequota.Set(uid, limit) }

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
	Quota          QuotaOperations
	QuotaEnabled   func() error
	Capacity       func() (storagequota.Filesystem, error)
	// AdmitAny is an explicit root-only test-installation policy. The gateway
	// must enforce signed Access assertions before the operator enables it.
	AdmitAny bool
	// GuardEvent is root-local diagnostic output, never included in a reply.
	// Only internally selected fixed literals are passed to it.
	GuardEvent func(string)
	// Published is called only after the binding and head are durable. It is
	// diagnostic only and must not affect the result of an ensure.
	Published func(string)
	owner     uint32
}

func NewWriter(dir string, min, max uint32, executor HostExecutor) Writer {
	return Writer{Dir: dir, UIDMin: min, UIDMax: max, Executor: executor, Quota: nativeQuota{}, QuotaEnabled: storagequota.Enabled, Capacity: storagequota.Capacity}
}
func failure(f Failure) Reply { return Reply{Version: 1, Failure: f} }

// lockedDir checks each directory component and takes an exclusive advisory
// lock on the private state directory inode. Fleetrepo must require every
// operator allowlist/ledger writer to take the same lock.
func lockedDir(ctx context.Context, path string, owner uint32) (int, error) {
	if err := ctx.Err(); err != nil {
		return -1, err
	}
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
	if unix.Fstat(fd, &st) != nil || st.Uid != owner || st.Mode&0077 != 0 {
		unix.Close(fd)
		return -1, ErrInvalid
	}
	// Nonblocking flock keeps cancellation and the exchange deadline effective.
	for {
		if err := ctx.Err(); err != nil {
			unix.Close(fd)
			return -1, err
		}
		err := unix.Flock(fd, unix.LOCK_EX|unix.LOCK_NB)
		if err == nil {
			if err = ctx.Err(); err == nil {
				return fd, nil
			}
			unix.Flock(fd, unix.LOCK_UN)
			unix.Close(fd)
			return -1, err
		}
		if err != unix.EWOULDBLOCK && err != unix.EAGAIN {
			unix.Close(fd)
			return -1, err
		}
		select {
		case <-ctx.Done():
			unix.Close(fd)
			return -1, ctx.Err()
		case <-time.After(10 * time.Millisecond):
		}
	}
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
func stateAt(ctx context.Context, fd int, owner uint32) (allowFile, ledgerFile, []byte, []byte, error) {
	var a allowFile
	var l ledgerFile
	// Reuse the strict parser without reopening a possibly replaced directory:
	// parse via the same validation rules below.
	if err := ctx.Err(); err != nil {
		return a, l, nil, nil, err
	}
	ab, e := readAt(fd, "allowlist.json", owner)
	if e != nil {
		return a, l, nil, nil, e
	}
	if err := ctx.Err(); err != nil {
		return a, l, nil, nil, err
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
	return w.Executor != nil && w.Quota != nil && w.QuotaEnabled != nil && w.Capacity != nil && w.UIDMin >= 1000 && w.UIDMax >= w.UIDMin && w.UIDMax-w.UIDMin <= 4095
}

// Handle serializes every authorize and ensure. A pending journal or interrupted
// staging write denies ALL routes, including previously committed bindings.
// Broker callers must pass the per-exchange context through without replacing it.
func (w Writer) Handle(ctx context.Context, r Request) Reply {
	// Authorize remains a read-only, short-deadline check. Ensure may start
	// a socket, but only after the durable publish and release of the ledger
	// lock (the Fleetrepo pre-start gate itself reads that lock).
	if r.Operation != "ensure" {
		return w.handleLocked(ctx, r)
	}
	result := w.handleLocked(ctx, r)
	if ctx.Err() != nil {
		return failure(StateUnavailable)
	}
	if result.Route == nil {
		return result
	}
	identity := ExecutorIdentity{provider: "github", id: r.ID, username: result.Route.Username, uid: result.Route.UID}
	if w.Executor.Ready(ctx, identity) != nil {
		// No token has crossed the boundary. Keep the committed binding and
		// require another explicit ensure; never retry an OAuth handoff.
		return failure(StateUnavailable)
	}
	// Recheck the complete policy and binding under lock after activation.
	// Never return a route based on a stale pre-start allowlist snapshot.
	checked := w.handleLocked(ctx, Request{Version: 1, Operation: "authorize", Provider: "github", ID: r.ID})
	if checked.Route == nil || checked.Route.UID != result.Route.UID || checked.Route.Username != result.Route.Username || checked.Generation < result.Generation || checked.Epoch != result.Epoch {
		return failure(StateUnavailable)
	}
	return checked
}

func (w Writer) handleLocked(ctx context.Context, r Request) Reply {
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
	if ctx.Err() != nil {
		return failure(StateUnavailable)
	}
	for _, n := range []string{"pending.json", "pending.json.next", "bindings.json.next", "head.json.next"} {
		if !absent(fd, n) {
			return failure(StateUnavailable)
		}
	}
	a, l, ab, lb, e := stateAt(ctx, fd, w.owner)
	if e != nil {
		return failure(StateUnavailable)
	}
	if ctx.Err() != nil {
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
	if ctx.Err() != nil {
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
	if r.Operation == "list" || r.Operation == "lookup" {
		offset := 0
		if r.Operation == "list" && r.Candidate != "" {
			offset, _ = strconv.Atoi(r.Candidate)
		}
		if offset > len(l.Bindings) {
			return failure(Invalid)
		}
		users := make([]BoundUser, 0)
		next := ""
		if r.Operation == "list" {
			end := offset + 30
			if end > len(l.Bindings) {
				end = len(l.Bindings)
			}
			for _, b := range l.Bindings[offset:end] {
				users = append(users, BoundUser{ID: b.ID, Username: b.Username})
			}
			if end < len(l.Bindings) {
				next = strconv.Itoa(end)
			}
		} else {
			for _, b := range l.Bindings {
				if b.ID == r.ID {
					users = append(users, BoundUser{ID: b.ID, Username: b.Username})
					break
				}
			}
			if len(users) == 0 {
				return failure(Denied)
			}
		}
		result := Reply{Version: 1, Users: &users, Next: next, Generation: l.Generation, Epoch: a.Epoch}
		if _, err := EncodeReply(result); err != nil {
			return failure(StateUnavailable)
		}
		return result
	}
	var entry *allowed
	for i := range a.IDs {
		if a.IDs[i].ID == r.ID {
			entry = &a.IDs[i]
			break
		}
	}
	// Admission governs login, not administration of an account that already
	// exists. A revoked binding still owns blocks and must remain visible to
	// an administrator; quota operations below can only target the ledger UID.
	if entry == nil && r.Operation != "quota_read" && r.Operation != "quota_set" {
		if !w.AdmitAny {
			return failure(Denied)
		}
		entry = &allowed{ID: r.ID}
	}
	for _, b := range l.Bindings {
		if b.ID == r.ID {
			if b.UID < w.UIDMin || b.UID > w.UIDMax {
				return failure(Drift)
			}
			if ctx.Err() != nil {
				return failure(StateUnavailable)
			}
			identity := ExecutorIdentity{provider: "github", id: b.ID, username: b.Username, uid: b.UID}
			if e := w.Executor.Verify(ctx, identity); e != nil {
				return failure(Drift)
			}
			if r.Operation == "authorize" || r.Operation == "ensure" {
				q, err := w.Quota.Read(b.UID)
				if err != nil || !validLimit(q.Limit) {
					return failure(StateUnavailable)
				}
			}
			if r.Operation == "quota_read" || r.Operation == "quota_set" {
				if r.Operation == "quota_set" && w.Quota.Set(b.UID, *r.LimitBytes) != nil {
					return failure(StateUnavailable)
				}
				q, err := w.Quota.Read(b.UID)
				if err != nil || !validLimit(q.Limit) || (r.Operation == "quota_set" && q.Limit != *r.LimitBytes) || ctx.Err() != nil || !sameState(ctx, fd, w.owner, ab, lb, a.Epoch) {
					return failure(StateUnavailable)
				}
				fs, err := w.Capacity()
				if err != nil || fs.Capacity == 0 || fs.Free > fs.Capacity {
					return failure(StateUnavailable)
				}
				return Reply{Version: 1, Quota: &QuotaReply{UsageBytes: q.Usage, LimitBytes: q.Limit, CapacityBytes: fs.Capacity, FreeBytes: fs.Free}, Generation: l.Generation, Epoch: a.Epoch}
			}
			if r.Operation == "authorize" && w.Executor.RouteReady(ctx, identity) != nil {
				// An inactive socket is not mapping drift. Deny this request but
				// retain the session for an operator-gated restart or new ensure.
				return failure(StateUnavailable)
			}
			// Do not return a route after a concurrent operator rewrite, even when
			// the executor's verification was in flight.
			if ctx.Err() != nil || !sameState(ctx, fd, w.owner, ab, lb, a.Epoch) {
				return failure(StateUnavailable)
			}
			return Reply{Version: 1, Route: &Route{UID: b.UID, Username: b.Username, Socket: socketFor(b.Username)}, Generation: l.Generation, Epoch: a.Epoch}
		}
	}
	if r.Operation != "ensure" {
		return failure(Denied)
	}
	if r.DefaultLimitBytes == nil {
		return failure(Invalid)
	}
	name := strings.ToLower(r.Candidate)
	if !username(name) {
		// The numeric provider ID is stable even when its login contains
		// characters or a length unsuitable for a Unix account name.
		name = "gh" + r.ID
	}
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
			if ctx.Err() != nil {
				return failure(StateUnavailable)
			}
			ok, err := w.Executor.Available(ctx, name, n)
			if err != nil {
				if w.GuardEvent != nil {
					stage := "availability_error"
					if guard, ok := err.(availabilityGuard); ok {
						stage = string(guard)
					}
					w.GuardEvent(stage)
				}
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
		if w.GuardEvent != nil {
			w.GuardEvent("no_available_binding")
		}
		return failure(NameCollision)
	}
	if ctx.Err() != nil || !sameState(ctx, fd, w.owner, ab, lb, a.Epoch) {
		return failure(StateUnavailable)
	}
	// A queued ensure must not begin irreversible work with its whole
	// mutation budget already spent waiting for the global lock. This is
	// admission only, not a promise that host commands will finish in time.
	if deadline, ok := ctx.Deadline(); ok && time.Until(deadline) < 60*time.Second {
		return failure(StateUnavailable)
	}
	// Do not leave an account and pending journal merely because the home
	// filesystem never had user-quota accounting enabled. The final Set and
	// readback remain authoritative if support disappears after this probe.
	if w.QuotaEnabled() != nil || ctx.Err() != nil {
		return failure(StateUnavailable)
	}
	identity := ExecutorIdentity{provider: "github", id: entry.ID, username: name, uid: uid}
	j := journal{Version: 1, ID: identity.ID(), Username: identity.Username(), UID: identity.UID(), Epoch: a.Epoch, Generation: l.Generation, Phase: "reserved"}
	if e := writeNew(fd, "pending.json", marshal(j)); e != nil {
		return failure(StateUnavailable)
	}
	for _, phase := range phases {
		j.Phase = phase
		if replace(fd, "pending.json", marshal(j)) != nil {
			return failure(StateUnavailable)
		}
		// Recheck external policy before each irreversible host operation.
		if ctx.Err() != nil || !sameState(ctx, fd, w.owner, ab, lb, a.Epoch) {
			return failure(StateUnavailable)
		}
		if ctx.Err() != nil {
			return failure(StateUnavailable)
		}
		if phase == "quota" {
			if e := w.Quota.Set(uid, *r.DefaultLimitBytes); e != nil {
				return failure(Drift)
			}
		} else if e := w.Executor.Step(ctx, phase, identity); e != nil {
			return failure(Drift)
		}
	}
	j.Phase = "verify"
	if replace(fd, "pending.json", marshal(j)) != nil {
		return failure(StateUnavailable)
	}
	if ctx.Err() != nil {
		return failure(StateUnavailable)
	}
	if e := w.Executor.Verify(ctx, identity); e != nil {
		return failure(Drift)
	}
	if ctx.Err() != nil || !sameState(ctx, fd, w.owner, ab, lb, a.Epoch) {
		return failure(StateUnavailable)
	}
	l.Generation++
	if l.Generation == 0 {
		return failure(StateUnavailable)
	}
	l.Bindings = append(l.Bindings, binding{ID: identity.ID(), UID: identity.UID(), Username: identity.Username()})
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
	if ctx.Err() != nil || !sameAllow(ctx, fd, w.owner, ab) {
		return failure(StateUnavailable)
	}
	if unix.Unlinkat(fd, "pending.json", 0) != nil || durable(fd) != nil {
		return failure(StateUnavailable)
	}
	if w.Published != nil {
		w.Published(name)
	}
	return Reply{Version: 1, Route: &Route{UID: uid, Username: name, Socket: socketFor(name)}, Generation: l.Generation, Epoch: a.Epoch}
}
func sameAllow(ctx context.Context, fd int, owner uint32, ab []byte) bool {
	if ctx.Err() != nil {
		return false
	}
	now, e := readAt(fd, "allowlist.json", owner)
	return e == nil && bytes.Equal(now, ab)
}
func sameState(ctx context.Context, fd int, owner uint32, ab, lb []byte, epoch uint64) bool {
	if !sameAllow(ctx, fd, owner, ab) {
		return false
	}
	if ctx.Err() != nil {
		return false
	}
	now, e := readAt(fd, "bindings.json", owner)
	if e != nil || !bytes.Equal(now, lb) {
		return false
	}
	// Epoch is compared via the exact allowlist bytes above.
	return epoch != 0
}
