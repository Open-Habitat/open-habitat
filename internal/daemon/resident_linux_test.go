//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

// residentRun is a live Taskfleet resident run as `run list` / `run show`
// carry it (Taskfleet ADR 0003), created by the given parent session.
func residentRun(id, parent, roundState string, round int, open bool) nativeSpinoff {
	r := nativeSpinoff{ID: id, Kind: "spinoff", Title: "Prototyyppikierrokset", Status: "running", SourceRepo: "/w", AgentOwner: "taskfleet", CreatedAt: "2030-01-01T00:00:00Z"}
	r.Creator = &struct {
		Harness   string `json:"harness"`
		SessionID string `json:"session_id"`
	}{"pi", parent}
	r.Supervisor.State = "alive"
	v := &taskfleetResident{Name: "proto-m365", RoundState: roundState, RoundsReported: round}
	if round > 0 {
		v.LastRound = &struct {
			Round      int    `json:"round"`
			ReportedAt string `json:"reported_at"`
			Summary    string `json:"summary"`
			Open       bool   `json:"open"`
		}{round, "2030-01-01T00:20:00Z", "Kierros valmis: kolme riffiä, suositus A1.", open}
	}
	r.Resident = v
	return r
}

// Jari 2026-11-06: a named worker shows Taskfleet's round state, never Pi's
// "waiting at its terminal". Waiting and dormant wait for the main agent;
// a round under way works; an ended resident ends like any run.
func TestResidentRoundStateInThePanel(t *testing.T) {
	parent := "aaaaaaaa-0000-4000-8000-00000000000a"
	waiting := residentRun(wakeRun, parent, "waiting", 2, true)
	if got := spinoffState(waiting); got != "waiting_parent" {
		t.Fatalf("waiting resident: %q", got)
	}
	// Its exited Pi's last reply would read idle; Taskfleet's word wins.
	if got, awaiting := liveWorkerState(nil, os.Getuid(), waiting, time.Now()); got != "waiting_parent" || awaiting {
		t.Fatalf("live state %q %v", got, awaiting)
	}
	row := residentRow(waiting)
	if row == nil || row.Name != "proto-m365" || row.RoundState != "waiting" || row.Rounds != 2 || row.Report == "" || row.ReportedAt != "2030-01-01T00:20:00Z" || row.Unlanded {
		t.Fatalf("row %+v", row)
	}
	dormant := residentRun(wakeRun, parent, "dormant", 2, true)
	dormant.Resident.LastLanding = &struct {
		Round int `json:"round"`
	}{2}
	if spinoffState(dormant) != "waiting_parent" || residentRow(dormant).LandedRound != 2 {
		t.Fatal("dormant resident")
	}
	// Idle expiry kept unlanded work and raised attention: still waiting for
	// the main agent, and the row says the work is on the branch.
	kept := residentRun(wakeRun, parent, "waiting", 3, true)
	kept.Attention = true
	kept.Resident.ExpiryAttentionAt = "2030-01-02T00:20:00Z"
	if spinoffState(kept) != "waiting_parent" || !residentRow(kept).Unlanded {
		t.Fatal("expiry attention")
	}
	working := residentRun(wakeRun, parent, "working", 2, false)
	if spinoffState(working) != "working" {
		t.Fatalf("working resident: %q", spinoffState(working))
	}
	// A dead supervisor is doubted whatever the round state says.
	doubted := residentRun(wakeRun, parent, "waiting", 2, true)
	doubted.Supervisor.State = "dead"
	if spinoffState(doubted) != "unknown" {
		t.Fatal("doubted supervisor shown as waiting")
	}
	ended := residentRun(wakeRun, parent, "waiting", 2, true)
	ended.Status, ended.Landed = "done", true
	if spinoffState(ended) != "merged" || residentBetweenRounds(ended) {
		t.Fatal("ended resident")
	}
	// A round state or name Habitat does not know reads as an ordinary run.
	for _, bad := range []func(*taskfleetResident){
		func(v *taskfleetResident) { v.RoundState = "sleeping" },
		func(v *taskfleetResident) { v.Name = "Proto" },
		func(v *taskfleetResident) { v.Name = "0m6" },
		func(v *taskfleetResident) { v.RoundsReported = -1 },
	} {
		r := residentRun(wakeRun, parent, "waiting", 2, true)
		bad(r.Resident)
		if residentRow(r) != nil || residentBetweenRounds(r) {
			t.Fatalf("unknown resident view accepted: %+v", r.Resident)
		}
	}
}

