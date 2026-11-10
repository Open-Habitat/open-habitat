//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/open-habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

const RepoPublishPath = "/api/v1/workspaces/github/publish"

var errPublishReceipt = errors.New("unverified native receipt")

type publishObservation struct {
	Name           string    `json:"full_name"`
	WorkspaceID    string    `json:"workspace_id"`
	WorkspaceToken string    `json:"workspace_token"`
	Visibility     string    `json:"visibility"`
	Stage          string    `json:"stage"`
	Token          string    `json:"observation_token"`
	Expires        time.Time `json:"-"`
}

func publishRepoMatches(raw []byte, name, visibility string) bool {
	var repo struct {
		FullName string `json:"full_name"`
		Private  bool   `json:"private"`
	}
	return strictRepoJSON(raw, &repo) == nil && repo.FullName == name && repo.Private == (visibility == "private")
}
func verifiedPublishRepo(ctx context.Context, run cloneRunner, gh, home, name, visibility string) bool {
	raw, e := run(ctx, gh, home, "", "api", "--method", "GET", "/repos/"+name)
	return e == nil && publishRepoMatches(raw, name, visibility)
}

// A challenge is single-use, short-lived, and held only in this user's daemon.
// It is not a workspace registry and is lost safely on daemon restart.
func RepoPublishHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return repoPublishHandler(cfg, trusted, cfg.Home, "/usr/bin/gh", "/usr/bin/git", func(ctx context.Context, program, home, fd string, args ...string) ([]byte, error) {
		if program == "/usr/bin/git" && len(args) > 0 && args[0] == "push" {
			return cloneCommandWithTimeout(ctx, 45*time.Minute, program, home, fd, args...)
		}
		return cloneCommand(ctx, program, home, fd, args...)
	})
}
func repoPublishHandler(cfg transport.Config, trusted func(*http.Request) bool, home, gh, git string, run cloneRunner) http.Handler {
	var mu sync.Mutex
	challenges := map[string]publishObservation{}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		if r.URL.Path != RepoPublishPath || r.Method == "POST" && r.RequestURI != RepoPublishPath || r.Host != "unix" || r.ProtoMajor != 1 || r.ProtoMinor != 1 || r.Method == "POST" && r.URL.RawQuery != "" || (r.Method != "GET" && r.Method != "POST") || len(r.TransferEncoding) != 0 {
			snapshotError(w, 400, "invalid_request")
			return
		}
		var in struct {
			WorkspaceID      string `json:"workspace_id"`
			FullName         string `json:"full_name"`
			Visibility       string `json:"visibility,omitempty"`
			Action           string `json:"action,omitempty"`
			Confirmation     string `json:"confirmation,omitempty"`
			ObservationToken string `json:"observation_token,omitempty"`
		}
		if r.Method == "GET" {
			if r.ContentLength > 0 {
				snapshotError(w, 400, "invalid_request")
				return
			}
			// Canonical query order and encoding; names cannot smuggle another route.
			if _, ok := observePublishQuery(r, &in); !ok {
				snapshotError(w, 400, "invalid_request")
				return
			}
		} else {
			if r.ContentLength < 2 || r.ContentLength > 1024 || r.Header.Get("Content-Type") != "application/json" {
				snapshotError(w, 400, "invalid_request")
				return
			}
			b, e := io.ReadAll(io.LimitReader(r.Body, 1025))
			if e != nil || int64(len(b)) != r.ContentLength || !catalogNoDuplicates(b) || strictCloneJSON(b, &in) != nil || in.Action != "create" && in.Action != "origin" && in.Action != "push" || in.Confirmation != in.FullName || len(in.ObservationToken) < 8 {
				snapshotError(w, 400, "invalid_request")
				return
			}
		}
		if !validCloneName(in.FullName) || !idPattern.MatchString(in.WorkspaceID) || in.Visibility != "private" && in.Visibility != "public" {
			snapshotError(w, 400, "invalid_request")
			return
		}
		if !cloneWriter.TryLock("workspace_publish_running") {
			snapshotError(w, 409, "workspace_busy")
			return
		}
		defer cloneWriter.Unlock()
		ceiling := 50 * time.Second
		if r.Method == "POST" {
			ceiling = 45 * time.Minute
		}
		// The daemon socket's default five-second write deadline is too short
		// for native GitHub and Git operations. Bound this single response to
		// the same finite native budget instead of changing other routes.
		if err := http.NewResponseController(w).SetWriteDeadline(time.Now().Add(ceiling + 10*time.Second)); err != nil && !errors.Is(err, http.ErrNotSupported) {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), ceiling)
		defer cancel()
		identity, e := run(ctx, gh, home, "", "api", "--method", "GET", "/user")
		var user struct {
			ID    json.Number `json:"id"`
			Login string      `json:"login"`
		}
		if e != nil || strictRepoJSON(identity, &user) != nil || string(user.ID) != cfg.Subject || user.Login != strings.Split(in.FullName, "/")[0] {
			snapshotError(w, 409, "github_auth_unavailable")
			return
		}
		src, source, e := workspaceSource(cfg)
		if e != nil {
			snapshotError(w, 409, "workspace_uncertain")
			return
		}
		defer unix.Close(src)
		obs := Discover(cfg)
		if obs.State == "error" || obs.Error != "" {
			snapshotError(w, 409, "workspace_uncertain")
			return
		}
		var target *Workspace
		for i := range obs.Entries {
			v := &obs.Entries[i]
			id := v.WorkspaceID
			if id == "" {
				id = opaque("ws_", cfg.Provider+":"+cfg.Subject+":"+v.Name)
			}
			if id == in.WorkspaceID && v.Error == "" {
				target = v
				break
			}
		}
		if target == nil || target.Kind != "git_main_worktree" || target.Metadata == "error" {
			snapshotError(w, 409, "workspace_uncertain")
			return
		}
		child, initial, e := openWorkspace(src, target.Name)
		if e != nil || uint64(initial.Dev) != target.dev || initial.Ino != target.ino {
			if e == nil {
				unix.Close(child)
			}
			snapshotError(w, 409, "workspace_changed")
			return
		}
		defer unix.Close(child)
		fd := strconv.Itoa(child)
		remote, e := run(ctx, git, home, fd, "remote", "get-url", "origin")
		stage := "create"
		if e == nil {
			if string(remote) != "https://github.com/"+in.FullName+".git\n" {
				snapshotError(w, 409, "origin_conflict")
				return
			}
			stage = "push"
			pushURLs, pushErr := run(ctx, git, home, fd, "remote", "get-url", "--push", "--all", "origin")
			if pushErr != nil || string(pushURLs) != "https://github.com/"+in.FullName+".git\n" {
				snapshotError(w, 409, "origin_conflict")
				return
			}
			if !verifiedPublishRepo(ctx, run, gh, home, in.FullName, in.Visibility) {
				snapshotError(w, 409, "remote_conflict")
				return
			}
		} else {
			// get-url fails both for missing and damaged Git state: verify git itself.
			list, err := run(ctx, git, home, fd, "remote")
			if err != nil || len(strings.TrimSpace(string(list))) != 0 {
				snapshotError(w, 409, "origin_conflict")
				return
			}
			raw, err := run(ctx, gh, home, "", "api", "--method", "GET", "/repos/"+in.FullName)
			if err == nil {
				if !publishRepoMatches(raw, in.FullName, in.Visibility) {
					snapshotError(w, 409, "remote_conflict")
					return
				}
				// An unrelated existing repo is never silently adopted. An empty
				// GitHub repository is also the recovery state after a lost create receipt.
				branches, branchErr := run(ctx, gh, home, "", "api", "--method", "GET", "/repos/"+in.FullName+"/branches?per_page=1")
				var rows []json.RawMessage
				if branchErr != nil || strictRepoJSON(branches, &rows) != nil || rows == nil || len(rows) != 0 {
					snapshotError(w, 409, "remote_conflict")
					return
				}
				stage = "origin"
			}
		}
		// Do not reuse a token after any observation changes, even if the same path reappears.
		wsToken := workspaceToken(cfg, *target)
		if r.Method == "GET" {
			token, e := newWorkspaceID()
			if e != nil {
				snapshotError(w, 503, "workspace_uncertain")
				return
			}
			o := publishObservation{in.FullName, in.WorkspaceID, wsToken, in.Visibility, stage, token, time.Now().Add(2 * time.Minute)}
			mu.Lock()
			for k, v := range challenges {
				if time.Now().After(v.Expires) {
					delete(challenges, k)
				}
			}
			challenges[token] = o
			mu.Unlock()
			workingTree := "unknown"
			if status, err := run(ctx, git, home, fd, "status", "--porcelain"); err == nil {
				workingTree = "clean"
				if len(status) > 0 {
					workingTree = "changes"
				}
			}
			localHead := "unborn"
			if head, err := run(ctx, git, home, fd, "rev-parse", "--verify", "HEAD^{commit}"); err == nil && validCloneCommit(head) {
				localHead = strings.TrimSpace(string(head))
			}
			historyJSON(w, map[string]any{"schema_version": 1, "full_name": in.FullName, "workspace_id": in.WorkspaceID, "visibility": in.Visibility, "stage": stage, "observation_token": token, "working_tree": workingTree, "local_head": localHead})
			return
		}
		mu.Lock()
		prior, ok := challenges[in.ObservationToken]
		delete(challenges, in.ObservationToken)
		mu.Unlock()
		if !ok || time.Now().After(prior.Expires) || prior.Name != in.FullName || prior.WorkspaceID != in.WorkspaceID || prior.WorkspaceToken != wsToken || prior.Stage != stage || prior.Visibility != in.Visibility || in.Action != stage || !workspaceStillNamed(src, target.Name, initial) || !cloneSourceStillNamed(home, source) {
			snapshotError(w, 409, "stale_precondition")
			return
		}
		// GitHub's API is the only creator. Never use gh repo create --push: each
		// native effect must have a distinct receipt and recovery observation.
		switch stage {
		case "create":
			visibility := "false"
			if in.Visibility == "private" {
				visibility = "true"
			}
			var raw []byte
			raw, e = run(ctx, gh, home, "", "api", "--method", "POST", "/user/repos", "-f", "name="+strings.Split(in.FullName, "/")[1], "-F", "private="+visibility)
			if e == nil && !publishRepoMatches(raw, in.FullName, in.Visibility) {
				e = errPublishReceipt
			}
		case "origin":
			_, e = run(ctx, git, home, fd, "remote", "add", "origin", "https://github.com/"+in.FullName+".git")
		case "push":
			// The effective push URL may have changed since the stage probe.
			pushURLs, pushErr := run(ctx, git, home, fd, "remote", "get-url", "--push", "--all", "origin")
			if pushErr != nil || string(pushURLs) != "https://github.com/"+in.FullName+".git\n" {
				snapshotError(w, 409, "origin_conflict")
				return
			}
			// No force, no implicit upstream rewrite. HEAD must be a commit.
			_, e = run(ctx, git, home, fd, "push", "origin", "HEAD")
		}
		if e != nil || ctx.Err() != nil || !workspaceStillNamed(src, target.Name, initial) || !cloneSourceStillNamed(home, source) {
			snapshotError(w, 409, "publish_uncertain")
			return
		}
		historyJSON(w, map[string]any{"schema_version": 1, "full_name": in.FullName, "stage": stage, "state": "confirmed"})
	})
}
