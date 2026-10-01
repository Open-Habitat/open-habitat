//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/maintainer/native-agent-host/internal/core"
	"github.com/maintainer/native-agent-host/internal/transport"
	"golang.org/x/sys/unix"
)

// ConversationController is scoped to one daemon incarnation. It is deliberately
// not a gateway route or a durable command ledger. Native history and the
// browser-origin owner lock permit explicit continuation after daemon restart.
type ConversationController struct {
	mu       sync.Mutex
	sessions map[string]*conversation
	cfg      transport.Config
	runtime  *core.PiRuntimeConfig
	status   func(context.Context) string
	trusted  func(*http.Request) bool
	closed   bool
	// home is the native root; discover resolves workspaces beneath it.
	// Only the synthetic browser host sets them apart from cfg.Home.
	home     string
	discover func(transport.Config) Discovery
	fixture  bool   // untrusted synthetic runtime: never set in production
	instance string // ephemeral provisional stream cursor scope
	journal  *eventJournal
	// A short-lived per-daemon gate prevents status probes from presenting each
	// other's temporary flock as an external writer. Never hold mu across I/O.
	proofGate chan struct{}
}

// A continued native session retains spent browser IDs within this daemon
// incarnation so a lost earlier receipt cannot be replayed after continuation.
// Bound that protection separately from the smaller native event/queue limits.
const maxConversationCommands = 4096

type conversation struct {
	id, workspace, cwd           string
	rpc                          *piRPC
	owner                        *piOwnership
	state                        string // idle, pending, accepted, rejected, uncertain, stopping
	ack                          string // last command: pending, accepted, rejected, uncertain
	settled                      bool
	dead                         bool
	queueSteering, queueFollowUp []string
	queueRevision                uint64
	commands                     map[string]bool
	command                      string
	events                       []json.RawMessage
	cursor                       uint64
	streamSeq                    uint64
	lost                         bool
	aborting                     bool
	receipts                     map[string]string // bounded to spent send IDs; no durable acceptance claim
	turnGeneration               uint64            // increments on each new prompt, fences slow native settlement reads
	settlement                   map[string]string // observed_at, native_key, state; nil means unknown
	question                     map[string]any    // bounded plain-text pending UI request
	publishedHistory             map[string]bool   // bounded to this native session; JSONL is authoritative
}

func newConversationController(ctx context.Context, cfg transport.Config, runtime *core.PiRuntimeConfig, trusted func(*http.Request) bool, status func(context.Context) string) *ConversationController {
	instance, _ := uuid() // stream refuses to start if the instance ID is unavailable
	c := &ConversationController{cfg: cfg, runtime: runtime, trusted: trusted, status: status, sessions: make(map[string]*conversation), home: cfg.Home, discover: Discover, instance: instance}
	go func() { <-ctx.Done(); c.shutdown() }()
	return c
}

// ConversationHandlerWithFixtureRuntime is only for test/browser-host. It
// runs the real controller against a synthetic native root and an untrusted
// fake Pi program, which production must never accept.
func ConversationHandlerWithFixtureRuntime(ctx context.Context, cfg transport.Config, trusted func(*http.Request) bool, status func(context.Context) string, root string, runtime *core.PiRuntimeConfig) *ConversationController {
	c := newConversationController(ctx, cfg, runtime, trusted, status)
	c.home = root
	c.discover = func(transport.Config) Discovery { return scan(root, cfg.UID, unix.Openat2) }
	c.fixture = true
	// The browser-host exercises the controller's real event publisher. Without
	// its journal the fake Pi RPC stream can never reach /api/v1/events.
	c.journal = newEventJournal()
	return c
}

// FixtureSnapshot exposes the same controller/journal snapshot handoff as the
// production daemon, using only the browser-host's disposable native root.
func (c *ConversationController) FixtureSnapshot() http.Handler {
	if !c.fixture {
		return http.NotFoundHandler()
	}
	sessions := func(cfg transport.Config) ([]nativeSession, error) {
		cfg.Home = c.home
		return nativeSessions(cfg)
	}
	return snapshotHandlerWithController(c.cfg, c.trusted, c.discover, sessions, c.home, func(context.Context) string { return "unknown" }, c.journal, c)
}

// FixtureEvents exposes the real bounded journal stream to the browser-host.
func (c *ConversationController) FixtureEvents() http.Handler {
	if !c.fixture {
		return http.NotFoundHandler()
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if c.status(r.Context()) != "usable" {
			snapshotError(w, 428, "pi_onboarding_required")
			return
		}
		c.journal.stream(w, r, func() bool { return c.trusted(r) && validSnapshotIdentity(c.cfg, r) }, func() bool { return c.status(r.Context()) == "usable" })
	})
}

// nativeCfg names the native root for history reads without changing the
// identity that authorizes requests.
func (c *ConversationController) nativeCfg() transport.Config {
	n := c.cfg
	n.Home = c.home
	return n
}

func (c *ConversationController) shutdown() {
	c.mu.Lock()
	if c.closed {
		c.mu.Unlock()
		return
	}
	c.closed = true
	list := make([]*conversation, 0, len(c.sessions))
	for _, s := range c.sessions {
		s.state = "uncertain"
		if c.journal != nil {
			c.journal.appendInvalidation("pi:" + s.id)
		}
		if s.ack == "pending" {
			s.ack = "uncertain"
		}
		if s.receipts != nil && s.receipts[s.command] == "pending" {
			c.receipt(s, s.command, "uncertain")
		}
		list = append(list, s)
	}
	c.mu.Unlock()
	for _, s := range list {
		_ = s.rpc.close()
		_ = s.owner.release()
	}
}
func (c *ConversationController) revoke() { c.shutdown() }

