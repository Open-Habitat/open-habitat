//go:build linux

// Package nativegh installs and observes native GitHub CLI credentials as the
// already mapped Unix user. It does not own web identity or browser state.
package nativegh

import (
	"bytes"
	"context"
	"crypto/subtle"
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

	"github.com/open-habitat/open-habitat/internal/diagnostic"
	"github.com/open-habitat/open-habitat/internal/transport"
)

const timeout = 4 * time.Second

var denied = errors.New("native GitHub credentials unavailable")
var noAuth = errors.New("gh reports no known GitHub hosts")

// rejected is GitHub's own answer that the active github.com token is no
// longer valid (revoked or deleted). It is not a network or keyring failure.
var rejected = errors.New("GitHub rejects the active gh token")

// unreachable is gh's own report that GitHub could not be asked or answered
// with a server error: an outage, which says nothing about the token.
var unreachable = errors.New("GitHub did not answer")

// githubError is GitHub's own answer with an error that says nothing certain
// about the token: a rate limit, or a 401 for a request gh sent without the
// token it could not read (a locked keyring).
var githubError = errors.New("GitHub answered the identity check with an error")

// slow is a gh or git command that did not finish within its time.
var slow = errors.New("gh or git did not answer in time")
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
			if userProbe && unreachableDiagnostic(diagnostic.Bytes()) {
				return nil, unreachable
			}
			if userProbe && githubErrorDiagnostic(diagnostic.Bytes()) {
				return nil, githubError
			}
		}
		if err != nil && ctx.Err() != nil {
			return nil, slow
		}
		return nil, denied
	}
	return out.Bytes(), nil
}

var (
	statusArgs = []string{"auth", "status", "--hostname", "github.com"}
	// --hostname: without it gh asks whichever host it is logged into, so a
	// person with only an Enterprise login would be identified there.
	// --include: the same answer's headers carry the token's OAuth scopes
	// (X-OAuth-Scopes), so they are read without another request.
	userArgs = []string{"api", "--hostname", "github.com", "user", "--include", "--jq", "{id: .id, login: .login}"}
)

// scopePattern is one OAuth scope name as GitHub lists them (repo, read:org,
// admin:repo_hook, ...). A header with anything else is not read at all.
var scopePattern = regexp.MustCompile(`^[a-z][a-z0-9_]*(?::[a-z][a-z0-9_]*)?$`)

// userReply splits gh api --include's output into the body and the token's
// scopes. gh prints the status line, the headers, an empty line and then
// the body. scopes is nil when the answer has no X-OAuth-Scopes header (a
// fine-grained or GitHub App token) or the header is not one this host
// recognizes; otherwise it is the sorted list, possibly empty. ok is false
// when the output is not that shape at all.
func userReply(b []byte) (body []byte, scopes []string, ok bool) {
	text := string(b)
	if !strings.HasPrefix(text, "HTTP/") {
		return nil, nil, false
	}
	var header []string
	seen := 0
	for {
		line, rest, found := strings.Cut(text, "\n")
		if !found {
			return nil, nil, false
		}
		text = rest
		line = strings.TrimSuffix(line, "\r")
		if line == "" {
			break
		}
		name, value, colon := strings.Cut(line, ":")
		if colon && strings.EqualFold(strings.TrimSpace(name), "X-OAuth-Scopes") {
			seen++
			header = strings.Split(value, ",")
		}
	}
	if seen != 1 {
		return []byte(text), nil, true
	}
	scopes = []string{}
	for _, s := range header {
		s = strings.TrimSpace(s)
		if s == "" && len(header) == 1 {
			break // a token with no scopes at all
		}
		if !scopePattern.MatchString(s) || len(s) > 64 || len(scopes) >= 32 {
			return []byte(text), nil, true
		}
		if !slices.Contains(scopes, s) {
			scopes = append(scopes, s)
		}
	}
	slices.Sort(scopes)
	return []byte(text), scopes, true
}

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

// gh's lines for a request that never reached GitHub or that GitHub's
// servers failed: its own DNS hint, Go's transport errors for the one URL
// the probe asks, and an HTTP 5xx answer (gh 2.45/2.46 print the message,
// when GitHub gave one, before the status). Any other wording stays
// unclassified; a timeout of the probe itself is not taken as an outage,
// because a hung keyring helper looks the same.
var unreachableLine = regexp.MustCompile(`^(?:error connecting to api\.github\.com|check your internet connection or https://githubstatus\.com|Get "https://api\.github\.com/user": (?:dial tcp[ :]|read tcp |net/http: TLS handshake timeout|net/http: timeout|EOF$|.*: connection reset by peer$)|gh: (?:[^\n]*\(HTTP 5[0-9]{2}\)|HTTP 5[0-9]{2}(?: \([^\n]*\))?))`)

