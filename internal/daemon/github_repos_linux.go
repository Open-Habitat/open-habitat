//go:build linux

package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/maintainer/native-agent-host/internal/transport"
)

const RepoCatalogPath = "/api/v1/onboarding/github/repos"

// GitHub sends full repository objects (~7 KiB each), even though we expose a
// small projection. One bounded 50-item page must fit before projection.
const repoOutputLimit = 1 << 20

var repoName = regexp.MustCompile(`^[A-Za-z0-9_.-]{1,100}$`)
var repoOwner = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9-]{0,38}$`)

type repoItem struct {
	FullName    string  `json:"full_name"`
	Private     bool    `json:"private"`
	Description string  `json:"description"`
	HTMLURL     string  `json:"html_url"`
	PushedAt    *string `json:"pushed_at"`
}
type repoReply struct {
	SchemaVersion int        `json:"schema_version"`
	Page          int        `json:"page"`
	Limit         int        `json:"limit"`
	HasMore       bool       `json:"has_more"`
	Repositories  []repoItem `json:"repositories"`
}

// RepoCatalogHandler uses the per-UID daemon's installed gh authorization,
// not a token or owner from HTTP. Pi sign-in does not govern repository reads.
func RepoCatalogHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return repoCatalogHandler(cfg, trusted, func(ctx context.Context, args ...string) ([]byte, error) { return runRepoGH(ctx, cfg.Home, args...) })
}

// RepoCatalogHandlerWithFixtureGH permits an offline cross-package integration
// fixture to invoke its own synthetic gh binary; production never uses it.
func RepoCatalogHandlerWithFixtureGH(cfg transport.Config, trusted func(*http.Request) bool, program, home string) http.Handler {
	return repoCatalogHandler(cfg, trusted, func(ctx context.Context, args ...string) ([]byte, error) {
		return runRepoGHProgram(ctx, home, program, args...)
	})
}
func repoCatalogHandler(cfg transport.Config, trusted func(*http.Request) bool, run func(context.Context, ...string) ([]byte, error)) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		page, limit, ok := repoQuery(r)
		if !ok {
			snapshotError(w, 400, "invalid_request")
			return
		}
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
		defer cancel()
		// gh status alone does not bind the installed authorization to this daemon's
		// immutable broker subject. Check /user first, even when the repo page is empty.
		identity, err := run(ctx, "api", "--method", "GET", "/user")
		if err != nil {
			snapshotError(w, 409, "github_auth_unavailable")
			return
		}
		var user struct {
			ID json.Number `json:"id"`
		}
		if strictRepoJSON(identity, &user) != nil || string(user.ID) != cfg.Subject {
			snapshotError(w, 409, "github_auth_unavailable")
			return
		}
		// GitHub pages at the requested size; a full page may have a successor.
		endpoint := fmt.Sprintf("/user/repos?affiliation=owner%%2Ccollaborator%%2Corganization_member&per_page=%d&page=%d&sort=full_name&direction=asc", limit, page)
		raw, err := run(ctx, "api", "--method", "GET", endpoint)
		if err != nil || len(raw) > repoOutputLimit {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		var rows []struct {
			Name        string  `json:"name"`
			FullName    string  `json:"full_name"`
			Private     *bool   `json:"private"`
			Description *string `json:"description"`
			HTMLURL     string  `json:"html_url"`
			PushedAt    *string `json:"pushed_at"`
			Owner       struct {
				Login string `json:"login"`
			} `json:"owner"`
		}
		if strictRepoJSON(raw, &rows) != nil || rows == nil || len(rows) > limit {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		more := len(rows) == limit
		result := repoReply{SchemaVersion: 1, Page: page, Limit: limit, HasMore: more, Repositories: make([]repoItem, 0, len(rows))}
		seen := map[string]bool{}
		for _, v := range rows {
			if !repoOwner.MatchString(v.Owner.Login) || !repoName.MatchString(v.Name) || v.Name == "." || v.Name == ".." || v.FullName != v.Owner.Login+"/"+v.Name || v.Private == nil || v.HTMLURL != "https://github.com/"+v.FullName || seen[strings.ToLower(v.FullName)] {
				snapshotError(w, 503, "native_source_unavailable")
				return
			}
			seen[strings.ToLower(v.FullName)] = true
			desc := ""
			if v.Description != nil {
				desc = *v.Description
			}
			if len(desc) > 500 || strings.ContainsAny(desc, "\r\n\x00") {
				snapshotError(w, 503, "native_source_unavailable")
				return
			}
			if v.PushedAt != nil {
				stamp, err := time.Parse(time.RFC3339, *v.PushedAt)
				if err != nil || stamp.Format(time.RFC3339) != *v.PushedAt {
					snapshotError(w, 503, "native_source_unavailable")
					return
				}
			}
			result.Repositories = append(result.Repositories, repoItem{v.FullName, *v.Private, desc, v.HTMLURL, v.PushedAt})
		}
		sort.Slice(result.Repositories, func(i, j int) bool {
			return strings.ToLower(result.Repositories[i].FullName) < strings.ToLower(result.Repositories[j].FullName)
		})
		historyJSON(w, result)
	})
}
func repoQuery(r *http.Request) (int, int, bool) {
	if r.Method != "GET" || r.URL.Path != RepoCatalogPath || r.URL.EscapedPath() != RepoCatalogPath || r.URL.Fragment != "" || r.ContentLength > 0 || len(r.TransferEncoding) != 0 || r.ProtoMajor != 1 || r.ProtoMinor != 1 {
		return 0, 0, false
	}
	q := r.URL.Query()
	if len(q) != 2 || len(q["page"]) != 1 || len(q["limit"]) != 1 {
		return 0, 0, false
	}
	page, e := strconv.Atoi(q.Get("page"))
	limit, f := strconv.Atoi(q.Get("limit"))
	if e != nil || f != nil || page < 1 || page > 100 || limit < 1 || limit > 50 || q.Get("page") != strconv.Itoa(page) || q.Get("limit") != strconv.Itoa(limit) || r.URL.RawQuery != "page="+strconv.Itoa(page)+"&limit="+strconv.Itoa(limit) || r.RequestURI != RepoCatalogPath+"?"+r.URL.RawQuery {
		return 0, 0, false
	}
	return page, limit, true
}
func strictRepoJSON(b []byte, v any) error {
	if len(b) > repoOutputLimit || !catalogNoDuplicates(b) {
		return fmt.Errorf("oversized")
	}
	d := json.NewDecoder(bytes.NewReader(b))
	d.UseNumber()
	if err := d.Decode(v); err != nil {
		return err
	}
	if d.Decode(new(any)) != io.EOF {
		return fmt.Errorf("trailing data")
	}
	return nil
}

// No inherited secrets or gh configuration overrides; kill the process group on
// cancellation so credential helpers cannot outlive the request.
func runRepoGH(parent context.Context, home string, args ...string) ([]byte, error) {
	return runRepoGHProgram(parent, home, "/usr/bin/gh", args...)
}
func runRepoGHProgram(parent context.Context, home, program string, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(parent, 7*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, program, args...)
	cmd.Dir = home
	cmd.Env = []string{"HOME=" + home, "XDG_CONFIG_HOME=" + filepath.Join(home, ".config"), "PATH=/usr/bin:/bin", "GH_PROMPT_DISABLED=1", "GIT_TERMINAL_PROMPT=0"}
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.WaitDelay = time.Second
	out := &limitedRepoWriter{}
	cmd.Stdout = out
	cmd.Stderr = io.Discard
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	pid := cmd.Process.Pid
	done := make(chan struct{})
	go func() {
		select {
		case <-ctx.Done():
			_ = syscall.Kill(-pid, syscall.SIGKILL)
		case <-done:
		}
	}()
	err := cmd.Wait()
	close(done)
	_ = syscall.Kill(-pid, syscall.SIGKILL)
	if err != nil || out.overflow || ctx.Err() != nil {
		return nil, fmt.Errorf("native unavailable")
	}
	return out.Bytes(), nil
}

type limitedRepoWriter struct {
	bytes.Buffer
	overflow bool
}

func (w *limitedRepoWriter) Write(b []byte) (int, error) {
	if w.Len()+len(b) > repoOutputLimit {
		w.overflow = true
		return len(b), fmt.Errorf("output limit")
	}
	return w.Buffer.Write(b)
}