// workspaceFD resolves only a freshly discovered immediate child, using the
// kernel's beneath/no-symlink/no-mount constraints. The open descriptor is
// carried into the child for chdir, so rename cannot redirect execution.
func (c *ConversationController) workspaceFD(id string) (*os.File, string, error) {
	observation := c.discover(c.cfg)
	if observation.State != "present" {
		return nil, "", errors.New("workspace unavailable")
	}
	name := ""
	var selected Workspace
	for _, w := range observation.Entries {
		wid := w.WorkspaceID
		if wid == "" {
			wid = opaque("ws_", c.cfg.Provider+":"+c.cfg.Subject+":"+w.Name)
		}
		if wid == id && w.Error == "" && w.Kind != "unknown" && w.Metadata != "error" {
			if name != "" {
				return nil, "", errors.New("ambiguous workspace")
			}
			name = w.Name
			selected = w
		}
	}
	if name == "" {
		return nil, "", errors.New("workspace unavailable")
	}
	root, err := unix.Open("/", unix.O_PATH|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if err != nil {
		return nil, "", err
	}
	defer unix.Close(root)
	home, err := dir(unix.Openat2, root, strings.TrimPrefix(c.home, "/"), false)
	if err != nil {
		return nil, "", err
	}
	defer unix.Close(home)
	h, err := stat(home)
	if err != nil || h.Uid != uint32(c.cfg.UID) {
		return nil, "", errors.New("home owner changed")
	}
	src, err := dir(unix.Openat2, home, "src", true)
	if err != nil {
		return nil, "", err
	}
	defer unix.Close(src)
	fd, err := dir(unix.Openat2, src, name, true)
	if err != nil {
		return nil, "", err
	}
	if !workspaceMatches(fd, selected) {
		unix.Close(fd)
		return nil, "", errors.New("workspace changed after discovery")
	}
	return os.NewFile(uintptr(fd), "workspace"), filepath.Join(c.home, "src", name), nil
}
func (c *ConversationController) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if !historyAuthorized(c.cfg, c.trusted, r) {
		snapshotError(w, 403, "cross_user_denied")
		return
	}
	state := c.status(r.Context())
	if state != "usable" || r.Context().Err() != nil {
		if state == "missing" {
			c.revoke()
		}
		snapshotError(w, 428, "pi_onboarding_required")
		return
	}
	if (r.URL.RawQuery != "" && !(r.Method == http.MethodGet && strings.HasSuffix(r.URL.Path, "/receipt") && len(r.URL.Query()) == 1 && len(r.URL.Query()["command_id"]) == 1 && sessionIDPattern.MatchString(r.URL.Query().Get("command_id")))) || r.URL.EscapedPath() != r.URL.Path || r.RequestURI != r.URL.RequestURI() {
		snapshotError(w, 400, "invalid_request")
		return
	}
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/conversations")
	if path == "" {
		if r.Method == http.MethodPost {
			c.create(w, r)
			return
		}
		if r.Method == http.MethodGet && r.ContentLength <= 0 && len(r.TransferEncoding) == 0 {
			c.list(w)
			return
		}
	}
	parts := strings.Split(strings.TrimPrefix(path, "/"), "/")
	if len(parts) != 2 || !sessionIDPattern.MatchString(parts[0]) {
		snapshotError(w, 404, "resource_not_found")
		return
	}
	switch {
	case r.Method == http.MethodGet && parts[1] == "receipt":
		c.readReceipt(w, r, parts[0])
	case r.Method == http.MethodGet && parts[1] == "status":
		c.observe(w, r, parts[0])
	case r.Method == http.MethodGet && parts[1] == "stream":
		c.stream(w, r, parts[0])
	case r.Method == http.MethodPost && (parts[1] == "send" || parts[1] == "steer" || parts[1] == "follow_up" || parts[1] == "clear_queue"):
		if parts[1] == "clear_queue" {
			c.clearQueue(w, r, parts[0])
		} else {
			c.sendKind(w, r, parts[0], parts[1])
		}
	case r.Method == http.MethodPost && parts[1] == "abort":
		c.abort(w, r, parts[0])
	case r.Method == http.MethodPost && parts[1] == "continue":
		c.continueEnded(w, r, parts[0])
	case r.Method == http.MethodPost && parts[1] == "stop":
		c.stop(w, r, parts[0])
	default:
		snapshotError(w, 404, "resource_not_found")
	}
}
func decodeControl(r *http.Request, target any, limit int64) error {
	if r.Header.Get("Content-Type") != "application/json" || len(r.TransferEncoding) != 0 || r.ContentLength <= 0 || r.ContentLength > limit {
		return errors.New("invalid body")
	}
	dec := json.NewDecoder(io.LimitReader(r.Body, limit+1))
	dec.DisallowUnknownFields()
	if dec.Decode(target) != nil || dec.Decode(new(any)) != io.EOF {
		return errors.New("invalid json")
	}
	return nil
}

func workspaceMatches(fd int, selected Workspace) bool {
	opened, err := stat(fd)
	return err == nil && opened.Mode&unix.S_IFMT == unix.S_IFDIR && uint64(opened.Dev) == selected.dev && opened.Ino == selected.ino
}

// list recovers an in-memory handle when the create response was lost. After a
// daemon crash only Pi's native read-only history survives; no takeover occurs.
func (c *ConversationController) list(w http.ResponseWriter) {
	c.mu.Lock()
	items := make([]map[string]string, 0, len(c.sessions))
	for _, s := range c.sessions {
		items = append(items, map[string]string{"agent_id": "pi:" + s.id, "workspace_id": s.workspace, "state": s.state})
	}
	c.mu.Unlock()
	historyJSON(w, map[string]any{"schema_version": 1, "sessions": items})
}

