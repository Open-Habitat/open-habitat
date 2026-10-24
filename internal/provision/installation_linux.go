//go:build linux

package provision

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"slices"
	"sort"

	"golang.org/x/sys/unix"
)

// Initialization is installation policy, not an identity binding. The offline
// operator may seed an empty broker; only Writer may ever create bindings.
type Initialization struct {
	GatewayUID uint32 `json:"gateway_uid"`
	GatewayGID uint32 `json:"gateway_gid"`
	UIDMin     uint32 `json:"uid_min"`
	UIDMax     uint32 `json:"uid_max"`
}

// InstallationState reports the durable policy and watermark separately. A
// published epoch is not evidence that the running broker has observed it.
type InstallationState struct {
	Policy        Initialization `json:"policy"`
	Admission     []string       `json:"admission"`
	BoundSubjects []string       `json:"bound_subjects"`
	Epoch         uint64         `json:"epoch"`
	ObservedEpoch uint64         `json:"observed_epoch"`
	Generation    uint64         `json:"generation"`
	Token         string         `json:"token"`
	// RuntimeAdmission is the switch as published; Runtime is the site_admin
	// source, which host apply reports but never converges.
	RuntimeAdmission bool           `json:"runtime_admission"`
	Runtime          []RuntimeEntry `json:"runtime"`
}

// RuntimeEntry is a site_admin admission as host plan reports it.
type RuntimeEntry struct {
	ID        string `json:"id"`
	State     string `json:"state"`
	Bound     bool   `json:"bound"`
	LoginHint string `json:"login_hint"`
	Actor     string `json:"actor"`
	At        string `json:"at"`
}

// Admits is the effective admission, the union of both sources.
func (s InstallationState) Admits(id string) bool {
	if slices.Contains(s.Admission, id) {
		return true
	}
	return s.RuntimeAdmits(id)
}

// RuntimeAdmits reports whether the site_admin source admits id.
func (s InstallationState) RuntimeAdmits(id string) bool {
	for _, x := range s.Runtime {
		if x.ID == id && x.State == "admitted" {
			return true
		}
	}
	return false
}

// InspectInstallation is root-local and read-only, including on failure. It
// shares the broker's directory lock and strict state parser.
func InspectInstallation(ctx context.Context) (InstallationState, error) {
	if os.Geteuid() != 0 {
		return InstallationState{}, ErrInvalid
	}
	return inspectInstallation(ctx, brokerState, 0)
}

func initializationConfig(p Initialization) brokerConfig {
	return brokerConfig{Version: 1, GatewayUID: p.GatewayUID, GatewayGID: p.GatewayGID, UIDMin: p.UIDMin, UIDMax: p.UIDMax, StateDir: brokerState, Admission: "allowlist"}
}
func installationAt(ctx context.Context, fd int, owner uint32) (InstallationState, error) {
	var s InstallationState
	// Unknown files may be operator evidence. Never repair or erase them; known
	// incomplete transactions always block, including allowlist staging.
	for _, n := range []string{"pending.json", "pending.json.next", "bindings.json.next", "head.json.next", "allowlist.json.next"} {
		if !absent(fd, n) {
			return s, ErrInvalid
		}
	}
	cb, e := readAt(fd, "broker.json", owner)
	if e != nil {
		return s, e
	}
	cfg, e := parseBrokerConfig(cb)
	if e != nil || cfg.Admission != "allowlist" {
		return s, ErrInvalid
	}
	a, l, ab, lb, e := stateAt(ctx, fd, owner)
	if e != nil {
		return s, e
	}
	hb, e := readAt(fd, "head.json", owner)
	if e != nil {
		return s, e
	}
	var h head
	if decode(hb, &h, "version", "epoch", "generation") != nil || h.Version != 1 || h.Epoch == 0 || h.Epoch > a.Epoch || h.Generation != l.Generation {
		return s, ErrInvalid
	}
	s.Policy = Initialization{cfg.GatewayUID, cfg.GatewayGID, cfg.UIDMin, cfg.UIDMax}
	s.Admission = []string{}
	s.BoundSubjects = []string{}
	for _, x := range a.IDs {
		if x.Alternate != "" {
			return InstallationState{}, ErrInvalid
		}
		s.Admission = append(s.Admission, x.ID)
	}
	for _, x := range l.Bindings {
		if x.UID < cfg.UIDMin || x.UID > cfg.UIDMax {
			return InstallationState{}, ErrInvalid
		}
		s.BoundSubjects = append(s.BoundSubjects, x.ID)
	}
	sort.Strings(s.Admission)
	sort.Strings(s.BoundSubjects)
	s.RuntimeAdmission = a.RuntimeAdmission
	s.Runtime = []RuntimeEntry{}
	for _, x := range a.Runtime {
		s.Runtime = append(s.Runtime, RuntimeEntry{ID: x.ID, State: x.State, Bound: slices.Contains(s.BoundSubjects, x.ID), LoginHint: x.LoginHint, Actor: x.Actor, At: x.At})
	}
	s.Epoch = a.Epoch
	s.ObservedEpoch = h.Epoch
	s.Generation = l.Generation
	sum := sha256.New()
	for _, b := range [][]byte{cb, ab, lb, hb} {
		sum.Write(b)
		sum.Write([]byte{0})
	}
	s.Token = hex.EncodeToString(sum.Sum(nil))
	return s, nil
}
func inspectInstallation(ctx context.Context, dir string, owner uint32) (InstallationState, error) {
	fd, e := lockedDir(ctx, dir, owner)
	if e != nil {
		return InstallationState{}, e
	}
	defer unix.Close(fd)
	return installationAt(ctx, fd, owner)
}

