//go:build linux

package provision

import (
	"context"
	"os"
	"path/filepath"

	"github.com/Open-Habitat/open-habitat/internal/storagequota"
	"golang.org/x/sys/unix"
)

// CheckActivation is a fixed-path, root-only systemd precondition. The broker
// owns the ledger parser and the only cold-runtime reconstruction. It never
// creates accounts, changes committed bindings, or starts a service here.
func CheckActivation(ctx context.Context, name string) error {
	if os.Geteuid() != 0 || ctx == nil || !username(name) {
		return ErrInvalid
	}
	fd, err := lockedDir(ctx, brokerState, 0)
	if err != nil {
		return ErrInvalid
	}
	defer unix.Close(fd)
	defer unix.Flock(fd, unix.LOCK_UN)
	cfg, i, err := activationAt(ctx, fd, 0, name)
	if err != nil {
		return ErrInvalid
	}
	e := NewLinuxHostExecutor(cfg.GatewayUID, cfg.GatewayGID)
	if storagequota.Enabled() != nil {
		return ErrInvalid
	}
	q, err := (nativeQuota{}).Read(i.uid)
	if err != nil || !validLimit(q.Limit) {
		return ErrInvalid
	}
	return e.startupIdentity(ctx, i, true)
}

// Read from the locked inode; pending/staging state, rollback, admission and
// pool membership must all be established before any runtime-directory write.
func activationAt(ctx context.Context, fd int, owner uint32, name string) (brokerConfig, ExecutorIdentity, error) {
	var cfg brokerConfig
	var i ExecutorIdentity
	for _, n := range []string{"pending.json", "pending.json.next", "bindings.json.next", "head.json.next", "allowlist.json.next"} {
		if !absent(fd, n) {
			return cfg, i, ErrInvalid
		}
	}
	cb, err := readAt(fd, "broker.json", owner)
	if err != nil {
		return cfg, i, ErrInvalid
	}
	cfg, err = parseBrokerConfig(cb)
	if err != nil {
		return cfg, i, ErrInvalid
	}
	a, l, _, _, err := stateAt(ctx, fd, owner)
	if err != nil {
		return cfg, i, ErrInvalid
	}
	hb, err := readAt(fd, "head.json", owner)
	var h head
	if err != nil || decode(hb, &h, "version", "epoch", "generation") != nil || h.Version != 1 || h.Epoch == 0 || h.Epoch > a.Epoch || h.Generation != l.Generation {
		return cfg, i, ErrInvalid
	}
	for _, b := range l.Bindings {
		if b.UID < cfg.UIDMin || b.UID > cfg.UIDMax {
			return cfg, i, ErrInvalid
		}
		if b.Username != name {
			continue
		}
		admitted := cfg.Admission == "any"
		for _, entry := range a.IDs {
			if entry.ID == b.ID {
				admitted = true
			}
		}
		if !admitted {
			return cfg, i, ErrInvalid
		}
		i = ExecutorIdentity{provider: "github", id: b.ID, username: b.Username, uid: b.UID}
	}
	if i.username == "" {
		return cfg, i, ErrInvalid
	}
	return cfg, i, nil
}

func (e *LinuxHostExecutor) startupIdentity(ctx context.Context, i ExecutorIdentity, admitted bool) error {
	if err := e.persistentIdentity(ctx, i); err != nil {
		return err
	}
	// Revocation preserves native identity, but must never restore search ACLs
	// or activate listeners. There may be no per-user runtime directory at all.
	if !admitted {
		return e.unit(ctx, i, true)
	}
	missing, err := missing(filepath.Join(socketBase, i.username))
	if err != nil {
		return ErrInvalid
	}
	if missing {
		if err = e.prepareSocket(ctx, i); err != nil {
			return err
		}
	}
	// Existing objects are verified, never chmodded or repaired. Partial or
	// foreign reconstruction is deliberately left closed for diagnosis.
	if err = e.socket(ctx, i); err != nil {
		return err
	}
	return e.unit(ctx, i, true)
}
