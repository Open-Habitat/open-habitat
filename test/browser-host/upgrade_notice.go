package main

import (
	"os"
	"strings"
	"sync"
	"time"

	"github.com/open-habitat/open-habitat/internal/upgradenotice"
)

// The synthetic host's upgrade record, as root's host upgrade would publish
// it for every daemon (internal/upgradenotice).
type fixtureUpgrade struct {
	mu     sync.Mutex
	rec    *upgradenotice.Record
	status string
}

var upgradeFixture = &fixtureUpgrade{}

func (f *fixtureUpgrade) set(status string, lead time.Duration) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	now := time.Now().UTC()
	switch status {
	case "clear":
		f.rec, f.status = nil, ""
		return true
	case "countdown":
		if lead < 0 || lead > upgradenotice.MaxLead {
			return false
		}
		f.rec = &upgradenotice.Record{SchemaVersion: 1, ScheduleID: strings.Repeat("e", 32), Revision: 1, TargetVersion: "0.9.0", AnnouncedAt: now, Deadline: now.Add(lead), State: upgradenotice.Announced, RenewedAt: now}
	case "withdrawn", "unknown":
		if f.rec == nil {
			return false
		}
		if status == "withdrawn" {
			f.rec.State, f.rec.RenewedAt = upgradenotice.Withdrawn, now
		}
	default:
		return false
	}
	f.status = status
	return true
}

func (f *fixtureUpgrade) read() (upgradenotice.Record, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.rec == nil {
		return upgradenotice.Record{}, os.ErrNotExist
	}
	r := *f.rec
	switch f.status {
	case "countdown":
		r.RenewedAt = time.Now().UTC() // a live owner
	case "unknown":
		r.RenewedAt = time.Now().UTC().Add(-2 * upgradenotice.LivenessWindow)
		if r.AnnouncedAt.After(r.RenewedAt) {
			r.AnnouncedAt = r.RenewedAt
		}
	}
	return r, nil
}
