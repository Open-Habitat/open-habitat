//go:build linux

package daemon

import (
	"regexp"
	"strconv"
	"time"
)

// A named support worker (Jari 2026-11-06, design-named-workers) is a
// Taskfleet resident run: it works in rounds, ends each with a told round
// report, and its process exits while its worktree, branch and native session
// stay until the parent's next message resumes it. Taskfleet owns all of
// that, and also landing and teardown (its ADR 0003); Habitat only reads the
// `resident` object `run list` and `run show` carry and shows it. Nothing
// here is inferred from activity or a quiet period: the round state is
// Taskfleet's own told word.
//
// When the parent's Pi stops, the helpers keep waiting and their next round
// report wakes it like a settled run (catchUpLive, wake_linux.go). Archiving
// the parent hides its helpers with it and restoring brings them back
// unstarted, because they belong to it by Taskfleet's creator session (Jari
// 2026-11-08); Habitat keeps no store of its own for them.

var residentNamePattern = regexp.MustCompile(`^[a-z][a-z0-9-]{0,47}$`)

// taskfleetResident is Taskfleet's read view of a resident run.
type taskfleetResident struct {
	Name              string `json:"name"`
	RoundState        string `json:"round_state"`
	RoundsReported    int    `json:"rounds_reported"`
	ExpiryAttentionAt string `json:"expiry_attention_at"`
	LastRound         *struct {
		Round      int    `json:"round"`
		ReportedAt string `json:"reported_at"`
		Summary    string `json:"summary"`
		Open       bool   `json:"open"`
	} `json:"last_round"`
	LastLanding *struct {
		Round int `json:"round"`
	} `json:"last_landing"`
}

// spinoffResident is the panel's projection of a resident run.
type spinoffResident struct {
	Name       string `json:"name"`
	RoundState string `json:"round_state"`
	Rounds     int    `json:"rounds"`
	Report     string `json:"report,omitempty"`
	ReportedAt string `json:"reported_at,omitempty"`
	// The latest round Taskfleet landed into the source branch.
	LandedRound int `json:"landed_round,omitempty"`
	// Idle expiry found work not yet landed and kept it on the branch.
	Unlanded bool `json:"unlanded,omitempty"`
}

// resident is the run's resident view when Taskfleet's word for it is one
// Habitat knows; anything else reads as an ordinary run.
func (r nativeSpinoff) resident() *taskfleetResident {
	v := r.Resident
	if v == nil || !residentNamePattern.MatchString(v.Name) || v.RoundsReported < 0 {
		return nil
	}
	switch v.RoundState {
	case "working", "waiting", "dormant":
		return v
	}
	return nil
}

// residentBetweenRounds says the run is a live resident whose round is
// reported and that waits for its parent's next message (also dormant, when
// idle expiry removed its fully landed worktree). Its `run wait` has
// returned, so it neither works on its own nor needs anyone but its parent.
func residentBetweenRounds(r nativeSpinoff) bool {
	v := r.resident()
	return v != nil && (r.Status == "pending" || r.Status == "running") && v.RoundState != "working"
}

// openRound is the reported round the parent has not yet answered, or 0.
func openRound(r nativeSpinoff) int {
	v := r.resident()
	if !residentBetweenRounds(r) || v.LastRound == nil || !v.LastRound.Open || v.LastRound.Round < 1 {
		return 0
	}
	return v.LastRound.Round
}

func residentRow(r nativeSpinoff) *spinoffResident {
	v := r.resident()
	if v == nil {
		return nil
	}
	row := &spinoffResident{Name: v.Name, RoundState: v.RoundState, Rounds: min(v.RoundsReported, 100000), Unlanded: v.ExpiryAttentionAt != ""}
	if v.LastRound != nil {
		row.Report = prefixBytes(v.LastRound.Summary, 2000)
		row.ReportedAt = nativeTimestamp(v.LastRound.ReportedAt)
	}
	if v.LastLanding != nil && v.LastLanding.Round > 0 {
		row.LandedRound = min(v.LastLanding.Round, 100000)
	}
	return row
}

// roundReportedAfter says the open round was reported after since (Unix ms).
func roundReportedAfter(r nativeSpinoff, since int64) bool {
	v := r.resident()
	if v == nil || v.LastRound == nil {
		return false
	}
	at, err := time.Parse(time.RFC3339Nano, v.LastRound.ReportedAt)
	return err == nil && at.UnixMilli() > since
}

// catchUpKey is how a catch-up records a run as told: each round report is
// news once, other states once per state.
func catchUpKey(id, state string, round int) string {
	if round > 0 {
		return id + ":" + state + ":" + strconv.Itoa(round)
	}
	return id + ":" + state
}

// resolveWaitOperands turns a wait's operands into run ids: a run id stays,
// and a named worker's name becomes the parent's own live resident run of
// that name, as Taskfleet resolved it when the wait started. A name that
// names none (its run has ended, or it is not this conversation's) is left
// out, so its wait is not the conversation's own.
func resolveWaitOperands(ops []string, runs []nativeSpinoff, parent string) []string {
	ids := make([]string, 0, len(ops))
	for _, op := range ops {
		if taskfleetIDPattern.MatchString(op) {
			ids = append(ids, op)
			continue
		}
		found := ""
		for _, r := range runs {
			v := r.resident()
			if v == nil || v.Name != op || r.Status != "pending" && r.Status != "running" || !belongsSpinoff(r, nativeSession{id: parent}) {
				continue
			}
			if found != "" {
				found = ""
				break
			}
			found = r.ID
		}
		if found != "" {
			ids = append(ids, found)
		}
	}
	return ids
}