// A round report returns the parent's `run wait` (Taskfleet settles it at
// once), so a stopped conversation waiting on its named worker wakes on it;
// a round under way does not, nor does a --terminal wait. A waiting worker
// does not keep its parent's Pi from the idle stop either.
func TestNamedWorkersRoundReportSettlesTheWait(t *testing.T) {
	id := "aaaaaaaa-0000-4000-8000-00000000000a"
	wait := []branchProcess{{ID: "proc_0a1b", Command: "taskfleet run wait " + wakeRun + " --output json", Wakes: true}}
	terminal := []branchProcess{{ID: "proc_0a1b", Command: "taskfleet run wait " + wakeRun + " --terminal", Wakes: true}}
	waiting := residentRun(wakeRun, id, "waiting", 3, true)
	working := residentRun(wakeRun, id, "working", 2, false)
	if got := waitOutcome(wait, map[string]nativeSpinoff{wakeRun: waiting}, id); got != "settled" {
		t.Fatalf("round report: %q", got)
	}
	if got := waitOutcome(wait, map[string]nativeSpinoff{wakeRun: working}, id); got != "" {
		t.Fatalf("round under way: %q", got)
	}
	if got := waitOutcome(terminal, map[string]nativeSpinoff{wakeRun: waiting}, id); got != "" {
		t.Fatalf("--terminal: %q", got)
	}
	// Taskfleet resolves a named worker's name in `run wait`; so does the wake.
	named := []branchProcess{{ID: "proc_0a1b", Command: "taskfleet run wait proto-m365 --output json", Wakes: true}}
	namedTerminal := []branchProcess{{ID: "proc_0a1b", Command: "taskfleet run wait proto-m365 --terminal", Wakes: true}}
	if got := waitOutcome(named, map[string]nativeSpinoff{wakeRun: working}, id); got != "" {
		t.Fatalf("named wait, round under way: %q", got)
	}
	if got := waitOutcome(namedTerminal, map[string]nativeSpinoff{wakeRun: waiting}, id); got != "" {
		t.Fatalf("named --terminal wait on a round report: %q", got)
	}
	if got := waitOutcome(named, map[string]nativeSpinoff{wakeRun: waiting}, id); got != "settled" {
		t.Fatalf("named wait, round reported: %q", got)
	}
	// A name no live run of this conversation has: its run ended or is not
	// this conversation's, as for a foreign run id.
	if got := waitOutcome(named, map[string]nativeSpinoff{wakeRun: residentRun(wakeRun, "aaaaaaaa-0000-4000-8000-0000000000ff", "working", 2, false)}, id); got != "cut_off" {
		t.Fatalf("foreign name: %q", got)
	}
	if ownsLiveRun([]nativeSpinoff{waiting}, id) || !ownsLiveRun([]nativeSpinoff{working}, id) {
		t.Fatal("idle-stop rule")
	}
}

// The catch-up tells each round report once, by its round, in the worker's
// own words and with the name the parent messages it by.
func TestCatchUpTellsEachRoundOnce(t *testing.T) {
	id := "aaaaaaaa-0000-4000-8000-00000000000a"
	parent := nativeSession{id: id}
	waiting := residentRun(wakeRun, id, "waiting", 3, true)
	since := time.Date(2030, 1, 1, 0, 10, 0, 0, time.UTC).UnixMilli()
	read := func(reported map[string]bool, runs ...nativeSpinoff) ([]restRun, []restRun) {
		settled, working, _ := unreportedRuns(context.Background(), parent, since, map[string]bool{}, reported,
			func(context.Context) ([]nativeSpinoff, bool) { return runs, true },
			func(_ context.Context, run string) (nativeSpinoff, bool) {
				for _, r := range runs {
					if r.ID == run {
						return r, true
					}
				}
				return nativeSpinoff{}, false
			})
		return settled, working
	}
	settled, working := read(map[string]bool{}, waiting)
	if len(settled) != 1 || settled[0].State != "round_reported" || settled[0].Round != 3 || settled[0].Name != "proto-m365" || !strings.Contains(settled[0].Summary, "suositus A1") || len(working) != 0 {
		t.Fatalf("settled %+v working %+v", settled, working)
	}
	if settled, _ := read(map[string]bool{wakeRun + ":round_reported:3": true}, waiting); len(settled) != 0 {
		t.Fatalf("told round repeated: %+v", settled)
	}
	// The next round is news again, though an earlier one was told.
	next := residentRun(wakeRun, id, "waiting", 4, true)
	next.Resident.LastRound.ReportedAt = "2030-01-01T00:40:00Z"
	if settled, _ := read(map[string]bool{wakeRun + ":round_reported:3": true}, next); len(settled) != 1 || settled[0].Round != 4 {
		t.Fatalf("next round: %+v", settled)
	}
	// Answered or under way is no news; a round under way still works.
	answered := residentRun(wakeRun, id, "dormant", 3, false)
	if settled, _ := read(map[string]bool{}, answered); len(settled) != 0 {
		t.Fatalf("answered round told: %+v", settled)
	}
	if settled, working := read(map[string]bool{}, residentRun(wakeRun, id, "working", 3, false)); len(settled) != 0 || len(working) != 1 {
		t.Fatalf("round under way: %+v %+v", settled, working)
	}
	// A stall keeps Taskfleet's caveat and carries no round.
	stalled := residentRun(wakeRun, id, "waiting", 3, true)
	stalled.Stalled = true
	if settled, _ := read(map[string]bool{}, stalled); len(settled) != 1 || settled[0].State != "stalled" || settled[0].Round != 0 || settled[0].Name != "" {
		t.Fatalf("stalled resident: %+v", settled)
	}
	// A report older than the branch is not news unless it was waited for.
	old := residentRun(wakeRun, id, "waiting", 3, true)
	old.Resident.LastRound.ReportedAt = "2030-01-01T00:05:00Z"
	if settled, _ := read(map[string]bool{}, old); len(settled) != 0 {
		t.Fatalf("old round told: %+v", settled)
	}
}

