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
	"syscall"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

const RepoClonePath = "/api/v1/onboarding/github/clone"
const RepoCloneStreamPath = RepoClonePath + "/stream"

type cloneRunner func(context.Context, string, string, string, ...string) ([]byte, error)

// RepoCloneHandler runs only on the mapped daemon's trusted socket. A failed
// request is never retried: the native directory is the recovery evidence.
func RepoCloneHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return cloneHandler(cfg, trusted, cfg.Home, "/usr/bin/gh", "/usr/bin/git", cloneCommand, false, boundedCloneVolume)
}

// RepoCloneHandlerWithFixturePrograms is an offline integration seam. All
// filesystem and command homes belong to the disposable fixture, never cfg.Home.
func RepoCloneHandlerWithFixturePrograms(cfg transport.Config, trusted func(*http.Request) bool, sourceHome, fixtureHome, gh, git string) http.Handler {
	return repoCloneHandler(cfg, trusted, sourceHome, gh, git, func(ctx context.Context, program, _, fd string, args ...string) ([]byte, error) {
		return cloneCommand(ctx, program, fixtureHome, fd, args...)
	})
}

// RepoCloneStreamHandler is the non-replayable, single-writer onboarding stream.
func RepoCloneStreamHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return repoCloneStreamHandler(cfg, trusted, cfg.Home, "/usr/bin/gh", "/usr/bin/git", cloneCommand, boundedCloneVolume)
}

// RepoCloneStreamHandlerWithFixturePrograms runs only against disposable homes;
// the production route always uses the real bounded-volume admission check.
func RepoCloneStreamHandlerWithFixturePrograms(cfg transport.Config, trusted func(*http.Request) bool, home, gh, git string) http.Handler {
	return repoCloneStreamHandler(cfg, trusted, home, gh, git, func(ctx context.Context, program, _, fd string, args ...string) ([]byte, error) {
		return cloneCommand(ctx, program, home, fd, args...)
	}, func(int) bool { return true })
}

func repoCloneStreamHandler(cfg transport.Config, trusted func(*http.Request) bool, home, gh, git string, run cloneRunner, budget func(int) bool) http.Handler {
	return cloneHandler(cfg, trusted, home, gh, git, run, true, budget)
}

func repoCloneHandler(cfg transport.Config, trusted func(*http.Request) bool, sourceHome, gh, git string, run cloneRunner) http.Handler {
	return cloneHandler(cfg, trusted, sourceHome, gh, git, run, false, nil)
}

