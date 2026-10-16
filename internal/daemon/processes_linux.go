//go:build linux

package daemon

import (
	"context"
	"errors"
	"net/http"
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
func taskfleetWait(command string) []string {
	if strings.ContainsAny(command, "|&;<>($`\\\"'\n\r)") {
		return nil
	}
	words := strings.Fields(command)
	if len(words) < 4 || filepath.Base(words[0]) != "taskfleet" || (words[0] != "taskfleet" && !filepath.IsAbs(words[0])) || words[1] != "run" || words[2] != "wait" {
		return nil
	}
	ids := []string{}
	for i := 3; i < len(words); i++ {
		w := words[i]
		switch w {
		case "--all", "--any", "--fail-on-error", "--progress", "--json":
		case "--timeout", "--poll-interval", "--output":
			i++
			if i >= len(words) {
				return nil
			}
			value := words[i]
			if w == "--output" {
				if value != "json" && value != "jsonl" && value != "text" {
					return nil
				}
			} else if d, err := time.ParseDuration(value); err != nil || d <= 0 {
				return nil
			}
		default:
			if !taskfleetIDPattern.MatchString(w) || len(ids) >= 20 {
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
	EndReason *string `json:"endReason"`
	Wakes     *bool   `json:"wakes_agent"`
}
type processRecord struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Preview   string   `json:"command_preview"`
	Token     string   `json:"process_token"`
	Status    string   `json:"status"`
	Start     int64    `json:"started_at"`
	End       *int64   `json:"ended_at"`
	ExitCode  *int     `json:"exit_code"`
	Signal    *string  `json:"signal"`
	EndReason *string  `json:"end_reason"`
	Wakes     *bool    `json:"wakes_agent"`
	RunIDs    []string `json:"run_ids"`
}
type processInventory struct {
	Schema       int             `json:"schema_version"`
	Generation   *string         `json:"owner_generation"`
	Availability string          `json:"availability"`
	Reason       *string         `json:"unavailable_reason"`
	Processes    []processRecord `json:"processes"`
}
type waitingProcess struct {
	ID     string   `json:"process_id"`
	Name   string   `json:"name"`
	Kind   string   `json:"kind"`
	RunIDs []string `json:"run_ids"`
}

func unavailableProcesses(reason string) processInventory {
	return processInventory{Schema: 1, Availability: "unavailable", Reason: &reason, Processes: []processRecord{}}
}
func (p *piRPC) inventory(ctx context.Context) processInventory {
	result := unavailableProcesses("bridge_unavailable")
	select {
	case <-p.exited:
		return unavailableProcesses("pi_not_running")
	default:
	}
	var reply struct {
		Records  []nativeProcess `json:"records"`
		Protocol int             `json:"protocol"`
	}
	if err := p.processRequest(ctx, map[string]string{"op": "list"}, &reply); err != nil {
		if err.Error() == "extension_missing" {
			return unavailableProcesses("extension_missing")
		}
		return result
	}
	if reply.Protocol != 1 || reply.Records == nil || len(reply.Records) > 200 {
		return result
	}
	records := make([]processRecord, 0, len(reply.Records))
	for _, r := range reply.Records {
		if !processIDPattern.MatchString(r.ID) || !utf8.ValidString(r.Name) || len(r.Name) > 200 || r.Start < 1 || r.Start > 8640000000000000 {
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
		ids := taskfleetWait(r.Command)
		if ids == nil {
			ids = []string{}
		}
		records = append(records, processRecord{r.ID, r.Name, commandPreview(r.Command), "pt_" + strconv.FormatInt(r.Start, 10), r.Status, r.Start, r.End, r.ExitCode, signal, reason, r.Wakes, ids})
	}
	return processInventory{1, &p.processGeneration, "available", nil, records}
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
		if len(p.RunIDs) > 0 {
			kind = "taskfleet_wait"
		}
		waiting = append(waiting, waitingProcess{p.ID, p.Name, kind, p.RunIDs})
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
		if r.Method == http.MethodGet && len(parts) == 2 && r.URL.RawQuery == "" {
			historyJSON(w, unavailableProcesses("terminal_control"))
		} else {
			snapshotError(w, 404, "resource_not_found")
		}
		return
	}
	if r.Method == http.MethodGet && r.ContentLength <= 0 && len(r.TransferEncoding) == 0 && len(parts) == 2 && r.URL.RawQuery == "" {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		historyJSON(w, s.rpc.inventory(ctx))
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
	var result map[string]any
	if err := s.rpc.processRequest(ctx, request, &result); err != nil {
		if errors.Is(err, errStaleProcess) {
			snapshotError(w, 409, "conflict")
		} else {
			snapshotError(w, 503, "resource_unavailable")
		}
		return
	}
	result["schema_version"] = 1
	if op == "output" {
		result["owner_generation"] = q.Generation
		result["process_id"] = id
		result["process_token"] = q.Token
	}
	historyJSON(w, result)
	if op != "output" && c.journal != nil {
		c.journal.appendInvalidation("pi:" + s.id)
	}
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
