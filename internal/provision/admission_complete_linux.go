//go:build linux

package provision

import (
	"bytes"
	"context"
	"golang.org/x/sys/unix"
	"os"
	"sort"
)

// CompleteAdmissionPublication finishes only a fully durable same-input root
// admission stage. The operator must retain closed entry points and the same
// approved apply fence proving revocation preceded staging. This never writes
// bindings, a pending account transaction or the broker's observed head.
func CompleteAdmissionPublication(ctx context.Context, p Initialization, ids []string) error {
	if os.Geteuid() != 0 {
		return ErrInvalid
	}
	return completeAdmissionPublication(ctx, brokerState, p, ids, 0)
}
func completeAdmissionPublication(ctx context.Context, dir string, p Initialization, ids []string, owner uint32) error {
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
	wanted := append([]string{}, ids...)
	sort.Strings(wanted)
	next := allowFile{Version: 1, Epoch: a.Epoch + 1, IDs: []allowed{}}
	for _, id := range wanted {
		next.IDs = append(next.IDs, allowed{ID: id})
	}
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
