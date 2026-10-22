//go:build linux

package host

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"golang.org/x/sys/unix"
)

var ErrRecovery = errors.New("recovery_required: inspect the durable operation; no automatic repair is safe")
var ErrTrust = errors.New("unsafe_path: require root-owned non-writable parents and private regular files")
var ErrBusy = errors.New("operation_busy: another host operation holds the root lock")
var ErrNotFound = errors.New("operation_not_found: no such durable operation")

const operationDir = "/var/lib/open-habitat/host"

var operationIDRE = regexp.MustCompile(`^[0-9a-f]{32}$`)

// These are implementation-owned enums, not arbitrary diagnostic strings.
// A lowercase credential also matches an identifier regex; syntax alone is not
// redaction. New maintenance steps extend these lists deliberately.
func operationKind(s string) bool { return s == "apply" || s == "prepare" || s == "upgrade" }
func operationPhase(s string) bool {
	switch s {
	case "session_restarting", "policy_installing", "probe_reserved", "probe_armed", "probe_cleanup", "probe_verified", "started", "staging", "initializing", "seeded", "converging", "verifying", "quiescing", "activating", "verified", "completed":
		return true
	}
	return false
}
func operationReason(s string) bool {
	switch s {
	case "", "cancelled", "precondition_changed", "broker_unavailable", "control_unavailable", "verification_failed", "publication_failed", "dependency_missing", "recovery_required":
		return true
	}
	return false
}

type Operation struct {
	SchemaVersion int     `json:"schema_version"`
	ID            string  `json:"id"`
	Kind          string  `json:"kind"`
	PlanID        string  `json:"plan_id"`
	Phase         string  `json:"phase"`
	Status        string  `json:"status"`
	Seq           uint64  `json:"seq"`
	StartedAt     string  `json:"started_at"`
	UpdatedAt     string  `json:"updated_at"`
	Target        Release `json:"target"`
	Reason        string  `json:"reason,omitempty"`
}

func (o Operation) valid() bool {
	return o.SchemaVersion == 1 && operationIDRE.MatchString(o.ID) && digestRE.MatchString(o.PlanID) && operationKind(o.Kind) && operationPhase(o.Phase) && o.Seq > 0 && versionRE.MatchString(o.Target.Version) && digestRE.MatchString(o.Target.ManifestSHA256) && (o.Status == "running" || o.Status == "completed" || o.Status == "failed" || o.Status == "cancelled") && operationReason(o.Reason) && validTimestamp(o.StartedAt) && validTimestamp(o.UpdatedAt)
}
func validTimestamp(s string) bool {
	_, e := time.Parse(time.RFC3339Nano, s)
	return e == nil && strings.HasSuffix(s, "Z")
}

// Lock serializes all deliberate host mutations (including future prepare and
// upgrade). Broker/admin operations retain their own narrower locks. Close does
// not erase interrupted operation evidence. No lock is needed to inspect a
// receipt atomically; show must remain usable during a long operation.
type Lock struct {
	fd    int
	owner uint32
	now   func() time.Time
}

