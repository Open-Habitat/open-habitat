//go:build linux

// Package nativegh installs and observes native GitHub CLI credentials as the
// already mapped Unix user. It does not own web identity or browser state.
package nativegh

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"go.yaml.in/yaml/v3"
	"golang.org/x/sys/unix"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/diagnostic"
	"github.com/Open-Habitat/open-habitat/internal/transport"
)

const timeout = 4 * time.Second

var denied = errors.New("native GitHub credentials unavailable")
var noAuth = errors.New("gh reports no known GitHub hosts")

// rejected is GitHub's own answer that the active github.com token is no
// longer valid (revoked or deleted). It is not a network or keyring failure.
var rejected = errors.New("GitHub rejects the active gh token")
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
	// Capture only the diagnostics of the two identity probes, returning
	// solely a recognized signal. Never return or log raw child output.
	statusProbe := c.Program == "gh" && slices.Equal(c.Args, statusArgs)
	userProbe := c.Program == "gh" && slices.Equal(c.Args, userArgs)
	var diagnostic bounded
	if statusProbe || userProbe {
		cmd.Stderr = &diagnostic
	} else {
		cmd.Stderr = io.Discard
	}
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
	if err != nil || out.overflow || diagnostic.overflow {
		if err != nil && ctx.Err() == nil && !diagnostic.overflow {
			if statusProbe && absentDiagnostic(diagnostic.Bytes()) {
				return nil, noAuth
			}
			if userProbe && rejectedDiagnostic(diagnostic.Bytes()) {
				return nil, rejected
			}
		}
		return nil, denied
	}
	return out.Bytes(), nil
}

var (
	statusArgs = []string{"auth", "status", "--hostname", "github.com"}
	// --hostname: without it gh asks whichever host it is logged into, so a
	// person with only an Enterprise login would be identified there.
	userArgs = []string{"api", "--hostname", "github.com", "user", "--jq", "{id: .id, login: .login}"}
)

func absentDiagnostic(b []byte) bool {
	// gh 2.45/2.46's complete diagnostics for no hosts at all and for logins
	// only on other hosts. Unknown/new wording fails closed; never infer
	// absence merely from a nonzero exit code.
	d := strings.TrimSpace(string(b))
	return d == "You are not logged into any GitHub hosts. To log in, run: gh auth login" || d == "You are not logged into any accounts on github.com"
}