// The catch-up's round report becomes the person's notice in history; one
// without its round or worker name is left out.
func TestRestartNoticeCarriesTheRoundReport(t *testing.T) {
	entry := func(spinoff map[string]any) *restartNotice {
		details, _ := json.Marshal(map[string]any{"customType": catchUpMessageType, "display": true, "details": map[string]any{"processes": []any{}, "spinoffs": []any{spinoff}}})
		h, ok := nativeRestart(nativeEntry{ID: "e1", Type: "custom_message", Timestamp: "2030-01-01T00:30:00Z", Raw: details})
		if !ok || h.Restart == nil {
			t.Fatal("catch-up not read")
		}
		return h.Restart
	}
	n := entry(map[string]any{"run_id": wakeRun, "state": "round_reported", "title": "t", "round": 3, "name": "proto-m365", "summary": "Kierros valmis."})
	if len(n.Runs) != 1 || n.Runs[0].Round != 3 || n.Runs[0].Name != "proto-m365" || n.Runs[0].State != "round_reported" {
		t.Fatalf("runs %+v", n.Runs)
	}
	for _, bad := range []map[string]any{
		{"run_id": wakeRun, "state": "round_reported", "title": "t", "name": "proto-m365"},
		{"run_id": wakeRun, "state": "round_reported", "title": "t", "round": 3, "name": "Bad Name"},
	} {
		if n := entry(bad); len(n.Runs) != 0 {
			t.Fatalf("malformed round report kept: %+v", n.Runs)
		}
	}
	// What a catch-up told is keyed by round, as the companion keys it.
	if catchUpKey(wakeRun, "round_reported", 3) != wakeRun+":round_reported:3" || catchUpKey(wakeRun, "merged", 0) != wakeRun+":merged" {
		t.Fatal("catch-up key")
	}
}

// The panel route carries a named worker's rounds with its row, read from
// Taskfleet's own list and show as the mapped user.
func TestSpinoffRouteCarriesTheNamedWorker(t *testing.T) {
	home := t.TempDir()
	cfg := transport.Config{Home: home, UID: os.Getuid(), Provider: "github", Subject: "42"}
	parent := nativeSession{id: spinoffParent, cwd: "/w", state: "readable"}
	run := residentRun(spinoffFixtureID, spinoffParent, "waiting", 2, true)
	run.Resident.LastLanding = &struct {
		Round int `json:"round"`
	}{2}
	list, _ := json.Marshal(map[string]any{"schema_version": 1, "data": map[string]any{"runs": []nativeSpinoff{run}}})
	show, _ := json.Marshal(map[string]any{"schema_version": 1, "data": run})
	bin := filepath.Join(home, ".local", "bin", "taskfleet")
	if e := os.MkdirAll(filepath.Dir(bin), 0700); e != nil {
		t.Fatal(e)
	}
	script := "#!/bin/sh\ncase \"$1\" in version) printf '%s' '{\"schema_version\":1,\"data\":{\"version\":\"0.19.0\"}}';; *) if [ \"$2\" = show ]; then printf '%s' '" + string(show) + "'; else printf '%s' '" + string(list) + "'; fi;; esac\n"
	if e := os.WriteFile(bin, []byte(script), 0700); e != nil {
		t.Fatal(e)
	}
	t.Setenv("PATH", filepath.Dir(bin))
	h := historyHandlerWithReader(cfg, func(*http.Request) bool { return true }, func(transport.Config) ([]nativeSession, error) { return []nativeSession{parent}, nil })
	for _, query := range []string{"", "?run=" + spinoffFixtureID} {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", "http://unix/api/v1/agents/pi:"+spinoffParent+"/spinoffs"+query, nil))
		var got struct {
			Runs []spinoffRow `json:"runs"`
		}
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &got) != nil || len(got.Runs) != 1 {
			t.Fatalf("%q: %d %s", query, w.Code, w.Body.String())
		}
		r := got.Runs[0]
		if r.State != "waiting_parent" || r.Resident == nil || r.Resident.Name != "proto-m365" || r.Resident.RoundState != "waiting" || r.Resident.Rounds != 2 || r.Resident.LandedRound != 2 || r.Resident.Report == "" {
			t.Fatalf("%q: %+v %+v", query, r, r.Resident)
		}
	}
}