func (c *ConversationController) create(w http.ResponseWriter, r *http.Request) {
	var body struct {
		WorkspaceID string `json:"workspace_id"`
	}
	if decodeControl(r, &body, 1024) != nil || !idPattern.MatchString(body.WorkspaceID) {
		snapshotError(w, 400, "invalid_request")
		return
	}
	if c.runtime == nil {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	// Native discovery and durable origin sync can block on disk I/O. Do not
	// stall event drains for other Pi children while preparing a new one.
	device := &PiDevice{Home: c.home, Node: c.runtime.Node, Entry: c.runtime.Entry, Manifest: c.runtime.Manifest, TrustedRuntime: !c.fixture, SharedSelector: !c.fixture, FixtureHome: c.fixture}
	if device.validate() != nil {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	ws, cwd, err := c.workspaceFD(body.WorkspaceID)
	if err != nil {
		snapshotError(w, 404, "resource_not_found")
		return
	}
	defer ws.Close()
	histories, err := nativeSessions(c.nativeCfg())
	if err != nil {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	id, ok := uuid()
	if !ok {
		snapshotError(w, 503, "daemon_unavailable")
		return
	}
	for _, s := range histories {
		if s.id == id {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
	}
	owner, err := acquirePiOwnership(c.home, id)
	if err != nil {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	releaseOwner := true
	defer func() {
		if releaseOwner {
			_ = owner.release()
		}
	}()
	// Inherit only a bounded, explicit environment. Pi reads credentials itself.
	if err := owner.markBrowser(body.WorkspaceID, cwd); err != nil {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	c.mu.Lock()
	active := 0
	for _, s := range c.sessions {
		select {
		case <-s.rpc.exited:
		default:
			active++
		}
	}
	if c.closed || active >= 4 || len(c.sessions) >= 128 {
		c.mu.Unlock()
		snapshotError(w, 429, "capacity_exceeded")
		return
	}
	p, err := launchPiRPCCommand(c.runtime.Node, []string{filepath.Join(filepath.Dir(c.runtime.Entry), "bundle", "cli.js")}, c.home, cwd, []string{"PATH=/usr/bin:/bin", "USER=" + c.cfg.Username}, owner, ws)
	if err != nil {
		c.mu.Unlock()
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	s := &conversation{id: id, workspace: body.WorkspaceID, cwd: cwd, rpc: p, owner: owner, state: "idle", events: make([]json.RawMessage, 0, 64), commands: make(map[string]bool)}
	c.sessions[id] = s
	if c.journal != nil {
		c.journal.appendInvalidation("pi:" + id)
	}
	releaseOwner = false
	c.mu.Unlock()
	// The daemon retains the advisory lock until the direct child is reaped;
	// stopped sessions stay as uncertain tombstones for lost-request lookup.
	go c.watch(s)
	go c.drain(s)
	historyJSON(w, map[string]any{"schema_version": 1, "agent_id": "pi:" + id, "workspace_id": body.WorkspaceID, "state": "idle"})
}

// proofPermit serializes temporary probes and continuation admission, including
// the period after proof returns while the caller still owns its fence. Waiting
// is bounded; saturation yields unproven/unavailable, never a false writer.
func (c *ConversationController) proofPermit(ctx context.Context) (func(), bool) {
	c.mu.Lock()
	if c.proofGate == nil {
		c.proofGate = make(chan struct{}, 1)
	}
	gate := c.proofGate
	c.mu.Unlock()
	timer := time.NewTimer(2 * time.Second)
	defer timer.Stop()
	select {
	case gate <- struct{}{}:
		return func() { <-gate }, true
	case <-ctx.Done():
		return nil, false
	case <-timer.C:
		return nil, false
	}
}

// continuationProof is the single admission proof used by status and continue.
// The returned owner fence stays held through admission, or is released by the
// status caller. The probe does no work past a failed non-blocking lock check.
func (c *ConversationController) continuationProof(id string) (*piOwnership, browserOrigin, *os.File, string, string, *conversation, string) {
	var zero browserOrigin
	c.mu.Lock()
	old := c.sessions[id]
	if c.closed || c.runtime == nil {
		c.mu.Unlock()
		return nil, zero, nil, "", "", old, "source_unavailable"
	}
	if old != nil {
		select {
		case <-old.rpc.exited:
			// Reaped is positive evidence; release our copy of the child's lock.
			_ = old.owner.release()
		default:
			c.mu.Unlock()
			return nil, zero, nil, "", "", old, "writer_present"
		}
	}
	owner, err := acquirePiOwnership(c.home, id)
	c.mu.Unlock()
	if err != nil {
		return nil, zero, nil, "", "", old, "writer_present"
	}
	fail := func(kind string) (*piOwnership, browserOrigin, *os.File, string, string, *conversation, string) {
		_ = owner.release()
		return nil, zero, nil, "", "", old, kind
	}
	origin, err := owner.browserOrigin()
	if err != nil {
		return fail("read_only_history")
	}
	if old != nil && (old.workspace != origin.Workspace || old.cwd != origin.Cwd) {
		return fail("unproven")
	}
	device := &PiDevice{Home: c.home, Node: c.runtime.Node, Entry: c.runtime.Entry, Manifest: c.runtime.Manifest, TrustedRuntime: !c.fixture, SharedSelector: !c.fixture, FixtureHome: c.fixture}
	if device.validate() != nil {
		return fail("source_unavailable")
	}
	ws, cwd, err := c.workspaceFD(origin.Workspace)
	if err != nil || cwd != origin.Cwd {
		if ws != nil {
			_ = ws.Close()
		}
		return fail("unproven")
	}
	histories, err := nativeSessions(c.nativeCfg())
	if err != nil {
		_ = ws.Close()
		return fail("source_unavailable")
	}
	path := ""
	for _, h := range histories {
		if h.id == id {
			if path != "" || h.cwd != cwd || h.state != "readable" {
				_ = ws.Close()
				return fail("unproven")
			}
			path = h.path
		}
	}
	if path == "" {
		_ = ws.Close()
		return fail("unproven")
	}
	if _, err := reconciledNativeHistory(path, c.cfg.UID, id, cwd); err != nil {
		_ = ws.Close()
		return fail("unproven")
	}
	return owner, origin, ws, cwd, path, old, "eligible"
}

// continueEnded is explicit. A browser lease at the gateway and the lock's
// origin marker are both required; a terminal history alone cannot grant control.
func (c *ConversationController) continueEnded(w http.ResponseWriter, r *http.Request, id string) {
	if r.ContentLength != 0 || len(r.TransferEncoding) != 0 {
		snapshotError(w, 400, "invalid_request")
		return
	}
	releasePermit, ok := c.proofPermit(r.Context())
	if !ok {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	defer releasePermit()
	owner, origin, ws, cwd, path, old, eligibility := c.continuationProof(id)
	if eligibility != "eligible" {
		switch eligibility {
		case "writer_present":
			snapshotError(w, 409, "writer_conflict")
		case "read_only_history":
			snapshotError(w, 409, "read_only_history")
		case "source_unavailable":
			snapshotError(w, 503, "native_source_unavailable")
		default:
			snapshotError(w, 409, "control_uncertain")
		}
		return
	}
	defer func() {
		if owner != nil {
			_ = owner.release()
		}
	}()
	defer ws.Close()
	// The owner fence is still held. Establish the pre-existing native keys
	// before starting Pi so the first settlement emits only this turn's new
	// entries, not the entire continued session into the shared replay ring.
	published, err := existingHistoryKeys(path, c.cfg.UID, id, cwd)
	if err != nil {
		snapshotError(w, 409, "control_uncertain")
		return
	}
	c.mu.Lock()
	// Another create or continuation may have run while history was read.
	// The owner fence still excludes another native writer for this ID.
	active := 0
	for _, session := range c.sessions {
		select {
		case <-session.rpc.exited:
		default:
			active++
		}
	}
	if c.closed || c.sessions[id] != old {
		c.mu.Unlock()
		snapshotError(w, 409, "control_uncertain")
		return
	}
	if active >= 4 || (old == nil && len(c.sessions) >= 128) {
		c.mu.Unlock()
		snapshotError(w, 429, "capacity_exceeded")
		return
	}
	p, err := launchPiRPCSession(c.runtime.Node, []string{filepath.Join(filepath.Dir(c.runtime.Entry), "bundle", "cli.js")}, c.home, cwd, []string{"PATH=/usr/bin:/bin", "USER=" + c.cfg.Username}, owner, ws, path)
	if err != nil {
		c.mu.Unlock()
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	s := &conversation{id: id, workspace: origin.Workspace, cwd: cwd, rpc: p, owner: owner, state: "idle", ack: "uncertain", events: make([]json.RawMessage, 0, 64), commands: make(map[string]bool), publishedHistory: published}

	if old != nil {
		s.commands = old.commands
		s.receipts = old.receipts
		s.command = old.command
	}
	c.sessions[id] = s
	if c.journal != nil {
		c.journal.reset("pi:"+id, "idle")
		c.journal.appendInvalidation("pi:" + id)
	}
	owner = nil // the child and watcher now own this lock
	c.mu.Unlock()
	go c.watch(s)
	go c.drain(s)
	historyJSON(w, map[string]any{"schema_version": 1, "agent_id": "pi:" + id, "workspace_id": origin.Workspace, "state": "idle", "prior_outcome": "uncertain"})
}

func (c *ConversationController) watch(s *conversation) {
	<-s.rpc.exited
	_ = s.rpc.in.Close()
	_ = s.rpc.out.Close()
	c.mu.Lock()
	s.dead = true
	s.state = "uncertain"
	if s.ack == "pending" {
		s.ack = "uncertain"
	}
	if s.receipts != nil && s.receipts[s.command] == "pending" {
		c.receipt(s, s.command, "uncertain")
	}
	if c.sessions[s.id] == s && c.journal != nil {
		c.journal.reset("pi:"+s.id, "unknown")
		c.journal.appendInvalidation("pi:" + s.id)
	}
	c.mu.Unlock()
	_ = s.owner.release()
}

// Only validated, bounded native fields cross into the public journal.
func (c *ConversationController) publishDelta(agent string, raw json.RawMessage) {
	var e struct {
		Type                  string `json:"type"`
		AssistantMessageEvent struct {
			Type         string `json:"type"`
			Delta        string `json:"delta"`
			ContentIndex int    `json:"contentIndex"`
		} `json:"assistantMessageEvent"`
		ToolCallID string `json:"toolCallId"`
		ToolName   string `json:"toolName"`
		IsError    bool   `json:"isError"`
	}
	if json.Unmarshal(raw, &e) != nil {
		return
	}
	switch e.Type {
	case "agent_start":
		c.journal.reset(agent, "running")
	case "turn_start":
		c.journal.activity(agent, "running")
	case "message_update":
		if e.AssistantMessageEvent.Type == "text_delta" && e.AssistantMessageEvent.ContentIndex >= 0 && e.AssistantMessageEvent.Delta != "" {
			c.journal.delta(agent, e.AssistantMessageEvent.Delta, e.AssistantMessageEvent.ContentIndex)
		}
	case "tool_execution_start", "tool_execution_end":
		if len(e.ToolCallID) < 1 || len(e.ToolCallID) > 200 || len(e.ToolName) < 1 || len(e.ToolName) > 200 {
			return
		}
		kind, state := "tool.updated", "running"
		if e.Type == "tool_execution_start" {
			kind = "tool.started"
		}
		if e.Type == "tool_execution_end" {
			kind = "tool.finished"
			state = "succeeded"
			if e.IsError {
				state = "failed"
			}
		}
		c.journal.progress(agent, kind, map[string]string{"tool_call_id": e.ToolCallID, "tool_name": e.ToolName, "state": state})
	}
}

func (c *ConversationController) drain(s *conversation) {
	for e := range s.rpc.events {
		c.mu.Lock()
		if s.dead || (c.sessions[s.id] != nil && c.sessions[s.id] != s) {
			c.mu.Unlock()
			break
		}
		s.cursor++
		if len(s.events) == 64 {
			s.events = s.events[1:]
			s.lost = true
		}
		var frame struct {
			Type string `json:"type"`
		}
		_ = json.Unmarshal(e, &frame)
		raw := e
		if len(e) > 8192 {
			e, _ = json.Marshal(map[string]any{"type": frame.Type, "truncated": true})
			s.lost = true
		}
		s.events = append(s.events, e)
		if c.journal != nil {
			if frame.Type != "message_update" && !strings.HasPrefix(frame.Type, "tool_execution_") {
				c.journal.invalidateNative()
			}
		}
		if c.journal != nil {
			c.publishDelta("pi:"+s.id, raw)
		}
		if frame.Type == "queue_update" {
			var q struct {
				Steering []string `json:"steering"`
				FollowUp []string `json:"followUp"`
			}
			if json.Unmarshal(raw, &q) == nil && q.Steering != nil && q.FollowUp != nil && len(q.Steering)+len(q.FollowUp) <= 128 {
				valid := true
				for _, text := range append(append([]string{}, q.Steering...), q.FollowUp...) {
					if len(text) > 65536 {
						valid = false
					}
				}
				if valid {
					s.queueSteering, s.queueFollowUp = q.Steering, q.FollowUp
					s.queueRevision++
					if c.journal != nil {
						c.journal.appendEvent("queue.changed", "pi:"+s.id, map[string]any{"revision": fmt.Sprintf("queue_%08d", s.queueRevision), "steering": q.Steering, "follow_up": q.FollowUp})
					}
				} else {
					s.rpc.overflow.Store(true)
				}
			} else {
				s.rpc.overflow.Store(true)
			}
		}
		if frame.Type == "extension_ui_request" {
			var q struct {
				ID          string   `json:"id"`
				Method      string   `json:"method"`
				Title       string   `json:"title"`
				Message     string   `json:"message"`
				StatusText  string   `json:"statusText"`
				Text        string   `json:"text"`
				Prefill     string   `json:"prefill"`
				WidgetLines []string `json:"widgetLines"`
				Options     []string `json:"options"`
			}
			if json.Unmarshal(raw, &q) == nil && len(q.ID) > 0 && len(q.ID) <= 200 && utf8.ValidString(q.ID) {
				prompt := q.Title
				for _, candidate := range []string{q.Message, q.StatusText, q.Text, q.Prefill, strings.Join(q.WidgetLines, "\n")} {
					if prompt == "" && candidate != "" {
						prompt = candidate
					}
				}
				if len(prompt) > 1000 {
					prompt = string([]rune(prompt)[:min(len([]rune(prompt)), 250)])
				}
				if prompt == "" {
					prompt = "Pi UI request (no text available)"
				}
				if utf8.ValidString(prompt) && len(prompt) <= 1000 {
					kind := q.Method
					if kind != "input" && kind != "confirm" && kind != "select" {
						kind = "unknown"
					}
					switch q.Method {
					case "notify", "setStatus", "setWidget", "setTitle", "set_editor_text":
						// These Pi RPC UI updates need no response. Preserve
						// their content as safe text, never replace a dialog.
						if c.journal != nil {
							c.journal.appendEvent("unknown.native", "pi:"+s.id, map[string]any{"native_type": "extension_ui_request", "content": map[string]any{"media_type": "text/plain", "text": prompt, "complete": true}})
						}
					default:
						if len(q.Options) > 100 {
							q.Options = q.Options[:100]
						}
						choices := make([]string, 0, len(q.Options))
						for _, option := range q.Options {
							if len(option) <= 500 && utf8.ValidString(option) {
								choices = append(choices, option)
							}
						}
						s.question = map[string]any{"request_id": q.ID, "question_kind": kind, "prompt": prompt, "choices": choices}
						if c.journal != nil {
							c.journal.appendEvent("question.requested", "pi:"+s.id, s.question)
						}
					}
				}
			}
		}

		settled := frame.Type == "agent_settled"
		turn := s.turnGeneration
		if settled {
			s.question = nil // any unanswered UI request is no longer pending after Pi settled
			s.settled = true
			if c.journal != nil {
				c.journal.activity("pi:"+s.id, "settling")
			}
			if s.state == "accepted" {
				s.state = "idle"
			}
		}
		c.mu.Unlock()
		if settled {
			key := c.publishNativeHistoryForTurn(s, turn)
			c.mu.Lock()
			if c.sessions[s.id] == s && !c.closed && s.turnGeneration == turn {
				state := "unknown"
				if key != "" {
					state = "settled"
				}
				s.settlement = map[string]string{"state": state, "observed_at": time.Now().UTC().Format(time.RFC3339Nano), "native_key": key}
				if c.journal != nil {
					c.journal.appendEvent("turn.settled", "pi:"+s.id, s.settlement)
				}
			}
			if c.sessions[s.id] == s && !c.closed && s.turnGeneration == turn && c.journal != nil {
				c.journal.activity("pi:"+s.id, "idle")
			}
			c.mu.Unlock()
		}
	}
	c.mu.Lock()
	if c.sessions[s.id] == s {
		s.state = "uncertain"
		if s.ack == "pending" {
			s.ack = "uncertain"
		}
		if s.receipts != nil && s.receipts[s.command] == "pending" {
			c.receipt(s, s.command, "uncertain")
		}
		if c.journal != nil {
			c.journal.reset("pi:"+s.id, "unknown")
		}
	}
	c.mu.Unlock()
}

// A continuation has already fenced and reconciled this native file. Seed
// only its existing active-branch entries; the next settlement must not
// flood the per-user event ring with old history.
func existingHistoryKeys(path string, uid int, id, cwd string) (map[string]bool, error) {
	native := readNativeSettled(path, uid)
	if native.state != "readable" || native.id != id || native.cwd != cwd {
		return nil, errors.New("native history changed before continuation")
	}
	keys := make(map[string]bool, len(native.entries))
	for _, entry := range native.entries {
		keys[entry.Key] = true
	}
	return keys, nil
}

// Pi's settlement notification carries no persistent entry identity. Read the
// mapped UID's checked JSONL instead; never turn an RPC message into history.
// A failed/unstable read invalidates the view rather than claiming settlement.
func (c *ConversationController) publishNativeHistory(s *conversation) string {
	c.mu.Lock()
	turn := s.turnGeneration
	c.mu.Unlock()
	return c.publishNativeHistoryForTurn(s, turn)
}
func (c *ConversationController) publishNativeHistoryForTurn(s *conversation, turn uint64) string {
	sessions, err := nativeSessions(c.nativeCfg())
	if err != nil {
		if c.journal != nil {
			c.journal.appendInvalidation("pi:" + s.id)
		}
		return ""
	}
	for _, header := range sessions {
		if header.id != s.id || header.cwd != s.cwd || header.state != "readable" {
			continue
		}
		native := readNativeSettled(header.path, c.cfg.UID)
		if native.state != "readable" || native.id != s.id || native.cwd != s.cwd {
			break
		}
		c.mu.Lock()
		if c.sessions[s.id] != s || c.closed || s.turnGeneration != turn {
			c.mu.Unlock()
			return ""
		}
		if s.publishedHistory == nil {
			s.publishedHistory = make(map[string]bool)
		}
		fresh := make([]historyEntry, 0)
		for _, entry := range native.entries {
			if s.publishedHistory[entry.Key] {
				continue
			}
			fresh = append(fresh, entry)
		}
		c.mu.Unlock()
		lastKey := ""
		for _, entry := range fresh {
			if entry.Kind == "assistant" {
				lastKey = entry.Key
			}
			inline(&native, &entry)
			// Continuation can replace a reaped handle while native reads
			// complete. Never publish a superseded controller's tail.
			c.mu.Lock()
			if c.sessions[s.id] != s || c.closed || s.turnGeneration != turn {
				c.mu.Unlock()
				return ""
			}
			s.publishedHistory[entry.Key] = true
			if c.journal != nil {
				c.journal.nativeEntry("pi:"+s.id, entry)
			}
			c.mu.Unlock()
		}
		return lastKey
	}
	if c.journal != nil {
		c.journal.appendInvalidation("pi:" + s.id)
	}
	return ""
}

// receipt records the Pi RPC acknowledgement, never completion of the turn.
// Caller holds c.mu. A missing entry after restart is unknown, never accepted.
func (c *ConversationController) receipt(s *conversation, id, outcome string) {
	if s.receipts == nil {
		s.receipts = make(map[string]string)
	}
	s.receipts[id] = outcome
	if c.journal != nil {
		c.journal.appendEvent("command.changed", "pi:"+s.id, map[string]string{"client_command_id": id, "acceptance": outcome, "execution": "unknown"})
	}
}

func (c *ConversationController) lookup(w http.ResponseWriter, id string) *conversation {
	c.mu.Lock()
	s := c.sessions[id]
	c.mu.Unlock()
	if s == nil {
		snapshotError(w, 404, "resource_not_found")
	}
	return s
}
func (c *ConversationController) send(w http.ResponseWriter, r *http.Request, id string) {
	c.sendKind(w, r, id, "send")
}
func (c *ConversationController) sendKind(w http.ResponseWriter, r *http.Request, id, kind string) {
	var body struct {
		Message   string `json:"message"`
		CommandID string `json:"command_id"`
	}
	if decodeControl(r, &body, 66000) != nil || body.Message == "" || len(body.Message) > 65536 || !sessionIDPattern.MatchString(body.CommandID) {
		snapshotError(w, 400, "invalid_request")
		return
	}
	c.mu.Lock()
	s := c.sessions[id]
	if s == nil {
		c.mu.Unlock()
		snapshotError(w, 404, "resource_not_found")
		return
	}
	if c.closed || s.aborting || (kind == "send" && s.state != "idle" && s.state != "rejected") || (kind != "send" && s.state != "accepted") || s.rpc.overflow.Load() || s.commands[body.CommandID] || len(s.commands) >= maxConversationCommands {
		c.mu.Unlock()
		snapshotError(w, 409, "control_uncertain")
		return
	}
	oldState := s.state
	s.state = "pending"
	s.ack = "pending"
	s.commands[body.CommandID] = true
	if kind == "send" {
		s.turnGeneration++
		s.settled = false
		s.settlement = nil
		s.question = nil
		if s.receipts == nil {
			s.receipts = make(map[string]string)
		}
		c.receipt(s, body.CommandID, "pending")
	}
	s.command = body.CommandID
	c.mu.Unlock()
	// A disconnect must not cancel the native request. Never retry ambiguous writes.
	go func() {
		rpcKind := kind
		if rpcKind == "send" {
			rpcKind = "prompt"
		}
		accepted, err := s.rpc.request(rpcKind, body.Message, 15*time.Second)
		c.mu.Lock()
		defer c.mu.Unlock()
		if s.state != "pending" {
			return
		}
		switch {
		case err != nil:
			s.state = "uncertain"
			s.ack = "uncertain"
		case !accepted:
			s.state = "rejected"
			if kind != "send" {
				s.state = oldState
				if s.settled {
					s.state = "idle"
				}
			}
			s.ack = "rejected"
		default:
			s.state = "accepted"
			s.ack = "accepted"
			if s.settled {
				s.state = "idle"
			}
		}
		if kind == "send" {
			c.receipt(s, body.CommandID, s.ack)
		}
	}()
	historyJSON(w, map[string]any{"schema_version": 1, "command_id": body.CommandID, "state": "pending"})
}
func (c *ConversationController) readReceipt(w http.ResponseWriter, r *http.Request, id string) {
	if r.ContentLength != 0 || len(r.TransferEncoding) != 0 {
		snapshotError(w, 400, "invalid_request")
		return
	}
	c.mu.Lock()
	s := c.sessions[id]
	result := ""
	if s != nil {
		result = s.receipts[r.URL.Query().Get("command_id")]
	}
	c.mu.Unlock()
	if result == "" {
		snapshotError(w, 404, "resource_not_found")
		return
	}
	historyJSON(w, map[string]any{"schema_version": 1, "command_id": r.URL.Query().Get("command_id"), "state": result})
}
func (c *ConversationController) observe(w http.ResponseWriter, r *http.Request, id string) {
	if r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
		snapshotError(w, 400, "invalid_request")
		return
	}
	s := c.lookup(w, id)
	if s == nil {
		return
	}
	c.mu.Lock()
	state, command, ack, cursor, lost := s.state, s.command, s.ack, s.cursor, s.lost
	settlement := s.settlement
	question := s.question
	receipt := ""
	if s.receipts != nil {
		receipt = s.receipts[s.command]
	}
	queueSteering, queueFollowUp, queueRevision := append([]string{}, s.queueSteering...), append([]string{}, s.queueFollowUp...), s.queueRevision
	events := append([]json.RawMessage{}, s.events...)
	cwd := s.cwd
	if s.rpc.overflow.Load() {
		state = "uncertain"
		lost = true
		s.state = state
		if s.ack == "pending" {
			s.ack = "uncertain"
			ack = "uncertain"
		}
		if receipt == "pending" {
			c.receipt(s, s.command, "uncertain")
			receipt = "uncertain"
		}
	}
	c.mu.Unlock()
	revision := ""
	history := "missing"
	sessions, err := nativeSessions(c.nativeCfg())
	if err != nil {
		history = "unavailable"
	} else {
		for _, n := range sessions {
			if n.id == id {
				history = "unavailable"
				if n.cwd == cwd {
					loaded := readNativeSettled(n.path, c.cfg.UID)
					if loaded.id == id && loaded.cwd == cwd && loaded.state == "readable" {
						revision = loaded.revision
						history = "readable"
					}
				}
				break
			}
		}
	}
	continuation := "unproven"
	if releasePermit, ok := c.proofPermit(r.Context()); ok {
		func() {
			defer releasePermit()
			owner, _, ws, _, _, _, proof := c.continuationProof(id)
			if ws != nil {
				_ = ws.Close()
			}
			if owner != nil {
				_ = owner.release()
			}
			if proof != "source_unavailable" {
				continuation = proof
			}
		}()
	}
	// A concurrent continuation can change the handle while the probe runs.
	// Never advertise eligibility for a superseded handle.
	c.mu.Lock()
	if c.closed || c.sessions[id] != s {
		continuation = "unproven"
	}
	c.mu.Unlock()
	historyJSON(w, map[string]any{"schema_version": 1, "agent_id": "pi:" + id, "workspace_id": s.workspace, "state": state, "continuation": continuation, "command_id": command, "ack": ack, "send_receipt": receipt, "turn_settled": settlement, "pending_question": question, "event_cursor": cursor, "events": events, "event_loss": lost, "native_history": history, "native_revision": revision, "history_query": "/api/v1/agents/pi:" + id + "/history", "queue": map[string]any{"revision": queueRevision, "steering": queueSteering, "follow_up": queueFollowUp}})
}

// clearQueue returns only Pi's correlated clear_queue response. No local queue
// snapshot is interpreted as proof of removal: delivery may race the clear.
func (c *ConversationController) clearQueue(w http.ResponseWriter, r *http.Request, id string) {
	var body struct {
		CommandID string `json:"command_id"`
	}
	if decodeControl(r, &body, 1024) != nil || !sessionIDPattern.MatchString(body.CommandID) {
		snapshotError(w, 400, "invalid_request")
		return
	}
	c.mu.Lock()
	s := c.sessions[id]
	if s == nil {
		c.mu.Unlock()
		snapshotError(w, 404, "resource_not_found")
		return
	}
	if c.closed || s.aborting || s.state == "pending" || s.state == "uncertain" || s.state == "stopping" || s.rpc.overflow.Load() || s.commands[body.CommandID] || len(s.commands) >= maxConversationCommands {
		c.mu.Unlock()
		snapshotError(w, 409, "control_uncertain")
		return
	}
	s.commands[body.CommandID] = true
	oldState := s.state
	s.state = "pending"
	s.ack = "pending"
	s.command = body.CommandID
	c.mu.Unlock()
	reply, err := s.rpc.requestQueue("clear_queue", "", 4*time.Second)
	c.mu.Lock()
	if s.state == "pending" {
		if err != nil {
			s.state = "uncertain"
			s.ack = "uncertain"
		} else if !reply.Accepted {
			s.state = oldState
			s.ack = "rejected"
		} else {
			s.state = oldState
			if s.settled && oldState == "accepted" {
				s.state = "idle"
			}
			s.ack = "accepted"
		}
	}
	accepted := err == nil && reply.Accepted
	// A correlated clear receipt remains valid even if Pi exits or a stop races
	// after the native removal. Never discard the only copy of these texts.
	c.mu.Unlock()
	if !accepted {
		snapshotError(w, 409, "control_uncertain")
		return
	}
	historyJSON(w, map[string]any{"schema_version": 1, "command_id": body.CommandID, "state": "accepted", "removed_queue": map[string]any{"steering": reply.Steering, "follow_up": reply.FollowUp}})
}

// abort interrupts the current Pi turn, not the Pi process or its detached tools.
// A command ID is spent before writing so an uncertain receipt cannot be retried.
func (c *ConversationController) abort(w http.ResponseWriter, r *http.Request, id string) {
	var body struct {
		CommandID string `json:"command_id"`
	}
	if decodeControl(r, &body, 1024) != nil || !sessionIDPattern.MatchString(body.CommandID) {
		snapshotError(w, 400, "invalid_request")
		return
	}
	c.mu.Lock()
	s := c.sessions[id]
	if s == nil {
		c.mu.Unlock()
		snapshotError(w, 404, "resource_not_found")
		return
	}
	if c.closed || s.state != "accepted" || s.settled || s.aborting || s.rpc.overflow.Load() || s.commands[body.CommandID] || len(s.commands) >= maxConversationCommands {
		c.mu.Unlock()
		snapshotError(w, 409, "control_uncertain")
		return
	}
	s.aborting = true
	s.commands[body.CommandID] = true
	s.command = body.CommandID
	s.ack = "pending"
	c.mu.Unlock()
	// A browser disconnect cannot cancel an abort already delivered to Pi.
	go func() {
		// Pi acknowledges abort only after waiting for its run loop to settle.
		accepted, err := s.rpc.request("abort", "", 30*time.Second)
		c.mu.Lock()
		defer c.mu.Unlock()
		s.aborting = false
		if s.command != body.CommandID || c.closed || s.state == "uncertain" || s.state == "stopping" {
			return
		}
		switch {
		case err != nil:
			s.ack = "uncertain"
			s.state = "uncertain"
		case !accepted:
			s.ack = "rejected"
		default:
			s.ack = "accepted"
		}
	}()
	historyJSON(w, map[string]any{"schema_version": 1, "command_id": body.CommandID, "state": "pending"})
}

func (c *ConversationController) stop(w http.ResponseWriter, r *http.Request, id string) {
	if r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
		snapshotError(w, 400, "invalid_request")
		return
	}
	c.mu.Lock()
	s := c.sessions[id]
	if s == nil {
		c.mu.Unlock()
		snapshotError(w, 404, "resource_not_found")
		return
	}
	if s.state != "stopping" {
		s.state = "stopping"
		go func() { _ = s.rpc.close(); c.mu.Lock(); s.state = "uncertain"; c.mu.Unlock() }()
	}
	c.mu.Unlock()
	historyJSON(w, map[string]any{"schema_version": 1, "state": "termination_unknown"})
}

// stream is a bounded, provisional SSE status-resnapshot stream. Its cursor is
// transport-only: lost frames are recovered from the native history and current
// status, never from a parallel history store. A stream cannot write to Pi.
func (c *ConversationController) stream(w http.ResponseWriter, r *http.Request, id string) {
	if r.ContentLength > 0 || len(r.TransferEncoding) != 0 || c.instance == "" {
		snapshotError(w, 400, "invalid_request")
		return
	}
	session := c.lookup(w, id)
	if session == nil {
		return
	}
	// One finite connection costs at most twenty native status reads. The
	// gateway checks the browser login again before forwarding every frame.
	prefix := "ev1:" + c.instance + ":"
	last := r.Header.Get("Last-Event-ID")
	if last != "" {
		if len(last) > 100 || !strings.HasPrefix(last, prefix) {
			snapshotError(w, 409, "cursor_instance_mismatch")
			return
		}
		seq, err := strconv.ParseUint(strings.TrimPrefix(last, prefix), 10, 64)
		c.mu.Lock()
		current := session.streamSeq
		c.mu.Unlock()
		if err != nil || seq == 0 || seq > current {
			snapshotError(w, 409, "control_uncertain")
			return
		}
		// No frame can be replayed. Even the latest cursor may have missed
		// frames emitted to another viewer, so require a fresh status/history
		// read instead of claiming a continuous stream.
		snapshotError(w, 409, "cursor_expired")
		return
	}
	// The UDS transport has a five-second request deadline. Remove it only
	// for this finite read-only stream; keep an absolute write bound.
	control := http.NewResponseController(w)
	if control.SetReadDeadline(time.Time{}) != nil || control.SetWriteDeadline(time.Now().Add(24*time.Second)) != nil {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(200)
	// Limit native onboarding probes and whole-history revision reads to one
	// every two seconds per connected viewer.
	tick := time.NewTicker(2 * time.Second)
	defer tick.Stop()
	end := time.Now().Add(20 * time.Second)
	for n := 0; n < 20 && time.Now().Before(end); n++ {
		if n > 0 {
			select {
			case <-r.Context().Done():
				return
			case <-tick.C:
			}
		}
		// Recheck native onboarding even on an already-open socket. Revocation
		// terminates the stream and the controller before another frame escapes.
		state := c.status(r.Context())
		if state != "usable" || r.Context().Err() != nil {
			if state == "missing" && r.Context().Err() == nil {
				c.revoke()
			}
			return
		}
		c.mu.Lock()
		s := c.sessions[id]
		closed := c.closed || s == nil
		c.mu.Unlock()
		if closed {
			return
		}
		rec := httptest.NewRecorder()
		c.observe(rec, r, id)
		if rec.Code != 200 || rec.Body.Len() > conversationStreamFrameLimit {
			return
		}
		c.mu.Lock()
		s = c.sessions[id]
		if c.closed || s == nil {
			c.mu.Unlock()
			return
		}
		// IDs belong to this private resnapshot channel, not the published
		// replay contract. Every connection without a cursor starts afresh.
		s.streamSeq++
		seq := s.streamSeq
		c.mu.Unlock()
		frame := strings.TrimSpace(rec.Body.String())
		if _, err := io.WriteString(w, "id: "+prefix+strconv.FormatUint(seq, 10)+"\nevent: status\ndata: "+frame+"\n\n"); err != nil {
			return
		}
		flusher.Flush()
	}
}

const conversationStreamFrameLimit = 1 << 20
