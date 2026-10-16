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
	"unicode/utf8"

	"github.com/Open-Habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
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
}
type spinoffRow struct {
	Preserved    bool   `json:"preserved"`
	Branch       string `json:"branch"`
	Worktree     string `json:"worktree"`
	SourceBranch string `json:"source_branch"`
	ID           string `json:"run_id"`
	Title        string `json:"title"`
	CreatedAt    string `json:"created_at"`
	State        string `json:"state"`
	Summary      string `json:"summary"`
}
type spinoffMessage struct {
	Key  string `json:"key"`
	Kind string `json:"kind"`
	Text string `json:"text"`
}
type spinoffView struct {
	NodeID       string           `json:"node_id"`
	Availability string           `json:"availability"`
	Messages     []spinoffMessage `json:"messages"`
	Truncated    bool             `json:"truncated"`
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
	case "done", "failed", "cancelled":
		return "unmerged"
	}
	return "unknown"
}
func belongsSpinoff(r nativeSpinoff, parent nativeSession) bool {
	return taskfleetIDPattern.MatchString(r.ID) && observedTaskfleetKind(r.Kind) && r.AgentOwner != "caller" && r.CreatorRun == nil && r.Creator != nil && r.Creator.Harness == "pi" && r.Creator.SessionID == parent.id && filepath.IsAbs(r.SourceRepo) && filepath.Clean(r.SourceRepo) == filepath.Clean(parent.cwd)
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
	var parent *nativeSession
	for i := range sessions {
		if "pi:"+sessions[i].id == id {
			if parent != nil {
				snapshotError(w, 503, "native_source_unavailable")
				return true
			}
			parent = &sessions[i]
		}
	}
	if parent == nil || parent.state != "readable" {
		snapshotError(w, 404, "resource_not_found")
		return true
	}
	ctx, cancel := context.WithTimeout(req.Context(), 5*time.Second)
	defer cancel()
	rows := []spinoffRow{}
	views := []spinoffView{}
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
	if !supported || !taskfleetRead(ctx, cfg.Home, []string{"run", "list", "--repo", parent.cwd, "--output", "json"}, &reply) || reply.Schema != 1 || reply.Data.Runs == nil {
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
			if !belongsSpinoffInCheckout(ctx, cfg.Home, r, *parent) || runID != "" && r.ID != runID {
				continue
			}
			if len(rows) >= 20 {
				availability = "partial"
				break
			}
			row := spinoffRow{ID: r.ID, Title: prefixBytes(r.Title, 200), CreatedAt: nativeTimestamp(r.CreatedAt), State: "unknown"}
			if runID == "" && (r.Status == "pending" || r.Status == "running") {
				row.State = spinoffState(r)
				row.SourceBranch = prefixBytes(r.SourceBranch, 200)
				rows = append(rows, row)
				continue
			}
			// List is inventory, not landing proof: only show carries the
			// verified landed flag and retained report/preserved work.
			var detail struct {
				Schema int           `json:"schema_version"`
				Data   nativeSpinoff `json:"data"`
			}
			if taskfleetRead(ctx, cfg.Home, []string{"run", "show", r.ID, "--output", "json"}, &detail) && detail.Schema == 1 && detail.Data.ID == r.ID && belongsSpinoffInCheckout(ctx, cfg.Home, detail.Data, *parent) {
				row.State = spinoffState(detail.Data)
				row.SourceBranch = prefixBytes(detail.Data.SourceBranch, 200)
				row.Worktree = prefixBytes(detail.Data.WorktreePath, 1024)
				for _, p := range detail.Data.Preserved {
					row.Preserved = row.Preserved || p.BranchPresent || p.WorktreePresent
					if p.Branch != nil {
						row.Branch = prefixBytes(*p.Branch, 300)
					}
					if p.Worktree != nil {
						row.Worktree = prefixBytes(*p.Worktree, 1024)
					}
					break
				}
				if runID == r.ID {
					summary := detail.Data.Report.Summary
					if reason := detail.Data.Report.Reason; reason != "" && reason != summary {
						if summary != "" {
							summary += "\n\n"
						}
						summary += reason
					}
					row.Summary = prefixBytes(summary, 16000)
					budget := 256 * 1024
					messagesLeft := 500
					for _, n := range detail.Data.Nodes {
						if len(views) >= 20 {
							break
						}
						v := readSpinoffTranscript(cfg, r.ID, n)
						for i := range v.Messages {
							if len(v.Messages[i].Text) > budget || messagesLeft == 0 {
								v.Messages = v.Messages[:i]
								v.Truncated = true
								break
							}
							budget -= len(v.Messages[i].Text)
							messagesLeft--
						}
						views = append(views, v)
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

// openat2 resolves the entire native path beneath the trusted mapped home;
// symlinks (including intermediate components), devices and foreign owners fail.
func readSpinoffTranscript(cfg transport.Config, runID string, n spinoffNode) spinoffView {
	v := spinoffView{NodeID: prefixBytes(n.NodeID, 128), Availability: "unavailable", Messages: []spinoffMessage{}}
	if n.Support != "supported" || n.Harness != "pi" {
		v.Availability = "unsupported"
		return v
	}
	if !taskfleetIDPattern.MatchString(runID) || !sessionIDPattern.MatchString(n.SessionID) || n.Attempt == nil || *n.Attempt < 0 {
		return v
	}
	home, err := os.Open(cfg.Home)
	if err != nil {
		return v
	}
	defer home.Close()
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
		fd, e := open(unix.Openat2, int(home.Fd()), filepath.Join(base, *p.Path), unix.O_RDONLY|unix.O_NONBLOCK, false)
		if e != nil {
			continue
		}
		f := os.NewFile(uintptr(fd), "spinoff")
		st, e := f.Stat()
		if e != nil || !st.Mode().IsRegular() || st.Size() > 8<<20 {
			f.Close()
			continue
		}
		uid, ok := fileOwner(st)
		if !ok || uid != cfg.UID {
			f.Close()
			continue
		}
		b, e := io.ReadAll(io.LimitReader(f, 8<<20+1))
		f.Close()
		if e != nil || len(b) > 8<<20 || !utf8.Valid(b) {
			continue
		}
		// A live append can end mid-record: only complete lines are displayable.
		if len(b) > 0 && b[len(b)-1] != '\n' {
			at := strings.LastIndexByte(string(b), '\n')
			if at < 0 {
				continue
			}
			b = b[:at+1]
		}
		s := decodeNative(b, "")
		if s.state != "readable" || s.id != n.SessionID || s.cwd != cwd {
			continue
		}
		if len(s.entries) > 200 {
			s.entries = s.entries[len(s.entries)-200:]
			v.Truncated = true
		}
		for _, e := range s.entries {
			if e.Kind != "user" && e.Kind != "assistant" && e.Kind != "tool" {
				continue
			}
			text := e.Content.Text
			if len(e.Blocks) > 0 {
				texts := []string{}
				for _, block := range e.Blocks {
					if block.Type == "text" {
						texts = append(texts, block.Text)
					}
				}
				text = strings.Join(texts, "\n")
			}
			if text != "" {
				if len(text) > 4000 {
					v.Truncated = true
				}
				v.Messages = append(v.Messages, spinoffMessage{s.id + ":" + e.Key, e.Kind, prefixBytes(text, 4000)})
			}
		}
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

// Taskfleet records the creating cwd, which can be a repository subdirectory.
// Compare the actual checkout, not git common-dir (shared by sibling worktrees).
func belongsSpinoffInCheckout(ctx context.Context, home string, r nativeSpinoff, parent nativeSession) bool {
	if belongsSpinoff(r, parent) {
		return true
	}
	candidate := r
	candidate.SourceRepo = parent.cwd
	if !belongsSpinoff(candidate, parent) || !filepath.IsAbs(r.SourceRepo) {
		return false
	}
	ctx, cancel := context.WithTimeout(ctx, 350*time.Millisecond)
	defer cancel()
	cmd := exec.CommandContext(ctx, "/usr/bin/git", "-C", r.SourceRepo, "rev-parse", "--show-toplevel")
	cmd.Env = []string{"HOME=" + home, agentPath(home), "GIT_OPTIONAL_LOCKS=0"}
	cmd.WaitDelay = 100 * time.Millisecond
	var out boundedSpinoffBuffer
	cmd.Stdout = &out
	if cmd.Run() != nil {
		return false
	}
	root := strings.TrimSuffix(string(out.b), "\n")
	expected, err := filepath.EvalSymlinks(parent.cwd)
	return err == nil && root == expected
}

// Workmux's default sibling container is itself an immediate src child. Do
// not advertise that unannotated container as a second ordinary workspace.
// Native run/node paths, not names such as "__worktrees", identify it.
func excludeTaskfleetWorkspaces(ctx context.Context, home string, entries []Workspace) []Workspace {
	if taskfleetBinary(home) == "" {
		return entries
	}
	var reply struct {
		Schema int `json:"schema_version"`
		Data   struct {
			Runs []nativeSpinoff `json:"runs"`
		} `json:"data"`
	}
	if !taskfleetRead(ctx, home, []string{"run", "list", "--output", "json"}, &reply) || reply.Schema != 1 {
		return entries
	}
	return filterTaskfleetWorkspaces(home, entries, reply.Data.Runs)
}
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

func observedTaskfleetKind(kind string) bool {
	switch kind {
	case "spinoff", "research", "technical-decision", "fan-out":
		return true
	}
	return false
}
