package nativeforge

import (
	"strings"
	"sync"
)

// Outcome is what a lifecycle call observed or did.
type Outcome string

const (
	// Written: the native file now holds the change.
	Written Outcome = "written"
	// Unchanged: the file already held the requested state, which is how a
	// repeated request after a lost reply is observed rather than replayed.
	Unchanged Outcome = "unchanged"
	// Absent: the entry to remove was already gone.
	Absent Outcome = "absent"
)

// Holds marks logins used by an active daemon job, so a removal is refused
// meanwhile. It is in-memory daemon state about the daemon's own jobs, not a
// record of connections. Keys compare case-insensitively.
type Holds struct {
	mu       sync.Mutex
	holds    map[string]int
	removing map[string]bool
}

// Hold marks key as used until release is called. It is refused while key
// is being removed.
func (h *Holds) Hold(key string) (release func(), err error) {
	key = strings.ToLower(key)
	h.mu.Lock()
	defer h.mu.Unlock()
	if key == "" || h.removing[key] {
		return nil, ErrInUse
	}
	if h.holds == nil {
		h.holds = map[string]int{}
	}
	h.holds[key]++
	done := false
	return func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		if !done {
			done = true
			if h.holds[key]--; h.holds[key] <= 0 {
				delete(h.holds, key)
			}
		}
	}, nil
}

// Removing marks key as being removed until end is called. It is refused
// while key is held or already being removed.
func (h *Holds) Removing(key string) (end func(), err error) {
	key = strings.ToLower(key)
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.holds[key] > 0 || h.removing[key] {
		return nil, ErrInUse
	}
	if h.removing == nil {
		h.removing = map[string]bool{}
	}
	h.removing[key] = true
	return func() {
		h.mu.Lock()
		delete(h.removing, key)
		h.mu.Unlock()
	}, nil
}
