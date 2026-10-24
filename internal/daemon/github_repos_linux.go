//go:build linux

package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"syscall"
	"time"
	"unicode/utf8"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

const RepoCatalogPath = "/api/v1/onboarding/github/repos"
const RepoLookupPath = "/api/v1/onboarding/github/repository"

// GitHub sends full repository objects (~7 KiB each), even though we expose a
// small projection. One bounded 100-item page must fit before projection.
const repoOutputLimit = 2 << 20

// The catalog reads at most this many pages of 100: about a thousand
// repositories, newest push first. An exact name beyond it is looked up.
const repoCatalogPages = 10

var repoName = regexp.MustCompile(`^[A-Za-z0-9_.-]{1,100}$`)
var repoOwner = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9-]{0,38}$`)

type repoItem struct {
	FullName      string  `json:"full_name"`
	Private       bool    `json:"private"`
	Description   string  `json:"description"`
	HTMLURL       string  `json:"html_url"`
	PushedAt      *string `json:"pushed_at"`
	SizeKiB       int64   `json:"size_kib"`
	DefaultBranch *string `json:"default_branch"`
	OwnerType     string  `json:"owner_type"`
	// Default marks one of the site's defaults the gateway put on this
	// request: preselected, or locked while the site fetches it (auto).
	Default string `json:"default,omitempty"`
}
type repoReply struct {
	SchemaVersion int `json:"schema_version"`
	// Login is the bound GitHub account's own login, read by the same /user
	// check, so the browser can tell the person's own repositories apart.
	Login        string     `json:"login,omitempty"`
	Complete     bool       `json:"complete"`
	Repositories []repoItem `json:"repositories"`
}

// nativeRepo is the part of GitHub's repository object the projection reads.
type nativeRepo struct {
	Name          string  `json:"name"`
	FullName      string  `json:"full_name"`
	Private       *bool   `json:"private"`
	Description   *string `json:"description"`
	HTMLURL       string  `json:"html_url"`
	PushedAt      *string `json:"pushed_at"`
	Size          *int64  `json:"size"`
	DefaultBranch *string `json:"default_branch"`
	Owner         struct {
		Login string `json:"login"`
		Type  string `json:"type"`
	} `json:"owner"`
}

// project validates one native object. A structurally wrong object fails
// the whole read; an owner type outside the contract (a bot account) only
// skips that repository, and a description is cleaned rather than refused.
func (v nativeRepo) project() (repoItem, bool, bool) {
	if !repoOwner.MatchString(v.Owner.Login) || !repoName.MatchString(v.Name) || v.Name == "." || v.Name == ".." || v.FullName != v.Owner.Login+"/"+v.Name || v.Private == nil || v.HTMLURL != "https://github.com/"+v.FullName || v.Size == nil || *v.Size < 0 || *v.Size > 9007199254740991 {
		return repoItem{}, false, false
	}
	if v.PushedAt != nil {
		stamp, err := time.Parse(time.RFC3339, *v.PushedAt)
		if err != nil || stamp.Format(time.RFC3339) != *v.PushedAt {
			return repoItem{}, false, false
		}
	}
	if v.DefaultBranch != nil && (*v.DefaultBranch == "" || len(*v.DefaultBranch) > 255 || strings.IndexFunc(*v.DefaultBranch, func(r rune) bool { return r < 0x20 || r == 0x7f }) >= 0) {
		return repoItem{}, false, false
	}
	if v.Owner.Type != "User" && v.Owner.Type != "Organization" {
		return repoItem{}, false, true
	}
	desc := ""
	if v.Description != nil {
		desc = strings.Map(func(r rune) rune {
			if r < 0x20 || r == 0x7f {
				return ' '
			}
			return r
		}, strings.ToValidUTF8(*v.Description, ""))
	}
	for len(desc) > 500 {
		_, size := utf8.DecodeLastRuneInString(desc)
		desc = desc[:len(desc)-size]
	}
	return repoItem{FullName: v.FullName, Private: *v.Private, Description: desc, HTMLURL: v.HTMLURL, PushedAt: v.PushedAt, SizeKiB: *v.Size, DefaultBranch: v.DefaultBranch, OwnerType: v.Owner.Type}, true, false
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

// RepoLookupHandler answers one exact owner/repo, in the catalog or not.
func RepoLookupHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return repoLookupHandler(cfg, trusted, func(ctx context.Context, args ...string) ([]byte, error) { return runRepoGH(ctx, cfg.Home, args...) })
}

// RepoLookupHandlerWithFixtureGH is the offline fixture seam for the lookup.
func RepoLookupHandlerWithFixtureGH(cfg transport.Config, trusted func(*http.Request) bool, program, home string) http.Handler {
	return repoLookupHandler(cfg, trusted, func(ctx context.Context, args ...string) ([]byte, error) {
		return runRepoGHProgram(ctx, home, program, args...)
	})
}

// boundGitHubUser checks that the installed gh authorization belongs to this
// daemon's immutable broker subject; gh status alone does not bind it. The
// login is returned only when it is a valid GitHub owner name.
func boundGitHubUser(ctx context.Context, cfg transport.Config, run func(context.Context, ...string) ([]byte, error)) (string, bool) {
	identity, err := run(ctx, "api", "--method", "GET", "/user")
	if err != nil {
		return "", false
	}
	var user struct {
		ID    json.Number `json:"id"`
		Login string      `json:"login"`
	}
	if strictRepoJSON(identity, &user) != nil || string(user.ID) != cfg.Subject {
		return "", false
	}
	if !repoOwner.MatchString(user.Login) {
		user.Login = ""
	}
	return user.Login, true
}

func repoCatalogHandler(cfg transport.Config, trusted func(*http.Request) bool, run func(context.Context, ...string) ([]byte, error)) http.Handler {
	return repoCatalogHandlerAt(cfg, trusted, run, RepoCatalogPath)
}

// catalogDefaults reads the site defaults the gateway puts on its own
// catalog request (ADR 0030): the mode and the names its sign-in check found
// this person can read, in the gateway's canonical encoding. No query is the
// ordinary catalog.
func catalogDefaults(r *http.Request, path string) (mark string, names []string, ok bool) {
	if r.URL.RawQuery == "" {
		return "", nil, r.RequestURI == path
	}
	// Only the gateway's route carries site defaults; an agent's does not.
	if path != RepoCatalogPath {
		return "", nil, false
	}
	q, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil || len(q) != 2 || len(q["mode"]) != 1 || len(q["default"]) < 1 || len(q["default"]) > transport.MaxPlanDefaults || q.Encode() != r.URL.RawQuery || r.RequestURI != path+"?"+r.URL.RawQuery {
		return "", nil, false
	}
	switch q.Get("mode") {
	case "preselected":
		mark = "preselected"
	case "auto":
		mark = "locked"
	default:
		return "", nil, false
	}
	seen := map[string]bool{}
	for _, n := range q["default"] {
		if !transport.ValidPlanName(n) || seen[strings.ToLower(n)] {
			return "", nil, false
		}
		seen[strings.ToLower(n)] = true
	}
	return mark, q["default"], true
}

func repoCatalogHandlerAt(cfg transport.Config, trusted func(*http.Request) bool, run func(context.Context, ...string) ([]byte, error), path string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mark, defaults, valid := catalogDefaults(r, path)
		if !valid || r.Method != "GET" || r.URL.Path != path || r.URL.EscapedPath() != path || r.ContentLength > 0 || len(r.TransferEncoding) != 0 || r.ProtoMajor != 1 || r.ProtoMinor != 1 {
			snapshotError(w, 400, "invalid_request")
			return
		}
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		extendReply(w, 40*time.Second)
		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()
		// Check /user first, even when the catalog is empty.
		login, bound := boundGitHubUser(ctx, cfg, run)
		if !bound {
			snapshotError(w, 409, "github_auth_unavailable")
			return
		}
		result := repoReply{SchemaVersion: 1, Login: login, Repositories: []repoItem{}}
		seen := map[string]bool{}
		for page := 1; page <= repoCatalogPages; page++ {
			endpoint := fmt.Sprintf("/user/repos?affiliation=owner%%2Ccollaborator%%2Corganization_member&per_page=100&page=%d&sort=pushed&direction=desc", page)
			raw, err := run(ctx, "api", "--method", "GET", endpoint)
			var rows []nativeRepo
			if err != nil || strictRepoJSON(raw, &rows) != nil || rows == nil || len(rows) > 100 {
				snapshotError(w, 503, "native_source_unavailable")
				return
			}
			for _, v := range rows {
				item, ok, skip := v.project()
				if skip {
					continue
				}
				if !ok {
					snapshotError(w, 503, "native_source_unavailable")
					return
				}
				// A push during the read moves a repository between pages.
				if seen[strings.ToLower(item.FullName)] {
					continue
				}
				seen[strings.ToLower(item.FullName)] = true
				result.Repositories = append(result.Repositories, item)
			}
			if len(rows) < 100 {
				result.Complete = true
				break
			}
		}
		// A default outside the person's catalog (a public repository of an
		// organisation they are not in, or beyond the first thousand) is
		// looked up by name; one GitHub no longer shows this person is left
		// out, as is one that cannot be read now.
		for _, name := range defaults {
			found := false
			for i := range result.Repositories {
				if strings.EqualFold(result.Repositories[i].FullName, name) {
					result.Repositories[i].Default, found = mark, true
				}
			}
			if !found && ctx.Err() == nil {
				if item, state := lookupRepo(ctx, run, name); state == "found" && !seen[strings.ToLower(item.FullName)] {
					seen[strings.ToLower(item.FullName)] = true
					item.Default = mark
					result.Repositories = append(result.Repositories, item)
				}
			}
		}
		sort.SliceStable(result.Repositories, func(i, j int) bool {
			a, b := result.Repositories[i], result.Repositories[j]
			if (a.PushedAt == nil) != (b.PushedAt == nil) {
				return a.PushedAt != nil
			}
			if a.PushedAt != nil && *a.PushedAt != *b.PushedAt {
				return *a.PushedAt > *b.PushedAt
			}
			return strings.ToLower(a.FullName) < strings.ToLower(b.FullName)
		})
		historyJSON(w, result)
	})
}

// lookupName accepts exactly one canonical full_name query.
func lookupName(r *http.Request) (string, bool) { return lookupNameAt(r, RepoLookupPath) }
func lookupNameAt(r *http.Request, path string) (string, bool) {
	if r.Method != "GET" || r.URL.Path != path || r.URL.EscapedPath() != path || r.ContentLength > 0 || len(r.TransferEncoding) != 0 || r.ProtoMajor != 1 || r.ProtoMinor != 1 {
		return "", false
	}
	q, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil || len(q) != 1 || len(q["full_name"]) != 1 {
		return "", false
	}
	name := q.Get("full_name")
	return name, validCloneName(name) && r.RequestURI == path+"?full_name="+url.QueryEscape(name)
}

var ghStatusLine = regexp.MustCompile(`^HTTP/[0-9.]+ ([0-9]{3})`)

func repoLookupHandler(cfg transport.Config, trusted func(*http.Request) bool, run func(context.Context, ...string) ([]byte, error)) http.Handler {
	return repoLookupHandlerAt(cfg, trusted, run, RepoLookupPath)
}

func repoLookupHandlerAt(cfg transport.Config, trusted func(*http.Request) bool, run func(context.Context, ...string) ([]byte, error), path string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name, ok := lookupNameAt(r, path)
		if !ok {
			snapshotError(w, 400, "invalid_request")
			return
		}
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		extendReply(w, 25*time.Second)
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		if _, bound := boundGitHubUser(ctx, cfg, run); !bound {
			snapshotError(w, 409, "github_auth_unavailable")
			return
		}
		switch item, state := lookupRepo(ctx, run, name); state {
		case "not_found":
			historyJSON(w, map[string]any{"schema_version": 1, "full_name": name, "state": "not_found"})
		case "found":
			historyJSON(w, map[string]any{"schema_version": 1, "full_name": name, "state": "found", "repository": item})
		default:
			snapshotError(w, 503, "native_source_unavailable")
		}
	})
}

// lookupRepo reads one exact owner/repo with the person's gh: found,
// not_found (GitHub says this user cannot reach it) or unavailable.
func lookupRepo(ctx context.Context, run func(context.Context, ...string) ([]byte, error), name string) (repoItem, string) {
	// --include keeps GitHub's status: gh exits 1 on any HTTP error, but
	// only a 404 (or a 403/451 refusal) says this user cannot reach it.
	raw, err := run(ctx, "api", "--include", "--method", "GET", "/repos/"+name)
	var exit *nativeCommandExit
	if err != nil && !(errors.As(err, &exit) && exit.Code == 1) {
		return repoItem{}, "unavailable"
	}
	status := ghStatusLine.FindSubmatch(raw)
	body := raw
	if i := bytes.Index(raw, []byte("\r\n\r\n")); i >= 0 {
		body = raw[i+4:]
	} else if i := bytes.Index(raw, []byte("\n\n")); i >= 0 {
		body = raw[i+2:]
	} else {
		status = nil
	}
	switch {
	case status == nil:
		return repoItem{}, "unavailable"
	case err != nil && (string(status[1]) == "404" || string(status[1]) == "403" || string(status[1]) == "451"):
		return repoItem{}, "not_found"
	case err == nil && string(status[1]) == "200":
		var v nativeRepo
		if strictRepoJSON(body, &v) == nil {
			if item, ok, skip := v.project(); ok && !skip {
				return item, "found"
			}
		}
	}
	return repoItem{}, "unavailable"
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
	if out.overflow || ctx.Err() != nil {
		return nil, fmt.Errorf("native unavailable")
	}
	if err != nil {
		// The output of a plain non-zero exit is returned with its status
		// for a caller that reads GitHub's own answer (gh api --include).
		var exit *exec.ExitError
		if errors.As(err, &exit) && exit.ExitCode() >= 0 {
			return out.Bytes(), &nativeCommandExit{Code: exit.ExitCode()}
		}
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
