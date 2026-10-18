//go:build linux

package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

const WorkspaceGitFetchPath = "/api/v1/workspaces/git/fetch"

// gitFetchLimit bounds one Hae etärepo, inside the gateway's 60-second
// ceiling for a finite reply. A fetch that needs longer belongs in a
// terminal, where its progress is visible.
const gitFetchLimit = 45 * time.Second

var gitRemoteName = regexp.MustCompile(`^[A-Za-z0-9_][A-Za-z0-9._-]{0,99}$`)

// WorkspaceGitFetchHandler is Hae etärepo: `git fetch` of one remote in one
// workspace, run as the user with the user's own Git configuration and
// credentials, on an explicit request only (no background polling). It
// updates remote-tracking refs and FETCH_HEAD, never a local branch or the
// working tree, and answers with the workspace's Git observation read again.
// The daemon has no SSH agent, so an SSH remote whose key needs one fails;
// that failure is classified, never passed on as Git's own text.
func WorkspaceGitFetchHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return workspaceGitFetchHandler(cfg, trusted, "/usr/bin/git", gitFetchLimit)
}

func workspaceGitFetchHandler(cfg transport.Config, trusted func(*http.Request) bool, git string, limit time.Duration) http.Handler {
	var mu sync.Mutex
	running := map[string]bool{}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		if r.Method != "POST" || r.URL.Path != WorkspaceGitFetchPath || r.RequestURI != WorkspaceGitFetchPath || r.URL.RawQuery != "" || r.Host != "unix" || r.ProtoMajor != 1 || r.ProtoMinor != 1 || len(r.TransferEncoding) != 0 || r.ContentLength < 2 || r.ContentLength > 256 || r.Header.Get("Content-Type") != "application/json" {
			snapshotError(w, 400, "invalid_request")
			return
		}
		var in struct {
			WorkspaceID string `json:"workspace_id"`
		}
		b, e := io.ReadAll(io.LimitReader(r.Body, 257))
		if e != nil || int64(len(b)) != r.ContentLength || !catalogNoDuplicates(b) || strictCloneJSON(b, &in) != nil || !idPattern.MatchString(in.WorkspaceID) {
			snapshotError(w, 400, "invalid_request")
			return
		}
		mu.Lock()
		if running[in.WorkspaceID] {
			mu.Unlock()
			snapshotError(w, 409, "fetch_in_progress")
			return
		}
		running[in.WorkspaceID] = true
		mu.Unlock()
		defer func() {
			mu.Lock()
			delete(running, in.WorkspaceID)
			mu.Unlock()
		}()
		// The socket's default five-second write deadline is too short for a
		// network fetch; extend it for this one bounded response.
		if err := http.NewResponseController(w).SetWriteDeadline(time.Now().Add(limit + 15*time.Second)); err != nil && !errors.Is(err, http.ErrNotSupported) {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		target, status, code := gitWorkspace(cfg, in.WorkspaceID)
		if target == nil {
			snapshotError(w, status, code)
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), limit+3*time.Second)
		defer cancel()
		if code := fetchWorkspaceGit(ctx, cfg, *target, git, limit); code != "" {
			snapshotError(w, 409, code)
			return
		}
		readCtx, stop := context.WithTimeout(r.Context(), 4*time.Second)
		defer stop()
		detail, err := readWorkspaceGitDetail(readCtx, cfg, *target)
		if err != nil {
			// The fetch ran; only the reading after it failed.
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		detail.SchemaVersion, detail.WorkspaceID = 1, in.WorkspaceID
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		_ = json.NewEncoder(w).Encode(detail)
	})
}

