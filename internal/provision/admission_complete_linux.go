//go:build linux

package provision

import (
	"bytes"
	"context"
	"golang.org/x/sys/unix"
	"os"
)

// CompleteAdmissionPublication finishes only a fully durable same-input root
// admission stage. The operator must retain closed entry points and the same
// approved apply fence proving revocation preceded staging. This never writes
// bindings, a pending account transaction or the broker's observed head.
// A staging file the broker's own admit or withdraw left behind never matches
// this site's operator publication, so it stays closed for the operator.
func CompleteAdmissionPublication(ctx context.Context, p Initialization, ids []string, runtimeAdmission bool) error {
	if os.Geteuid() != 0 {
		return ErrInvalid
	}
	return completeAdmissionPublication(ctx, brokerState, p, ids, runtimeAdmission, 0)
}
func completeAdmissionPublication(ctx context.Context, dir string, p Initialization, ids []string, runtimeAdmission bool, owner uint32) error {
	if !validAdmission(ids) {
		return ErrInvalid
	}
	fd, e := lockedDir(ctx, dir, owner)
	if e != nil {
		return e
	}
	defer unix.Close(fd)
	for _, name := range []string{"pending.json", "pending.json.next", "bindings.json.next", "head.json.next"} {
		if !absent(fd, name) {
			return ErrInvalid
		}
	}
	cb, e := readAt(fd, "broker.json", owner)
	if e != nil {
		return e
	}
	cfg, e := parseBrokerConfig(cb)
	if e != nil || cfg != initializationConfig(p) {
		return ErrInvalid
	}
	a, l, _, _, e := stateAt(ctx, fd, owner)
	if e != nil || a.Epoch == ^uint64(0) {
		return ErrInvalid
	}
	hb, e := readAt(fd, "head.json", owner)
	var h head
	if e != nil || decode(hb, &h, "version", "epoch", "generation") != nil || h.Version != 1 || h.Epoch != a.Epoch || h.Generation != l.Generation {
		return ErrInvalid
	}
	bound := map[string]bool{}
	for _, b := range l.Bindings {
		bound[b.ID] = true
	}
	next := operatorPublication(a, ids, runtimeAdmission, bound)
	staged, e := readAt(fd, "allowlist.json.next", owner)
	if e != nil || !bytes.Equal(staged, marshal(next)) {
		return ErrInvalid
	}
	if ctx.Err() != nil {
		return ctx.Err()
	}
	if e = unix.Renameat(fd, "allowlist.json.next", fd, "allowlist.json"); e != nil {
		return e
	}
	return durable(fd)
}
