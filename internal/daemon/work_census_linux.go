//go:build linux

package daemon

import (
	"context"
	"net/http"
	"sort"
	"sync"
	"time"
	"unicode/utf8"
)

const AgentWorkPath = "/agent/v1/work"

// The work census is what stopping this daemon would cut, for the host
// upgrade's quiet window and its interruption approval. Stopping the daemon
// ends its own children (KillMode=mixed): every Pi it runs, the processes
// those Pi started, a temporary Pi naming a history, a clone, a publish's
// push. Native SSH,
// tmux and Taskfleet Pi are not its children and are not listed.
//
// A conversation is listed when its handle holds work (heldWork), when a
// start is under way, or when Pi's process bridge reports a process still
// running or does not answer clearly ("unknown"). The census uses the same
// definition as the per-person limit and workspace deletion, so the upgrade
// cannot see a conversation as idle that those see as busy. Handles are read
// whether or not the rail can place their workspace.
//
// Long-lived processes are listed apart from the rest: a preview server runs
// until someone stops it, so the upgrade names them in its approval rather
// than waiting for them to end.
func (c *ConversationController) workCensus(clones *CloneJobs) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// invalid_arguments is reserved for a CLI that does not know the
		// census at all; the upgrade tells a predecessor without it apart by
		// that code (internal/host).
		if r.Method != http.MethodGet || r.URL.RawQuery != "" || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
			snapshotError(w, 400, "invalid_request")
			return
		}
		historyJSON(w, c.census(r.Context(), clones))
	})
}

type censusProcess struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	StartedAt string `json:"started_at,omitempty"`
}

type censusConversation struct {
	AgentID     string          `json:"agent_id"`
	WorkspaceID string          `json:"workspace_id,omitempty"`
	Activities  []string        `json:"activities"`
	Processes   []censusProcess `json:"processes"`
}

type censusJob struct {
	Kind    string `json:"kind"`
	AgentID string `json:"agent_id,omitempty"`
}

func (c *ConversationController) census(ctx context.Context, clones *CloneJobs) map[string]any {
	type entry struct {
		row *censusConversation
		rpc *piRPC
	}
	var entries []entry
	jobs := []censusJob{}
	c.mu.Lock()
	for id, s := range c.sessions {
		row := &censusConversation{AgentID: "pi:" + id, Activities: []string{}, Processes: []censusProcess{}}
		if idPattern.MatchString(s.workspace) {
			row.WorkspaceID = s.workspace
		}
		if liveChild(s) {
			row.Activities = append(row.Activities, heldWork(s)...)
			entries = append(entries, entry{row, s.rpc})
			continue
		}
		// Without a live child only a start under way or what waits for it
		// is lost; a stopped handle's leftover flags are not work.
		if s.state == "pending" || s.state == "accepted" || s.state == "starting" || len(s.held) > 0 || len(s.guestHeld) > 0 {
			row.Activities = append(row.Activities, "turn")
		}
		if s.bash != nil && s.bash.state == "held" {
			row.Activities = append(row.Activities, "command")
		}
		if len(row.Activities) > 0 {
			entries = append(entries, entry{row, nil})
		}
	}
	for id, n := range c.titleWork {
		for i := 0; i < n; i++ {
			jobs = append(jobs, censusJob{Kind: "history_title", AgentID: "pi:" + id})
		}
	}
	c.mu.Unlock()
	if clones != nil {
		if _, running := clones.runningName(); running {
			jobs = append(jobs, censusJob{Kind: "clone"})
		}
	}
	// A publish pushes for up to 45 minutes under the writer; most other
	// holders leave within milliseconds and only shift the window a little.
	if cloneWriter.held() {
		jobs = append(jobs, censusJob{Kind: "workspace_operation"})
	}

	// Ask every live Pi's bridge, not only the idle ones: a preview server
	// started during a turn outlives it, and the approval names it.
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	var wg sync.WaitGroup
	for _, e := range entries {
		if e.rpc == nil {
			continue
		}
		wg.Add(1)
		go func(e entry) {
			defer wg.Done()
			running, ok := e.rpc.runningProcesses(ctx)
			if !ok {
				if len(e.row.Activities) == 0 || e.row.Activities[0] != "unknown" {
					e.row.Activities = append(e.row.Activities, "unknown")
				}
				return
			}
			for _, p := range running {
				e.row.Processes = append(e.row.Processes, censusProcess{ID: boundedLabel(p.ID), Name: boundedLabel(p.Name), StartedAt: processStart(p.Start)})
			}
			if len(running) > 0 {
				e.row.Activities = append(e.row.Activities, "processes")
			}
		}(e)
	}
	wg.Wait()
	conversations := []censusConversation{}
	for _, e := range entries {
		if len(e.row.Activities) > 0 {
			conversations = append(conversations, *e.row)
		}
	}
	sort.Slice(conversations, func(i, j int) bool { return conversations[i].AgentID < conversations[j].AgentID })
	sort.SliceStable(jobs, func(i, j int) bool {
		if jobs[i].Kind != jobs[j].Kind {
			return jobs[i].Kind < jobs[j].Kind
		}
		return jobs[i].AgentID < jobs[j].AgentID
	})
	return map[string]any{"schema_version": 1, "conversations": conversations, "jobs": jobs}
}

// beginTitleWork and endTitleWork bracket naming a history that no handle
// holds: a title-model child and a temporary Pi run for it, and the census
// has no other way to see them. Caller holds c.mu.
func (c *ConversationController) beginTitleWork(id string) {
	if c.titleWork == nil {
		c.titleWork = map[string]int{}
	}
	c.titleWork[id]++
}

func (c *ConversationController) endTitleWork(id string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.titleWork[id]--; c.titleWork[id] <= 0 {
		delete(c.titleWork, id)
	}
}

// A process label is Pi's own text; the census bounds it and never carries
// the command line, which may hold a secret.
func boundedLabel(s string) string {
	if !utf8.ValidString(s) {
		return ""
	}
	if r := []rune(s); len(r) > 80 {
		return string(r[:80])
	}
	return s
}

func processStart(ms int64) string {
	if ms <= 0 {
		return ""
	}
	return time.UnixMilli(ms).UTC().Format(time.RFC3339Nano)
}
