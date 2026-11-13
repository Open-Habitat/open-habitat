//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/open-habitat/open-habitat/internal/transport"
)

var taskfleetCreatorSessionIDPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

type spinoffTranscriptPath struct {
	Anchor       string  `json:"anchor"`
	Path         *string `json:"path"`
	Availability string  `json:"availability"`
}
type spinoffNode struct {
	NodeID      string                `json:"node_id"`
	Harness     string                `json:"harness"`
	SessionID   string                `json:"session_id"`
	Attempt     *int                  `json:"attempt"`
	OriginalCwd string                `json:"original_cwd"`
	Worktree    string                `json:"worktree_path"`
	Support     string                `json:"support"`
	Live        spinoffTranscriptPath `json:"live"`
	Original    spinoffTranscriptPath `json:"original"`
}
type spinoffPreserved struct {
	Branch          *string `json:"branch"`
	Worktree        *string `json:"worktree_path"`
	BranchPresent   bool    `json:"branch_present"`
	WorktreePresent bool    `json:"worktree_present"`
}
type nativeSpinoff struct {
	AgentOwner   string             `json:"agent_owner"`
	Preserved    []spinoffPreserved `json:"preserved_work"`
	SourceBranch string             `json:"source_branch"`
	WorktreePath string             `json:"worktree_path"`
	Supervisor   struct {
		State string `json:"state"`
	} `json:"supervisor"`
	ID         string `json:"run_id"`
	Kind       string `json:"kind"`
	Title      string `json:"title"`
	Status     string `json:"status"`
	Lifecycle  string `json:"lifecycle"`
	SourceRepo string `json:"source_repo"`
	CreatedAt  string `json:"created_at"`
	Creator    *struct {
		Harness   string `json:"harness"`
		SessionID string `json:"session_id"`
	} `json:"created_by_session"`
	CreatorRun *string       `json:"created_by_run_id"`
	Nodes      []spinoffNode `json:"node_transcripts"`
	Attention  bool          `json:"attention_required"`
	Stalled    bool          `json:"stalled"`
	Landed     bool          `json:"landed"`
	Report     struct {
		Summary string `json:"summary"`
		Reason  string `json:"reason"`
	} `json:"report"`
	Harness       string             `json:"harness"`
	AwaitingInput bool               `json:"awaiting_input"`
	Resident      *taskfleetResident `json:"resident"`
	Manifest      struct {
		Selection struct {
			Profile string `json:"profile"`
		} `json:"selection"`
		UpdatedAt string `json:"updated_at"`
	} `json:"manifest"`
	Attach struct {
		State    string `json:"state"`
		Identity struct {
			Socket   string `json:"socket"`
			WindowID string `json:"window_id"`
			PaneID   string `json:"pane_id"`
		} `json:"identity"`
	} `json:"attach"`
}
type spinoffRow struct {
	Harness       string `json:"harness"`
	Profile       string `json:"profile,omitempty"`
	AwaitingInput bool   `json:"awaiting_input"`
	Terminal      string `json:"terminal,omitempty"`
	TerminalSpace string `json:"terminal_workspace,omitempty"`
	GitWorkspace  string `json:"git_workspace,omitempty"`
	Brief         string `json:"brief,omitempty"`
	OtherRepo     string `json:"other_repository,omitempty"`
	EndedAt       string `json:"ended_at,omitempty"`
	Preserved     bool   `json:"preserved"`
	Branch        string `json:"branch"`
	Worktree      string `json:"worktree"`
	SourceBranch  string `json:"source_branch"`
	ID            string `json:"run_id"`
	Title         string `json:"title"`
	CreatedAt     string `json:"created_at"`
	State         string `json:"state"`
	Summary       string `json:"summary"`
	// A named support worker's rounds (resident_linux.go).
	Resident *spinoffResident `json:"resident,omitempty"`
}
type spinoffView struct {
	NodeID       string         `json:"node_id"`
	Harness      string         `json:"harness"`
	Availability string         `json:"availability"`
	Entries      []historyEntry `json:"entries"`
	Truncated    bool           `json:"truncated"`
}

