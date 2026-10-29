//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"net/http"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/nativegh"
	"github.com/Open-Habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

// The work facts of a parent conversation's Taskfleet workers: what each has
// produced against the branch it was started from, and its pull request as
// the person's own gh sees it. The browser asks only while the person has
// the experimental worker-row sentence on, so the spinoffs read itself stays
// free of Git and GitHub calls. Everything is read fresh, as the person;
// nothing is kept between reads.

type spinoffWork struct {
	ID string `json:"run_id"`
	// "available" when Git answered for the worker's worktree or branch.
	Git     string  `json:"git"`
	Dirty   *int    `json:"dirty_count,omitempty"`
	Ahead   *int    `json:"ahead,omitempty"`
	Behind  *int    `json:"behind,omitempty"`
	Added   *int    `json:"added,omitempty"`
	Removed *int    `json:"removed,omitempty"`
	PRState string  `json:"pull_request_state"`
	PR      *workPR `json:"pull_request,omitempty"`

	repo, branch string
}
type workPR struct {
	Number int        `json:"number"`
	State  string     `json:"state"`
	URL    string     `json:"url"`
	Checks workChecks `json:"checks"`
}
type workChecks struct {
	Passed  int `json:"passed"`
	Failed  int `json:"failed"`
	Pending int `json:"pending"`
}

// workPullRequest reads one branch's newest pull request. Replaced in tests;
// production asks the person's own gh.
var workPullRequest = ghPullRequest

func serveSpinoffWork(w http.ResponseWriter, req *http.Request, cfg transport.Config, sessions []nativeSession) bool {
	path := req.URL.EscapedPath()
	if !strings.HasPrefix(path, "/api/v1/agents/") || !strings.HasSuffix(path, "/spinoff-work") {
		return false
	}
	id := strings.TrimSuffix(strings.TrimPrefix(path, "/api/v1/agents/"), "/spinoff-work")
	if req.URL.Path != path || req.URL.RawQuery != "" || !strings.HasPrefix(id, "pi:") || !sessionIDPattern.MatchString(strings.TrimPrefix(id, "pi:")) {
		snapshotError(w, 400, "invalid_request")
		return true
	}
	parent := spinoffParentSession(w, sessions, id)
	if parent == nil {
		return true
	}
	// Git reads take milliseconds; the budget is for GitHub, asked once per
	// worker branch and side by side.
	ctx, cancel := context.WithTimeout(req.Context(), 8*time.Second)
	defer cancel()
	availability := "available"
	works := []spinoffWork{}
	var version struct {
		Schema int `json:"schema_version"`
		Data   struct {
			Version string `json:"version"`
		} `json:"data"`
	}
	var reply struct {
		Schema   int      `json:"schema_version"`
		Warnings []string `json:"warnings"`
		Data     struct {
			Runs []nativeSpinoff `json:"runs"`
		} `json:"data"`
	}
	if !taskfleetRead(ctx, cfg.Home, []string{"version", "--output", "json"}, &version) || version.Schema != 1 || !taskfleetSpinoffVersion(version.Data.Version) || !taskfleetRead(ctx, cfg.Home, []string{"run", "list", "--output", "json"}, &reply) || reply.Schema != 1 || reply.Data.Runs == nil {
		availability = "unavailable"
	} else {
		if len(reply.Warnings) > 0 {
			availability = "partial"
		}
		runs := reply.Data.Runs
		sort.Slice(runs, func(i, j int) bool { return runs[i].CreatedAt > runs[j].CreatedAt })
		for _, r := range runs {
			if !belongsSpinoff(r, *parent) {
				continue
			}
			// The panel lists at most 20 rows; their facts are the ones asked for.
			if len(works) >= 20 {
				availability = "partial"
				break
			}
			worktree, branch := r.WorktreePath, ""
			if r.Status != "pending" && r.Status != "running" {
				// Only show says whether an ended run landed and what it left.
				detail, ok := showSpinoff(ctx, cfg.Home, r.ID, *parent)
				if !ok {
					availability = "partial"
					continue
				}
				kept, keptBranch, keptWorktree := preservedWork(detail)
				branch, worktree = keptBranch, keptWorktree
				// A landed run's work is in its source branch, and one with
				// nothing left on disk is not listed: neither has facts.
				if spinoffState(detail) == "merged" || !kept {
					continue
				}
			}
			works = append(works, readWorkerGit(ctx, cfg.Home, r, worktree, branch))
		}
	}
	readWorkPullRequests(ctx, cfg.Home, works)
	if ctx.Err() != nil && availability == "available" {
		availability = "partial"
	}
	historyJSON(w, map[string]any{"schema_version": 1, "parent_id": id, "availability": availability, "runs": works})
	return true
}