func OpenOperationLock(ctx context.Context) (*Lock, error) {
	if os.Geteuid() != 0 {
		return nil, ErrTrust
	}
	return openOperationLock(ctx, operationDir, 0, time.Now)
}
func openOperationLock(ctx context.Context, dir string, owner uint32, now func() time.Time) (*Lock, error) {
	// The parent is an installer-created trust root, not an arbitrary mkdir -p.
	parent, e := openDir(filepath.Dir(dir), owner, false)
	if e != nil {
		return nil, e
	}
	defer unix.Close(parent)
	name := filepath.Base(dir)
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	e = unix.Mkdirat(parent, name, 0700)
	if e != nil && e != unix.EEXIST {
		return nil, e
	}
	if e == nil && unix.Fsync(parent) != nil {
		return nil, ErrRecovery
	}
	fd, e := openDir(dir, owner, true)
	if e != nil {
		return nil, e
	}
	if e = unix.Flock(fd, unix.LOCK_EX|unix.LOCK_NB); e != nil {
		unix.Close(fd)
		if e == unix.EWOULDBLOCK || e == unix.EAGAIN {
			return nil, ErrBusy
		}
		return nil, e
	}
	if ctx.Err() != nil {
		unix.Close(fd)
		return nil, ctx.Err()
	}
	return &Lock{fd, owner, now}, nil
}
func (l *Lock) Close() error { return unix.Close(l.fd) }
func (l *Lock) Begin(kind, plan string, target Release) (Operation, error) {
	var o Operation
	if !operationKind(kind) || !digestRE.MatchString(plan) || !versionRE.MatchString(target.Version) || !digestRE.MatchString(target.ManifestSHA256) {
		return o, ErrRecovery
	}
	// One active record is a fail-closed fence, even after the process lock dies.
	if b, e := readPrivateAt(l.fd, "active.json", l.owner); e == nil {
		var prior Operation
		if decodeOperation(b, &prior) != nil || prior.Status != "completed" || l.matchReceipt(prior) != nil {
			return o, ErrRecovery
		}
	} else if !errors.Is(e, os.ErrNotExist) && e != unix.ENOENT {
		return o, e
	}
	var id [16]byte
	if _, e := rand.Read(id[:]); e != nil {
		return o, e
	}
	stamp := l.now().UTC().Format(time.RFC3339Nano)
	o = Operation{SchemaVersion: 1, ID: hex.EncodeToString(id[:]), Kind: kind, PlanID: plan, Phase: "started", Status: "running", Seq: 1, StartedAt: stamp, UpdatedAt: stamp, Target: target}
	if e := l.persist(o); e != nil {
		return Operation{}, e
	}
	return o, nil
}

// Advance persists the intent before its corresponding irreversible step. The
// caller must explicitly verify that step before advancing again; the journal
// never infers resumability from a phase name alone.
func (l *Lock) Advance(o Operation, phase, status, reason string) (Operation, error) {
	prior, e := readPrivateAt(l.fd, "active.json", l.owner)
	if e != nil {
		return Operation{}, e
	}
	var current Operation
	if decodeOperation(prior, &current) != nil || current != o || o.Status != "running" || o.Seq == ^uint64(0) || l.matchReceipt(current) != nil {
		return Operation{}, ErrRecovery
	}
	o.Phase = phase
	o.Status = status
	o.Reason = reason
	o.Seq++
	o.UpdatedAt = l.now().UTC().Format(time.RFC3339Nano)
	if !o.valid() {
		return Operation{}, ErrRecovery
	}
	if e = l.persist(o); e != nil {
		return Operation{}, e
	}
	return o, nil
}

// Publication is receipt-first, fence-last. If a process died between them,
// neither an old in-memory writer nor a newly acquired lock may erase the newer
// receipt by replaying from the older fence. Preserve both for diagnosis.
func (l *Lock) matchReceipt(o Operation) error {
	b, err := readPrivateAt(l.fd, o.ID+".json", l.owner)
	var receipt Operation
	if err != nil || decodeOperation(b, &receipt) != nil || receipt != o {
		return ErrRecovery
	}
	return nil
}