// Fixed argv, fresh native reads as the daemon UID. No inherited TASKFLEET_HOME,
// creator claim, registry or cached history. Missing/older binaries fail honestly.
func taskfleetRead(ctx context.Context, home string, args []string, dest any) bool {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	binary := taskfleetBinary(home)
	if binary == "" {
		return false
	}
	cmd := exec.CommandContext(ctx, binary, args...)
	cmd.Dir = home
	cmd.Env = []string{"HOME=" + home, agentPath(home), "TASKFLEET_HOME=" + filepath.Join(home, ".taskfleet")}
	cmd.WaitDelay = 100 * time.Millisecond
	var out boundedSpinoffBuffer
	cmd.Stdout = &out
	return cmd.Run() == nil && json.Unmarshal(out.b, dest) == nil
}

type boundedSpinoffBuffer struct{ b []byte }

func (b *boundedSpinoffBuffer) Write(p []byte) (int, error) {
	if len(b.b)+len(p) > 4<<20 {
		return 0, io.ErrShortBuffer
	}
	b.b = append(b.b, p...)
	return len(p), nil
}
func spinoffState(r nativeSpinoff) string {
	if r.Landed {
		return "merged"
	}
	// A named worker between rounds waits for its parent's next message:
	// Taskfleet's told round state, also when idle expiry raised attention
	// over work it kept on the branch. Its exited Pi says nothing more.
	if residentBetweenRounds(r) && !r.Stalled && r.Supervisor.State != "dead" && r.Supervisor.State != "unknown" {
		return "waiting_parent"
	}
	if r.Stalled || (r.Status == "pending" || r.Status == "running") && (r.Supervisor.State == "dead" || r.Supervisor.State == "unknown") {
		return "unknown"
	}
	if r.Attention && r.Lifecycle == "interactive" {
		return "waiting_parent"
	}
	switch r.Status {
	case "pending", "running":
		if r.Attention {
			return "unknown"
		}
		return "working"
	case "failed":
		return "failed"
	case "done", "cancelled":
		return "unmerged"
	}
	return "unknown"
}

// Creator-session attribution is independent of the target repository. The
// inventory is already read as this Unix user; cwd is not a security boundary.
func belongsSpinoff(r nativeSpinoff, parent nativeSession) bool {
	return taskfleetIDPattern.MatchString(r.ID) && observedTaskfleetKind(r.Kind) && r.AgentOwner != "caller" && r.CreatorRun == nil && r.Creator != nil && r.Creator.Harness == "pi" && r.Creator.SessionID == parent.id && filepath.IsAbs(r.SourceRepo)
}

// otherRepository names the worker's repository only when the parent
// conversation does not run inside it: the panel marks a worker that works
// elsewhere, never one in the conversation's own repository.
func otherRepository(sourceRepo, parentCwd string) string {
	// Without the parent's directory nothing says the repository differs.
	if sourceRepo == "" || parentCwd == "" {
		return ""
	}
	src := filepath.Clean(sourceRepo)
	if rel, err := filepath.Rel(src, filepath.Clean(parentCwd)); err == nil && rel != ".." && !strings.HasPrefix(rel, "../") {
		return ""
	}
	return prefixBytes(filepath.Base(src), 200)
}

// worktreeOnDisk says whether an ended run's checkout directory still
// exists. Lstat: a symlink in its place is not the worktree.
func worktreeOnDisk(path string) bool {
	if !filepath.IsAbs(path) {
		return false
	}
	st, err := os.Lstat(filepath.Clean(path))
	return err == nil && st.IsDir()
}

