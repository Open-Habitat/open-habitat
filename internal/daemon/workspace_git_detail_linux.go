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
}

// Read-only, on-demand observation. Git never fetches, writes or supplies an
// authorization token. The browser supplies an opaque ID, never a path or argv.
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
		discovery := Discover(cfg)
		var target *Workspace
		for i := range discovery.Entries {
			entry := &discovery.Entries[i]
			entryID := entry.WorkspaceID
			if entryID == "" {
				entryID = opaque("ws_", cfg.Provider+":"+cfg.Subject+":"+entry.Name)
			}
			if entryID == id && entry.Error == "" && entry.Metadata != "error" && (entry.Kind == "git_main_worktree" || entry.Kind == "git_linked_worktree") {
				if target != nil {
					snapshotError(w, 503, "native_source_unavailable")
					return
				}
				target = entry
			}
		}
		if target == nil {
			snapshotError(w, 404, "workspace_unavailable")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
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

func readWorkspaceGitDetail(ctx context.Context, cfg transport.Config, target Workspace) (workspaceGitDetail, error) {
	out := workspaceGitDetail{Files: []workspaceGitFile{}, Commits: []workspaceGitCommit{}}
	src, source, err := workspaceSource(cfg)
	if err != nil {
		return out, err
	}
	defer unix.Close(src)
	fd, opened, err := openWorkspace(src, target.Name)
	if err != nil {
		return out, err
	}
	defer unix.Close(fd)
	if uint64(opened.Dev) != target.dev || opened.Ino != target.ino {
		return out, errors.New("workspace changed")
	}
	// FETCH_HEAD's mtime is the last recorded native fetch, not remote freshness.
	// Linked worktrees and missing/unsafe files leave this explicitly unknown.
	if target.Kind == "git_main_worktree" {
		if fetchFD, e := open(unix.Openat2, fd, ".git/FETCH_HEAD", unix.O_RDONLY|unix.O_NONBLOCK, true); e == nil {
			if st, e := stat(fetchFD); e == nil && st.Mode&unix.S_IFMT == unix.S_IFREG && int(st.Uid) == cfg.UID && st.Mtim.Sec >= 0 && st.Mtim.Sec <= 8640000000000 {
				value := st.Mtim.Sec
				out.FetchedAt = &value
			}
			unix.Close(fetchFD)
		}
	}
	read := func(args ...string) ([]byte, error) {
		return cloneCommandWithTimeout(ctx, time.Second, "/usr/bin/git", cfg.Home, strconv.Itoa(fd), append([]string{"-c", "core.fsmonitor=false", "-c", "core.quotepath=false"}, args...)...)
	}
	branch, err := read("symbolic-ref", "--quiet", "HEAD")
	symbolicBranch := ""
	if err == nil {
		symbolicBranch = strings.TrimSpace(string(branch))
		branch = []byte(strings.TrimPrefix(symbolicBranch, "refs/heads/"))
	}
	if err != nil {
		branch, err = read("rev-parse", "--short", "HEAD")
	}
	if err != nil || len(branch) > 256 {
		return out, errors.New("branch unavailable")
	}
	out.Branch = strings.TrimSpace(string(branch))
	status, err := read("status", "--porcelain=v1", "-z", "--untracked-files=all")
	if err != nil || len(status) > 1<<20 {
		return out, errors.New("status unavailable")
	}
	records := strings.Split(strings.TrimSuffix(string(status), "\x00"), "\x00")
	for i := 0; i < len(records); i++ {
		record := records[i]
		if record == "" {
			continue
		}
		if len(record) < 4 || record[2] != ' ' {
			return out, errors.New("invalid status")
		}
		file := workspaceGitFile{Status: record[:2], Path: record[3:]}
		if strings.ContainsAny(file.Status, "RC") {
			i++
			if i >= len(records) {
				return out, errors.New("incomplete rename")
			}
			file.PreviousPath = records[i]
		}
		if len(file.Path) > 4096 || len(file.PreviousPath) > 4096 {
			return out, errors.New("oversize path")
		}
		out.DirtyCount++
		if len(out.Files) < 200 {
			out.Files = append(out.Files, file)
		} else {
			out.FilesTruncated = true
		}
	}
	upstream, err := read("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}")
	if err == nil && len(upstream) <= 256 {
		out.Upstream = strings.TrimSpace(string(upstream))
		counts, e := read("rev-list", "--left-right", "--count", "HEAD...@{upstream}")
		parts := strings.Fields(string(counts))
		if e == nil && len(parts) == 2 {
			ahead, e1 := strconv.Atoi(parts[0])
			behind, e2 := strconv.Atoi(parts[1])
			if e1 == nil && e2 == nil && ahead >= 0 && behind >= 0 {
				out.Ahead, out.Behind = &ahead, &behind
			}
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
	if !workspaceStillNamed(src, target.Name, opened) || !cloneSourceStillNamed(cfg.Home, source) {
		return out, errors.New("workspace changed")
	}
	return out, nil
}