func (l *Lock) persist(o Operation) error {
	if !o.valid() {
		return ErrRecovery
	}
	// A known interrupted publication is a precondition failure, not a new
	// phase intent. Refuse before replacing the receipt or creating an orphan
	// operation when a previous completed fence still has a staged successor.
	for _, name := range []string{"active.json.next", o.ID + ".json.next"} {
		var st unix.Stat_t
		if unix.Fstatat(l.fd, name, &st, unix.AT_SYMLINK_NOFOLLOW) != unix.ENOENT {
			return ErrRecovery
		}
	}
	b, e := json.Marshal(o)
	if e != nil {
		return e
	}
	// Receipt first, active fence last. An interrupted Advance leaves mismatching
	// evidence and requires recovery. An interrupted Begin can leave an orphan
	// started receipt: no host action may run until Begin succeeds and the first
	// action's Advance has persisted its intent.
	if e = replacePrivateAt(l.fd, o.ID+".json", b); e != nil {
		return e
	}
	return replacePrivateAt(l.fd, "active.json", b)
}
func ShowOperation(id string) (Operation, error) {
	if os.Geteuid() != 0 {
		return Operation{}, ErrTrust
	}
	return showOperation(operationDir, id, 0)
}
func showOperation(dir, id string, owner uint32) (Operation, error) {
	var o Operation
	if !operationIDRE.MatchString(id) {
		return o, ErrNotFound
	}
	fd, e := openDir(dir, owner, true)
	if e != nil {
		return o, e
	}
	defer unix.Close(fd)
	b, e := readPrivateAt(fd, id+".json", owner)
	if e != nil {
		if errors.Is(e, os.ErrNotExist) {
			return o, ErrNotFound
		}
		return o, e
	}
	if decodeOperation(b, &o) != nil || o.ID != id {
		return Operation{}, ErrRecovery
	}
	return o, nil
}
func decodeOperation(b []byte, o *Operation) error {
	if strictJSON(b) != nil {
		return ErrRecovery
	}
	d := json.NewDecoder(strings.NewReader(string(b)))
	d.DisallowUnknownFields()
	if d.Decode(o) != nil || !o.valid() {
		return ErrRecovery
	}
	return nil
}
func openDir(path string, owner uint32, private bool) (int, error) {
	if !filepath.IsAbs(path) || filepath.Clean(path) != path {
		return -1, ErrTrust
	}
	fd, e := unix.Open("/", unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if e != nil {
		return -1, e
	}
	if path != "/" {
		for _, p := range strings.Split(strings.TrimPrefix(path, "/"), "/") {
			n, e := unix.Openat(fd, p, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
			unix.Close(fd)
			if e != nil {
				return -1, e
			}
			fd = n
			var st unix.Stat_t
			if unix.Fstat(fd, &st) != nil || (st.Uid != 0 && st.Uid != owner) || st.Mode&0022 != 0 {
				unix.Close(fd)
				return -1, ErrTrust
			}
		}
	}
	var st unix.Stat_t
	if unix.Fstat(fd, &st) != nil || st.Uid != owner || private && st.Mode&0077 != 0 {
		unix.Close(fd)
		return -1, ErrTrust
	}
	return fd, nil
}
func readPrivateAt(fd int, name string, owner uint32) ([]byte, error) {
	f, e := unix.Openat(fd, name, unix.O_RDONLY|unix.O_CLOEXEC|unix.O_NOFOLLOW|unix.O_NONBLOCK, 0)
	if e != nil {
		return nil, e
	}
	file := os.NewFile(uintptr(f), name)
	defer file.Close()
	var st unix.Stat_t
	if unix.Fstat(f, &st) != nil || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Mode&0077 != 0 || st.Uid != owner || st.Nlink != 1 || st.Size < 1 || st.Size > MaxSiteBytes {
		return nil, ErrTrust
	}
	b, e := io.ReadAll(io.LimitReader(file, MaxSiteBytes+1))
	if e != nil || len(b) > MaxSiteBytes {
		return nil, ErrTrust
	}
	return b, nil
}
func replacePrivateAt(fd int, name string, b []byte) error {
	return replaceAtMode(fd, name, b, 0600)
}
func replaceAtMode(fd int, name string, b []byte, mode os.FileMode) error {
	if mode != 0600 && mode != 0644 {
		return ErrTrust
	}
	stage := name + ".next"
	f, e := unix.Openat(fd, stage, unix.O_WRONLY|unix.O_CREAT|unix.O_EXCL|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0600)
	if e != nil {
		return ErrRecovery
	}
	file := os.NewFile(uintptr(f), stage)
	n, e := file.Write(b)
	if e == nil && n != len(b) {
		e = io.ErrShortWrite
	}
	if e == nil {
		e = file.Chmod(mode)
	}
	if e == nil {
		e = file.Sync()
	}
	ce := file.Close()
	if e == nil {
		e = ce
	}
	if e != nil {
		return e
	}
	if e = unix.Renameat(fd, stage, fd, name); e != nil {
		return e
	}
	return unix.Fsync(fd)
}

// LoadSite has no environment substitution or includes. The site and references
// are separately authenticated; merely naming a file grants it no trust.
func LoadSite(path string) (Site, error) { return loadSite(path, 0) }
func loadSite(path string, owner uint32) (Site, error) {
	if !absolute(path) {
		return Site{}, ErrTrust
	}
	fd, e := openDir(filepath.Dir(path), owner, false)
	if e != nil {
		return Site{}, e
	}
	defer unix.Close(fd)
	b, e := readPrivateAt(fd, filepath.Base(path), owner)
	if e != nil {
		return Site{}, e
	}
	return ParseSite(b)
}