// preservedWork is what an ended run left on disk: whether its branch or
// worktree is still there, and their names as Taskfleet records them.
func preservedWork(detail nativeSpinoff) (kept bool, branch, worktree string) {
	worktree = detail.WorktreePath
	for _, p := range detail.Preserved {
		kept = p.BranchPresent || p.WorktreePresent
		if p.Branch != nil {
			branch = *p.Branch
		}
		if p.Worktree != nil {
			worktree = *p.Worktree
		}
		break
	}
	// A merged run whose worktree removal did not finish keeps no preserved
	// work in Taskfleet's words, but its checkout is still on disk for
	// someone to clean up.
	return kept || worktreeOnDisk(detail.WorktreePath), branch, worktree
}

// showSpinoff reads one run's detail, still attributed to the same parent.
func showSpinoff(ctx context.Context, home, runID string, parent nativeSession) (nativeSpinoff, bool) {
	var detail struct {
		Schema int           `json:"schema_version"`
		Data   nativeSpinoff `json:"data"`
	}
	ok := taskfleetRead(ctx, home, []string{"run", "show", runID, "--output", "json"}, &detail) && detail.Schema == 1 && detail.Data.ID == runID && belongsSpinoff(detail.Data, parent)
	return detail.Data, ok
}
func serveSpinoffs(w http.ResponseWriter, req *http.Request, cfg transport.Config, sessions []nativeSession) bool {
	path := req.URL.EscapedPath()
	if !strings.HasPrefix(path, "/api/v1/agents/") || !strings.HasSuffix(path, "/spinoffs") {
		return false
	}
	id := strings.TrimSuffix(strings.TrimPrefix(path, "/api/v1/agents/"), "/spinoffs")
	q := req.URL.Query()
	runID := q.Get("run")
	if req.URL.Path != path || !strings.HasPrefix(id, "pi:") || !sessionIDPattern.MatchString(strings.TrimPrefix(id, "pi:")) || (req.URL.RawQuery != "" && (len(q) != 1 || len(q["run"]) != 1 || !taskfleetIDPattern.MatchString(runID))) {
		snapshotError(w, 400, "invalid_request")
		return true
	}
	parent := spinoffParentSession(w, sessions, id)
	if parent == nil {
		return true
	}
	ctx, cancel := context.WithTimeout(req.Context(), 5*time.Second)
	defer cancel()
	rows := []spinoffRow{}
	views := []spinoffView{}
	var live []int // live rows, by index in rows, to enrich with a profile
	// A live worker's own session says whether it is at work.
	home, _ := os.Open(cfg.Home)
	if home != nil {
		defer home.Close()
	}
	now := time.Now()
	availability := "available"
	var reply struct {
		Schema   int      `json:"schema_version"`
		Warnings []string `json:"warnings"`
		Data     struct {
			Runs []nativeSpinoff `json:"runs"`
		} `json:"data"`
	}
	var version struct {
		Schema int `json:"schema_version"`
		Data   struct {
			Version string `json:"version"`
		} `json:"data"`
	}
	supported := taskfleetRead(ctx, cfg.Home, []string{"version", "--output", "json"}, &version) && version.Schema == 1 && taskfleetSpinoffVersion(version.Data.Version)
	if !supported || !taskfleetRead(ctx, cfg.Home, []string{"run", "list", "--output", "json"}, &reply) || reply.Schema != 1 || reply.Data.Runs == nil {
		availability = "unavailable"
	} else {
		if len(reply.Warnings) > 0 {
			availability = "partial"
		}
		// The creator and transcript fields were released together. Never portray an
		// older binary's un-attributable inventory as proof that no children exist.
		sort.Slice(reply.Data.Runs, func(i, j int) bool { return reply.Data.Runs[i].CreatedAt > reply.Data.Runs[j].CreatedAt })
		for _, r := range reply.Data.Runs {
			if r.Nodes == nil {
				availability = "partial"
			}
			if !belongsSpinoff(r, *parent) || runID != "" && r.ID != runID {
				continue
			}
			if len(rows) >= 20 {
				availability = "partial"
				break
			}
			row := spinoffRow{ID: r.ID, Title: prefixBytes(r.Title, 200), CreatedAt: nativeTimestamp(r.CreatedAt), State: "unknown", Harness: workerHarness(r.Harness), AwaitingInput: r.AwaitingInput, OtherRepo: otherRepository(r.SourceRepo, parent.cwd), Resident: residentRow(r)}
			if runID == "" && (r.Status == "pending" || r.Status == "running") {
				row.State, row.AwaitingInput = liveWorkerState(home, cfg.UID, r, now)
				row.SourceBranch = prefixBytes(r.SourceBranch, 200)
				live = append(live, len(rows))
				rows = append(rows, row)
				continue
			}
			// List is inventory, not landing proof: only show carries the
			// verified landed flag and retained report/preserved work.
			if detail, shown := showSpinoff(ctx, cfg.Home, r.ID, *parent); shown {
				row.State, row.AwaitingInput = liveWorkerState(home, cfg.UID, detail, now)
				row.Resident = residentRow(detail)
				row.Harness = workerHarness(detail.Harness)
				row.SourceBranch = prefixBytes(detail.SourceBranch, 200)
				row.Worktree = prefixBytes(detail.WorktreePath, 1024)
				row.Profile = prefixBytes(detail.Manifest.Selection.Profile, 64)
				row.OtherRepo = otherRepository(detail.SourceRepo, parent.cwd)
				// Taskfleet records no end time; an ended run's manifest was
				// last written when it ended.
				if s := detail.Status; s == "done" || s == "failed" || s == "cancelled" {
					row.EndedAt = nativeTimestamp(detail.Manifest.UpdatedAt)
				}
				kept, branch, worktree := preservedWork(detail)
				row.Preserved = kept
				row.Branch = prefixBytes(branch, 300)
				row.Worktree = prefixBytes(worktree, 1024)
				// Jari 28.10.2026: the list is the real state. An ended
				// worker is listed while its branch or worktree exists and
				// leaves once both are gone; nothing acknowledges it away.
				// The worker's own view (?run=) still opens any run.
				if runID == "" && !row.Preserved {
					continue
				}
				if runID == r.ID {
					summary := detail.Report.Summary
					if reason := detail.Report.Reason; reason != "" && reason != summary {
						if summary != "" {
							summary += "\n\n"
						}
						summary += reason
					}
					row.Summary = prefixBytes(summary, 16000)
					discovery := Discover(cfg)
					if token := workerTerminal(detail); token != "" {
						if space := workerTerminalWorkspaceIn(cfg, discovery, detail.WorktreePath); space != "" {
							row.Terminal, row.TerminalSpace = token, space
						}
					}
					// The header's Git chip reads the worktree through the
					// workspace Git route, which takes only this opaque ID.
					row.GitWorkspace = workerGitWorkspace(cfg, discovery, worktree)
					row.Brief = readRunBrief(cfg, r.ID)
					// One node's conversation is the view; a later node (a
					// retried attempt) replaces an earlier one.
					for i := len(detail.Nodes) - 1; i >= 0 && len(views) == 0; i-- {
						views = append(views, readSpinoffTranscript(cfg, r.ID, detail.Nodes[i]))
					}
				}
			} else {
				availability = "partial"
			}

			rows = append(rows, row)
		}
	}
	if ctx.Err() != nil {
		availability = "partial"
	}
	// A live row's state comes from the list; show adds only the profile its
	// panel row names. It runs after every ended row's required read so it
	// can never spend their time, and a missing profile is no partial read.
	for _, i := range live {
		if ctx.Err() != nil {
			break
		}
		if d, ok := showSpinoff(ctx, cfg.Home, rows[i].ID, *parent); ok {
			rows[i].Profile = prefixBytes(d.Manifest.Selection.Profile, 64)
		}
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].CreatedAt == rows[j].CreatedAt {
			return rows[i].ID < rows[j].ID
		}
		return rows[i].CreatedAt < rows[j].CreatedAt
	})
	if runID != "" {
		found := false
		for _, r := range rows {
			found = found || r.ID == runID
		}
		if !found && availability == "available" {
			snapshotError(w, 404, "resource_not_found")
			return true
		}
	}
	historyJSON(w, map[string]any{"schema_version": 1, "parent_id": id, "availability": availability, "runs": rows, "transcripts": views})
	return true
}

