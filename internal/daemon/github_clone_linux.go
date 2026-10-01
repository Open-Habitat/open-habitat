//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/maintainer/native-agent-host/internal/transport"
	"golang.org/x/sys/unix"
)

const RepoClonePath = "/api/v1/onboarding/github/clone"

type cloneRunner func(context.Context, string, string, string, ...string) ([]byte, error)

// RepoCloneHandler runs only on the mapped daemon's trusted socket. A failed
// request is never retried: the native directory is the recovery evidence.
func RepoCloneHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return repoCloneHandler(cfg, trusted, cfg.Home, "/usr/bin/gh", "/usr/bin/git", cloneCommand)
}

// RepoCloneHandlerWithFixturePrograms is an offline integration seam. All
// filesystem and command homes belong to the disposable fixture, never cfg.Home.
func RepoCloneHandlerWithFixturePrograms(cfg transport.Config, trusted func(*http.Request) bool, sourceHome, fixtureHome, gh, git string) http.Handler {
	return repoCloneHandler(cfg, trusted, sourceHome, gh, git, func(ctx context.Context, program, _, fd string, args ...string) ([]byte, error) {
		return cloneCommand(ctx, program, fixtureHome, fd, args...)
	})
}

func repoCloneHandler(cfg transport.Config, trusted func(*http.Request) bool, sourceHome, gh, git string, run cloneRunner) http.Handler {
	var mu sync.Mutex // serialize per-UID case-insensitive collision checks
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		if r.Method != "POST" || r.RequestURI != RepoClonePath || r.URL.Path != RepoClonePath || r.URL.RawQuery != "" || r.Host != "unix" || r.ProtoMajor != 1 || r.ProtoMinor != 1 || r.ContentLength < 1 || r.ContentLength > 256 || len(r.TransferEncoding) != 0 {
			snapshotError(w, 400, "invalid_request")
			return
		}
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		body, err := io.ReadAll(io.LimitReader(r.Body, 257))
		var input struct {
			FullName string `json:"full_name"`
		}
		if err != nil || int64(len(body)) != r.ContentLength || !catalogNoDuplicates(body) || strictCloneJSON(body, &input) != nil || !validCloneName(input.FullName) {
			snapshotError(w, 400, "invalid_request")
			return
		}
		parts := strings.Split(input.FullName, "/")
		ctx, cancel := context.WithTimeout(r.Context(), 90*time.Second)
		defer cancel()
		identity, err := run(ctx, gh, cfg.Home, "", "api", "--method", "GET", "/user")
		var user struct {
			ID json.Number `json:"id"`
		}
		if err != nil || strictRepoJSON(identity, &user) != nil || string(user.ID) != cfg.Subject {
			snapshotError(w, 409, "github_auth_unavailable")
			return
		}
		raw, err := run(ctx, gh, cfg.Home, "", "api", "--method", "GET", "/repos/"+input.FullName)
		var repo struct {
			Name     string `json:"name"`
			FullName string `json:"full_name"`
			CloneURL string `json:"clone_url"`
			Owner    struct {
				Login string `json:"login"`
			} `json:"owner"`
		}
		if err != nil || strictRepoJSON(raw, &repo) != nil || repo.Owner.Login != parts[0] || repo.Name != parts[1] || repo.FullName != input.FullName || repo.CloneURL != "https://github.com/"+input.FullName+".git" {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		if ctx.Err() != nil {
			snapshotError(w, 409, "checkout_uncertain")
			return
		}
		src, err := cloneSource(cfg, sourceHome)
		if err != nil {
			snapshotError(w, 409, "checkout_unavailable")
			return
		}
		defer unix.Close(src)
		srcInitial, _ := stat(src)
		// GitHub repo names are case insensitive. Never conflate an existing tree
		// (including a partial prior attempt) with a successful import.
		dup, e := unix.Dup(src)
		if e != nil {
			snapshotError(w, 409, "checkout_unavailable")
			return
		}
		f := os.NewFile(uintptr(dup), "src")
		entries, e := f.ReadDir(513)
		f.Close()
		if (e != nil && e != io.EOF) || len(entries) > 512 {
			snapshotError(w, 409, "checkout_unavailable")
			return
		}
		for _, entry := range entries {
			if strings.EqualFold(entry.Name(), parts[1]) {
				snapshotError(w, 409, "checkout_exists")
				return
			}
		}
		if ctx.Err() != nil {
			snapshotError(w, 409, "checkout_uncertain")
			return
		}
		if unix.Mkdirat(src, parts[1], 0700) != nil {
			snapshotError(w, 409, "checkout_exists")
			return
		}
		child, e := dir(unix.Openat2, src, parts[1], true)
		if e != nil {
			snapshotError(w, 409, "checkout_uncertain")
			return
		}
		defer unix.Close(child)
		initial, e := stat(child)
		if e != nil || initial.Uid != uint32(cfg.UID) {
			snapshotError(w, 409, "checkout_uncertain")
			return
		}
		// An open cwd, not a pathname, pins Git inside the reserved destination.
		url := repo.CloneURL
		if _, e = run(ctx, git, cfg.Home, strconv.Itoa(child), "clone", "--", url, "."); e != nil {
			snapshotError(w, 409, "checkout_uncertain")
			return
		}
		gd, e := dir(unix.Openat2, child, ".git", true)
		if e != nil {
			snapshotError(w, 409, "checkout_uncertain")
			return
		}
		unix.Close(gd)
		top, e1 := run(ctx, git, cfg.Home, strconv.Itoa(child), "rev-parse", "--is-inside-work-tree")
		remote, e2 := run(ctx, git, cfg.Home, strconv.Itoa(child), "remote", "get-url", "origin")
		status, e3 := run(ctx, git, cfg.Home, strconv.Itoa(child), "status", "--porcelain")
		named, e4 := dir(unix.Openat2, src, parts[1], true)
		var now unix.Stat_t
		if e4 == nil {
			now, e4 = stat(named)
			unix.Close(named)
		}
		sourceOK := cloneSourceStillNamed(sourceHome, srcInitial)
		if e1 != nil || e2 != nil || e3 != nil || e4 != nil || !sourceOK || !same(initial, now) || string(top) != "true\n" || string(remote) != url+"\n" || len(status) != 0 || ctx.Err() != nil {
			snapshotError(w, 409, "checkout_uncertain")
			return
		}
		historyJSON(w, map[string]any{"schema_version": 1, "full_name": input.FullName, "state": "cloned"})
	})
}
func strictCloneJSON(b []byte, v any) error {
	d := json.NewDecoder(strings.NewReader(string(b)))
	d.DisallowUnknownFields()
	if err := d.Decode(v); err != nil {
		return err
	}
	if d.Decode(new(any)) != io.EOF {
		return errors.New("trailing")
	}
	return nil
}
func validCloneName(s string) bool {
	p := strings.Split(s, "/")
	return len(p) == 2 && repoOwner.MatchString(p[0]) && repoName.MatchString(p[1]) && p[1] != "." && p[1] != ".."
}
func cloneSource(cfg transport.Config, home string) (int, error) {
	if cfg.UID != os.Geteuid() {
		return -1, errors.New("identity")
	}
	root, e := unix.Open("/", unix.O_PATH|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if e != nil {
		return -1, e
	}
	defer unix.Close(root)
	if !filepath.IsAbs(home) || filepath.Clean(home) != home || home == "/" {
		return -1, errors.New("home")
	}
	h, e := dir(unix.Openat2, root, strings.TrimPrefix(home, "/"), false)
	if e != nil {
		return -1, e
	}
	defer unix.Close(h)
	hs, e := stat(h)
	if e != nil || hs.Uid != uint32(cfg.UID) || hs.Mode&0022 != 0 {
		return -1, errors.New("home ownership")
	}
	src, e := dir(unix.Openat2, h, "src", true)
	if errors.Is(e, unix.ENOENT) {
		if unix.Mkdirat(h, "src", 0700) != nil {
			return -1, errors.New("src")
		}
		src, e = dir(unix.Openat2, h, "src", true)
	}
	if e != nil {
		return -1, e
	}
	s, e := stat(src)
	if e != nil || s.Uid != uint32(cfg.UID) || s.Mode&0022 != 0 {
		unix.Close(src)
		return -1, errors.New("src ownership")
	}
	return src, nil
}
func cloneCommand(parent context.Context, program, cwd, fd string, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(parent, 70*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, program, args...)
	home := cwd
	if fd != "" {
		n, e := strconv.Atoi(fd)
		if e != nil {
			return nil, e
		}
		copyFD, e := unix.Dup(n)
		if e != nil {
			return nil, e
		}
		file := os.NewFile(uintptr(copyFD), "checkout")
		defer file.Close()
		cmd.ExtraFiles = []*os.File{file}
		cmd.Dir = "/proc/" + strconv.Itoa(os.Getpid()) + "/fd/" + strconv.Itoa(int(file.Fd()))
	} else {
		cmd.Dir = cwd
	}

	cmd.Env = []string{"HOME=" + home, "XDG_CONFIG_HOME=" + filepath.Join(home, ".config"), "PATH=/usr/bin:/bin", "GH_PROMPT_DISABLED=1", "GIT_TERMINAL_PROMPT=0", "GCM_INTERACTIVE=never", "GIT_CONFIG_NOSYSTEM=1", "GIT_OPTIONAL_LOCKS=0"}
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.WaitDelay = time.Second
	out := &limitedRepoWriter{}
	cmd.Stdout = out
	cmd.Stderr = io.Discard
	if e := cmd.Start(); e != nil {
		return nil, e
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
	e := cmd.Wait()
	close(done)
	_ = syscall.Kill(-pid, syscall.SIGKILL)
	if e != nil || out.overflow || ctx.Err() != nil {
		return nil, errors.New("native failure")
	}
	return out.Bytes(), nil
}

// Reopen the trusted path without creation: an fd pinned to an unlinked
// directory is not evidence that ~/src still contains the checkout.
func cloneSourceStillNamed(home string, expected unix.Stat_t) bool {
	root, e := unix.Open("/", unix.O_PATH|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if e != nil {
		return false
	}
	defer unix.Close(root)
	h, e := dir(unix.Openat2, root, strings.TrimPrefix(home, "/"), false)
	if e != nil {
		return false
	}
	defer unix.Close(h)
	src, e := dir(unix.Openat2, h, "src", true)
	if e != nil {
		return false
	}
	defer unix.Close(src)
	current, e := stat(src)
	return e == nil && same(expected, current)
}
