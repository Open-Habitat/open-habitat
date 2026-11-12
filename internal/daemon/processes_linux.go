//go:build linux

package daemon

import (
	"context"
	"errors"
	"golang.org/x/sys/unix"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

var processIDPattern = regexp.MustCompile(`^proc_[a-f0-9]{4}$`)
var taskfleetIDPattern = regexp.MustCompile(`^[0-9a-hjkmnp-tv-z]{26}$`)

// Bare seconds or Go-style unit runs, written out rather than left to
// time.ParseDuration so the companion's copy (process-extension.mjs) can match
// it exactly; a value must also name a non-zero amount.
var taskfleetDurationPattern = regexp.MustCompile(`^(?:[0-9]+|(?:(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:ns|us|µs|μs|ms|s|m|h))+)$`)
var previewEnv = regexp.MustCompile(`(^|\s)[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|\S+)`)
var previewURL = regexp.MustCompile(`(https?://)[^\s/@]+(?::[^\s/@]*)?@`)
var previewOption = regexp.MustCompile(`(?i)(--[^\s=]*(?:token|secret|key|pass|auth|user|cred)[^\s=]*(?:=|\s+)|(?:-H|--header)(?:=|\s+))(?:"[^"]*"|'[^']*'|\S+)`)
var previewCredential = regexp.MustCompile(`(?:ghp_|github_pat_|sk-|xox)[A-Za-z0-9_-]+`)

// Best-effort hint, never the full native command. Output is separately scoped
// to the signed-in user's explicit log read and is not credential-redacted.
func commandPreview(command string) string {
	if !utf8.ValidString(command) {
		return ""
	}
	command = previewEnv.ReplaceAllStringFunc(command, func(s string) string { i := strings.IndexByte(s, '='); return s[:i+1] + "•••" })
	command = previewURL.ReplaceAllString(command, "${1}•••@")
	command = previewOption.ReplaceAllString(command, "${1}•••")
	command = previewCredential.ReplaceAllString(command, "•••")
	command = strings.Map(func(r rune) rune {
		if r < 32 || r == 127 {
			return ' '
		}
		return r
	}, command)
	return prefixBytes(command, 1000)
}

// Recognition is presentation only; shell commands outside this deliberately
// narrow grammar stay ordinary processes. No browser text is ever executed.
// Agents usually wait from the repository whose runs they wait on, so one
// literal leading `cd <path> &&` is allowed; any other shell syntax is not.
// The companion's waitRuns (process-extension.mjs) is the same grammar; both
// are tested against testdata/taskfleet-wait-grammar.json.
func taskfleetWait(command string) []string {
	ops := taskfleetWaitOperands(command)
	for _, op := range ops {
		if !taskfleetIDPattern.MatchString(op) {
			return nil
		}
	}
	return ops
}

// taskfleetWaitOperands is the same grammar with a named worker's name
// accepted where a run id is: Taskfleet resolves a resident name among the
// repository's live runs (ADR 0003). Only readers that resolve names against
// the conversation's own runs use it (resolveWaitOperands); everything that
// carries run ids onward uses taskfleetWait.
func taskfleetWaitOperands(command string) []string {
	const refused = "|&;<>($`\\\"'\n\r)"
	const expanded = refused + "#*?[]{}="
	if strings.ContainsAny(command, "\n\r") {
		return nil
	}
	// Shell blanks only, so the companion's split cannot disagree on Unicode spaces.
	words := strings.FieldsFunc(command, func(r rune) bool { return r == ' ' || r == '\t' })
	if len(words) > 3 && words[0] == "cd" && words[2] == "&&" {
		if strings.ContainsAny(words[1], expanded) {
			return nil
		}
		words = words[3:]
	}
	if strings.ContainsAny(strings.Join(words, " "), refused) {
		return nil
	}
	if len(words) < 4 || strings.ContainsAny(words[0], expanded) || filepath.Base(words[0]) != "taskfleet" || (words[0] != "taskfleet" && !filepath.IsAbs(words[0])) || words[1] != "run" || words[2] != "wait" {
		return nil
	}
	ids := []string{}
	for i := 3; i < len(words); i++ {
		w := words[i]
		switch w {
		case "--all", "--any", "--fail-on-error", "--progress", "--json", "--terminal":
		case "--timeout", "--check-in", "--poll-interval", "--output":
			i++
			if i >= len(words) {
				return nil
			}
			value := words[i]
			if w == "--output" {
				if value != "json" && value != "jsonl" && value != "text" {
					return nil
				}
			} else if !taskfleetDurationPattern.MatchString(value) || !strings.ContainsAny(value, "123456789") {
				return nil
			}
		default:
			if !taskfleetIDPattern.MatchString(w) && !residentNamePattern.MatchString(w) || len(ids) >= 20 {
				return nil
			}
			ids = append(ids, w)
		}
	}
	if len(ids) == 0 {
		return nil
	}
	return ids
}

type nativeProcess struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Command  string `json:"command"`
	Start    int64  `json:"startTime"`
	End      *int64 `json:"endTime"`
	Status   string `json:"status"`
	ExitCode *int   `json:"exitCode"`
	Signal   *struct {
		Name string `json:"name"`
	} `json:"signal"`
	EndReason *string  `json:"endReason"`
	Wakes     *bool    `json:"wakes_agent"`
	RunIDs    []string `json:"run_ids"`
}
type processRecord struct {
	Spinoff   []processSpinoff `json:"spinoff,omitempty"`
	ID        string           `json:"id"`
	Name      string           `json:"name"`
	Preview   string           `json:"command_preview"`
	Token     string           `json:"process_token"`
	Status    string           `json:"status"`
	Start     int64            `json:"started_at"`
	End       *int64           `json:"ended_at"`
	ExitCode  *int             `json:"exit_code"`
	Signal    *string          `json:"signal"`
	EndReason *string          `json:"end_reason"`
	Wakes     *bool            `json:"wakes_agent"`
	RunIDs    []string         `json:"run_ids"`
}
type processInventory struct {
	ForegroundRunIDs []string        `json:"foreground_run_ids,omitempty"`
	Schema           int             `json:"schema_version"`
	Generation       *string         `json:"owner_generation"`
	Availability     string          `json:"availability"`
	Reason           *string         `json:"unavailable_reason"`
	Processes        []processRecord `json:"processes"`
	// Interrupted is read from the native branch and needs no running Pi.
	Interrupted []interruptedProcess `json:"interrupted"`
}
type waitingProcess struct {
	Spinoff []processSpinoff `json:"spinoff,omitempty"`
	ID      string           `json:"process_id"`
	Name    string           `json:"name"`
	Kind    string           `json:"kind"`
	RunIDs  []string         `json:"run_ids"`
	// BeforeTurn says the process started before the person began the
	// conversation's latest turn (see markWaitsBeforeTurn).
	BeforeTurn bool `json:"before_turn,omitempty"`
	start      int64
}