// spinoffParentSession is the one readable native session id names, or nil
// after writing the error reply.
func spinoffParentSession(w http.ResponseWriter, sessions []nativeSession, id string) *nativeSession {
	var parent *nativeSession
	for i := range sessions {
		if "pi:"+sessions[i].id == id {
			if parent != nil {
				snapshotError(w, 503, "native_source_unavailable")
				return nil
			}
			parent = &sessions[i]
		}
	}
	if parent == nil || parent.state != "readable" {
		snapshotError(w, 404, "resource_not_found")
		return nil
	}
	return parent
}

// openat2 resolves the entire native path beneath the trusted mapped home;
// symlinks (including intermediate components), devices and foreign owners fail.
func readSpinoffTranscript(cfg transport.Config, runID string, n spinoffNode) spinoffView {
	v := spinoffView{NodeID: prefixBytes(n.NodeID, 128), Harness: workerHarness(n.Harness), Availability: "unavailable", Entries: []historyEntry{}}
	if n.Harness != "pi" && n.Harness != "claude" {
		v.Availability = "unsupported"
		return v
	}
	home, err := os.Open(cfg.Home)
	if err != nil {
		return v
	}
	defer home.Close()
	if n.Harness == "claude" {
		return readClaudeWorker(cfg, n, int(home.Fd()))
	}
	if n.Support != "supported" {
		v.Availability = "unsupported"
		return v
	}
	if !taskfleetIDPattern.MatchString(runID) || !sessionIDPattern.MatchString(n.SessionID) || n.Attempt == nil || *n.Attempt < 0 {
		return v
	}
	for _, archived := range []bool{true, false} {
		p := n.Live
		cwd := n.Worktree
		base := ".taskfleet"
		if archived {
			p = n.Original
			cwd = n.OriginalCwd
			base = filepath.Join(base, "runs", runID)
			if p.Anchor != "run-root" {
				continue
			}
		} else if p.Anchor != "state-root" {
			continue
		}
		if p.Availability != "available" || p.Path == nil || *p.Path == "" || filepath.IsAbs(*p.Path) || filepath.Clean(*p.Path) == ".." || strings.HasPrefix(filepath.Clean(*p.Path), "../") || !filepath.IsAbs(cwd) {
			continue
		}
		b, _, ok := readHomeFile(int(home.Fd()), filepath.Join(base, *p.Path), cfg.UID, workerFileLimit, true, false)
		if !ok {
			continue
		}
		s := decodeNative(b, "")
		if s.state != "readable" || s.id != n.SessionID || s.cwd != cwd {
			continue
		}
		v.Entries, v.Truncated = boundWorkerEntries(piWorkerEntries(b, s))
		v.Availability = "available"
		return v
	}
	return v
}

