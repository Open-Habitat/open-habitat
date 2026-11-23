//go:build linux

package host

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"path/filepath"
	"sync"
	"time"

	"github.com/open-habitat/open-habitat/internal/upgradenotice"
	"golang.org/x/sys/unix"
)

// UpgradeAnnouncement is the countdown's part of an upgrade result, apart
// from the upgrade's own outcome: when the stop was announced to begin, which
// schedule the daemons saw, and how far the announcement reached.
type UpgradeAnnouncement struct {
	// Mode is "countdown" or "immediate" (--immediate: nothing announced).
	Mode        string `json:"mode"`
	LeadSeconds int    `json:"lead_seconds"`
	// State: "previewed" (dry run), "not_announced" (immediate, or this
	// invocation only staged), "announced" (the deadline came and the stop
	// began), "withdrawn" (cancelled or failed before the stop).
	State       string              `json:"state"`
	ScheduleID  string              `json:"schedule_id,omitempty"`
	Revision    int                 `json:"revision,omitempty"`
	AnnouncedAt string              `json:"announced_at,omitempty"`
	Deadline    string              `json:"deadline,omitempty"`
	Reach       *UpgradeNoticeReach `json:"reach,omitempty"`
}

// UpgradeNoticeReach sums the daemons' own reports at the deadline. A
// conversation not reached is never waited for.
type UpgradeNoticeReach struct {
	// Told: conversations whose agent got the announcement.
	Told int `json:"told"`
	// Held: idle conversations holding it for a turn that did not start.
	Held int `json:"held"`
	// NotDelivered: conversations whose Pi did not take it.
	NotDelivered int `json:"not_delivered"`
	// DaemonsUnreported: live daemons that reported nothing for this
	// schedule (a predecessor without the receiver, or no census).
	DaemonsUnreported int `json:"daemons_unreported"`
}

// upgradeNotice owns one published schedule for as long as the upgrade
// owner runs: it renews the record so readers know the owner lives, and
// withdraws or removes it when the owner returns.
type upgradeNotice struct {
	path  string
	owner uint32
	now   func() time.Time
	mu    sync.Mutex
	rec   upgradenotice.Record
	stop  chan struct{}
	done  chan struct{}
}

func newScheduleID() (string, error) {
	var b [16]byte
	if _, e := rand.Read(b[:]); e != nil {
		return "", e
	}
	return hex.EncodeToString(b[:]), nil
}

// publishUpgradeNotice writes the record readable by everyone, as root's
// file in root's directory. A stale stage is advisory and simply replaced.
func publishUpgradeNotice(path string, owner uint32, r upgradenotice.Record) error {
	b, e := upgradenotice.Encode(r)
	if e != nil {
		return e
	}
	fd, e := openDir(filepath.Dir(path), owner, false)
	if e != nil {
		return e
	}
	defer unix.Close(fd)
	if e = unix.Unlinkat(fd, filepath.Base(path)+".next", 0); e != nil && e != unix.ENOENT {
		return e
	}
	return replaceAtMode(fd, filepath.Base(path), b, 0644)
}

func removeUpgradeNotice(path string, owner uint32) error {
	fd, e := openDir(filepath.Dir(path), owner, false)
	if e != nil {
		return e
	}
	defer unix.Close(fd)
	for _, name := range []string{filepath.Base(path) + ".next", filepath.Base(path)} {
		if e = unix.Unlinkat(fd, name, 0); e != nil && e != unix.ENOENT {
			return e
		}
	}
	return unix.Fsync(fd)
}

func announceUpgrade(path string, owner uint32, now func() time.Time, target string, lead time.Duration) (*upgradeNotice, error) {
	id, e := newScheduleID()
	if e != nil {
		return nil, e
	}
	at := now().UTC()
	n := &upgradeNotice{path: path, owner: owner, now: now, stop: make(chan struct{}), done: make(chan struct{}),
		rec: upgradenotice.Record{SchemaVersion: 1, ScheduleID: id, Revision: 1, TargetVersion: target, AnnouncedAt: at, Deadline: at.Add(lead), State: upgradenotice.Announced, RenewedAt: at}}
	if e = publishUpgradeNotice(path, owner, n.rec); e != nil {
		_ = removeUpgradeNotice(path, owner)
		return nil, e
	}
	go n.renew()
	return n, nil
}

func (n *upgradeNotice) renew() {
	defer close(n.done)
	t := time.NewTicker(upgradenotice.RenewInterval)
	defer t.Stop()
	for {
		select {
		case <-n.stop:
			return
		case <-t.C:
			n.mu.Lock()
			n.rec.RenewedAt = n.now().UTC()
			// A failed renewal reads as a lost owner, which is safe.
			_ = publishUpgradeNotice(n.path, n.owner, n.rec)
			n.mu.Unlock()
		}
	}
}

func (n *upgradeNotice) halt() {
	select {
	case <-n.stop:
	default:
		close(n.stop)
	}
	<-n.done
}

// withdraw cancels the schedule before the stop: the daemons tell their
// browsers the update was cancelled. Its deadline is never reused.
func (n *upgradeNotice) withdraw() error {
	n.halt()
	n.mu.Lock()
	defer n.mu.Unlock()
	n.rec.State, n.rec.RenewedAt = upgradenotice.Withdrawn, n.now().UTC()
	return publishUpgradeNotice(n.path, n.owner, n.rec)
}

// finish removes the record once the stop has begun: the daemons that read
// it next are the restarted ones, for whom nothing is scheduled.
func (n *upgradeNotice) finish() error {
	n.halt()
	return removeUpgradeNotice(n.path, n.owner)
}

func (n *upgradeNotice) view(lead time.Duration) *UpgradeAnnouncement {
	return &UpgradeAnnouncement{Mode: "countdown", LeadSeconds: int(lead / time.Second), State: "announced", ScheduleID: n.rec.ScheduleID, Revision: n.rec.Revision, AnnouncedAt: n.rec.AnnouncedAt.Format(time.RFC3339), Deadline: n.rec.Deadline.Format(time.RFC3339)}
}

// waitDeadline counts down on the monotonic clock: a wall-clock change moves
// neither the stop nor the published UTC deadline.
func waitDeadline(ctx context.Context, lead time.Duration) error {
	t := time.NewTimer(lead)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-t.C:
		return nil
	}
}

// noticeReach sums the daemons' reports for this schedule from the plan's
// work census.
func noticeReach(work []upgradeUser, key string) *UpgradeNoticeReach {
	r := &UpgradeNoticeReach{}
	for _, u := range work {
		if !u.Daemon {
			continue
		}
		if u.Notice == nil || u.Notice.Key != key {
			r.DaemonsUnreported++
			continue
		}
		r.Told += u.Notice.Told
		r.Held += u.Notice.Held
		r.NotDelivered += u.Notice.NotDelivered
	}
	return r
}
