//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

var workspaceCommitHash = regexp.MustCompile(`^[0-9a-f]{40,64}$`)

const WorkspaceGitPath = "/api/v1/workspaces/git"

type workspaceGitFile struct {
	Status       string `json:"status"`
	Path         string `json:"path"`
	PreviousPath string `json:"previous_path,omitempty"`
	Added        *int   `json:"added,omitempty"`
	Deleted      *int   `json:"deleted,omitempty"`
}
type workspaceGitCommit struct {
	Hash      string `json:"hash"`
	Subject   string `json:"subject"`
	Timestamp int64  `json:"timestamp"`
	Pushed    *bool  `json:"pushed,omitempty"`
}
type workspaceGitDetail struct {
	SchemaVersion    int                  `json:"schema_version"`
	WorkspaceID      string               `json:"workspace_id"`
	Branch           string               `json:"branch"`
	Files            []workspaceGitFile   `json:"files"`
	DirtyCount       int                  `json:"dirty_count"`
	FilesTruncated   bool                 `json:"files_truncated"`
	Commits          []workspaceGitCommit `json:"commits"`
	CommitsAvailable bool                 `json:"commits_available"`
	Upstream         string               `json:"upstream,omitempty"`
	Ahead            *int                 `json:"ahead,omitempty"`
	Behind           *int                 `json:"behind,omitempty"`
	FetchedAt        *int64               `json:"fetched_at,omitempty"`
	Unpushed         []workspaceGitCommit `json:"unpushed_commits,omitempty"`
	Incoming         []workspaceGitCommit `json:"incoming_commits,omitempty"`
	Base             *gitBase             `json:"base,omitempty"`
	BaseAhead        []workspaceGitCommit `json:"base_ahead_commits,omitempty"`
	BaseBehind       []workspaceGitCommit `json:"base_behind_commits,omitempty"`
}

// Read-only, on-demand observation. This read never fetches, writes or
// supplies an authorization token (Hae etärepo is its own POST route). The
// browser supplies an opaque ID, never a path or argv.
func WorkspaceGitHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		q := r.URL.Query()
		id := q.Get("workspace_id")
		if r.Method != "GET" || r.URL.Path != WorkspaceGitPath || r.URL.EscapedPath() != WorkspaceGitPath || r.Host != "unix" || r.ProtoMajor != 1 || r.ProtoMinor != 1 || r.ContentLength > 0 || len(r.TransferEncoding) != 0 || len(q) != 1 || len(q["workspace_id"]) != 1 || !idPattern.MatchString(id) || r.URL.RawQuery != "workspace_id="+id {
			snapshotError(w, 400, "invalid_request")
			return
		}
		target, status, code := gitWorkspace(cfg, id)
		if target == nil {
			snapshotError(w, status, code)
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 4*time.Second)
		defer cancel()
		detail, err := readWorkspaceGitDetail(ctx, cfg, *target)
		if err != nil {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		detail.SchemaVersion, detail.WorkspaceID = 1, id
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		_ = json.NewEncoder(w).Encode(detail)
	})
}

// gitTarget is the checkout a Git read or fetch acts on: a freshly
// discovered Git workspace or one of its worktree places (ADR 0025).
type gitTarget struct {
	main  bool
	place *worktreePlace
	// open pins the checkout; still reports whether it is still the
	// directory that was opened; done releases what open holds.
	open func() (fd int, still func() bool, done func(), err error)
}

// gitWorkspace finds the one freshly discovered Git workspace or worktree
// place with this opaque ID; the browser never names a path.
func gitWorkspace(cfg transport.Config, id string) (*gitTarget, int, string) {
	discovery := Discover(cfg)
	var target *Workspace
	for i := range discovery.Entries {
		entry := &discovery.Entries[i]
		if workspaceIDOf(cfg, *entry) == id && entry.Error == "" && entry.Metadata != "error" && (entry.Kind == "git_main_worktree" || entry.Kind == "git_linked_worktree") {
			if target != nil {
				return nil, 503, "native_source_unavailable"
			}
			target = entry
		}
	}
	if target == nil {
		if p, ok := findPlace(cfg, cfg.Home, discovery, id); ok {
			return placeTarget(cfg.Home, p), 0, ""
		}
		return nil, 404, "workspace_unavailable"
	}
	t := workspaceGitTarget(cfg, *target)
	return &t, 0, ""
}

func workspaceGitTarget(cfg transport.Config, entry Workspace) gitTarget {
	return gitTarget{main: entry.Kind == "git_main_worktree", open: func() (int, func() bool, func(), error) {
		src, source, err := workspaceSource(cfg)
		if err != nil {
			return -1, nil, nil, err
		}
		fd, opened, err := openWorkspace(src, entry.Name)
		if err != nil {
			unix.Close(src)
			return -1, nil, nil, err
		}
		if uint64(opened.Dev) != entry.dev || opened.Ino != entry.ino {
			unix.Close(fd)
			unix.Close(src)
			return -1, nil, nil, errors.New("workspace changed")
		}
		still := func() bool {
			return workspaceStillNamed(src, entry.Name, opened) && cloneSourceStillNamed(cfg.Home, source)
		}
		return fd, still, func() { unix.Close(fd); unix.Close(src) }, nil
	}}
}