// 0.15 is the first released attribution/transcript/lifetime contract.
func taskfleetSpinoffVersion(v string) bool {
	parts := strings.Split(strings.TrimPrefix(v, "v"), ".")
	if len(parts) != 3 {
		return false
	}
	major, e := strconv.Atoi(parts[0])
	if e != nil {
		return false
	}
	minor, e := strconv.Atoi(parts[1])
	if e != nil {
		return false
	}
	return major > 0 || major == 0 && minor >= 15
}

func taskfleetBinary(home string) string {
	for _, dir := range filepath.SplitList(strings.TrimPrefix(agentPath(home), "PATH=")) {
		path := filepath.Join(dir, "taskfleet")
		if st, err := os.Stat(path); err == nil && st.Mode().IsRegular() && st.Mode().Perm()&0111 != 0 {
			return path
		}
	}
	return ""
}

func listTaskfleetRuns(ctx context.Context, home string) ([]nativeSpinoff, bool) {
	var reply struct {
		Schema int `json:"schema_version"`
		Data   struct {
			Runs []nativeSpinoff `json:"runs"`
		} `json:"data"`
	}
	if !taskfleetRead(ctx, home, []string{"run", "list", "--output", "json"}, &reply) || reply.Schema != 1 {
		return nil, false
	}
	return reply.Data.Runs, true
}