// InitializeBroker publishes a complete empty broker in a single no-replace
// rename. Its trusted private parent must already exist. Interrupted staging is
// preserved for diagnosis, never mistaken for permission to reseed. Availability
// checks for the reserved pool belong to the caller's host preflight.
func InitializeBroker(ctx context.Context, p Initialization, ids []string) (bool, error) {
	if os.Geteuid() != 0 {
		return false, ErrInvalid
	}
	return initializeBroker(ctx, "/var/lib/open-habitat", "broker", p, ids, 0, nil)
}
func validAdmission(ids []string) bool {
	if ids == nil || len(ids) > 128 {
		return false
	}
	seen := map[string]bool{}
	for _, id := range ids {
		if !numericID(id) || seen[id] {
			return false
		}
		seen[id] = true
	}
	return true
}
func initializeBroker(ctx context.Context, parent, name string, p Initialization, ids []string, owner uint32, after func(string) error) (bool, error) {
	cfg := initializationConfig(p)
	if _, e := parseBrokerConfig(marshal(cfg)); e != nil || !validAdmission(ids) || name != "broker" {
		return false, ErrInvalid
	}
	fd, e := lockedDir(ctx, parent, owner)
	if e != nil {
		return false, e
	}
	defer unix.Close(fd)
	stage := ".broker-initialize"
	if !absent(fd, stage) {
		return false, ErrInvalid
	}
	if !absent(fd, name) {
		s, e := inspectInstallation(ctx, parent+"/"+name, owner)
		if e != nil || s.Policy != p {
			return false, ErrInvalid
		}
		// A repeat never resets policy, epochs or bindings. Admission convergence is
		// a separate monotonic transaction, not another initializer invocation.
		want := append([]string{}, ids...)
		sort.Strings(want)
		if !equalStrings(s.Admission, want) {
			return false, ErrInvalid
		}
		return false, nil
	}
	a := allowFile{Version: 1, Epoch: 1, IDs: []allowed{}}
	sorted := append([]string{}, ids...)
	sort.Strings(sorted)
	for _, id := range sorted {
		a.IDs = append(a.IDs, allowed{ID: id})
	}
	files := []struct {
		name  string
		value any
	}{{"broker.json", cfg}, {"allowlist.json", a}, {"bindings.json", ledgerFile{Version: 1, Generation: 1, Bindings: []binding{}}}, {"head.json", head{Version: 1, Epoch: 1, Generation: 1}}}
	for _, f := range files {
		if len(marshal(f.value)) > MaxMessage {
			return false, ErrInvalid
		}
	}
	if ctx.Err() != nil {
		return false, ctx.Err()
	}
	if unix.Mkdirat(fd, stage, 0700) != nil || durable(fd) != nil {
		return false, ErrInvalid
	}
	sf, e := unix.Openat(fd, stage, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if e != nil {
		return false, e
	}
	defer unix.Close(sf)
	for _, f := range files {
		if ctx.Err() != nil {
			return false, ctx.Err()
		}
		if e = writeNew(sf, f.name, marshal(f.value)); e != nil {
			return false, e
		}
		if after != nil {
			if e = after(f.name); e != nil {
				return false, e
			}
		}
	}
	if ctx.Err() != nil {
		return false, ctx.Err()
	}
	if e = unix.Renameat2(fd, stage, fd, name, unix.RENAME_NOREPLACE); e != nil {
		return false, e
	}
	if e = durable(fd); e != nil {
		return false, e
	}
	if after != nil {
		if e = after("published"); e != nil {
			return false, e
		}
	}
	return true, nil
}
func equalStrings(a, b []string) bool { return bytes.Equal(marshal(a), marshal(b)) }

// PublishAdmission is a compare-and-publish transaction, not an admission API on
// the broker listener. It replaces only the operator source and root's
// runtime-admission switch; the site_admin entries are carried over unchanged.
// The caller must keep entry points closed and revoke subjects the new
// effective admission drops *before* this call. It must then wait for
// ObservedEpoch; this function never advances the broker's head on its behalf.
func PublishAdmission(ctx context.Context, expectedToken string, ids []string, runtimeAdmission bool) (InstallationState, error) {
	if os.Geteuid() != 0 {
		return InstallationState{}, ErrInvalid
	}
	return publishAdmission(ctx, brokerState, 0, expectedToken, ids, runtimeAdmission)
}

// operatorPublication is the admission file host apply stages: the given
// operator ids and switch, with the current site_admin entries and epoch+1.
func operatorPublication(current allowFile, ids []string, runtimeAdmission bool) allowFile {
	want := append([]string{}, ids...)
	sort.Strings(want)
	next := allowFile{Version: 1, Epoch: current.Epoch + 1, IDs: []allowed{}, RuntimeAdmission: runtimeAdmission, Runtime: current.Runtime}
	for _, id := range want {
		next.IDs = append(next.IDs, allowed{ID: id})
	}
	return next
}
func publishAdmission(ctx context.Context, dir string, owner uint32, token string, ids []string, runtimeAdmission bool) (InstallationState, error) {
	if !validAdmission(ids) {
		return InstallationState{}, ErrInvalid
	}
	fd, e := lockedDir(ctx, dir, owner)
	if e != nil {
		return InstallationState{}, e
	}
	defer unix.Close(fd)
	s, e := installationAt(ctx, fd, owner)
	if e != nil {
		return s, e
	}
	if token == "" || s.Token != token || s.ObservedEpoch != s.Epoch {
		return InstallationState{}, ErrInvalid
	}
	want := append([]string{}, ids...)
	sort.Strings(want)
	if equalStrings(s.Admission, want) && s.RuntimeAdmission == runtimeAdmission {
		return s, nil
	}
	if s.Epoch == ^uint64(0) {
		return InstallationState{}, ErrInvalid
	}
	current, _, _, _, e := stateAt(ctx, fd, owner)
	if e != nil || current.Epoch != s.Epoch {
		return InstallationState{}, ErrInvalid
	}
	a := operatorPublication(current, ids, runtimeAdmission)
	if ctx.Err() != nil {
		return InstallationState{}, ctx.Err()
	}
	if e = replace(fd, "allowlist.json", marshal(a)); e != nil {
		return InstallationState{}, e
	}
	return installationAt(ctx, fd, owner)
}

// MaintenanceIdentities exposes verified committed native identities to the
// deliberate root operator. It never creates/restores an account or socket and
// includes revoked bindings: their native services can still consume a runtime.
func MaintenanceIdentities(ctx context.Context) ([]ExecutorIdentity, error) {
	if os.Geteuid() != 0 {
		return nil, ErrInvalid
	}
	fd, e := lockedDir(ctx, brokerState, 0)
	if e != nil {
		return nil, e
	}
	defer unix.Close(fd)
	state, e := installationAt(ctx, fd, 0)
	if e != nil {
		return nil, e
	}
	_, ledger, _, _, e := stateAt(ctx, fd, 0)
	if e != nil {
		return nil, e
	}
	executor := NewLinuxHostExecutor(state.Policy.GatewayUID, state.Policy.GatewayGID)
	ids := []ExecutorIdentity{}
	for _, b := range ledger.Bindings {
		i := ExecutorIdentity{provider: "github", id: b.ID, username: b.Username, uid: b.UID}
		if e = executor.persistentIdentity(ctx, i); e != nil {
			return nil, e
		}
		ids = append(ids, i)
	}
	return ids, nil
}
