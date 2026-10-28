//go:build linux

package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

const GitIdentityPath = "/api/v1/account/git-identity"

var gitIdentityLogin = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9-]{0,38}$`)

var gitIdentityWriter sync.Mutex

type gitIdentity struct {
	SchemaVersion  int      `json:"schema_version"`
	Name           string   `json:"name"`
	Email          string   `json:"email"`
	Source         string   `json:"source"`
	SuggestedName  string   `json:"suggested_name"`
	SuggestedEmail string   `json:"suggested_email"`
	Emails         []string `json:"emails"`
}

// Only native commands executed as this daemon's UID can supply identity facts.
// The fixture runners are injected solely by package tests.
func GitIdentityHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return gitIdentityHandler(cfg, trusted, func(ctx context.Context, args ...string) ([]byte, error) { return runRepoGH(ctx, cfg.Home, args...) }, func(ctx context.Context, args ...string) ([]byte, error) {
		return runIdentityGit(ctx, cfg.Home, "/usr/bin/git", args...)
	})
}

// GitIdentityHandlerWithFixturePrograms runs against a synthetic home and gh binary.
func GitIdentityHandlerWithFixturePrograms(cfg transport.Config, trusted func(*http.Request) bool, home, ghProgram, gitProgram string) http.Handler {
	cfg.Home = home // synthetic home is the native command's actual HOME
	return gitIdentityHandler(cfg, trusted, func(ctx context.Context, args ...string) ([]byte, error) {
		return runRepoGHProgram(ctx, home, ghProgram, args...)
	}, func(ctx context.Context, args ...string) ([]byte, error) {
		return runIdentityGit(ctx, home, gitProgram, args...)
	})
}

func runIdentityGit(ctx context.Context, home, program string, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, program, args...)
	cmd.Dir = home
	cmd.Env = []string{"HOME=" + home, "XDG_CONFIG_HOME=" + filepath.Join(home, ".config"), "PATH=/usr/bin:/bin", "GIT_CONFIG_NOSYSTEM=1", "GIT_TERMINAL_PROMPT=0"}
	// Reads must observe all native global values (including XDG and includes).
	// A new write, once proven unset, is pinned to the promised ~/.gitconfig.
	if len(args) == 4 && args[0] == "config" && args[1] == "--global" && args[2] != "--get" {
		cmd.Env = append(cmd.Env, "GIT_CONFIG_GLOBAL="+filepath.Join(home, ".gitconfig"))
	}
	out := &limitedRepoWriter{}
	cmd.Stdout = out
	cmd.Stderr = io.Discard
	err := cmd.Run()
	if out.overflow {
		return nil, os.ErrInvalid
	}
	return out.Bytes(), err
}

func gitValue(ctx context.Context, run func(context.Context, ...string) ([]byte, error), key string) (string, error) {
	b, e := run(ctx, "config", "--global", "--get", key)
	if e != nil {
		if exit, ok := e.(*exec.ExitError); ok && exit.ExitCode() == 1 {
			return "", nil
		}
		return "", e
	}
	return strings.TrimSuffix(string(b), "\n"), nil
}

func gitSource(ctx context.Context, run func(context.Context, ...string) ([]byte, error), home, key string) string {
	b, e := run(ctx, "config", "--global", "--show-origin", "--get", key)
	if e != nil {
		return "Gitin globaali asetus"
	}
	path, _, found := strings.Cut(strings.TrimSuffix(string(b), "\n"), "\t")
	if !found {
		return "Gitin globaali asetus"
	}
	switch path {
	case "file:" + filepath.Join(home, ".gitconfig"):
		return "~/.gitconfig"
	case "file:" + filepath.Join(home, ".config/git/config"):
		return "~/.config/git/config"
	default:
		return "Gitin globaali asetus"
	}
}

func validGitValue(s string, max int) bool {
	return s != "" && len(s) <= max && strings.TrimSpace(s) == s && !strings.ContainsAny(s, "\x00\r\n<>")
}

func gitProfile(ctx context.Context, gh func(context.Context, ...string) ([]byte, error), subject string) (string, string, []string, bool) {
	b, e := gh(ctx, "api", "--method", "GET", "/user")
	var u struct {
		ID    json.Number `json:"id"`
		Login string      `json:"login"`
		Name  string      `json:"name"`
	}
	if e != nil || strictRepoJSON(b, &u) != nil || string(u.ID) != subject || !gitIdentityLogin.MatchString(u.Login) {
		return "", "", nil, false
	}
	name := strings.TrimSpace(u.Name)
	if !validGitValue(name, 200) {
		name = u.Login
	}
	noreply := subject + "+" + u.Login + "@users.noreply.github.com"
	emails := []string{noreply}
	// A missing email permission must not prevent the safe noreply choice.
	b, e = gh(ctx, "api", "--method", "GET", "/user/emails?per_page=100")
	if e == nil {
		var rows []struct {
			Email    string `json:"email"`
			Verified bool   `json:"verified"`
		}
		if strictRepoJSON(b, &rows) == nil && len(rows) <= 100 {
			for _, row := range rows {
				if row.Verified && validGitValue(row.Email, 254) && strings.Contains(row.Email, "@") && !slices.Contains(emails, row.Email) {
					emails = append(emails, row.Email)
				}
			}
		}
	}
	return name, noreply, emails, true
}

func gitIdentityHandler(cfg transport.Config, trusted func(*http.Request) bool, gh, git func(context.Context, ...string) ([]byte, error)) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != GitIdentityPath || r.RequestURI != GitIdentityPath || r.Host != "unix" || (r.Method != "GET" && r.Method != "POST") || len(r.TransferEncoding) != 0 {
			snapshotError(w, 400, "invalid_request")
			return
		}
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		if cfg.UID != os.Geteuid() || cfg.Home == "" {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		if r.Method == "POST" {
			// Serializes identity writes, so onboarding's "never overwrite" check
			// and its write are one step. It is not the ~/src writer: a clone that
			// runs for many minutes never touches ~/.gitconfig and must not block
			// confirming the identity during onboarding.
			if !gitIdentityWriter.TryLock() {
				snapshotError(w, 409, "workspace_identity_running")
				return
			}
			defer gitIdentityWriter.Unlock()
		}
		ctx, cancel := context.WithTimeout(r.Context(), 12*time.Second)
		defer cancel()
		read := func() (string, string, bool) {
			n, e := gitValue(ctx, git, "user.name")
			if e != nil {
				return "", "", false
			}
			m, e := gitValue(ctx, git, "user.email")
			return n, m, e == nil
		}
		name, email, ok := read()
		if !ok {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		source := "~/.gitconfig"
		if name != "" || email != "" {
			key := "user.name"
			if name == "" {
				key = "user.email"
			}
			source = gitSource(ctx, git, cfg.Home, key)
			if name != "" && email != "" && gitSource(ctx, git, cfg.Home, "user.email") != source {
				source = "Gitin globaali asetus"
			}
		}
		reply := gitIdentity{SchemaVersion: 1, Name: name, Email: email, Source: source, Emails: []string{}}
		if r.Method == "GET" {
			if r.ContentLength > 0 {
				snapshotError(w, 400, "invalid_request")
				return
			}
			if suggested, noreply, emails, available := gitProfile(ctx, gh, cfg.Subject); available {
				reply.SuggestedName = suggested
				reply.SuggestedEmail = noreply
				reply.Emails = emails
			}
			historyJSON(w, reply)
			return
		}
		if r.ContentLength < 2 || r.ContentLength > 1024 || r.Header.Get("Content-Type") != "application/json" {
			snapshotError(w, 400, "invalid_request")
			return
		}
		b, e := io.ReadAll(io.LimitReader(r.Body, 1025))
		var in struct {
			Name  string `json:"name"`
			Email string `json:"email"`
			Mode  string `json:"mode"`
		}
		decoder := json.NewDecoder(bytes.NewReader(b))
		decoder.DisallowUnknownFields()
		if e != nil || int64(len(b)) != r.ContentLength || !catalogNoDuplicates(b) || decoder.Decode(&in) != nil || decoder.Decode(new(any)) != io.EOF || !validGitValue(in.Name, 200) || !validGitValue(in.Email, 254) || !strings.Contains(in.Email, "@") || (in.Mode != "onboarding" && in.Mode != "settings") {
			snapshotError(w, 400, "invalid_request")
			return
		}
		if in.Mode == "onboarding" {
			if name != "" || email != "" {
				snapshotError(w, 409, "identity_exists")
				return
			}
			// Commit metadata is chosen by the person, not proof of their login.
			// The account profile can contain an address absent from GitHub.
		}
		// Git owns its config format. Never overwrite a pre-existing onboarding value.
		if _, e = git(ctx, "config", "--global", "user.name", in.Name); e != nil {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		if _, e = git(ctx, "config", "--global", "user.email", in.Email); e != nil {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		reply.Name, reply.Email, ok = read()
		if !ok || reply.Name != in.Name || reply.Email != in.Email {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		historyJSON(w, reply)
	})
}