// Workmux's default sibling container is itself an immediate src child. Do
// not advertise that unannotated container as a second ordinary workspace.
// Native run/node paths, not names such as "__worktrees", identify it.
func filterTaskfleetWorkspaces(home string, entries []Workspace, runs []nativeSpinoff) []Workspace {
	src := filepath.Join(home, "src")
	hidden := map[string]bool{}
	for _, r := range runs {
		if !observedTaskfleetKind(r.Kind) || r.AgentOwner == "caller" || !taskfleetIDPattern.MatchString(r.ID) {
			continue
		}
		for _, n := range r.Nodes {
			if !filepath.IsAbs(n.Worktree) {
				continue
			}
			path := filepath.Clean(n.Worktree)
			if filepath.Dir(path) == src {
				hidden[filepath.Base(path)] = false
			} else {
				container := filepath.Dir(path)
				if filepath.Dir(container) == src && container != filepath.Clean(r.SourceRepo) {
					if _, found := hidden[filepath.Base(container)]; !found {
						hidden[filepath.Base(container)] = true
					}
				}
			}
		}
	}
	result := make([]Workspace, 0, len(entries))
	for _, e := range entries {
		container, found := hidden[e.Name]
		if found && (!container || e.Kind == "directory" && e.Metadata == "absent") {
			continue
		}
		result = append(result, e)
	}
	return result
}

// workingSpinoffs counts the parent's own runs at work and those whose Pi
// waits at its prompt. It also includes runs in sibling repositories,
// regardless of whether this daemon still holds the parent's wait after a
// restart.
func workingSpinoffs(home *os.File, uid int, runs []nativeSpinoff, parent nativeSession, now time.Time) (working, idle int) {
	for _, r := range runs {
		if !belongsSpinoff(r, parent) {
			continue
		}
		switch state, _ := liveWorkerState(home, uid, r, now); state {
		case "working":
			working++
		case "idle":
			idle++
		}
	}
	return working, idle
}

// workerFailedUnseen says whether one of the conversation's own Taskfleet
// runs failed after the conversation last changed. Neither the agent nor the
// person has written to it since, so nobody has acted on the failure yet;
// a parent that waits for the run is woken by its end and so moves on at once.
// The time a run ended is its manifest's updated_at, which `run list` does
// not carry; the manifest is read directly rather than through `run show` for
// every failed run on every snapshot.
func workerFailedUnseen(home string, uid int, runs []nativeSpinoff, parent nativeSession) bool {
	changed, err := time.Parse(time.RFC3339Nano, parent.changedAt)
	if err != nil {
		return false
	}
	var dir *os.File
	for _, r := range runs {
		if !belongsSpinoff(r, parent) || spinoffState(r) != "failed" {
			continue
		}
		if dir == nil {
			if dir, err = os.Open(home); err != nil {
				return false
			}
			defer dir.Close()
		}
		b, _, ok := readHomeFile(int(dir.Fd()), filepath.Join(".taskfleet", "runs", r.ID, "manifest.json"), uid, 1<<20, false, false)
		var manifest struct {
			Status    string `json:"status"`
			UpdatedAt string `json:"updated_at"`
		}
		if !ok || json.Unmarshal(b, &manifest) != nil || manifest.Status != "failed" {
			continue
		}
		if ended, err := time.Parse(time.RFC3339Nano, manifest.UpdatedAt); err == nil && ended.After(changed) {
			return true
		}
	}
	return false
}

func observedTaskfleetKind(kind string) bool {
	switch kind {
	case "spinoff", "research", "technical-decision", "fan-out":
		return true
	}
	return false
}
