//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/maintainer/native-agent-host/internal/core"
	"github.com/maintainer/native-agent-host/internal/transport"
	"golang.org/x/sys/unix"
)

// ConversationController is scoped to one daemon incarnation. It is deliberately
// not a gateway route or a durable command ledger. No restart takeover exists.
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
	instance string // ephemeral stream cursor scope; never a history store
}
type conversation struct {
	id, workspace, cwd           string
	rpc                          *piRPC
	owner                        *piOwnership
	state                        string // idle, pending, accepted, rejected, uncertain, stopping
	ack                          string // last command: pending, accepted, rejected, uncertain
	settled                      bool
	queueSteering, queueFollowUp []string
	queueRevision                uint64
	commands                     map[string]bool
	command                      string
	events                       []json.RawMessage
	cursor                       uint64
	streamSeq                    uint64
	lost                         bool
	aborting                     bool
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
	return c
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
		if s.ack == "pending" {
			s.ack = "uncertain"
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
	if r.URL.RawQuery != "" || r.URL.EscapedPath() != r.URL.Path || r.RequestURI != r.URL.Path {
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
	c.mu.Lock()
	defer c.mu.Unlock()
	active := 0
	for _, s := range c.sessions {
		select {
		case <-s.rpc.exited:
		default:
			active++
		}
	}
	if c.closed || active >= 4 || len(c.sessions) >= 128 {
		snapshotError(w, 429, "capacity_exceeded")
		return
	}
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
	// Inherit only a bounded, explicit environment. Pi reads credentials itself.
	p, err := launchPiRPCCommand(c.runtime.Node, []string{filepath.Join(filepath.Dir(c.runtime.Entry), "bundle", "cli.js")}, c.home, cwd, []string{"PATH=/usr/bin:/bin", "USER=" + c.cfg.Username}, owner, ws)
	if err != nil {
		_ = owner.release()
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	s := &conversation{id: id, workspace: body.WorkspaceID, cwd: cwd, rpc: p, owner: owner, state: "idle", events: make([]json.RawMessage, 0, 64), commands: make(map[string]bool)}
	c.sessions[id] = s
	// The daemon retains the advisory lock until the direct child is reaped;
	// stopped sessions stay as uncertain tombstones for lost-request lookup.
	go c.watch(s)
	go c.drain(s)
	historyJSON(w, map[string]any{"schema_version": 1, "agent_id": "pi:" + id, "workspace_id": body.WorkspaceID, "state": "idle"})
}
func (c *ConversationController) watch(s *conversation) {
	<-s.rpc.exited
	_ = s.rpc.in.Close()
	_ = s.rpc.out.Close()
	c.mu.Lock()
	s.state = "uncertain"
	if s.ack == "pending" {
		s.ack = "uncertain"
	}
	c.mu.Unlock()
	_ = s.owner.release()
}

func (c *ConversationController) drain(s *conversation) {
	for e := range s.rpc.events {
		c.mu.Lock()
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
				} else {
					s.rpc.overflow.Store(true)
				}
			} else {
				s.rpc.overflow.Store(true)
			}
		}
		if frame.Type == "agent_settled" {
			s.settled = true
			if s.state == "accepted" {
				s.state = "idle"
			}
		}
		c.mu.Unlock()
	}
	c.mu.Lock()
	s.state = "uncertain"
	if s.ack == "pending" {
		s.ack = "uncertain"
	}
	c.mu.Unlock()
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
	if c.closed || s.aborting || (kind == "send" && s.state != "idle" && s.state != "rejected") || (kind != "send" && s.state != "accepted") || s.rpc.overflow.Load() || s.commands[body.CommandID] || len(s.commands) >= 128 {
		c.mu.Unlock()
		snapshotError(w, 409, "control_uncertain")
		return
	}
	oldState := s.state
	s.state = "pending"
	s.ack = "pending"
	s.commands[body.CommandID] = true
	if kind == "send" {
		s.settled = false
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
	}()
	historyJSON(w, map[string]any{"schema_version": 1, "command_id": body.CommandID, "state": "pending"})
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
	historyJSON(w, map[string]any{"schema_version": 1, "agent_id": "pi:" + id, "workspace_id": s.workspace, "state": state, "command_id": command, "ack": ack, "event_cursor": cursor, "events": events, "event_loss": lost, "native_history": history, "native_revision": revision, "history_query": "/api/v1/agents/pi:" + id + "/history", "queue": map[string]any{"revision": queueRevision, "steering": queueSteering, "follow_up": queueFollowUp}})
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
	if c.closed || s.aborting || s.state == "pending" || s.state == "uncertain" || s.state == "stopping" || s.rpc.overflow.Load() || s.commands[body.CommandID] || len(s.commands) >= 128 {
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
	if c.closed || s.state != "accepted" || s.settled || s.aborting || s.rpc.overflow.Load() || s.commands[body.CommandID] || len(s.commands) >= 128 {
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
	if c.lookup(w, id) == nil {
		return
	}
	// One finite connection costs at most twenty native status reads. The
	// gateway checks the browser login again before forwarding every frame.
	prefix := "ev1:" + c.instance + ":"
	last := r.Header.Get("Last-Event-ID")
	if last != "" {
		if len(last) > 100 || !strings.HasPrefix(last, prefix) {
			snapshotError(w, 409, "control_uncertain")
			return
		}
		seq, err := strconv.ParseUint(strings.TrimPrefix(last, prefix), 10, 64)
		c.mu.Lock()
		current := c.sessions[id].streamSeq
		c.mu.Unlock()
		// Concurrent viewers can advance this cursor independently. An old
		// cursor receives a full native-backed resnapshot, never a false
		// claim of replay. Future or invented cursors fail closed.
		if err != nil || seq == 0 || seq > current {
			snapshotError(w, 409, "control_uncertain")
			return
		}
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
	tick := time.NewTicker(time.Second)
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
		// A bounded monotonic cursor covers status/ack changes as well as Pi
		// events. Old or missing cursors receive a full status resnapshot.
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
