//go:build linux

package daemon

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/open-habitat/open-habitat/internal/diagnostic"
	"github.com/open-habitat/open-habitat/internal/transport"
)

const claudeLoginPath = "/api/v1/pi/claude-login"

// Claude owns the credential exchange and its native store. The host retains
// only an expiring, adapter-owned process lease, never a token. Browser
// session owners and the own-UID agent owner occupy disjoint namespaces.
type claudeLogin struct {
	mu                    sync.Mutex
	device                *PiDevice
	owner, id, state, uri string
	until                 time.Time
	cancel                context.CancelFunc
	input                 io.WriteCloser
	submitted             bool
	// A cancelled child can still write its native store until it is reaped.
	// Browser and agent adapters share this fence as well as the lease.
	done chan struct{}
	// Same-UID synthetic tests only; production derives the executable from the trusted runtime.
	executable string
	// onSignedIn hears of a completed sign-in, which ends the conversations'
	// record of Claude refusing them.
	onSignedIn func()
}
type claudeLoginResponse struct {
	SchemaVersion   int    `json:"schema_version"`
	State           string `json:"state"`
	AttemptID       string `json:"attempt_id,omitempty"`
	VerificationURI string `json:"verification_uri,omitempty"`
}

func ClaudeLoginHandler(cfg transport.Config, trusted func(*http.Request) bool, p *PiDevice) http.Handler {
	return (&claudeLogin{device: p}).handler(cfg, trusted)
}
func (a *claudeLogin) binary() string {
	if a.executable != "" && a.device.FixtureHome {
		return a.executable
	}
	return filepath.Join(claudeCodeDir(filepath.Dir(filepath.Dir(a.device.Node))), "claude")
}

// claudeCodeDir is where a core runtime ships Claude Code.
func claudeCodeDir(runtimeRoot string) string {
	return filepath.Join(runtimeRoot, "node_modules/@anthropic-ai/claude-agent-sdk-linux-"+claudeCPU())
}