func rejectedDiagnostic(b []byte) bool {
	// gh 2.45/2.46 print GitHub's 401 message for a revoked or deleted token
	// as exactly this. A token gh cannot read (a locked keyring) is sent as no
	// token and answered "Requires authentication (HTTP 401)"; a network
	// failure names the connection. Both, and any other wording, fail closed:
	// only GitHub's rejection of the token itself makes a login replaceable.
	return strings.TrimSpace(string(b)) == "gh: Bad credentials (HTTP 401)"
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
	flightMu sync.Mutex
	flight   *statusFlight
	observed *observedStatus // guarded by flightMu
	// mutations moves at the start and end of Install and Disconnect, so an
	// observation that overlapped either is never remembered.
	mutations atomic.Uint64
	home      string
	subject   string
	run       Runner
	evidence  Evidence
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
	return func(ctx context.Context, token string) error {
		result, err := a.Install(ctx, token)
		// The phase is native observation, distinct from the transport ack.
		// Never include token, gh output, stderr, login or credential storage.
		if err != nil {
			diagnostic.New(os.Stderr, "daemon").Warn("native_gh_install", "outcome", "failed", "reason", "native_install_unavailable")
		} else {
			diagnostic.New(os.Stderr, "daemon").Info("native_gh_install", "outcome", "accepted", "phase", string(result.Phase))
		}
		return err
	}
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

// account is what gh's active github.com login positively is. Anything the
// adapter cannot classify is unclassified and is never overwritten or removed.
type account int

const (
	unclassified account = iota
	own                  // GitHub answers with the mapped subject's ID
	foreign              // GitHub answers with another account's ID
	absent               // gh's explicit diagnostic: no github.com login
	revoked              // GitHub rejects the active token itself
)

func (a *Adapter) identity(ctx context.Context) (string, bool) {
	login, kind := a.classify(ctx)
	return login, kind == own
}

// classify asks gh, then GitHub. gh auth status alone proves only absence: gh
// 2.45/2.46 exit 0 for an invalid token and print the same "token is invalid"
// for an unreachable network, and newer gh exit 1 for either. Identity, and
// whether the token is dead, come from GitHub's answer to gh api user.
func (a *Adapter) classify(ctx context.Context) (string, account) {
	if _, e := a.gh(ctx, false, nil, statusArgs...); errors.Is(e, noAuth) {
		return "", absent
	} else if ctx.Err() != nil {
		return "", unclassified
	}
	b, e := a.gh(ctx, true, nil, userArgs...)
	if errors.Is(e, rejected) {
		return "", revoked
	}
	if e != nil {
		return "", unclassified
	}
	var v struct {
		ID    json.Number `json:"id"`
		Login string      `json:"login"`
	}
	d := json.NewDecoder(strings.NewReader(string(b)))
	d.UseNumber()
	if d.Decode(&v) != nil || d.Decode(new(any)) != io.EOF || !loginPattern.MatchString(v.Login) {
		return "", unclassified
	}
	id, e := strconv.ParseUint(string(v.ID), 10, 64)
	if e != nil || id == 0 || strconv.FormatUint(id, 10) != string(v.ID) {
		return "", unclassified
	}
	if string(v.ID) != a.subject {
		return v.Login, foreign
	}
	return v.Login, own
}

type statusFlight struct {
	done  chan struct{}
	state string
	busy  bool // a mutation held the adapter; the answer says nothing
	stamp string
	gen   uint64
}

// observedStatus is the last completed observation and the native inputs it
// was made from. It is never written to disk.
type observedStatus struct {
	state string
	stamp string
	gen   uint64
	at    time.Time
}

// A credential change on this machine is seen through its files. A change only
// GitHub knows about (a token revoked on github.com) has no local input, so a
// remembered observation is rechecked in the background after this long. A
// keyring-backed login is never remembered: locking the keyring writes nothing.
const (
	observedRecheck        = 5 * time.Minute
	observedUnknownRecheck = 30 * time.Second
)

// Status makes a fresh, bounded observation; overlapping readers share only
// the in-flight result (never a stale cached state). Only gh's explicit
// no-hosts diagnostic proves absence; other failures remain unknown.
func (a *Adapter) Status(ctx context.Context) string {
	if ctx.Err() != nil {
		return "unknown"
	}
	return a.wait(ctx, a.start())
}

// ObservedStatus answers from the last observation while none of gh's or
// Git's native credential inputs have changed since it was made, and
// otherwise observes afresh like Status. The snapshot uses it so that a page
// load does not wait for GitHub's API; mutation checks keep using Status.
func (a *Adapter) ObservedStatus(ctx context.Context) string {
	if ctx.Err() != nil {
		return "unknown"
	}
	stamp, ok := credentialStamp(a.home)
	gen := a.mutations.Load()
	a.flightMu.Lock()
	o := a.observed
	a.flightMu.Unlock()
	if ok && o != nil && o.stamp == stamp && o.gen == gen {
		recheck := observedRecheck
		if o.state == "unknown" {
			recheck = observedUnknownRecheck
		}
		if time.Since(o.at) > recheck {
			a.start() // the next snapshot sees the refreshed observation
		}
		return o.state
	}
	// A flight already under way may have read the inputs before they
	// changed; its answer is not this caller's. The next flight starts after
	// this call began, so it is.
	f := a.start()
	if !ok || f.stamp != stamp || f.gen != gen {
		if a.wait(ctx, f); ctx.Err() != nil {
			return "unknown"
		}
		f = a.start()
	}
	return a.wait(ctx, f)
}

func (a *Adapter) start() *statusFlight {
	a.flightMu.Lock()
	defer a.flightMu.Unlock()
	if a.flight != nil {
		return a.flight
	}
	stamp, stamped := credentialStamp(a.home)
	f := &statusFlight{done: make(chan struct{}), stamp: stamp, gen: a.mutations.Load()}
	a.flight = f
	// One independent bounded observation serves concurrent callers: a
	// canceled tab cannot cancel another tab's status check.
	go func() {
		budget, cancel := context.WithTimeout(context.Background(), 1500*time.Millisecond)
		defer cancel()
		var remember bool
		f.state, f.busy, remember = a.checkStatus(budget)
		after, still := credentialStamp(a.home)
		a.flightMu.Lock()
		// Remember only an observation whose inputs did not move under it.
		if remember && !f.busy && stamped && still && after == f.stamp && f.gen == a.mutations.Load() {
			a.observed = &observedStatus{state: f.state, stamp: f.stamp, gen: f.gen, at: time.Now()}
		} else if !remember {
			a.observed = nil
		}
		a.flight = nil
		close(f.done)
		a.flightMu.Unlock()
	}()
	return f
}

func (a *Adapter) wait(ctx context.Context, f *statusFlight) string {
	select {
	case <-f.done:
		if ctx.Err() == nil {
			return f.state
		}
	case <-ctx.Done():
	}
	return "unknown"
}

// credentialStamp names every local input of checkStatus: gh's configuration
// and token file, Git's global configuration that holds the credential
// helper, the directories whose permissions storage() checks, and the gh and
// git programs themselves. Directory timestamps of home and ~/.config are
// left out: unrelated programs touch them constantly.
func credentialStamp(home string) (string, bool) {
	var b strings.Builder
	for _, p := range []struct {
		path  string
		times bool
	}{
		{home, false},
		{filepath.Join(home, ".config"), false},
		{filepath.Join(home, ".config", "gh"), true},
		{filepath.Join(home, ".config", "gh", "hosts.yml"), true},
		{filepath.Join(home, ".config", "gh", "config.yml"), true},
		{"/usr/bin/gh", true},
		{"/usr/bin/git", true},
		{"/bin/gh", true},
		{"/bin/git", true},
	} {
		var st unix.Stat_t
		err := unix.Lstat(p.path, &st)
		switch {
		case errors.Is(err, unix.ENOENT) || errors.Is(err, unix.ENOTDIR):
			b.WriteString("-;")
		case err != nil:
			return "", false
		case p.times:
			writeStat(&b, &st)
		default:
			fmt.Fprintf(&b, "%d:%d:%o:%d;", st.Dev, st.Ino, st.Mode, st.Uid)
		}
	}
	git, ok := GitConfigStamp(home)
	return b.String() + git, ok
}

func writeStat(b *strings.Builder, st *unix.Stat_t) {
	fmt.Fprintf(b, "%d:%d:%o:%d:%d:%d.%d:%d.%d;", st.Dev, st.Ino, st.Mode, st.Uid, st.Size, st.Mtim.Sec, st.Mtim.Nsec, st.Ctim.Sec, st.Ctim.Nsec)
}

var gitConfigPathKey = regexp.MustCompile(`(?im)^\s*(?:path|excludesfile|attributesfile)\s*=\s*(.+?)\s*$`)

// GitConfigStamp changes whenever Git's global configuration as Git reads it
// can have changed: ~/.gitconfig and ~/.config/git/{config,ignore,attributes},
// the targets of those that are symlinks (a dotfiles checkout), and every
// file they name with include.path, includeIf, core.excludesFile or
// core.attributesFile, recursively. The system file is never read here
// (GIT_CONFIG_NOSYSTEM=1). A stamp that cannot be made is not a stamp.
func GitConfigStamp(home string) (string, bool) {
	var b strings.Builder
	seen := map[string]bool{}
	var add func(path string, depth int) bool
	add = func(path string, depth int) bool {
		if seen[path] || len(seen) > 64 || depth > 8 {
			return depth <= 8 && len(seen) <= 64
		}
		seen[path] = true
		b.WriteString(path + "=")
		var st unix.Stat_t
		err := unix.Lstat(path, &st)
		if errors.Is(err, unix.ENOENT) || errors.Is(err, unix.ENOTDIR) {
			b.WriteString("-;")
			return true
		}
		if err != nil {
			return false
		}
		writeStat(&b, &st)
		if st.Mode&unix.S_IFMT == unix.S_IFLNK {
			if err := unix.Stat(path, &st); errors.Is(err, unix.ENOENT) {
				b.WriteString("-;")
				return true
			} else if err != nil {
				return false
			}
			writeStat(&b, &st)
		}
		if st.Mode&unix.S_IFMT != unix.S_IFREG || st.Size > 1<<20 {
			return st.Mode&unix.S_IFMT != unix.S_IFREG
		}
		content, err := os.ReadFile(path)
		if err != nil {
			return false
		}
		for _, m := range gitConfigPathKey.FindAllSubmatch(content, -1) {
			named := strings.Trim(string(m[1]), `"`)
			switch {
			case strings.HasPrefix(named, "~/"):
				named = filepath.Join(home, named[2:])
			case !filepath.IsAbs(named):
				// Relative to the including file, through a symlink or not.
				if real, err := filepath.EvalSymlinks(path); err == nil && !add(filepath.Join(filepath.Dir(real), named), depth+1) {
					return false
				}
				named = filepath.Join(filepath.Dir(path), named)
			}
			if !add(named, depth+1) {
				return false
			}
		}
		return true
	}
	for _, p := range []string{".gitconfig", ".config/git/config", ".config/git/ignore", ".config/git/attributes"} {
		if !add(filepath.Join(home, p), 0) {
			return "", false
		}
	}
	return b.String(), true
}

// checkStatus reports the state, whether a mutation made the answer
// meaningless, and whether its inputs are all files credentialStamp covers.
func (a *Adapter) checkStatus(ctx context.Context) (string, bool, bool) {
	if !a.mu.TryLock() {
		return "unknown", true, false // mutation in progress; cannot infer its eventual outcome
	}
	defer a.mu.Unlock()
	login, kind := a.classify(ctx)
	if ctx.Err() != nil {
		return "unknown", false, true
	}
	// A revoked token connects nothing; the next sign-in replaces it.
	if kind == absent || kind == foreign || kind == revoked {
		return "disconnected", false, true
	}
	if kind != own {
		return "unknown", false, true
	}
	_, _, ok := a.observeWithLogin(ctx, login)
	// Without a token in hosts.yml, gh and the observation consult the
	// keyring, whose lock state is not a file: such an answer is not kept.
	remember := fileToken(a.home)
	if ctx.Err() != nil {
		return "unknown", false, remember
	}
	if !ok {
		return "partial", false, remember
	}
	return "connected", false, remember
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
func fileToken(home string) bool {
	fd, err := unix.Open(filepath.Join(home, ".config", "gh", "hosts.yml"), unix.O_RDONLY|unix.O_CLOEXEC|unix.O_NOFOLLOW|unix.O_NONBLOCK, 0)
	if err != nil {
		return false
	}
	defer unix.Close(fd)
	return validFD(fd, false, -1) && tokenMarker(fd)
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

// Git config emits one trailing newline. Compare the command itself exactly:
// Git executes ! helpers through a shell, so accepting an arbitrary path or
// appended shell syntax here would trust a different executable.
func trustedGitHelper(output []byte) bool {
	helper := strings.TrimSuffix(string(output), "\n")
	return helper == "!gh auth git-credential" || helper == "!/usr/bin/gh auth git-credential"
}

func (a *Adapter) observe(ctx context.Context) (string, Storage, bool) {
	login, ok := a.identity(ctx)
	if !ok {
		return login, Unknown, false
	}
	return a.observeWithLogin(ctx, login)
}
func (a *Adapter) observeWithLogin(ctx context.Context, login string) (string, Storage, bool) {
	protocol, e := a.gh(ctx, true, nil, "config", "get", "git_protocol", "--host", "github.com")
	if e != nil || strings.TrimSpace(string(protocol)) != "https" {
		return login, Unknown, false
	}
	helper, e := a.git(ctx, true, nil, "config", "--global", "--get", "credential.https://github.com.helper")
	if e != nil || !trustedGitHelper(helper) {
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
	// Only gh's own absence diagnostic proves the login is gone: newer gh
	// also exit nonzero while a broken account remains.
	_, e = a.gh(ctx, false, nil, statusArgs...)
	return errors.Is(e, noAuth)
}
func (a *Adapter) Install(ctx context.Context, token string) (Result, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.mutations.Add(1)
	defer a.mutations.Add(1)
	result := Result{Phase: Partial, Storage: Unknown}
	if token == "" || len(token) > 4096 {
		return result, denied
	}
	// A pre-existing gh login may belong to someone else or be partial.
	// Never overwrite or clean up credentials we did not just install. The
	// one exception is a token GitHub itself rejects: it works for nobody, so
	// replacing it loses nothing, and keeping it would refuse every later
	// sign-in. A login that cannot be classified (network, keyring, unknown
	// output) is left alone.
	stamp, stamped := credentialStamp(a.home)
	switch login, kind := a.classify(ctx); {
	case ctx.Err() != nil:
		return result, denied
	case kind == own:
		if _, storage, ok := a.observeWithLogin(ctx, login); ok {
			return Result{Phase: Reobserved, Storage: storage}, nil
		}
		return result, denied
	case kind == revoked:
		// gh auth login writes the incoming account's entry, which may be
		// another stored account than the rejected active one; only GitHub's
		// verdict on the active token was observed. So replace only the sole
		// account, and only while gh's files are still those just classified
		// (gh rewrites them on every login, including one made natively).
		sole := soleAccount(a.home)
		now, still := credentialStamp(a.home)
		if !sole || !stamped || !still || now != stamp {
			return result, denied
		}
	case kind != absent:
		return result, denied
	}
	_, err := a.gh(ctx, false, strings.NewReader(token), "auth", "login", "--hostname", "github.com", "--with-token", "--git-protocol", "https")
	token = "" // drop reference before subsequent commands
	loggedIn := err == nil
	if err == nil {
		_, err = a.gh(ctx, false, nil, "auth", "setup-git", "--hostname", "github.com")
	}
	installed, installedStamped := credentialStamp(a.home)
	login, storage, ok := a.observe(ctx)
	if err == nil && ok {
		return Result{Phase: Installed, Storage: storage}, nil
	}
	result.Storage = storage
	// A failed gh auth login installed nothing, so whatever login gh shows
	// now is not ours to remove. After our login, only a login returned by gh
	// status + validated API may be used for logout; identity mismatch is
	// still a valid observed login to clean up, unless gh's files moved after
	// ours were written: then the observed login may be a native one.
	if now, still := credentialStamp(a.home); loggedIn && installedStamped && still && now == installed {
		result.CleanupOK = a.cleanup(ctx, login)
	}
	return result, denied
}

// soleAccount reports whether gh's hosts.yml names exactly one github.com
// account and it is the active one. Anything unreadable or unexpected is not.
func soleAccount(home string) bool {
	fd, err := unix.Open(filepath.Join(home, ".config", "gh", "hosts.yml"), unix.O_RDONLY|unix.O_CLOEXEC|unix.O_NOFOLLOW|unix.O_NONBLOCK, 0)
	if err != nil {
		return false
	}
	defer unix.Close(fd)
	var st unix.Stat_t
	if !validFD(fd, false, -1) || unix.Fstat(fd, &st) != nil || st.Size <= 0 || st.Size > 65536 {
		return false
	}
	// The file may hold tokens: read, parse and wipe, never return its bytes.
	b := make([]byte, st.Size)
	defer func() {
		for i := range b {
			b[i] = 0
		}
	}()
	if n, e := unix.Read(fd, b); e != nil || n != len(b) {
		return false
	}
	var hosts map[string]struct {
		User  string               `yaml:"user"`
		Users map[string]yaml.Node `yaml:"users"`
	}
	if yaml.Unmarshal(b, &hosts) != nil {
		return false
	}
	h, ok := hosts["github.com"]
	if !ok || len(h.Users) != 1 {
		return false
	}
	_, active := h.Users[h.User]
	return active
}

// Disconnect is not web logout. The caller must have independently enforced
// fresh authentication AND explicit confirmation; local logout never revokes
// the GitHub OAuth grant.
func (a *Adapter) Disconnect(ctx context.Context, fresh, confirmed bool) (Result, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.mutations.Add(1)
	defer a.mutations.Add(1)
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
	if e != nil || !trustedGitHelper(helper) {
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