func cloneHandler(cfg transport.Config, trusted func(*http.Request) bool, sourceHome, gh, git string, run cloneRunner, streaming bool, budget func(int) bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !cloneWriter.TryLock() {
			snapshotError(w, 409, "checkout_unavailable")
			return
		}
		defer cloneWriter.Unlock()
		path := RepoClonePath
		if streaming {
			path = RepoCloneStreamPath
		}
		if r.Method != "POST" || r.RequestURI != path || r.URL.Path != path || r.URL.RawQuery != "" || r.Host != "unix" || r.ProtoMajor != 1 || r.ProtoMinor != 1 || r.ContentLength < 1 || r.ContentLength > 256 || len(r.TransferEncoding) != 0 {
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
		ceiling := 90 * time.Second
		if streaming {
			ceiling = 45 * time.Minute
		}
		ctx, cancel := context.WithTimeout(r.Context(), ceiling)
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
		src, err := cloneSource(cfg, sourceHome, budget == nil)
		if err != nil {
			snapshotError(w, 409, "checkout_unavailable")
			return
		}
		defer unix.Close(src)
		srcMode, modeErr := stat(src)
		if budget != nil && (modeErr != nil || srcMode.Mode&0777 != 0700 || !budget(src) || ctx.Err() != nil) {
			snapshotError(w, 409, "checkout_unavailable")
			return
		}
		var emit *cloneEmitter
		if streaming {
			if _, ok := w.(http.Flusher); !ok {
				snapshotError(w, 503, "checkout_unavailable")
				return
			}
			emit = &cloneEmitter{w: w, cancel: cancel}
		}
		srcInitial, _ := stat(src)
		// GitHub repo names are case insensitive. Never conflate an existing tree
		// (including a partial prior attempt) with a successful import.
		conflict := false
		e := eachSourceEntry(src, func(entry os.DirEntry) {
			if strings.EqualFold(entry.Name(), parts[1]) {
				conflict = true
			}
		})
		if e != nil {
			snapshotError(w, 409, "checkout_unavailable")
			return
		}
		if conflict {
			snapshotError(w, 409, "checkout_exists")
			return
		}
		if ctx.Err() != nil {
			snapshotError(w, 409, "checkout_uncertain")
			return
		}
		if streaming {
			w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
			w.Header().Set("Cache-Control", "no-store")
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.WriteHeader(200)
			if !emit.progress("reserving", -1) {
				return
			}
			ticker := time.NewTicker(20 * time.Second)
			stop := make(chan struct{})
			defer func() { close(stop); ticker.Stop() }()
			go func() {
				for {
					select {
					case <-ticker.C:
						emit.heartbeat()
					case <-stop:
						return
					case <-ctx.Done():
						return
					}
				}
			}()
		}
		if unix.Mkdirat(src, parts[1], 0700) != nil {
			cloneFail(w, emit, "destination_exists")
			return
		}
		child, e := dir(unix.Openat2, src, parts[1], true)
		if e != nil {
			cloneFail(w, emit, "verification_failed")
			return
		}
		defer unix.Close(child)
		initial, e := stat(child)
		if e != nil || initial.Uid != uint32(cfg.UID) {
			cloneFail(w, emit, "verification_failed")
			return
		}
		if emit != nil && !emit.progress("connecting", -1) {
			return
		}
		// An open cwd, not a pathname, pins Git inside the reserved destination.
		url := repo.CloneURL
		if streaming {
			e = cloneProgressCommand(ctx, git, cfg.Home, child, url, emit)
		} else {
			_, e = run(ctx, git, cfg.Home, strconv.Itoa(child), "clone", "--", url, ".")
		}
		if e != nil {
			cloneFail(w, emit, cloneReason(e))
			return
		}
		if emit != nil && !emit.progress("verifying", -1) {
			return
		}
		gd, e := dir(unix.Openat2, child, ".git", true)
		if e != nil {
			cloneFail(w, emit, "verification_failed")
			return
		}
		unix.Close(gd)
		top, e1 := run(ctx, git, cfg.Home, strconv.Itoa(child), "rev-parse", "--is-inside-work-tree")
		remote, e2 := run(ctx, git, cfg.Home, strconv.Itoa(child), "remote", "get-url", "origin")
		status, e3 := run(ctx, git, cfg.Home, strconv.Itoa(child), "status", "--porcelain")
		head, e5 := run(ctx, git, cfg.Home, strconv.Itoa(child), "rev-parse", "--verify", "HEAD^{commit}")
		named, e4 := dir(unix.Openat2, src, parts[1], true)
		var now unix.Stat_t
		if e4 == nil {
			now, e4 = stat(named)
			unix.Close(named)
		}
		sourceOK := cloneSourceStillNamed(sourceHome, srcInitial)
		if e1 != nil || e2 != nil || e3 != nil || e4 != nil || e5 != nil || !validCloneCommit(head) || !sourceOK || !same(initial, now) || string(top) != "true\n" || string(remote) != url+"\n" || len(status) != 0 || ctx.Err() != nil {
			cloneFail(w, emit, "verification_failed")
			return
		}
		if streaming {
			emit.terminal("confirmed", "")
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
func cloneSource(cfg transport.Config, home string, allowCreate bool) (int, error) {
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
	src, e := dir(unix.Openat2, h, "src", false)
	if errors.Is(e, unix.ENOENT) && allowCreate {
		if unix.Mkdirat(h, "src", 0700) != nil {
			return -1, errors.New("src")
		}
		src, e = dir(unix.Openat2, h, "src", false)
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
	return cloneCommandWithTimeout(parent, 70*time.Second, program, cwd, fd, args...)
}
func cloneCommandWithTimeout(parent context.Context, limit time.Duration, program, cwd, fd string, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(parent, limit)
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
	src, e := dir(unix.Openat2, h, "src", false)
	if e != nil {
		return false
	}
	defer unix.Close(src)
	current, e := stat(src)
	return e == nil && same(expected, current)
}
