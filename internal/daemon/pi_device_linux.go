//go:build linux

package daemon

import (
	"bufio"
	"context"
	"crypto/rand"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/open-habitat/open-habitat/internal/core"
)

//go:embed pi_device_helper.mjs
var piDeviceHelper string

// PiDevice runs the pinned native Pi SDK as the daemon's own Unix UID.
// Entry and Manifest are trusted deployment paths, never browser-supplied.
type PiDevice struct {
	Home, Node, Entry, Manifest string
	// SharedSelector verifies the installation selector at construction.
	SharedSelector bool
	// TrustedRuntime enables root-owned package validation in the startup check.
	// Direct synthetic PiDevice tests can supply a mock instead.
	TrustedRuntime bool
	// FixtureHome permits the same-UID browser host's per-identity synthetic root.
	// Production constructors never set this; the process HOME must match there.
	FixtureHome bool
	// Test seams count startup checks without invoking a host installation.
	selectorCheck func() error
	runtimeCheck  func() error
	mu            sync.Mutex
	active        string
	cancel        context.CancelFunc
}
type PiDeviceEvent struct {
	Type            string `json:"type"`
	State           string `json:"state,omitempty"`
	VerificationURI string `json:"verificationUri,omitempty"`
	UserCode        string `json:"userCode,omitempty"`
}

// validate runs before handlers are published. The root-owned release cannot be
// changed by this UID; walking all dependencies again on a read adds seconds.
func (p *PiDevice) validate() error {
	if err := p.validateConfiguration(); err != nil {
		return refuse(RefusalPiConfiguration, err)
	}
	selector := p.selectorCheck
	if selector == nil {
		selector = p.checkSharedSelector
	}
	if err := selector(); err != nil {
		return refuse(RefusalPiSelector, err)
	}
	if p.TrustedRuntime {
		check := p.runtimeCheck
		if check == nil {
			check = p.validateRuntime
		}
		if err := check(); err != nil {
			code := RefusalPiRuntimeUntrusted
			if errors.Is(err, errRuntimeUnsupported) {
				code = RefusalPiRuntimeVersion
			}
			return refuse(code, errors.New("native Pi runtime unavailable"))
		}
	}
	return nil
}

// Keep cheap identity/configuration checks at each native-operation boundary;
// only the operator-owned selector and release tree are startup-only.
func (p *PiDevice) validateConfiguration() error {
	if p.Home == "" || !filepath.IsAbs(p.Home) || !filepath.IsAbs(p.Node) || !filepath.IsAbs(p.Entry) || !filepath.IsAbs(p.Manifest) || os.Geteuid() == 0 {
		return errors.New("invalid Pi device configuration or UID")
	}
	if !p.FixtureHome && os.Getenv("HOME") != p.Home {
		return errors.New("daemon HOME mismatch")
	}
	return nil
}

// Credential paths are checked only when starting onboarding, not when reading
// status or serving ordinary conversation requests. Missing paths are normal.
func (p *PiDevice) validateCredentials() error {
	// Pi's native auth storage follows symlinks and does not repair old file modes.
	// Refuse unsafe existing paths rather than modifying another provider's credentials.
	for i, path := range []string{p.Home, filepath.Join(p.Home, ".pi"), filepath.Join(p.Home, ".pi", "agent"), filepath.Join(p.Home, ".pi", "agent", "auth.json")} {
		st, err := os.Lstat(path)
		if errors.Is(err, os.ErrNotExist) && i > 0 {
			continue
		}
		if err != nil {
			return errors.New("unsafe Pi credential path")
		}
		if st.Mode()&os.ModeSymlink != 0 || st.Sys().(*syscall.Stat_t).Uid != uint32(os.Geteuid()) {
			return errors.New("unsafe Pi credential path")
		}
		if i < 3 && (!st.IsDir() || st.Mode().Perm()&0022 != 0) {
			return errors.New("unsafe Pi credential directory")
		}
		if i == 3 && (!st.Mode().IsRegular() || st.Mode().Perm()&0077 != 0) {
			return errors.New("unsafe Pi credential file")
		}
	}
	return nil
}

func (p *PiDevice) checkSharedSelector() error {
	if p.SharedSelector {
		selected, err := core.LoadSharedPiRuntime()
		if err != nil || selected.Node != p.Node || selected.Entry != p.Entry || selected.Manifest != p.Manifest {
			return errors.New("native Pi selector unavailable")
		}
	}
	return nil
}

var errPiAttemptActive = errors.New("Pi sign-in already active")

// Start creates one operation, with a daemon-generated, unguessable ownership ID.
// The bounded channel never blocks process reaping on a disconnected browser.
// A dropped event is an unknown outcome: the caller must recheck Status.
func (p *PiDevice) Start() (string, <-chan PiDeviceEvent, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.active != "" {
		return "", nil, errPiAttemptActive
	}
	if err := p.validateCredentials(); err != nil {
		return "", nil, err
	}
	var token [16]byte
	if _, err := rand.Read(token[:]); err != nil {
		return "", nil, errors.New("attempt creation failed")
	}
	id := hex.EncodeToString(token[:])
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	p.active, p.cancel = id, cancel
	events := make(chan PiDeviceEvent, 3)
	go func() {
		defer cancel()
		defer close(events)
		defer func() { p.mu.Lock(); p.active = ""; p.cancel = nil; p.mu.Unlock() }()
		emit := func(e PiDeviceEvent) {
			select {
			case events <- e:
			default:
			}
		}
		frames, err := p.run(ctx, "login", emit)
		if err != nil || frames.Type != "completed" {
			emit(PiDeviceEvent{Type: "unknown"})
			return
		}
		state, err := p.status(ctx)
		p.mu.Lock()
		// Serialize the final decision with Cancel: an accepted cancellation
		// cannot be followed by an attempt-success event.
		if err != nil || state != "usable" || ctx.Err() != nil {
			emit(PiDeviceEvent{Type: "unknown"})
		} else {
			emit(PiDeviceEvent{Type: "status", State: "usable"})
		}
		p.mu.Unlock()
	}()
	return id, events, nil
}

