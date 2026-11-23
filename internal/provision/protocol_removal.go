package provision

import (
	"encoding/json"
	"time"
)

// Removing a person (ADR 0037). One administrator request schedules the
// removal of a committed binding: the broker withdraws the person, records
// a removal entry and closes them out of the host at once (stage 1). At the
// due time the broker itself deletes what the person owns on the host and
// drops the binding (stage 2). Between the two the administrator may cancel.
const (
	OpRemovalSchedule = "removal_schedule"
	OpRemovalCancel   = "removal_cancel"
)

// When a scheduled removal deletes the data: after the fixed grace period or
// at once. The broker computes the due time; a request never carries one.
const (
	RemovalNow   = "now"
	RemovalGrace = "grace"
)

// RemovalGracePeriod is the fixed grace period (Jari, 2026-11-21).
const RemovalGracePeriod = 14 * 24 * time.Hour

// Removal stages. closing: the entry is committed and the close-out has not
// yet been confirmed; closed: nothing of the person runs, the home waits for
// the due time; removing: the data stage has begun and can no longer be
// cancelled.
const (
	RemovalClosing  = "closing"
	RemovalClosed   = "closed"
	RemovalRemoving = "removing"
)

// Fixed reasons a removal is held. They name what the operator inspects,
// never a path, process or command output.
const (
	RemovalCloseFailed = "close_failed"
	RemovalAdmitted    = "admitted"
	RemovalHomeUnsafe  = "home_unsafe"
	RemovalFilesRemain = "files_remain"
	RemovalStepFailed  = "step_failed"
)

// Removal failures: the subject's binding carries a removal entry, so
// ensure, authorize, restore and quota changes are refused; or the data
// stage has begun and a cancel can no longer stop it.
const (
	RemovalPending Failure = "removal_pending"
	RemovalStarted Failure = "removal_started"
)

// RemovalState is what an access row says about a scheduled removal.
type RemovalState struct {
	Stage  string `json:"stage"`
	Due    string `json:"due"`
	Actor  string `json:"actor"`
	At     string `json:"at"`
	Reason string `json:"reason,omitempty"`
}

func removalOperation(op string) bool { return op == OpRemovalSchedule || op == OpRemovalCancel }

func removalStage(s string) bool {
	return s == RemovalClosing || s == RemovalClosed || s == RemovalRemoving
}

func removalReason(s string) bool {
	switch s {
	case "", RemovalCloseFailed, RemovalAdmitted, RemovalHomeUnsafe, RemovalFilesRemain, RemovalStepFailed:
		return true
	}
	return false
}

func validRemovalState(x RemovalState, raw json.RawMessage) bool {
	var fields map[string]json.RawMessage
	if json.Unmarshal(raw, &fields) != nil {
		return false
	}
	for k := range fields {
		if k != "stage" && k != "due" && k != "actor" && k != "at" && k != "reason" {
			return false
		}
	}
	if _, ok := fields["reason"]; ok && x.Reason == "" {
		return false
	}
	return removalStage(x.Stage) && validStamp(x.Due) && validActor(x.Actor) && validStamp(x.At) && removalReason(x.Reason)
}

// parseRemovalRequest checks a removal request. Schedule carries the
// person's login hint, kept on the withdrawn entry the removal leaves, and
// the timing; cancel only the subject and actor.
func parseRemovalRequest(raw map[string]json.RawMessage, r Request) (Request, error) {
	present := func(k string) bool { _, ok := raw[k]; return ok }
	if r.Version != 1 || r.Provider != "github" || !numericID(r.ID) || !validActor(r.Actor) || present("candidate") || present("default_limit_bytes") || present("limit_bytes") || present("slug") || present("teams") {
		return Request{}, ErrInvalid
	}
	switch r.Operation {
	case OpRemovalSchedule:
		if !githubLogin(r.LoginHint) || r.When != RemovalNow && r.When != RemovalGrace {
			return Request{}, ErrInvalid
		}
	case OpRemovalCancel:
		if present("login_hint") || present("when") {
			return Request{}, ErrInvalid
		}
	default:
		return Request{}, ErrInvalid
	}
	return r, nil
}