// fetchWorkspaceGit fetches the remote of the current branch's upstream, or
// origin, or the only remote. It returns "" on success or a fixed code.
func fetchWorkspaceGit(ctx context.Context, cfg transport.Config, target Workspace, git string, limit time.Duration) string {
	src, source, err := workspaceSource(cfg)
	if err != nil {
		return "workspace_changed"
	}
	defer unix.Close(src)
	fd, opened, err := openWorkspace(src, target.Name)
	if err != nil {
		return "workspace_changed"
	}
	defer unix.Close(fd)
	if uint64(opened.Dev) != target.dev || opened.Ino != target.ino || !workspaceStillNamed(src, target.Name, opened) || !cloneSourceStillNamed(cfg.Home, source) {
		return "workspace_changed"
	}
	base := []string{"-c", "core.fsmonitor=false", "-c", "core.quotepath=false"}
	read := func(args ...string) ([]byte, error) {
		return cloneCommandWithTimeout(ctx, 2*time.Second, git, cfg.Home, strconv.Itoa(fd), append(base, args...)...)
	}
	listed, err := read("remote")
	if err != nil {
		return "fetch_failed"
	}
	remotes := strings.Fields(string(listed))
	remote := ""
	if branch, e := read("symbolic-ref", "--quiet", "--short", "HEAD"); e == nil {
		if configured, e := read("config", "--get", "branch."+strings.TrimSpace(string(branch))+".remote"); e == nil {
			remote = strings.TrimSpace(string(configured))
		}
	}
	has := func(name string) bool {
		for _, r := range remotes {
			if r == name {
				return true
			}
		}
		return false
	}
	if !has(remote) {
		remote = ""
		if has("origin") {
			remote = "origin"
		} else if len(remotes) == 1 {
			remote = remotes[0]
		}
	}
	if remote == "" {
		return "no_remote"
	}
	if !gitRemoteName.MatchString(remote) {
		return "fetch_failed"
	}
	ssh := false
	if url, e := read("remote", "get-url", remote); e == nil {
		ssh = gitURLIsSSH(strings.TrimSpace(string(url)))
	}
	// Automatic maintenance is off because a detached gc would outlive the
	// bounded command (ADR 0019 made the same choice for its fetch).
	stderr := &capped{n: 16 << 10}
	started := time.Now()
	_, err = nativeCommand(ctx, limit, stderr, git, cfg.Home, strconv.Itoa(fd), append(base, "-c", "maintenance.auto=false", "-c", "gc.auto=0", "fetch", "--quiet", "--no-recurse-submodules", "--", remote)...)
	if err == nil {
		return ""
	}
	if ctx.Err() != nil || time.Since(started) >= limit {
		return "fetch_timeout"
	}
	return classifyFetchFailure(stderr.Bytes(), ssh)
}

// A remote URL is SSH when it says so or uses the scp-like host:path form.
func gitURLIsSSH(url string) bool {
	if strings.HasPrefix(url, "ssh://") || strings.HasPrefix(url, "git+ssh://") || strings.HasPrefix(url, "ssh+git://") {
		return true
	}
	if strings.Contains(url, "://") || strings.HasPrefix(url, "/") || strings.HasPrefix(url, ".") {
		return false
	}
	host, _, ok := strings.Cut(url, ":")
	return ok && host != "" && !strings.Contains(host, "/")
}

// classifyFetchFailure turns Git's diagnostics into a fixed code. The text
// itself never leaves the daemon: it can name hosts, paths or credentials.
func classifyFetchFailure(stderr []byte, ssh bool) string {
	text := strings.ToLower(string(stderr))
	has := func(needles ...string) bool {
		for _, n := range needles {
			if strings.Contains(text, n) {
				return true
			}
		}
		return false
	}
	switch {
	case has("could not resolve host", "could not resolve hostname", "network is unreachable", "connection timed out", "connection refused", "no route to host", "failed to connect"):
		return "remote_unreachable"
	case has("repository not found", "does not appear to be a git repository"):
		return "remote_not_found"
	case ssh && has("permission denied", "host key verification failed", "could not read from remote repository"):
		return "remote_ssh_unavailable"
	case has("could not read username", "could not read password", "authentication failed", "terminal prompts disabled", "invalid username or password", "permission denied", "403"):
		return "remote_auth_unavailable"
	}
	return "fetch_failed"
}

// capped keeps the first n bytes and discards the rest without failing the
// writer, so a chatty failure cannot kill the command it describes.
type capped struct {
	bytes.Buffer
	n int
}

func (c *capped) Write(b []byte) (int, error) {
	if room := c.n - c.Len(); room > 0 {
		c.Buffer.Write(b[:min(room, len(b))])
	}
	return len(b), nil
}