// markWaitsBeforeTurn marks the waits that started before the person began
// the conversation's latest turn. The agent has answered the person since such
// a process started and handed the turn back, so the process is something it
// left running (a file server, a watcher), not what the conversation waits for.
// The browser decides what that means for the rail; the fact stays a fact.
func markWaitsBeforeTurn(waiting []waitingProcess, turnAt int64) {
	if turnAt <= 0 {
		return
	}
	for i := range waiting {
		if waiting[i].start > 0 && waiting[i].start < turnAt {
			waiting[i].BeforeTurn = true
		}
	}
}

func unavailableProcesses(reason string) processInventory {
	return processInventory{Schema: 1, Availability: "unavailable", Reason: &reason, Processes: []processRecord{}, Interrupted: []interruptedProcess{}}
}
func (p *piRPC) inventory(ctx context.Context) processInventory {
	result := unavailableProcesses("bridge_unavailable")
	select {
	case <-p.exited:
		return unavailableProcesses("pi_not_running")
	default:
	}
	var reply struct {
		Records          []nativeProcess `json:"records"`
		Protocol         int             `json:"protocol"`
		ForegroundRunIDs []string        `json:"foreground_run_ids"`
	}
	if err := p.processRequest(ctx, map[string]string{"op": "list"}, &reply); err != nil {
		if err.Error() == "duplicate_owner" {
			return unavailableProcesses("error")
		}
		if err.Error() == "extension_missing" {
			return unavailableProcesses("extension_missing")
		}
		return result
	}
	if reply.Protocol != 1 || reply.Records == nil || len(reply.Records) > 200 {
		return result
	}
	if len(reply.ForegroundRunIDs) > 200 {
		return result
	}
	for _, id := range reply.ForegroundRunIDs {
		if !taskfleetIDPattern.MatchString(id) {
			return result
		}
	}
	records := make([]processRecord, 0, len(reply.Records))
	for _, r := range reply.Records {
		if !processIDPattern.MatchString(r.ID) || !utf8.ValidString(r.Name) || r.Name == "" || r.Start < 1 || r.Start > 8640000000000000 {
			return result
		}
		switch r.Status {
		case "running", "terminating", "terminate_timeout", "exited", "killed":
		default:
			return result
		}
		var signal *string
		if r.Signal != nil {
			s := prefixBytes(r.Signal.Name, 80)
			signal = &s
		}
		reason := r.EndReason
		if reason != nil {
			v := prefixBytes(*reason, 80)
			reason = &v
		}
		// The companion uses the reminder's live-argv detection for shell
		// expansions. Keep the static fallback for native fixture records.
		ids := r.RunIDs
		if len(ids) > 200 {
			return result
		}
		for _, id := range ids {
			if !taskfleetIDPattern.MatchString(id) {
				return result
			}
		}
		if ids == nil {
			ids = taskfleetWait(r.Command)
		}
		if ids == nil {
			ids = []string{}
		}
		records = append(records, processRecord{nil, r.ID, prefixBytes(r.Name, 200), commandPreview(r.Command), "pt_" + strconv.FormatInt(r.Start, 10), r.Status, r.Start, r.End, r.ExitCode, signal, reason, r.Wakes, ids})
	}
	home, env := processRunHome(p)
	for i := range records {
		if len(records[i].RunIDs) > 0 {
			records[i].Spinoff = readProcessSpinoffs(ctx, home, env, records[i].RunIDs, nativeSession{id: p.processParentID, cwd: p.processWorkspace})
		}
	}
	return processInventory{ForegroundRunIDs: reply.ForegroundRunIDs, Schema: 1, Generation: &p.processGeneration, Availability: "available", Processes: records, Interrupted: []interruptedProcess{}}
}
func inventoryWaiting(inv processInventory) []waitingProcess {
	waiting := []waitingProcess{}
	if inv.Availability != "available" {
		return waiting
	}
	for _, p := range inv.Processes {
		if p.Status != "running" || p.Wakes == nil || !*p.Wakes {
			continue
		}
		kind := "process"
		if taskfleetPending(p.Spinoff) {
			kind = "taskfleet_wait"
		}
		waiting = append(waiting, waitingProcess{Spinoff: p.Spinoff, ID: p.ID, Name: p.Name, Kind: kind, RunIDs: p.RunIDs, start: p.Start})
	}
	return waiting
}