func unreachableDiagnostic(b []byte) bool {
	lines := strings.Split(strings.TrimSpace(string(b)), "\n")
	if len(lines) == 0 || len(lines) > 4 {
		return false
	}
	for _, line := range lines {
		if !unreachableLine.MatchString(strings.TrimSpace(line)) {
			return false
		}
	}
	return true
}

// gh prints GitHub's message before the status of any other answer, such as
// "gh: API rate limit exceeded for user ID 1. (HTTP 403)". It only names the
// cause of an unknown state, so any wording with a 4xx status is accepted.
var githubErrorLine = regexp.MustCompile(`^gh: [^\n]*\(HTTP 4[0-9]{2}\)$`)

func githubErrorDiagnostic(b []byte) bool {
	for _, line := range strings.Split(strings.TrimSpace(string(b)), "\n") {
		if githubErrorLine.MatchString(strings.TrimSpace(line)) {
			return true
		}
	}
	return false
}

type bounded struct {
	b        []byte
	overflow bool
}

func (b *bounded) Write(p []byte) (int, error) {
	// gh api --include prints GitHub's headers before the body: about 2 KiB.
	if len(b.b)+len(p) > 16384 {
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
	Replaced   Phase = "replaced"
	Reobserved Phase = "already-correct"
	Partial    Phase = "partial"
	Absent     Phase = "absent"
)

type Result struct {
	Phase   Phase
	Storage Storage
	// Unused is set only when the kept login positively holds another
	// token than the one handed over, so revoking that one costs nothing.
	Unused            bool
	CleanupOK         bool
	HelperInert       bool
	RevokesOAuthToken bool
	// Scopes are the installed token's OAuth scopes as GitHub named them
	// in the check after the install; nil when not read.
	Scopes []string
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
	handed   *observedStatus // the answer of a promised flight; guarded by flightMu
	// mutations moves at the start and end of Install and Disconnect, so an
	// observation that overlapped either is never remembered.
	mutations atomic.Uint64
	// The connection's recent course, derived in memory from the
	// observations themselves and guarded by flightMu: when an outage began
	// and how many checks have found it, when GitHub first rejected the
	// token without a second check confirming it, the timer of the next
	// check either asks for, and the last state told to onChange.
	outageSince time.Time
	outageTries int
	outageNext  time.Time
	rejectedAt  time.Time
	rejectedFor string // the credential stamp and generation it was about
	retry       *time.Timer
	told        Observation
	onChange    func()
	// onReconnected is told the scopes of an explicit reconnect's token;
	// guarded by flightMu.
	onReconnected func(scopes []string)
	verifyAfter   time.Duration
	retryDelays   []time.Duration
	early         time.Duration // how early a check may come and still be the scheduled one
	budget        time.Duration // one whole check
	pageWait      time.Duration // how long a snapshot waits for a fresh check
	lastAsked     time.Time
	home          string
	subject       string
	run           Runner
	evidence      Evidence
}

func New(home, subject string, run Runner, evidence Evidence) (*Adapter, error) {
	n, e := strconv.ParseUint(subject, 10, 64)
	if e != nil || n == 0 || strconv.FormatUint(n, 10) != subject || !filepath.IsAbs(home) || filepath.Clean(home) != home || home == "/" {
		return nil, denied
	}
	if run == nil {
		run = Executor{Home: home}
	}
	return &Adapter{home: home, subject: subject, run: run, evidence: evidence, verifyAfter: verifyAfter, retryDelays: retryDelays, early: time.Second, budget: statusBudget, pageWait: pageWait}, nil
}

// OnChange names what to call, outside the adapter's locks, when a check
// has settled on a different connection than the one last told: another
// state or login, or another try of an outage. The daemon uses it to tell
// open pages to read the snapshot again.
func (a *Adapter) OnChange(f func()) {
	a.flightMu.Lock()
	a.onChange = f
	a.flightMu.Unlock()
}

// Recheck asks GitHub now instead of at the next scheduled check, for a hint
// that the connection may have changed: an agent's git or gh command against
// GitHub just failed. The hint is never itself evidence; only the check that
// it starts is. Hints closer together than this share one check.
func (a *Adapter) Recheck() {
	a.flightMu.Lock()
	if time.Since(a.lastAsked) < recheckHintSpacing {
		a.flightMu.Unlock()
		return
	}
	a.lastAsked = time.Now()
	a.flightMu.Unlock()
	a.start()
}

// OnReconnected names what to call, outside the adapter's locks, after the
// person's explicit reconnect installed its token in gh: with the new
// token's scopes, or nil when they could not be read. The daemon remembers
// from it whether the person allowed the workflow scope.
func (a *Adapter) OnReconnected(f func(scopes []string)) {
	a.flightMu.Lock()
	a.onReconnected = f
	a.flightMu.Unlock()
}

// Consumer can be passed to transport.NewServer/daemon.ServeHTTP. The token
// exists only as a call-local reader; callers must not retry the handoff.
func (a *Adapter) Consumer() transport.Consumer {
	return func(ctx context.Context, token string, replace bool) (bool, error) {
		result, err := a.Install(ctx, token, replace)
		if err == nil && replace && (result.Phase == Replaced || result.Phase == Installed) {
			a.flightMu.Lock()
			f := a.onReconnected
			a.flightMu.Unlock()
			if f != nil {
				f(result.Scopes)
			}
		}
		// The phase is native observation, distinct from the transport ack.
		// Never include token, gh output, stderr, login or credential storage.
		if err != nil {
			diagnostic.New(os.Stderr, "daemon").Warn("native_gh_install", "outcome", "failed", "reason", "native_install_unavailable")
		} else {
			diagnostic.New(os.Stderr, "daemon").Info("native_gh_install", "outcome", "accepted", "phase", string(result.Phase), "token_unused", result.Unused)
		}
		return err == nil && result.Unused, err
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
	outage               // gh could not reach GitHub, or GitHub failed
)

func (a *Adapter) identity(ctx context.Context) (string, []string, bool) {
	login, kind, _, scopes := a.classify(ctx)
	return login, scopes, kind == own
}

// timedOut tells a command that ran out of time from one that failed.
func timedOut(ctx context.Context, e error) bool {
	return ctx.Err() != nil || errors.Is(e, slow) || errors.Is(e, context.DeadlineExceeded)
}

// classify asks gh, then GitHub. gh auth status alone proves only absence: gh
// 2.45/2.46 exit 0 for an invalid token and print the same "token is invalid"
// for an unreachable network, and newer gh exit 1 for either. Identity, and
// whether the token is dead, come from GitHub's answer to gh api user. An
// unclassified account comes with the Reason it could not be classified.
// The person's own login also comes with its token's scopes, nil when
// GitHub's answer did not name them.
func (a *Adapter) classify(ctx context.Context) (string, account, string, []string) {
	if _, e := a.gh(ctx, false, nil, statusArgs...); errors.Is(e, noAuth) {
		return "", absent, "", nil
	} else if timedOut(ctx, e) {
		return "", unclassified, ReasonTimeout, nil
	}
	b, e := a.gh(ctx, true, nil, userArgs...)
	if errors.Is(e, rejected) {
		return "", revoked, "", nil
	}
	if errors.Is(e, unreachable) {
		return "", outage, "", nil
	}
	if errors.Is(e, githubError) {
		return "", unclassified, ReasonGitHubError, nil
	}
	if timedOut(ctx, e) {
		return "", unclassified, ReasonTimeout, nil
	}
	if e != nil {
		return "", unclassified, ReasonUnrecognized, nil
	}
	body, scopes, ok := userReply(b)
	if !ok {
		return "", unclassified, ReasonUnrecognized, nil
	}
	var v struct {
		ID    json.Number `json:"id"`
		Login string      `json:"login"`
	}
	d := json.NewDecoder(strings.NewReader(string(body)))
	d.UseNumber()
	if d.Decode(&v) != nil || d.Decode(new(any)) != io.EOF || !loginPattern.MatchString(v.Login) {
		return "", unclassified, ReasonUnrecognized, nil
	}
	id, e := strconv.ParseUint(string(v.ID), 10, 64)
	if e != nil || id == 0 || strconv.FormatUint(id, 10) != string(v.ID) {
		return "", unclassified, ReasonUnrecognized, nil
	}
	if string(v.ID) != a.subject {
		return v.Login, foreign, "", nil
	}
	return v.Login, own, "", scopes
}

// Observation is one status check: the state, and for the person's own
// working login also its GitHub login name. A foreign or rejected login's
// name is never part of it.
type Observation struct {
	State string
	Login string
	// For "unreachable": when the outage began, how many checks have found
	// it so far, and when the next one is due. The first RetryAttempts
	// checks are the host's own retry; after them the outage is a warning.
	Since   time.Time
	Attempt int
	NextAt  time.Time
	// For "unknown": why the check learned nothing, one of the Reason
	// constants, so the page can say it instead of a bare "unknown".
	Reason string
	// For "connected": the OAuth scopes of gh's token, read from GitHub's
	// X-OAuth-Scopes header of the identity check. nil when they could not
	// be read (no header: a fine-grained or GitHub App token).
	Scopes []string
}

// Why a check ended "unknown".
const (
	// The check is still under way, or a sign-in or disconnect holds the
	// adapter; a later read has the answer.
	ReasonChecking = "checking"
	// gh, Git or GitHub did not answer within the check's time.
	ReasonTimeout = "timeout"
	// GitHub answered with an error that says nothing certain about the
	// token (a rate limit, a request gh sent without its token).
	ReasonGitHubError = "github_error"
	// gh could not be run, or its answer was not one the host recognizes.
	ReasonUnrecognized = "unrecognized"
)

// statusBudget bounds one whole check: two GitHub requests and three local
// commands. On the ARM host the check takes 1.1-1.3 s when idle, and the earlier
// 1.5 s budget turned an ordinary slow moment, such as the first check after
// a reboot, into "unknown" for a working login. Each command still has its
// own timeout.
const statusBudget = 2 * timeout

// pageWait is how long a snapshot waits for a fresh check before it answers
// "checking"; the page is told again when the check ends.
const pageWait = 2 * time.Second

// The checks of an outage before the host stops calling it a retry, and the
// waits after each of them: GitHub is asked at 0, 30, 60 and 120 seconds,
// and every 30 seconds after that until it answers.
const RetryAttempts = 4

var retryDelays = []time.Duration{30 * time.Second, 30 * time.Second, 60 * time.Second, 30 * time.Second}

// A first 401 is checked once more before it is believed: GitHub's API has
// answered a valid token with a passing "Bad credentials".
const verifyAfter = 10 * time.Second

const recheckHintSpacing = 5 * time.Second

// A scheduled check that met a sign-in or disconnect in progress is tried
// again this much later.
const busyRetry = 5 * time.Second

type statusFlight struct {
	done  chan struct{}
	obs   Observation
	busy  bool // a mutation held the adapter; the answer says nothing
	stamp string
	gen   uint64
	// A page was told "checking" while this flight ran, so its end is told
	// even when the connection is the one last told. Guarded by flightMu.
	promised bool
}

// observedStatus is the last completed observation and the native inputs it
// was made from. It is never written to disk.
type observedStatus struct {
	obs     Observation
	stamp   string
	stamped bool
	gen     uint64
	at      time.Time
}

// handedFresh is how long the answer of a promised flight is given to the
// pages that re-read for it.
const handedFresh = 10 * time.Second

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
	return a.wait(ctx, a.start()).State
}

// ObservedStatus answers from the last observation while none of gh's or
// Git's native credential inputs have changed since it was made, and
// otherwise observes afresh like Status. The snapshot uses it so that a page
// load does not wait for GitHub's API; mutation checks keep using Status.
func (a *Adapter) ObservedStatus(ctx context.Context) string {
	return a.ObservedConnection(ctx).State
}

// ObservedConnection is ObservedStatus with the login it observed.
func (a *Adapter) ObservedConnection(ctx context.Context) Observation {
	if ctx.Err() != nil {
		return Observation{State: "unknown"}
	}
	stamp, ok := credentialStamp(a.home)
	gen := a.mutations.Load()
	a.flightMu.Lock()
	o, h := a.observed, a.handed
	a.flightMu.Unlock()
	// The answer a page was promised is its own, even when it is not one
	// that may be remembered (a keyring-backed login): asking afresh would
	// only promise again.
	if h != nil && h.stamp == stamp && h.stamped == ok && h.gen == gen && time.Since(h.at) < handedFresh {
		return h.obs
	}
	if ok && o != nil && o.stamp == stamp && o.gen == gen {
		recheck := observedRecheck
		if o.obs.State == "unknown" || o.obs.State == "unreachable" || o.obs.State == "verifying" {
			recheck = observedUnknownRecheck
		}
		if time.Since(o.at) > recheck {
			a.start() // the next snapshot sees the refreshed observation
		}
		return o.obs
	}
	// A flight already under way may have read the inputs before they
	// changed; its answer is not this caller's. The next flight starts after
	// this call began, so it is.
	page, cancel := context.WithTimeout(ctx, a.pageWait)
	defer cancel()
	f := a.start()
	mine := ok && f.stamp == stamp && f.gen == gen
	if !mine {
		a.wait(page, f)
		if page.Err() == nil {
			f, mine = a.start(), true
		}
	}
	obs := a.wait(page, f)
	if page.Err() == nil || ctx.Err() != nil {
		return obs
	}
	// A flight ends under flightMu, so under it a flight either has ended,
	// and its answer can be given now, or is still running and will see
	// the promise. A stale flight that has ended is followed by a new one.
	for range 3 {
		a.flightMu.Lock()
		ended := closed(f.done)
		if !ended {
			f.promised = true
		}
		a.flightMu.Unlock()
		if !ended {
			break
		}
		if mine {
			return f.obs
		}
		f = a.start()
		mine = ok && f.stamp == stamp && f.gen == gen
	}
	return Observation{State: "unknown", Reason: ReasonChecking}
}

func closed(c chan struct{}) bool {
	select {
	case <-c:
		return true
	default:
		return false
	}
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
		budget, cancel := context.WithTimeout(context.Background(), a.budget)
		defer cancel()
		var remember bool
		f.obs, f.busy, remember = a.checkStatus(budget)
		after, still := credentialStamp(a.home)
		a.flightMu.Lock()
		var tell func()
		if !f.busy {
			// The credential the check was about: a rejection is confirmed
			// only against the same one.
			credential := fmt.Sprintf("%d:%s", f.gen, f.stamp)
			switch {
			case f.gen != a.mutations.Load() || stamped != still || after != f.stamp:
				credential = ""
			case !stamped:
				// Files that cannot be stamped at all: the adapter's own
				// sign-ins and disconnects still tell credentials apart.
				credential = fmt.Sprintf("%d:", f.gen)
			}
			f.obs = a.settle(f.obs, credential, time.Now())
			if f.obs.State != "unknown" && !sameConnection(f.obs, a.told) {
				a.told, tell = f.obs, a.onChange
			}
		} else if now := time.Now(); !a.outageSince.IsZero() && !now.Before(a.outageNext.Add(-a.early)) || !a.rejectedAt.IsZero() && !now.Before(a.rejectedAt.Add(a.verifyAfter-a.early)) {
			// A sign-in or disconnect held the adapter at the scheduled
			// check: it is not lost, only later. An earlier busy check
			// leaves the pending timer alone.
			a.schedule(busyRetry)
		}
		// A page that was told "checking" is told the answer, whatever it is,
		// and its re-read is given that answer. Any later check replaces it:
		// a page told of that check's news must not re-read the older one.
		a.handed = nil
		if f.promised {
			tell = a.onChange
			if !f.busy && stamped == still && after == f.stamp && f.gen == a.mutations.Load() {
				a.handed = &observedStatus{obs: f.obs, stamp: f.stamp, stamped: stamped, gen: f.gen, at: time.Now()}
			}
		}
		// Remember only an observation whose inputs did not move under it.
		if remember && !f.busy && stamped && still && after == f.stamp && f.gen == a.mutations.Load() {
			a.observed = &observedStatus{obs: f.obs, stamp: f.stamp, gen: f.gen, at: time.Now()}
		} else if !remember {
			a.observed = nil
		}
		a.flight = nil
		close(f.done)
		a.flightMu.Unlock()
		if tell != nil {
			tell()
		}
	}()
	return f
}

