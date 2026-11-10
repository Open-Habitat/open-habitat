//go:build linux

package provision

import (
	"context"
	"path/filepath"
	"sort"

	"golang.org/x/sys/unix"

	"github.com/open-habitat/open-habitat/internal/livelimits"
)

// The broker's own staging name for the live-limits file.
const liveLimitsStage = ".live-limits.json.broker"

func (w Writer) liveLimitsPath() string {
	if w.LiveLimitsFile != "" {
		return w.LiveLimitsFile
	}
	return livelimits.Path
}

// handleLiveLimits serves the three live-limit operations under the broker's
// directory lock, which also serializes the writes. A person is named by
// provider subject and resolved through the committed ledger to its UID,
// the only key the file and the person's daemon know; an exception whose UID
// no committed binding has is not listed, and a change drops it. The broker
// is the file's only writer and creates it on the first change. The rename
// is the commit point; a failure after it is reported as unavailable, which
// the gateway treats as uncertain.
func (w Writer) handleLiveLimits(ctx context.Context, r Request) Reply {
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
	_, ledger, _, _, e := stateAt(ctx, fd, w.owner)
	if e != nil {
		return failure(StateUnavailable)
	}
	uidOf := map[string]uint32{}
	idOf := map[uint32]string{}
	for _, b := range ledger.Bindings {
		if b.UID < w.UIDMin || b.UID > w.UIDMax {
			continue
		}
		uidOf[b.ID], idOf[b.UID] = b.UID, b.ID
	}
	path := w.liveLimitsPath()
	dir, e := trustedParent(path, w.owner)
	if e != nil {
		return failure(StateUnavailable)
	}
	defer unix.Close(dir)
	raw, e := readRootFile(dir, filepath.Base(path), w.owner, livelimits.MaxFile)
	if e != nil {
		return failure(StateUnavailable)
	}
	file := livelimits.File{People: map[uint32]int{}}
	if raw != nil {
		if file, e = livelimits.Parse(raw); e != nil {
			return failure(StateUnavailable)
		}
	}
	page := func(f livelimits.File) Reply {
		p := &LiveLimitPage{Default: f.Default, People: []LiveLimitPerson{}}
		for uid, n := range f.People {
			if id, ok := idOf[uid]; ok {
				p.People = append(p.People, LiveLimitPerson{ID: id, Limit: n})
			}
		}
		sort.Slice(p.People, func(i, j int) bool { return p.People[i].ID < p.People[j].ID })
		reply := Reply{Version: 1, LiveLimits: p}
		if _, err := EncodeReply(reply); err != nil {
			return failure(StateUnavailable)
		}
		return reply
	}
	if r.Operation == OpLiveLimitList {
		return page(file)
	}
	// A change also drops exceptions no committed binding owns.
	next := livelimits.File{Default: file.Default, People: map[uint32]int{}}
	for uid, n := range file.People {
		if _, ok := idOf[uid]; ok {
			next.People[uid] = n
		}
	}
	if r.ID == "0" {
		next.Default = 0
		if r.Operation == OpLiveLimitSet {
			next.Default = *r.LiveLimit
		}
	} else {
		uid, ok := uidOf[r.ID]
		if !ok {
			return failure(Denied)
		}
		delete(next.People, uid)
		if r.Operation == OpLiveLimitSet {
			next.People[uid] = *r.LiveLimit
		}
	}
	b, e := livelimits.Encode(next)
	if e != nil {
		// Only more exceptions than the file holds can fail here.
		return failure(Invalid)
	}
	if ctx.Err() != nil {
		return failure(StateUnavailable)
	}
	if string(b) != string(raw) {
		if publishRootFile(dir, liveLimitsStage, filepath.Base(path), b) != nil {
			return failure(StateUnavailable)
		}
	}
	return page(next)
}