// Cancel accepts only the currently active attempt ID. Cancellation never asserts logout.
func (p *PiDevice) Cancel(id string) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	if id == "" || id != p.active {
		return false
	}
	p.cancel()
	return true
}

// Status checks Pi's own stored OAuth status; never returns credentials.
func (p *PiDevice) Status() string { return p.StatusContext(context.Background()) }

// StatusContext lets an HTTP caller end native refresh when its response budget
// expires. The helper is killed and reaped before the status call returns.
func (p *PiDevice) StatusContext(ctx context.Context) string {
	if ctx.Err() != nil {
		return "unknown"
	}
	state, err := p.status(ctx)
	if state != "usable" && ctx.Err() == nil {
		bridge := filepath.Join(filepath.Dir(filepath.Dir(p.Node)), "node_modules/pi-claude-bridge/src/index.ts")
		if info, statErr := os.Stat(bridge); statErr == nil && info.Mode().IsRegular() {
			if (&claudeLogin{device: p}).status(ctx) == "completed" {
				return "usable"
			}
		}
	}
	if err != nil {
		return "unknown"
	}
	return state
}
func (p *PiDevice) status(parent context.Context) (string, error) {
	// Even status can refresh and rewrite Pi auth.json. This check belongs at
	// each helper spawn, including the follow-up status after device login;
	// selector and runtime validation remain startup-only.
	if err := p.validateCredentials(); err != nil {
		return "unknown", err
	}
	ctx, cancel := context.WithTimeout(parent, 15*time.Second)
	defer cancel()
	result, err := p.run(ctx, "status", func(PiDeviceEvent) {})
	if err != nil || result.Type != "status" {
		return "unknown", errors.New("native status unavailable")
	}
	return result.State, nil
}
func (p *PiDevice) run(ctx context.Context, action string, emit func(PiDeviceEvent)) (PiDeviceEvent, error) {
	// -e contains only static helper code. Pi module paths are operator-controlled.
	cmd := exec.CommandContext(ctx, p.Node, "--input-type=module", "--eval", piDeviceHelper, p.Entry, p.Manifest, action)
	// Do not let ambient Pi directory or Node preloads redirect native credentials.
	var env []string
	for _, item := range os.Environ() {
		if strings.HasPrefix(item, "PI_CODING_AGENT_DIR=") || strings.HasPrefix(item, "NODE_OPTIONS=") || strings.HasPrefix(item, "HOME=") {
			continue
		}
		env = append(env, item)
	}
	cmd.Env = append(env, "HOME="+p.Home, "PI_OFFLINE=1")
	cmd.Dir = p.Home
	cmd.Stderr = &storageDiagnostics{operation: "pi_device"} // Native errors may contain secrets.
	cmd.WaitDelay = time.Second
	in, err := cmd.StdinPipe()
	if err != nil {
		return PiDeviceEvent{}, errors.New("native child unavailable")
	}
	out, err := cmd.StdoutPipe()
	if err != nil {
		return PiDeviceEvent{}, errors.New("native child unavailable")
	}
	if err := cmd.Start(); err != nil {
		return PiDeviceEvent{}, errors.New("native child unavailable")
	}
	// Parent pipe stays open for the life of the child; EOF on parent death aborts Pi.
	defer in.Close()
	scanner := bufio.NewScanner(out)
	scanner.Buffer(make([]byte, 1024), 1024)
	var terminal PiDeviceEvent
	count := 0
	deviceSeen := false
	valid := true
	for scanner.Scan() {
		count++
		var e PiDeviceEvent
		line := scanner.Bytes()
		if count > 2 || json.Unmarshal(line, &e) != nil {
			valid = false
			break
		}
		switch e.Type {
		case "device_code":
			if action != "login" || terminal.Type != "" || e.VerificationURI != "https://auth.openai.com/codex/device" || len(e.UserCode) < 4 || len(e.UserCode) > 24 || !safeCode(e.UserCode) {
				valid = false
			} else {
				deviceSeen = true
				emit(e)
			}
		case "completed":
			if action != "login" || terminal.Type != "" {
				valid = false
			} else {
				terminal = e
			}
		case "status":
			if action != "status" || terminal.Type != "" || (e.State != "usable" && e.State != "missing" && e.State != "unknown") {
				valid = false
			} else {
				terminal = e
			}
		case "unknown":
			if terminal.Type != "" {
				valid = false
			} else {
				terminal = e
			}
		default:
			valid = false
		}
		if !valid {
			break
		}
	}
	if !valid {
		_ = cmd.Process.Kill()
	}
	scanErr := scanner.Err()
	waitErr := cmd.Wait()
	if !valid || scanErr != nil || waitErr != nil || ctx.Err() != nil || terminal.Type == "" || (action == "login" && terminal.Type == "completed" && !deviceSeen) {
		return PiDeviceEvent{}, fmt.Errorf("native operation unknown (%s)", strconv.FormatBool(valid))
	}
	return terminal, nil
}
func safeCode(s string) bool {
	for _, r := range s {
		if !strings.ContainsRune("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-", r) {
			return false
		}
	}
	return true
}