// settle turns one check into the connection's state over time. An outage
// counts its checks and asks for the next one itself, so the retry goes on
// without a page open and the warning leaves once GitHub answers. A first
// rejection is "verifying" until a second check, verifyAfter later, says
// the same. Called with flightMu held.
func (a *Adapter) settle(obs Observation, credential string, now time.Time) Observation {
	switch obs.State {
	case "unknown":
		// Nothing was learned: neither an outage nor a rejection ends. The
		// scheduled check of either still has a successor.
		if !a.outageSince.IsZero() && !now.Before(a.outageNext.Add(-a.early)) {
			wait := a.retryDelays[len(a.retryDelays)-1]
			a.outageNext = now.Add(wait)
			a.schedule(wait)
		} else if !a.rejectedAt.IsZero() && !now.Before(a.rejectedAt.Add(a.verifyAfter-a.early)) {
			a.schedule(a.verifyAfter)
		}
		return obs
	case "unreachable":
		a.rejectedAt = time.Time{}
		// A check before the scheduled one (a page's read, an agent's hint)
		// is not another try: the count follows the schedule, so extra
		// checks can neither hurry the warning nor tell a change each time.
		// The scheduled check is armed again in case an early one took its
		// timer's place (a sign-in held the adapter).
		if !a.outageSince.IsZero() && now.Before(a.outageNext.Add(-a.early)) {
			obs.Since, obs.Attempt, obs.NextAt = a.outageSince, a.outageTries, a.outageNext
			a.schedule(a.outageNext.Sub(now))
			return obs
		}
		if a.outageSince.IsZero() {
			a.outageSince, a.outageTries = now, 0
		}
		a.outageTries++
		wait := a.retryDelays[min(a.outageTries, len(a.retryDelays))-1]
		a.outageNext = now.Add(wait)
		obs.Since, obs.Attempt, obs.NextAt = a.outageSince, a.outageTries, a.outageNext
		a.schedule(wait)
		return obs
	case "expired":
		a.outageSince, a.outageTries = time.Time{}, 0
		// Another credential's rejection, or one whose files moved under
		// the check, confirms nothing about this one.
		if a.rejectedAt.IsZero() || credential == "" || credential != a.rejectedFor {
			a.rejectedAt, a.rejectedFor = now, credential
			a.schedule(a.verifyAfter)
			return Observation{State: "verifying"}
		}
		// Only the check verifyAfter later confirms it.
		if due := a.rejectedAt.Add(a.verifyAfter); now.Before(due) {
			a.schedule(due.Sub(now))
			return Observation{State: "verifying"}
		}
		a.stopRetry()
		return obs
	}
	a.outageSince, a.outageTries, a.rejectedAt = time.Time{}, 0, time.Time{}
	a.stopRetry()
	return obs
}