// readWorkerGit compares the worker's work with the branch it started from
// (Taskfleet's source_branch): a worker branch has no upstream to compare
// with. A worktree on disk gives the uncommitted changes too; an ended run
// that kept only its branch is read in its source repository.
func readWorkerGit(ctx context.Context, home string, r nativeSpinoff, worktree, branch string) spinoffWork {
	work := spinoffWork{ID: r.ID, Git: "unavailable", PRState: "unknown"}
	source := r.SourceBranch
	checkout := ""
	if worktreeOnDisk(worktree) {
		checkout = filepath.Clean(worktree)
	} else if branch != "" && filepath.IsAbs(r.SourceRepo) {
		checkout = filepath.Clean(r.SourceRepo)
	} else {
		return work
	}
	fd, err := openCheckout(home, checkout)
	if err != nil {
		return work
	}
	defer unix.Close(fd)
	read := func(args ...string) ([]byte, error) {
		return inspectGit(ctx, home, fd, args...)
	}
	head := "HEAD"
	var untracked []workspaceGitFile
	countable := true
	if checkout == filepath.Clean(worktree) {
		// The untracked files' lines count as produced work; status keeps a
		// bounded list of them, and past it the total is not known.
		status, err := readGitStatus(read, 50)
		if err != nil {
			return work
		}
		countable = !status.FilesTruncated
		work.Dirty = intPtr(status.DirtyCount)
		if !status.Detached {
			work.branch = status.Branch
		}
		for _, f := range status.Files {
			if f.Status == "??" {
				untracked = append(untracked, f)
			}
		}
	} else {
		if !validGitBaseName(branch) {
			return work
		}
		head = "refs/heads/" + branch
		if _, err := read("rev-parse", "--verify", "--quiet", head+"^{commit}"); err != nil {
			return work
		}
		work.branch = branch
	}
	work.Git = "available"
	if validGitBaseName(source) && source != work.branch {
		base := "refs/heads/" + source
		if counts, err := read("rev-list", "--left-right", "--count", head+"..."+base, "--"); err == nil {
			if parts := strings.Fields(string(counts)); len(parts) == 2 {
				ahead, e1 := strconv.Atoi(parts[0])
				behind, e2 := strconv.Atoi(parts[1])
				if e1 == nil && e2 == nil && ahead >= 0 && behind >= 0 {
					work.Ahead, work.Behind = intPtr(ahead), intPtr(behind)
				}
			}
		}
		if work.Ahead != nil && countable {
			added, removed, ok := workLines(read, fd, head, base, untracked)
			if ok {
				work.Added, work.Removed = intPtr(added), intPtr(removed)
			}
		}
	}
	// Only a repository known not to be on GitHub has no pull request to ask
	// about; a GitHub address in a form not read here, or an origin Git did
	// not answer for, leaves it unknown.
	origin, err := read("remote", "get-url", "origin")
	if err == nil {
		if name, ok := githubRepoName(string(origin)); ok {
			work.repo = name
		} else if !strings.Contains(strings.ToLower(string(origin)), "github.com") {
			work.PRState = "unsupported"
		}
	} else if gitExit(err) == 2 { // no remote called origin
		work.PRState = "unsupported"
	}
	return work
}

// workLines are the lines of everything the worker produced, committed or
// not: the merge base against the working tree (or the kept branch), plus
// the untracked files status listed.
func workLines(read gitRead, fd int, head, base string, untracked []workspaceGitFile) (int, int, bool) {
	raw, err := read("merge-base", head, base)
	mergeBase := strings.TrimSpace(string(raw))
	if err != nil || !workspaceCommitHash.MatchString(mergeBase) {
		return 0, 0, false
	}
	// Against the working tree, diff would refresh a stat-dirty index and
	// take the worker's index.lock under it.
	args := []string{"-c", "diff.autoRefreshIndex=false", "diff", "--numstat", "-z", "--find-renames", "--no-ext-diff", "--no-textconv", mergeBase}
	if head != "HEAD" {
		args = append(args, head)
	}
	out, err := read(append(args, "--")...)
	if err != nil || len(out) > 1<<20 {
		return 0, 0, false
	}
	added, removed := 0, 0
	records := strings.Split(strings.TrimSuffix(string(out), "\x00"), "\x00")
	for i := 0; i < len(records); i++ {
		fields := strings.SplitN(records[i], "\t", 3)
		if len(fields) != 3 {
			continue
		}
		// A rename's two paths follow as their own fields.
		if fields[2] == "" {
			i += 2
		}
		a, e1 := strconv.Atoi(fields[0])
		d, e2 := strconv.Atoi(fields[1])
		if e1 == nil && e2 == nil && a >= 0 && d >= 0 {
			added, removed = added+a, removed+d
		}
	}
	// A binary file has no lines, tracked or not, as in Git's numstat; one
	// that cannot be read leaves the total unknown rather than smaller.
	for _, f := range untracked {
		lines, _, ok := untrackedLines(fd, f.Path)
		if !ok {
			return 0, 0, false
		}
		added += lines
	}
	return added, removed, true
}

