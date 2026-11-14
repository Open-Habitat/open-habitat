//go:build linux

package daemon

import (
	"time"

	"github.com/open-habitat/open-habitat/internal/livelimits"
)

// Live children are never evicted, so the records hold the highest limit
// and the reserved background place (background_linux.go).
const maxConversationRecords = livelimits.Max + 1

// makeRecordRoom holds c.mu. Keep recent receipts for lost-request lookup,
// evicting only under pressure. Native history and browser ownership survive
// eviction; held input and in-flight starts do not, so they must stay resident.
func (c *ConversationController) makeRecordRoom() bool {
	now := time.Now()
	for len(c.sessions) >= maxConversationRecords {
		var oldest *conversation
		for _, s := range c.sessions {
			if !s.dead || liveChild(s) || (s.state != "stopped" && s.state != "start_failed") || len(s.held) > 0 || s.bash.active() || s.naming || s.recapping || s.waking {
				continue
			}
			// The wake scanner still owes this rest a native wait check. It
			// scans resident handles, so eviction would silently cancel it.
			if s.state == "stopped" && !s.waitChecked && s.stopCause != "person" {
				rest, _, resting := c.restOf(s)
				if resting && rest.cause != "person" && now.Sub(rest.at) <= wakeHorizon {
					continue
				}
			}
			if oldest == nil || s.stoppedAt.Before(oldest.stoppedAt) || (s.stoppedAt.Equal(oldest.stoppedAt) && s.id < oldest.id) {
				oldest = s
			}
		}
		if oldest == nil {
			return false
		}
		oldest.recordEvicted = true
		delete(c.sessions, oldest.id)
	}
	return true
}

// admissionProblem checks a new child's two independent bounds under c.mu.
func (c *ConversationController) admissionProblem() string {
	if c.closed || c.liveCount() >= c.liveLimit() {
		return "capacity_exceeded"
	}
	if !c.makeRecordRoom() {
		return "session_records_exhausted"
	}
	return ""
}