func (a *Adapter) schedule(wait time.Duration) {
	a.stopRetry()
	a.retry = time.AfterFunc(wait, func() { a.start() })
}

func (a *Adapter) stopRetry() {
	if a.retry != nil {
		a.retry.Stop()
		a.retry = nil
	}
}

func sameConnection(x, y Observation) bool {
	return x.State == y.State && x.Login == y.Login && x.Attempt == y.Attempt && (x.Scopes == nil) == (y.Scopes == nil) && slices.Equal(x.Scopes, y.Scopes)
}

func (a *Adapter) wait(ctx context.Context, f *statusFlight) Observation {
	select {
	case <-f.done:
		if ctx.Err() == nil {
			return f.obs
		}
	case <-ctx.Done():
	}
	return Observation{State: "unknown"}
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

// checkStatus reports the observation, whether a mutation made the answer
// meaningless, and whether its inputs are all files credentialStamp covers.
func (a *Adapter) checkStatus(ctx context.Context) (Observation, bool, bool) {
	unknown := func(reason string) Observation { return Observation{State: "unknown", Reason: reason} }
	if !a.mu.TryLock() {
		return unknown(ReasonChecking), true, false // mutation in progress; cannot infer its eventual outcome
	}
	defer a.mu.Unlock()
	login, kind, reason, scopes := a.classify(ctx)
	if ctx.Err() != nil {
		return unknown(ReasonTimeout), false, true
	}
	// A revoked token connects nothing, but it is not an absent login: gh
	// still offers it to every push. The person sees it as expired, and the
	// next sign-in replaces it (Install's revoked case).
	if kind == revoked {
		return Observation{State: "expired"}, false, true
	}
	// GitHub could not be asked: the token may be fine, and the connection
	// comes back by itself.
	if kind == outage {
		return Observation{State: "unreachable"}, false, true
	}
	if kind == absent || kind == foreign {
		return Observation{State: "disconnected"}, false, true
	}
	if kind != own {
		return unknown(reason), false, true
	}
	_, _, ok, late := a.observeLogin(ctx, login)
	// Without a token in hosts.yml, gh and the observation consult the
	// keyring, whose lock state is not a file: such an answer is not kept.
	remember := fileToken(a.home)
	if late {
		return unknown(ReasonTimeout), false, remember
	}
	if !ok {
		return Observation{State: "partial", Login: login}, false, remember
	}
	return Observation{State: "connected", Login: login, Scopes: scopes}, false, remember
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

func (a *Adapter) observe(ctx context.Context) (string, []string, Storage, bool) {
	login, scopes, ok := a.identity(ctx)
	if !ok {
		return login, nil, Unknown, false
	}
	login, storage, ok := a.observeWithLogin(ctx, login)
	return login, scopes, storage, ok
}
func (a *Adapter) observeWithLogin(ctx context.Context, login string) (string, Storage, bool) {
	login, storage, ok, _ := a.observeLogin(ctx, login)
	return login, storage, ok
}

// observeLogin is observeWithLogin that also says whether a command ran out
// of time, which proves nothing about the configuration.
func (a *Adapter) observeLogin(ctx context.Context, login string) (string, Storage, bool, bool) {
	protocol, e := a.gh(ctx, true, nil, "config", "get", "git_protocol", "--host", "github.com")
	if e != nil || strings.TrimSpace(string(protocol)) != "https" {
		return login, Unknown, false, timedOut(ctx, e)
	}
	helper, e := a.git(ctx, true, nil, "config", "--global", "--get", "credential.https://github.com.helper")
	if e != nil || !trustedGitHelper(helper) {
		return login, Unknown, false, timedOut(ctx, e)
	}
	// Ordinary Git credential protocol; stdout contains a credential and must
	// be discarded, never captured or reflected into a result.
	if _, e = a.git(ctx, false, strings.NewReader("protocol=https\nhost=github.com\n\n"), "credential", "fill"); e != nil {
		return login, Unknown, false, timedOut(ctx, e)
	}
	storage, ok := a.storage(ctx, login)
	return login, storage, ok, ctx.Err() != nil
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

// holdsOther is whether gh's active github.com login positively holds a token
// other than this one. A token gh cannot show, or one equal to it, may be the
// one gh uses, so it is never reported as unused.
func (a *Adapter) holdsOther(ctx context.Context, token string) bool {
	held, e := a.gh(ctx, true, nil, "auth", "token", "--hostname", "github.com")
	defer clear(held)
	held = bytes.TrimSuffix(held, []byte("\n"))
	return e == nil && len(held) > 0 && subtle.ConstantTimeCompare(held, []byte(token)) == 0
}

// Install hands the token to gh. replace is the person's explicit reconnect:
// it lets the token take the place of gh's working login of the same account,
// which an ordinary sign-in keeps.
func (a *Adapter) Install(ctx context.Context, token string, replace bool) (Result, error) {
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
	// sign-in. The other is the person's explicit reconnect of their own
	// account, which asks for exactly that. A login that cannot be classified
	// (network, keyring, unknown output) is left alone.
	stamp, stamped := credentialStamp(a.home)
	phase := Installed
	switch login, kind, _, _ := a.classify(ctx); {
	case ctx.Err() != nil:
		return result, denied
	case kind == own:
		_, storage, ok := a.observeWithLogin(ctx, login)
		if !ok {
			return result, denied
		}
		other := a.holdsOther(ctx, token)
		// gh auth login writes the incoming token's account entry, and only
		// the active token's identity was observed. So a reconnect replaces
		// only the sole account; with others stored it keeps the login, as an
		// ordinary sign-in does.
		if !replace || !other || !soleAccount(a.home) {
			return Result{Phase: Reobserved, Storage: storage, Unused: other}, nil
		}
		// It must still be the login just classified: a native gh auth
		// switch or login in between is not ours to replace. Nothing was
		// handed to gh yet, so the sign-in keeps the login as an ordinary one.
		if now, still := credentialStamp(a.home); !stamped || !still || now != stamp {
			return Result{Phase: Reobserved, Storage: storage, Unused: other}, nil
		}
		phase = Replaced
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
	login, scopes, storage, ok := a.observe(ctx)
	if err == nil && ok {
		return Result{Phase: phase, Storage: storage, Scopes: scopes}, nil
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
	login, _, ok := a.identity(ctx)
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