// readWorkPullRequests asks GitHub about each worker branch, at most four at
// a time. A failed or unanswered read is "unknown", never "none".
func readWorkPullRequests(ctx context.Context, home string, works []spinoffWork) {
	var wg sync.WaitGroup
	slots := make(chan struct{}, 4)
	for i := range works {
		w := &works[i]
		if w.repo == "" || w.branch == "" || !validGitBaseName(w.branch) {
			continue
		}
		wg.Add(1)
		go func() {
			defer wg.Done()
			select {
			case slots <- struct{}{}:
			case <-ctx.Done():
				return
			}
			defer func() { <-slots }()
			if pr, found, ok := workPullRequest(ctx, home, w.repo, w.branch); ok {
				w.PRState = "none"
				if found {
					w.PRState, w.PR = "found", &pr
				}
			}
		}()
	}
	wg.Wait()
}

// ghPullRequest runs `gh pr list` as the person with the fixed environment
// nativegh uses for every gh call; gh's own login is the only credential.
// The projection keeps the output small whatever the number of checks.
func ghPullRequest(ctx context.Context, home, repo, branch string) (workPR, bool, bool) {
	out, err := nativegh.Executor{Home: home}.Run(ctx, nativegh.Command{Program: "gh", Output: true, Args: []string{
		"pr", "list", "--repo=github.com/" + repo, "--head=" + branch, "--state=all", "--limit=1",
		"--json=number,state,isDraft,statusCheckRollup",
		"--jq=[.[] | {number, state, isDraft, checks: [.statusCheckRollup[]? | [.__typename, .status // \"\", .conclusion // \"\", .state // \"\"]]}]",
	}})
	if err != nil {
		return workPR{}, false, false
	}
	return parsePullRequest(out, repo)
}

// parsePullRequest reads the projection above. A check run counts as passed
// on success, a neutral result or a skip, as pending until it completes and
// as failed otherwise; a commit status the same by its state.
func parsePullRequest(out []byte, repo string) (workPR, bool, bool) {
	var prs []struct {
		Number  int        `json:"number"`
		State   string     `json:"state"`
		IsDraft bool       `json:"isDraft"`
		Checks  [][]string `json:"checks"`
	}
	if json.Unmarshal(out, &prs) != nil || len(prs) > 1 {
		return workPR{}, false, false
	}
	if len(prs) == 0 {
		return workPR{}, false, true
	}
	p := prs[0]
	pr := workPR{Number: p.Number, URL: "https://github.com/" + repo + "/pull/" + strconv.Itoa(p.Number)}
	switch {
	case p.State == "MERGED":
		pr.State = "merged"
	case p.State == "CLOSED":
		pr.State = "closed"
	case p.State == "OPEN" && p.IsDraft:
		pr.State = "draft"
	case p.State == "OPEN":
		pr.State = "open"
	}
	if pr.State == "" || p.Number < 1 || p.Number > 1<<30 {
		return workPR{}, false, false
	}
	for _, c := range p.Checks {
		if len(c) != 4 {
			return workPR{}, false, false
		}
		kind, status, conclusion, state := c[0], c[1], c[2], c[3]
		switch {
		case kind == "CheckRun" && status != "COMPLETED", kind == "StatusContext" && (state == "PENDING" || state == "EXPECTED"):
			pr.Checks.Pending++
		case kind == "CheckRun" && (conclusion == "SUCCESS" || conclusion == "NEUTRAL" || conclusion == "SKIPPED"), kind == "StatusContext" && state == "SUCCESS":
			pr.Checks.Passed++
		default:
			pr.Checks.Failed++
		}
	}
	return pr, true, true
}