// processRoutes is called only after the controller's mapped-user check. Its
// browser-controlled inputs choose a record, never a socket, PID or filesystem.
func (c *ConversationController) processRoutes(w http.ResponseWriter, r *http.Request, parts []string) {
	if len(parts) < 2 || !sessionIDPattern.MatchString(parts[0]) || parts[1] != "processes" || r.URL.EscapedPath() != r.URL.Path || r.RequestURI != r.URL.RequestURI() {
		snapshotError(w, 400, "invalid_request")
		return
	}
	c.mu.Lock()
	s := c.sessions[parts[0]]
	c.mu.Unlock()
	if s == nil {
		if r.Method == http.MethodGet && len(parts) == 2 && r.URL.RawQuery == "" && r.ContentLength <= 0 && len(r.TransferEncoding) == 0 {
			// A terminal Pi may still own its processes; never call them cut off.
			inv := unavailableProcesses("terminal_control")
			if processBrowserOrigin(c.home, parts[0]) {
				inv = unavailableProcesses("pi_not_running")
				inv.Interrupted = c.interruptedFor(parts[0], "", "", time.Now().UnixMilli(), true)
			}
			historyJSON(w, inv)
		} else {
			snapshotError(w, 404, "resource_not_found")
		}
		return
	}
	if r.Method == http.MethodGet && r.ContentLength <= 0 && len(r.TransferEncoding) == 0 && len(parts) == 2 && r.URL.RawQuery == "" {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		inv := s.rpc.inventory(ctx)
		before, census := s.rpc.launched, false
		select {
		case <-s.rpc.exited:
			before, census = time.Now().UnixMilli(), true
		default:
		}
		c.mu.Lock()
		path, cwd := s.historyPath, s.cwd
		c.mu.Unlock()
		inv.Interrupted = c.interruptedFor(s.id, path, cwd, before, census)
		historyJSON(w, inv)
		return
	}
	var q struct {
		Generation string `json:"owner_generation"`
		Token      string `json:"process_token"`
		Force      *bool  `json:"force"`
	}
	op, id := "", ""
	if r.Method == http.MethodPost && r.URL.RawQuery == "" && (len(parts) == 3 && parts[2] == "clear-finished" || len(parts) == 4 && parts[3] == "stop" && processIDPattern.MatchString(parts[2])) {
		if decodeControl(r, &q, 2048) != nil {
			snapshotError(w, 400, "invalid_request")
			return
		}
		if len(parts) == 3 {
			if q.Token != "" || q.Force != nil {
				snapshotError(w, 400, "invalid_request")
				return
			}
			op = "clear"
		} else {
			if q.Token == "" || len(q.Token) > 200 || q.Force == nil {
				snapshotError(w, 400, "invalid_request")
				return
			}
			op = "stop"
			id = parts[2]
		}
	} else if r.Method == http.MethodGet && len(parts) == 4 && parts[3] == "output" && processIDPattern.MatchString(parts[2]) && r.ContentLength <= 0 && len(r.TransferEncoding) == 0 {
		query := r.URL.Query()
		if len(query) != 3 || len(query["owner_generation"]) != 1 || len(query["process_token"]) != 1 || len(query["tail_lines"]) != 1 {
			snapshotError(w, 400, "invalid_request")
			return
		}
		q.Generation = query.Get("owner_generation")
		q.Token = query.Get("process_token")
		op = "output"
		id = parts[2]
	} else {
		snapshotError(w, 400, "invalid_request")
		return
	}
	if q.Generation != s.rpc.processGeneration {
		snapshotError(w, 409, "conflict")
		return
	}
	request := map[string]any{"op": op, "id": id, "token": q.Token}
	if op == "output" {
		n, err := strconv.Atoi(r.URL.Query().Get("tail_lines"))
		if err != nil || n < 1 || n > 2000 || q.Token == "" || len(q.Token) > 200 {
			snapshotError(w, 400, "invalid_request")
			return
		}
		request["tail_lines"] = n
	}
	if op == "stop" {
		request["force"] = *q.Force
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	var reply struct {
		Result string `json:"result"`
		Lines  []struct {
			Stream string `json:"stream"`
			Text   string `json:"text"`
		} `json:"lines"`
		Omitted   *int  `json:"omitted_before"`
		Retention *bool `json:"retention_restarted"`
	}
	if err := s.rpc.processRequest(ctx, request, &reply); err != nil {
		if errors.Is(err, errStaleProcess) {
			snapshotError(w, 409, "conflict")
		} else {
			snapshotError(w, 503, "resource_unavailable")
		}
		return
	}
	result := map[string]any{"schema_version": 1}
	if op == "output" {
		size := 0
		valid := reply.Lines != nil && len(reply.Lines) <= 2000 && (reply.Omitted == nil || *reply.Omitted >= 0)
		for _, line := range reply.Lines {
			size += len(line.Text)
			if (line.Stream != "stdout" && line.Stream != "stderr") || !utf8.ValidString(line.Text) {
				valid = false
			}
		}
		if !valid || size > 128*1024 {
			snapshotError(w, 503, "resource_unavailable")
			return
		}
		result["owner_generation"] = q.Generation
		result["process_id"] = id
		result["process_token"] = q.Token
		result["lines"] = reply.Lines
		result["omitted_before"] = reply.Omitted
		result["retention_restarted"] = reply.Retention
	} else {
		valid := op == "clear" && reply.Result == "cleared" || op == "stop" && (reply.Result == "killed" || reply.Result == "terminate_timeout" || reply.Result == "not_found" || reply.Result == "error")
		if !valid {
			snapshotError(w, 503, "resource_unavailable")
			return
		}
		result["result"] = reply.Result
	}
	historyJSON(w, result)
	if op != "output" && c.journal != nil {
		c.journal.appendInvalidation("pi:" + s.id)
	}
}

// interruptedFor reads the conversation's own native branch as the mapped user.
// Missing or unreadable history yields none: absence is not shown as an end.
// A known path (a continued conversation) avoids listing every session.
// Without this daemon's live Pi, census proves no terminal Pi writes the
// session now: the origin marker outlives the browser Pi, and a terminal
// Pi's live processes must never be called cut off.
func (c *ConversationController) interruptedFor(id, path, cwd string, before int64, census bool) []interruptedProcess {
	if c.facts == nil {
		return []interruptedProcess{}
	}
	if path == "" || cwd == "" {
		path = ""
		sessions, err := c.facts.sessions.read(c.nativeCfg())
		if err != nil {
			return []interruptedProcess{}
		}
		for _, h := range sessions {
			if h.id == id && h.state == "readable" {
				if path != "" {
					return []interruptedProcess{}
				}
				path, cwd = h.path, h.cwd
			}
		}
	}
	if path == "" {
		return []interruptedProcess{}
	}
	if census && c.piWriter(path, cwd) != "not_observed" {
		return []interruptedProcess{}
	}
	open, ok := c.facts.sessions.processes(path, c.cfg.UID)
	if !ok {
		return []interruptedProcess{}
	}
	return interruptedProcesses(open, before, c.started)
}

// Per-snapshot observation only. No registry/cache, and no controller lock held
// across socket I/O. One short deadline bounds absent or starting companions.
func (c *ConversationController) processWaitingViews(parent context.Context) map[string][]waitingProcess {
	c.mu.Lock()
	owners := map[string]*piRPC{}
	for id, s := range c.sessions {
		if !s.dead && !s.runActive && s.questionID == "" {
			owners[id] = s.rpc
		}
	}
	c.mu.Unlock()
	ctx, cancel := context.WithTimeout(parent, 600*time.Millisecond)
	defer cancel()
	result := map[string][]waitingProcess{}
	var mu sync.Mutex
	var wg sync.WaitGroup
	for id, p := range owners {
		wg.Add(1)
		go func(id string, p *piRPC) {
			defer wg.Done()
			inv := p.inventory(ctx)
			if inv.Availability == "available" {
				mu.Lock()
				result[id] = inventoryWaiting(inv)
				mu.Unlock()
			}
		}(id, p)
	}
	wg.Wait()
	return result
}

// Display-only origin observation, not admission or a lock acquisition. Never
// create an ownership file just to answer an inventory query for native history.
func processBrowserOrigin(home, id string) bool {
	if !filepath.IsAbs(home) || !sessionIDPattern.MatchString(id) {
		return false
	}
	fd, err := unix.Open(filepath.Join(home, "pi-owners", id+".lock"), unix.O_RDONLY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err != nil {
		return false
	}
	file := os.NewFile(uintptr(fd), "origin")
	defer file.Close()
	info, err := file.Stat()
	if err != nil || !info.Mode().IsRegular() || info.Mode().Perm() != 0600 {
		return false
	}
	uid, ok := fileOwner(info)
	if !ok || uid != os.Geteuid() {
		return false
	}
	owner := piOwnership{file: file, id: id}
	_, err = owner.browserOrigin()
	return err == nil
}
