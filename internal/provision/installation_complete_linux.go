//go:build linux

package provision

import (
	"bytes"
	"context"
	"golang.org/x/sys/unix"
	"os"
	"sort"
)

// CompleteBrokerInitialization publishes only a fully written, exact initial
// transaction. It never fills in, resets or rewrites a partial stage, nor touches
// an occupied broker. The host operator must hold its same-input apply fence.
func CompleteBrokerInitialization(ctx context.Context, p Initialization, ids []string) error {
	if os.Geteuid() != 0 {
		return ErrInvalid
	}
	return completeBrokerInitialization(ctx, "/var/lib/open-habitat", p, ids, 0)
}
func completeBrokerInitialization(ctx context.Context, parent string, p Initialization, ids []string, owner uint32) error {
	cfg := initializationConfig(p)
	if _, e := parseBrokerConfig(marshal(cfg)); e != nil || !validAdmission(ids) {
		return ErrInvalid
	}
	fd, e := lockedDir(ctx, parent, owner)
	if e != nil {
		return e
	}
	defer unix.Close(fd)
	if !absent(fd, "broker") {
		return ErrInvalid
	}
	sf, e := unix.Openat(fd, ".broker-initialize", unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if e != nil {
		return ErrInvalid
	}
	defer unix.Close(sf)
	var st unix.Stat_t
	if unix.Fstat(sf, &st) != nil || st.Uid != owner || st.Mode&0077 != 0 {
		return ErrInvalid
	}
	copyFD, e := unix.Dup(sf)
	if e != nil {
		return e
	}
	dir := os.NewFile(uintptr(copyFD), "stage")
	names, e := dir.Readdirnames(-1)
	dir.Close()
	if e != nil || len(names) != 4 {
		return ErrInvalid
	}
	sorted := append([]string{}, ids...)
	sort.Strings(sorted)
	a := allowFile{Version: 1, Epoch: 1, IDs: []allowed{}}
	for _, id := range sorted {
		a.IDs = append(a.IDs, allowed{ID: id})
	}
	files := map[string]any{"broker.json": cfg, "allowlist.json": a, "bindings.json": ledgerFile{Version: 1, Generation: 1, Bindings: []binding{}}, "head.json": head{Version: 1, Epoch: 1, Generation: 1}}
	for _, name := range names {
		want, ok := files[name]
		if !ok {
			return ErrInvalid
		}
		b, e := readAt(sf, name, owner)
		if e != nil || !bytes.Equal(b, marshal(want)) {
			return ErrInvalid
		}
	}
	if ctx.Err() != nil {
		return ctx.Err()
	}
	if e = durable(sf); e != nil {
		return e
	}
	if e = unix.Renameat2(fd, ".broker-initialize", fd, "broker", unix.RENAME_NOREPLACE); e != nil {
		return e
	}
	return durable(fd)
}
