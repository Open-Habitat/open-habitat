//go:build linux

// Package nativegh installs and observes native GitHub CLI credentials as the
// already mapped Unix user. It does not own web identity or browser state.
package nativegh

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"golang.org/x/sys/unix"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/maintainer/native-agent-host/internal/transport"
)

const timeout = 4 * time.Second

var denied = errors.New("native GitHub credentials unavailable")
var loginPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9-]{0,38}$`)

type Command struct {
	Program string
	Args    []string
	Stdin   io.Reader
	Output  bool
}
type Runner interface {
	Run(context.Context, Command) ([]byte, error)
}

// Executor never inherits arbitrary process environment. Secret-bearing helper
// output is discarded; diagnostics from children are never returned.
type Executor struct{ Home string }

func (e Executor) Run(ctx context.Context, c Command) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, c.Program, c.Args...)
	cmd.Dir = e.Home
	cmd.Env = []string{"HOME=" + e.Home, "PATH=/usr/bin:/bin", "GH_PROMPT_DISABLED=1", "GIT_TERMINAL_PROMPT=0", "GCM_INTERACTIVE=never", "XDG_CONFIG_HOME=" + filepath.Join(e.Home, ".config")}
	cmd.Stdin = c.Stdin
	cmd.WaitDelay = time.Second
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	var out bounded
	if c.Output {
		cmd.Stdout = &out
	} else {
		cmd.Stdout = io.Discard
	}
	cmd.Stderr = io.Discard
	if cmd.Start() != nil {
		return nil, denied
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
	// Kill surviving helper descendants while the process group still exists.
	_ = syscall.Kill(-pid, syscall.SIGKILL)
	if err != nil || out.overflow {
		return nil, denied
	}
	return out.Bytes(), nil
}

type bounded struct {
	b        []byte
	overflow bool
}

func (b *bounded) Write(p []byte) (int, error) {
	if len(b.b)+len(p) > 8192 {
		b.overflow = true
		return len(p), errors.New("output limit")
	}
	b.b = append(b.b, p...)
	return len(p), nil
}
func (b *bounded) Bytes() []byte { return b.b }

type Storage string

const (
	Unknown       Storage = "unknown"
	Keyring       Storage = "system-store"
	ProtectedFile Storage = "protected-file"
)

type Phase string

const (
	Installed  Phase = "installed"
	Reobserved Phase = "already-correct"
	Partial    Phase = "partial"
	Absent     Phase = "absent"
)

type Result struct {
	Phase             Phase
	Storage           Storage
	CleanupOK         bool
	HelperInert       bool
	RevokesOAuthToken bool
}

// Evidence supplies positive keyring attestation only from a trusted OS-specific
// inspector. An unconfigured inspector fails closed on keyring storage.
type Evidence interface {
	Keyring(context.Context, string) bool
}
type Adapter struct {
	mu       sync.Mutex // one daemon UID: serialize observation, login and disconnect
	home     string
	subject  string
	run      Runner
	evidence Evidence
}

func New(home, subject string, run Runner, evidence Evidence) (*Adapter, error) {
	n, e := strconv.ParseUint(subject, 10, 64)
	if e != nil || n == 0 || strconv.FormatUint(n, 10) != subject || !filepath.IsAbs(home) || filepath.Clean(home) != home || home == "/" {
		return nil, denied
	}
	if run == nil {
		run = Executor{Home: home}
	}
	return &Adapter{home: home, subject: subject, run: run, evidence: evidence}, nil
}

// Consumer can be passed to transport.NewServer/daemon.ServeHTTP. The token
// exists only as a call-local reader; callers must not retry the handoff.
func (a *Adapter) Consumer() transport.Consumer {
	return func(ctx context.Context, token string) error { _, err := a.Install(ctx, token); return err }
}
func (a *Adapter) call(ctx context.Context, program string, output bool, in io.Reader, args ...string) ([]byte, error) {
	return a.run.Run(ctx, Command{program, args, in, output})
}
func (a *Adapter) gh(ctx context.Context, output bool, in io.Reader, args ...string) ([]byte, error) {
	return a.call(ctx, "gh", output, in, args...)
}
func (a *Adapter) git(ctx context.Context, output bool, in io.Reader, args ...string) ([]byte, error) {
	return a.call(ctx, "git", output, in, args...)
}
func (a *Adapter) identity(ctx context.Context) (string, bool) {
	if _, e := a.gh(ctx, false, nil, "auth", "status", "--hostname", "github.com"); e != nil {
		return "", false
	}
	b, e := a.gh(ctx, true, nil, "api", "user", "--jq", "{id: .id, login: .login}")
	if e != nil {
		return "", false
	}
	var v struct {
		ID    json.Number `json:"id"`
		Login string      `json:"login"`
	}
	d := json.NewDecoder(strings.NewReader(string(b)))
	d.UseNumber()
	if d.Decode(&v) != nil || d.Decode(new(any)) != io.EOF || !loginPattern.MatchString(v.Login) {
		return "", false
	}
	id, e := strconv.ParseUint(string(v.ID), 10, 64)
	return v.Login, e == nil && id > 0 && strconv.FormatUint(id, 10) == a.subject
}
func (a *Adapter) storage(ctx context.Context, login string) (Storage, bool) {
	// Resolve parent components first; the final path is opened with O_NOFOLLOW.
	// A later pathname swap cannot change the already-open file descriptor.
	home, err := filepath.EvalSymlinks(a.home)
	if err != nil || home != a.home {
		return Unknown, false
	}
	dir := filepath.Join(a.home, ".config")
	file := filepath.Join(dir, "gh", "hosts.yml")
	fd, err := unix.Open(a.home, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC|unix.O_NOFOLLOW, 0)
	if err == nil {
		defer unix.Close(fd)
		if validFD(fd, true, -1) {
			config, e := unix.Openat(fd, ".config", unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC|unix.O_NOFOLLOW, 0)
			if e == nil {
				defer unix.Close(config)
				if validFD(config, true, 0700) {
					gh, e := unix.Openat(config, "gh", unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC|unix.O_NOFOLLOW, 0)
					if e == nil {
						defer unix.Close(gh)
						if validFD(gh, true, 0700) {
							host, e := unix.Openat(gh, "hosts.yml", unix.O_RDONLY|unix.O_CLOEXEC|unix.O_NOFOLLOW|unix.O_NONBLOCK, 0)
							if e == nil {
								defer unix.Close(host)
								if validFD(host, false, 0600) && tokenMarker(host) {
									return ProtectedFile, true
								}
							}
						}
					}
				}
			}
		}
	}
	// Never turn an insecure file into a keyring success.
	if _, e := os.Lstat(file); !errors.Is(e, os.ErrNotExist) {
		return Unknown, false
	}
	if _, e := os.Lstat(filepath.Join(dir, "gh")); e == nil {
		if !secureDir(filepath.Join(dir, "gh"), 0700) {
			return Unknown, false
		}
	} else if !errors.Is(e, os.ErrNotExist) {
		return Unknown, false
	}
	if _, e := os.Lstat(dir); e == nil {
		if !secureDir(dir, 0700) {
			return Unknown, false
		}
	} else if !errors.Is(e, os.ErrNotExist) {
		return Unknown, false
	}
	if a.evidence != nil && loginPattern.MatchString(login) && a.evidence.Keyring(ctx, login) {
		return Keyring, true
	}
	return Unknown, false
}
func validFD(fd int, dir bool, mode int) bool {
	var st unix.Stat_t
	if unix.Fstat(fd, &st) != nil || int(st.Uid) != os.Geteuid() {
		return false
	}
	if dir && st.Mode&unix.S_IFMT != unix.S_IFDIR || !dir && st.Mode&unix.S_IFMT != unix.S_IFREG {
		return false
	}
	return mode < 0 || int(st.Mode&0777) == mode
}
func tokenMarker(fd int) bool {
	var st unix.Stat_t
	if unix.Fstat(fd, &st) != nil || st.Size <= 0 || st.Size > 8192 {
		return false
	}
	b := make([]byte, st.Size)
	defer func() {
		for i := range b {
			b[i] = 0
		}
	}()
	n, e := unix.Read(fd, b)
	return e == nil && n == len(b) && bytes.Contains(b, []byte("oauth_token:"))
}
func secureDir(p string, m os.FileMode) bool {
	f, e := os.Lstat(p)
	if e != nil || !f.IsDir() || f.Mode()&os.ModeSymlink != 0 || f.Mode().Perm() != m {
		return false
	}
	st, ok := f.Sys().(*syscall.Stat_t)
	return ok && int(st.Uid) == os.Geteuid()
}
func (a *Adapter) observe(ctx context.Context) (string, Storage, bool) {
	login, ok := a.identity(ctx)
	if !ok {
		return login, Unknown, false
	}
	protocol, e := a.gh(ctx, true, nil, "config", "get", "git_protocol", "--host", "github.com")
	if e != nil || strings.TrimSpace(string(protocol)) != "https" {
		return login, Unknown, false
	}
	helper, e := a.git(ctx, true, nil, "config", "--global", "--get", "credential.https://github.com.helper")
	if e != nil || strings.TrimSpace(string(helper)) != "!gh auth git-credential" {
		return login, Unknown, false
	}
	// Ordinary Git credential protocol; stdout contains a credential and must
	// be discarded, never captured or reflected into a result.
	if _, e = a.git(ctx, false, strings.NewReader("protocol=https\nhost=github.com\n\n"), "credential", "fill"); e != nil {
		return login, Unknown, false
	}
	storage, ok := a.storage(ctx, login)
	return login, storage, ok
}
func (a *Adapter) cleanup(ctx context.Context, login string) bool {
	if !loginPattern.MatchString(login) {
		return false
	}
	_, e := a.gh(ctx, false, nil, "auth", "logout", "--hostname", "github.com", "--user", login)
	if e != nil {
		return false
	}
	_, e = a.gh(ctx, false, nil, "auth", "status", "--hostname", "github.com")
	return e != nil
}
func (a *Adapter) Install(ctx context.Context, token string) (Result, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	result := Result{Phase: Partial, Storage: Unknown}
	if token == "" || len(token) > 4096 {
		return result, denied
	}
	// A pre-existing gh login may belong to someone else or be partial.
	// Never overwrite or clean up credentials we did not just install.
	if _, err := a.gh(ctx, false, nil, "auth", "status", "--hostname", "github.com"); err == nil {
		if _, storage, ok := a.observe(ctx); ok {
			return Result{Phase: Reobserved, Storage: storage}, nil
		}
		return result, denied
	} else if ctx.Err() != nil {
		return result, denied
	}
	_, err := a.gh(ctx, false, strings.NewReader(token), "auth", "login", "--hostname", "github.com", "--with-token", "--git-protocol", "https")
	token = "" // drop reference before subsequent commands
	if err == nil {
		_, err = a.gh(ctx, false, nil, "auth", "setup-git", "--hostname", "github.com")
	}
	login, storage, ok := a.observe(ctx)
	if err == nil && ok {
		return Result{Phase: Installed, Storage: storage}, nil
	}
	result.Storage = storage
	// Only a login returned by gh status + validated API may be used for logout;
	// identity mismatch is still a valid observed login to clean up.
	result.CleanupOK = a.cleanup(ctx, login)
	return result, denied
}

// Disconnect is not web logout. The caller must have independently enforced
// fresh authentication AND explicit confirmation; local logout never revokes
// the GitHub OAuth grant.
func (a *Adapter) Disconnect(ctx context.Context, fresh, confirmed bool) (Result, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	r := Result{Phase: Partial, Storage: Unknown, HelperInert: false, RevokesOAuthToken: false}
	if !fresh || !confirmed {
		return r, denied
	}
	login, ok := a.identity(ctx)
	if !ok {
		return r, denied
	}
	if !a.cleanup(ctx, login) {
		return r, denied
	}
	helper, e := a.git(ctx, true, nil, "config", "--global", "--get", "credential.https://github.com.helper")
	if e != nil || strings.TrimSpace(string(helper)) != "!gh auth git-credential" {
		return r, denied
	}
	// A helper is inert only when it cannot return a credential.
	if _, e = a.git(ctx, false, strings.NewReader("protocol=https\nhost=github.com\n\n"), "credential", "fill"); e == nil {
		return r, denied
	}
	r.Phase = Absent
	r.CleanupOK = true
	r.HelperInert = true
	return r, nil
}

// Ensure no alternative config root is silently trusted by the adapter.