// npm installs only the SDK binary package for the runtime's own CPU, named
// with npm's spelling (x64, arm64).
func claudeCPU() string {
	if runtime.GOARCH == "amd64" {
		return "x64"
	}
	return runtime.GOARCH
}
func (a *claudeLogin) validate() error {
	if err := a.device.validateConfiguration(); err != nil {
		return err
	}
	for i, path := range []string{a.device.Home, filepath.Join(a.device.Home, ".claude"), filepath.Join(a.device.Home, ".claude", ".credentials.json"), filepath.Join(a.device.Home, ".claude.json"), filepath.Join(a.device.Home, ".claude", ".claude.json")} {
		st, err := os.Lstat(path)
		if errors.Is(err, os.ErrNotExist) && i > 0 {
			continue
		}
		if err != nil {
			return errors.New("native unavailable")
		}
		owner, ok := st.Sys().(*syscall.Stat_t)
		if !ok || owner.Uid != uint32(os.Geteuid()) || st.Mode()&os.ModeSymlink != 0 || st.Mode().Perm()&0022 != 0 || (i < 2 && !st.IsDir()) || (i >= 2 && (!st.Mode().IsRegular() || st.Mode().Perm()&0077 != 0)) {
			return errors.New("unsafe native store")
		}
	}
	st, err := os.Stat(a.binary())
	if err != nil || !st.Mode().IsRegular() || st.Mode().Perm()&0111 == 0 {
		return errors.New("native unavailable")
	}
	return nil
}
func (a *claudeLogin) command(ctx context.Context, args ...string) *exec.Cmd {
	cmd := exec.CommandContext(ctx, a.binary(), args...)
	cmd.Dir = a.device.Home
	cmd.Env = []string{"HOME=" + a.device.Home, "PATH=/usr/bin:/bin", "BROWSER=/bin/false"}
	cmd.Stderr = io.Discard
	cmd.WaitDelay = time.Second
	cmd.SysProcAttr = &syscall.SysProcAttr{Pdeathsig: syscall.SIGTERM}
	return cmd
}
func (a *claudeLogin) status(ctx context.Context) string {
	if a.validate() != nil {
		return "unavailable"
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	var out limitedOutput
	cmd := a.command(ctx, "auth", "status", "--json")
	cmd.Stdout = &out
	err := cmd.Run()
	var result struct {
		LoggedIn   bool   `json:"loggedIn"`
		AuthMethod string `json:"authMethod"`
	}
	if out.overflow || json.Unmarshal(out.data, &result) != nil {
		return "unknown"
	}
	if err == nil && result.LoggedIn && result.AuthMethod == "claude.ai" {
		return "completed"
	}
	if !result.LoggedIn {
		return "missing"
	}
	return "unknown"
}

// Never buffer arbitrary native output or expose native error text.
type limitedOutput struct {
	data     []byte
	overflow bool
}

func (b *limitedOutput) Write(p []byte) (int, error) {
	n := len(p)
	if len(b.data)+n > 8192 {
		b.overflow = true
		return n, nil
	}
	b.data = append(b.data, p...)
	return n, nil
}

var claudeCode = regexp.MustCompile(`^[A-Za-z0-9_~.\-#]+$`)

func claudeAuthorizationURI(raw string) bool {
	if len(raw) > 4096 {
		return false
	}
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" || u.Host != "claude.com" || u.Path != "/cai/oauth/authorize" || u.User != nil || u.Fragment != "" {
		return false
	}
	q := u.Query()
	return q.Get("redirect_uri") == "https://platform.claude.com/oauth/code/callback" && q.Get("response_type") == "code" && q.Get("code") == "true" && q.Get("code_challenge_method") == "S256" && q.Get("state") != "" && q.Get("code_challenge") != ""
}
func (a *claudeLogin) stop() {
	if a.cancel != nil {
		a.cancel()
	}
	if a.input != nil {
		_ = a.input.Close()
	}
	a.input = nil
	a.uri = ""
	a.state = "unknown"
}
func (a *claudeLogin) start(owner string) error {
	if err := a.validate(); err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	cmd := a.command(ctx, "auth", "login", "--claudeai")
	input, err := cmd.StdinPipe()
	if err != nil {
		cancel()
		return err
	}
	output, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		_ = input.Close()
		return err
	}
	if err = cmd.Start(); err != nil {
		cancel()
		_ = input.Close()
		return err
	}
	// A monotonic per-process generation is sufficient: the session token, never
	// this ID, supplies ownership. An old tab cannot submit to a newer generation.
	id := time.Now().UTC().Format("20060102T150405.000000000")
	a.owner, a.id, a.state, a.uri = owner, id, "pending", ""
	a.until = time.Now().Add(5 * time.Minute)
	a.input = input
	a.cancel = cancel
	a.submitted = false
	done := make(chan struct{})
	a.done = done
	go func() {
		defer close(done)
		scanner := bufio.NewScanner(output)
		scanner.Buffer(make([]byte, 1024), 8192)
		for scanner.Scan() {
			line := scanner.Text()
			if pos := strings.Index(line, "https://"); pos >= 0 {
				uri := strings.TrimSpace(line[pos:])
				if claudeAuthorizationURI(uri) {
					a.mu.Lock()
					if a.id == id && a.state == "pending" {
						a.state = "code"
						a.uri = uri
					}
					a.mu.Unlock()
				}
			}
		}
		if scanner.Err() != nil {
			cancel()
		}
		err := cmd.Wait()
		_ = input.Close()
		state := "unknown"
		if err == nil && ctx.Err() == nil {
			state = a.status(ctx)
			if state == "completed" {
				if _, err := a.device.modelSettings(ctx, "initialize-claude", ""); err != nil {
					state = "unknown"
				}
				// The sign-in itself succeeded; a person who later meets the
				// first-run screen can still finish it in Claude Code.
				if err := markClaudeOnboarded(a.device.Home); err != nil {
					diagnostic.New(os.Stderr, "daemon").Warn("claude_onboarding", "outcome", "failed", "reason", err.Error())
				}
			}
		}
		a.mu.Lock()
		signedIn := a.onSignedIn
		if a.id == id && a.state != "unknown" {
			a.state = state
			a.uri = ""
			a.input = nil
		}
		a.mu.Unlock()
		if state == "completed" && signedIn != nil {
			signedIn()
		}
		cancel()
	}()
	return nil
}
func (a *claudeLogin) handler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return a.handlerAt(cfg, trusted, claudeLoginPath, false)
}
func (a *claudeLogin) handlerAt(cfg transport.Config, trusted func(*http.Request) bool, path string, agent bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != path || r.RequestURI != path || r.URL.RawQuery != "" || !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		owner := "agent-own-uid"
		if !agent {
			tokens := r.Header.Values("X-Agent-Host-Session")
			if len(tokens) != 1 || !sessionToken.MatchString(tokens[0]) {
				snapshotError(w, 403, "cross_user_denied")
				return
			}
			owner = tokens[0]
		}
		var body struct {
			AttemptID string `json:"attempt_id"`
			Code      string `json:"code"`
		}
		switch r.Method {
		case "PUT", "DELETE":
			if decodeControl(r, &body, 4096) != nil || body.AttemptID == "" || (r.Method == "PUT" && (!claudeCode.MatchString(body.Code) || len(body.Code) < 8 || len(body.Code) > 2048)) || (r.Method == "DELETE" && body.Code != "") {
				snapshotError(w, 400, "invalid_request")
				return
			}
		case "GET", "POST":
			if r.ContentLength > 0 || len(r.TransferEncoding) > 0 {
				snapshotError(w, 400, "invalid_request")
				return
			}
		default:
			snapshotError(w, 405, "method_not_allowed")
			return
		}
		a.mu.Lock()
		defer a.mu.Unlock()
		if a.owner != "" && time.Now().After(a.until) {
			a.stop()
			a.owner = ""
			a.id = ""
		}
		if r.Method == "POST" {
			if a.done != nil && !channelClosed(a.done) {
				snapshotError(w, 409, "attempt_active")
				return
			}
			if a.owner != "" && (a.owner != owner || a.state == "pending" || a.state == "code") {
				snapshotError(w, 409, "attempt_active")
				return
			}
			if err := a.start(owner); err != nil {
				snapshotError(w, 503, "native_unavailable")
				return
			}
		} else if r.Method != "GET" {
			if a.owner != owner || a.id != body.AttemptID {
				snapshotError(w, 404, "attempt_not_found")
				return
			}
			if r.Method == "DELETE" {
				a.stop()
			} else {
				if a.state != "code" || a.submitted || a.input == nil {
					snapshotError(w, 409, "attempt_active")
					return
				}
				a.submitted = true
				// Small bounded pipe write; no returned code is retained in the lease.
				if _, err := io.WriteString(a.input, body.Code+"\n"); err != nil {
					a.stop()
				}
			}
		}
		result := claudeLoginResponse{SchemaVersion: 1}
		if a.owner == owner {
			result.State = a.state
			result.AttemptID = a.id
			result.VerificationURI = a.uri
			if result.State == "completed" {
				// Completion is a process outcome, not a credential cache.
				// Reobserve native logout/expiry on an explicit status read.
				a.mu.Unlock()
				result.State = a.status(r.Context())
				a.mu.Lock()
				if a.owner != owner || a.id != result.AttemptID {
					snapshotError(w, 404, "attempt_not_found")
					return
				}
				// Cancellation won while native status was running.
				if a.state != "completed" {
					result.State = a.state
				}
			}
		} else {
			// A different browser may read native presence, never this lease.
			// Slow native I/O must not prevent its owner from cancelling.
			a.mu.Unlock()
			result.State = a.status(r.Context())
			a.mu.Lock()
		}
		historyJSON(w, result)
	})
}