func placeTarget(home string, p worktreePlace) *gitTarget {
	return &gitTarget{place: &p, open: func() (int, func() bool, func(), error) {
		fd, err := openPlace(home, p)
		if err != nil {
			return -1, nil, nil, err
		}
		still := func() bool {
			again, err := openPlace(home, p)
			if err == nil {
				unix.Close(again)
			}
			return err == nil
		}
		return fd, still, func() { unix.Close(fd) }, nil
	}}
}

func readWorkspaceGitDetail(ctx context.Context, cfg transport.Config, target gitTarget) (workspaceGitDetail, error) {
	out := workspaceGitDetail{Files: []workspaceGitFile{}, Commits: []workspaceGitCommit{}}
	fd, still, done, err := target.open()
	if err != nil {
		return out, err
	}
	defer done()
	// FETCH_HEAD's mtime is the last recorded native fetch, not remote freshness.
	// Linked worktrees and missing/unsafe files leave this explicitly unknown.
	if target.main {
		if fetchFD, e := open(unix.Openat2, fd, ".git/FETCH_HEAD", unix.O_RDONLY|unix.O_NONBLOCK, true); e == nil {
			if st, e := stat(fetchFD); e == nil && st.Mode&unix.S_IFMT == unix.S_IFREG && int(st.Uid) == cfg.UID && st.Mtim.Sec >= 0 && st.Mtim.Sec <= 8640000000000 {
				value := st.Mtim.Sec
				out.FetchedAt = &value
			}
			unix.Close(fetchFD)
		}
	}
	read := func(args ...string) ([]byte, error) {
		return cloneCommandWithTimeout(ctx, 2*time.Second, "/usr/bin/git", cfg.Home, strconv.Itoa(fd), append([]string{"-c", "core.fsmonitor=false", "-c", "core.quotepath=false"}, args...)...)
	}
	status, err := readGitStatus(read, 200)
	if err != nil {
		return out, err
	}
	symbolicBranch := ""
	if !status.Detached {
		symbolicBranch = "refs/heads/" + status.Branch
	}
	out.Branch, out.Upstream, out.Ahead, out.Behind = status.Branch, status.Upstream, status.Ahead, status.Behind
	out.DirtyCount, out.FilesTruncated = status.DirtyCount, status.FilesTruncated
	if status.Files != nil {
		out.Files = status.Files
	}
	addGitLineCounts(read, fd, out.Files)
	// Commits by name for each comparison, newest first and bounded; the
	// counts above stay the totals.
	if out.Ahead != nil {
		if list, e := readGitCommits(read, "@{upstream}..HEAD"); e == nil {
			out.Unpushed = list
		}
		if list, e := readGitCommits(read, "HEAD..@{upstream}"); e == nil {
			out.Incoming = list
		}
	}
	base := readGitBase(read, status)
	if target.place != nil {
		base = readPlaceBase(read, status, target.place.MainBranch)
	}
	if base != nil {
		out.Base = base
		if list, e := readGitCommits(read, base.full+"..HEAD"); e == nil {
			out.BaseAhead = list
		}
		if list, e := readGitCommits(read, "HEAD.."+base.full); e == nil {
			out.BaseBehind = list
		}
	}
	// One bounded reachability walk, not a walk per displayed commit. Omit
	// publication marks if the local upstream observation is unavailable.
	var unpushed map[string]bool
	if out.Ahead != nil && *out.Ahead <= 5000 {
		if raw, e := read("rev-list", "--max-count=5001", "HEAD", "--not", "@{upstream}"); e == nil {
			hashes := strings.Fields(string(raw))
			if len(hashes) == *out.Ahead {
				unpushed = make(map[string]bool, len(hashes))
				for _, hash := range hashes {
					unpushed[hash] = true
				}
			}
		}
	}
	log, err := read("log", "-8", "-z", "--no-show-signature", "--format=%H%x00%s%x00%ct")
	if err == nil {
		parts := strings.Split(strings.TrimSuffix(string(log), "\x00"), "\x00")
		if len(parts)%3 != 0 {
			return out, errors.New("invalid log")
		}
		for i := 0; i < len(parts); i += 3 {
			timestamp, e := strconv.ParseInt(parts[i+2], 10, 64)
			if e != nil || timestamp < 0 || timestamp > 8640000000000 || !workspaceCommitHash.MatchString(parts[i]) || len(parts[i+1]) > 4096 {
				return out, errors.New("invalid commit")
			}
			commit := workspaceGitCommit{Hash: parts[i], Subject: parts[i+1], Timestamp: timestamp}
			if unpushed != nil {
				pushed := !unpushed[commit.Hash]
				commit.Pushed = &pushed
			}
			out.Commits = append(out.Commits, commit)
		}
		out.CommitsAvailable = true
	} else if strings.HasPrefix(symbolicBranch, "refs/heads/") {
		// Only Git's explicit missing-ref outcome proves an unborn branch. A
		// failed HEAD read or a warning-skipping ref enumeration is not proof.
		// Older Git lacking --exists safely leaves this observation unknown.
		_, e := read("show-ref", "--exists", symbolicBranch)
		var exit *nativeCommandExit
		if errors.As(e, &exit) && exit.Code == 2 {
			out.CommitsAvailable = true
		}
	}
	if ctx.Err() != nil {
		return out, ctx.Err()
	}
	if !still() {
		return out, errors.New("workspace changed")
	}
	return out, nil
}
