//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/Open-Habitat/open-habitat/internal/core"
	"github.com/Open-Habitat/open-habitat/internal/transport"
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
	home           string
	discover       func(transport.Config) Discovery
	fixture        bool                         // untrusted synthetic runtime: never set in production
	titleGenerator func(string) (string, error) // unit fixture only
	journal        *eventJournal
	// A short-lived per-daemon gate prevents continuation probes from presenting
	// each other's temporary flock as an external writer. Never hold mu across I/O.
	proofGate      chan struct{}
	recapPath      string
	recapIdleDelay time.Duration                            // test seam; zero uses the production three-minute interval
	recapGenerator func(*conversation, string, uint64) bool // synthetic test seam
}

// A continued native session retains spent browser IDs within this daemon
// incarnation so a lost earlier receipt cannot be replayed after continuation.
// Bound that protection separately from the smaller native event/queue limits.
const maxConversationCommands = 4096

type piStartupChoice struct {
	Provider string `json:"provider,omitempty"`
	Model    string `json:"model"`
	Thinking string `json:"thinking,omitempty"`
}

type conversation struct {
	// Native startup/first-message settings until Pi persists its history. This is
	// per-child, in-memory control state, never a second default or history store.
	startupChoice                                           *piStartupChoice
	id, workspace, cwd                                      string
	rpc                                                     *piRPC
	owner                                                   *piOwnership
	state                                                   string // idle, pending, accepted, rejected, uncertain, stopping
	ack                                                     string // last command: pending, accepted, rejected, uncertain
	runInitial                                              bool
	runActive                                               bool
	settled                                                 bool
	dead                                                    bool
	queueSteering, queueFollowUp                            []string
	queueRevision                                           uint64
	commands                                                map[string]bool
	command                                                 string
	events                                                  []json.RawMessage
	cursor                                                  uint64
	historyPath                                             string
	lost                                                    bool
	aborting                                                bool
	receipts                                                map[string]string // bounded to spent send IDs; no durable acceptance claim
	turnGeneration                                          uint64            // increments on each new prompt, fences slow native settlement reads
	acceptedMessages                                        uint64
	naming, automaticFirst, automaticRefined, refinementDue bool
	recapping                                               bool
	recapTimer                                              *time.Timer
	recapActivity                                           uint64 // activity fence, protected by c.mu
	recapLastActivity                                       time.Time
	recapReschedule                                         bool
	recapAttemptedThrough                                   string // at most one automatic request per native message
	automaticName                                           string // last name written by this controller, never authoritative
	firstText, thirdText, latestText                        string
	settlement                                              map[string]string // observed_at, native_key, state; nil means unknown
	authError                                               string            // fixed code only; cleared on a new prompt
	question                                                map[string]any    // bounded plain-text pending UI request
	questionID                                              string            // native ID; never trust a browser-supplied native identity
	questionKind                                            string
	questionChoices                                         []string
	queuedQuestions                                         []pendingQuestion // bounded native requests waiting behind the visible one
	spentQuestions                                          map[string]bool   // native IDs already answered or cancelled
	publishedHistory                                        map[string]bool   // bounded to this native session; JSONL is authoritative
}

type pendingQuestion struct {
	id, kind string
	choices  []string
	view     map[string]any
}

// Caller holds c.mu. Only one request is visible at a time, but Pi can have
// multiple outstanding native resolvers (including after an earlier timeout).
func (c *ConversationController) showQuestion(s *conversation, q pendingQuestion) {
	s.questionID, s.questionKind, s.questionChoices = q.id, q.kind, q.choices
	s.question = q.view
	if c.journal != nil {
		c.journal.appendEvent("question.requested", "pi:"+s.id, q.view)
	}
}

func newConversationController(ctx context.Context, cfg transport.Config, runtime *core.PiRuntimeConfig, trusted func(*http.Request) bool, status func(context.Context) string) *ConversationController {
	c := &ConversationController{cfg: cfg, runtime: runtime, trusted: trusted, status: status, sessions: make(map[string]*conversation), home: cfg.Home, discover: Discover}
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
	watchCfg := c.nativeCfg()
	go watchNativeHistory(ctx, watchCfg, c.journal, nil)
	return c
}

// FixtureSetRecapIdleDelay compresses the daemon timer in the synthetic host only.
func (c *ConversationController) FixtureSetRecapIdleDelay(delay time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.fixture {
		c.recapIdleDelay = delay
	}
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
		c.journal.stream(w, r, func() bool { return c.trusted(r) })
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
		if s.recapTimer != nil {
			s.recapTimer.Stop()
		}
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
	if c.recapPath != "" {
		_ = os.RemoveAll(filepath.Dir(c.recapPath))
	}
}

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
	src, err := dir(unix.Openat2, home, "src", false)
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
	// Process operations have their own exact query grammar.
	processParts := strings.Split(strings.TrimPrefix(strings.TrimPrefix(r.URL.Path, "/api/v1/conversations"), "/"), "/")
	if len(processParts) >= 2 && processParts[1] == "processes" {
		c.processRoutes(w, r, processParts)
		return
	}
	if (r.URL.RawQuery != "" && !(r.Method == http.MethodGet && ((strings.HasSuffix(r.URL.Path, "/receipt") && len(r.URL.Query()) == 1 && len(r.URL.Query()["command_id"]) == 1 && sessionIDPattern.MatchString(r.URL.Query().Get("command_id"))) || (strings.HasSuffix(r.URL.Path, "/status") && len(r.URL.Query()) == 1 && r.URL.Query().Get("continuation") == "true" && len(r.URL.Query()["continuation"]) == 1)))) || r.URL.EscapedPath() != r.URL.Path || r.RequestURI != r.URL.RequestURI() {
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
	case r.Method == http.MethodGet && parts[1] == "eligibility":
		c.historyEligibility(w, r, parts[0])
	case r.Method == http.MethodPost && (parts[1] == "send" || parts[1] == "steer" || parts[1] == "follow_up" || parts[1] == "clear_queue"):
		if parts[1] == "clear_queue" {
			c.clearQueue(w, r, parts[0])
		} else {
			c.sendKind(w, r, parts[0], parts[1])
		}
	case r.Method == http.MethodPost && parts[1] == "regenerate_title":
		c.regenerateTitle(w, r, parts[0])
	case r.Method == http.MethodPost && parts[1] == "history_title":
		c.historyTitle(w, r, parts[0])
	case r.Method == http.MethodPost && parts[1] == "recap":
		c.requestRecap(w, r, parts[0])
	case r.Method == http.MethodPost && parts[1] == "question":
		c.answerQuestion(w, r, parts[0])
	case r.Method == http.MethodPost && parts[1] == "abort":
		c.abort(w, r, parts[0])
	case r.Method == http.MethodPost && parts[1] == "continue":
		c.continueEnded(w, r, parts[0])
	case r.Method == http.MethodPost && parts[1] == "stop":
		c.stop(w, r, parts[0])
	case r.Method == http.MethodPost && parts[1] == "close":
		c.closeEmpty(w, r, parts[0])
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
	items := make([]map[string]any, 0, len(c.sessions))
	for _, s := range c.sessions {
		items = append(items, map[string]any{"agent_id": "pi:" + s.id, "workspace_id": s.workspace, "state": s.state, "startup_choice": s.startupChoice})
	}
	c.mu.Unlock()
	historyJSON(w, map[string]any{"schema_version": 1, "sessions": items})
}

func (c *ConversationController) create(w http.ResponseWriter, r *http.Request) {
	var body struct {
		WorkspaceID string `json:"workspace_id"`
		Provider    string `json:"provider"`
		Model       string `json:"model"`
		Thinking    string `json:"thinking"`
	}
	if decodeControl(r, &body, 1024) != nil || !idPattern.MatchString(body.WorkspaceID) || len(body.Model) > 160 || (body.Thinking != "" && (!validThinking(body.Thinking) || body.Model == "")) {
		snapshotError(w, 400, "invalid_request")
		return
	}
	if body.Provider == "" {
		body.Provider = "openai-codex"
	}
	if body.Provider != "openai-codex" && body.Provider != "openai" && body.Provider != "claude-bridge" {
		snapshotError(w, 400, "invalid_request")
		return
	}
	if c.runtime == nil {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	// The socket server's default write deadline is five seconds. Native catalog
	// validation can take twelve seconds and the child's initial get_state up to
	// fifteen; retain the create reply instead of losing an already-created
	// session to that shorter transport deadline. Stay below the gateway's
	// sixty-second finite-request ceiling.
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(45 * time.Second))
	// Validate against this person's native catalog without changing their default.
	if body.Model != "" && !c.fixture {
		device := &PiDevice{Home: c.home, Node: c.runtime.Node, Entry: c.runtime.Entry, Manifest: c.runtime.Manifest, TrustedRuntime: true}
		catalog, err := device.catalog(r.Context(), "")
		chosen := false
		if err == nil && catalog.CatalogStatus != "unavailable" {
			for _, model := range catalog.Models {
				if model.ID == body.Model && model.Provider == body.Provider {
					chosen = body.Thinking == ""
					for _, level := range model.ThinkingLevels {
						if level == body.Thinking {
							chosen = true
						}
					}
				}
			}
		}
		if !chosen {
			snapshotError(w, 400, "invalid_request")
			return
		}
	}
	// Native discovery and durable origin sync can block on disk I/O. Do not
	// stall event drains for other Pi children while preparing a new one.
	ws, cwd, err := c.workspaceFD(body.WorkspaceID)
	if err != nil {
		snapshotError(w, 404, "resource_not_found")
		return
	}
	defer ws.Close()
	id, ok := uuid()
	if !ok {
		snapshotError(w, 503, "daemon_unavailable")
		return
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
	prefix, err := c.piArgs()
	if err != nil {
		c.mu.Unlock()
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	if body.Model != "" {
		prefix = append(prefix, "--provider", body.Provider, "--model", body.Model)
		if body.Thinking != "" {
			prefix = append(prefix, "--thinking", body.Thinking)
		}
	}
	p, err := launchPiRPCCommand(c.runtime.Node, prefix, c.home, cwd, []string{agentPath(c.home), "USER=" + c.cfg.Username}, owner, ws)
	if err != nil {
		c.mu.Unlock()
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	s := &conversation{id: id, workspace: body.WorkspaceID, cwd: cwd, rpc: p, owner: owner, state: "pending", events: make([]json.RawMessage, 0, 64), commands: make(map[string]bool)}
	if body.Model != "" {
		s.startupChoice = &piStartupChoice{Provider: body.Provider, Model: body.Model, Thinking: body.Thinking}
	}
	c.sessions[id] = s
	// Publish creation once the child's initial native settings are observed.
	releaseOwner = false
	c.mu.Unlock()
	// The daemon retains the advisory lock until the direct child is reaped;
	// stopped sessions stay as uncertain tombstones for lost-request lookup.
	go c.watch(s)
	go c.drain(s)
	go c.watchProcesses(s)
	// Pi may choose a model even when no explicit startup flag was supplied.
	// Observe this child before admitting its first send; a later global default
	// is not evidence of which model this already-running session uses.
	initial, initialErr := p.requestQueue("get_state", "", 15*time.Second)
	c.mu.Lock()
	if initialErr == nil && initial.Accepted && !s.dead && s.state == "pending" {
		if s.runActive {
			s.state = "accepted"
		} else {
			s.state = "idle"
		}
		if initial.Choice != nil {
			s.startupChoice = initial.Choice
		}
	} else if s.state == "pending" {
		s.state = "uncertain"
	}
	state, choice := s.state, s.startupChoice
	if c.journal != nil {
		c.journal.appendInvalidation("pi:" + id)
	}
	c.mu.Unlock()
	historyJSON(w, map[string]any{"schema_version": 1, "agent_id": "pi:" + id, "workspace_id": body.WorkspaceID, "state": state, "startup_choice": choice})

}

func (c *ConversationController) watch(s *conversation) {
	<-s.rpc.exited
	_ = s.rpc.in.Close()
	_ = s.rpc.out.Close()
	c.mu.Lock()
	s.dead = true
	if s.recapTimer != nil {
		s.recapTimer.Stop()
	}
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
		Message     string           `json:"message"`
		CommandID   string           `json:"command_id"`
		FirstChoice *piStartupChoice `json:"first_choice,omitempty"`
	}
	if decodeControl(r, &body, 66000) != nil || body.Message == "" || len(body.Message) > 65536 || !sessionIDPattern.MatchString(body.CommandID) {
		snapshotError(w, 400, "invalid_request")
		return
	}
	if body.FirstChoice != nil {
		if kind != "send" || !c.validFirstChoice(r.Context(), body.FirstChoice) {
			snapshotError(w, 400, "invalid_request")
			return
		}
	}
	c.mu.Lock()
	s := c.sessions[id]
	if s == nil {
		c.mu.Unlock()
		snapshotError(w, 404, "resource_not_found")
		return
	}
	archiveState := "active"
	if c.home != "" {
		annotations, annotationErr := loadVisibility(c.home)
		archiveState = archiveFact(annotations, annotationErr, "pi:"+id)
	}
	if archiveState != "active" || c.closed || s.aborting || (kind == "send" && s.state != "idle" && s.state != "rejected") || (kind != "send" && s.state != "accepted") || s.rpc.overflow.Load() || s.commands[body.CommandID] || len(s.commands) >= maxConversationCommands {
		c.mu.Unlock()
		snapshotError(w, 409, "control_uncertain")
		return
	}
	if body.FirstChoice != nil && (s.state != "idle" || len(s.commands) != 0 || s.acceptedMessages != 0 || s.dead || s.naming || s.recapping || s.questionID != "") {
		c.mu.Unlock()
		snapshotError(w, 409, "control_uncertain")
		return
	}
	oldState := s.state
	wasSettled := s.settled
	s.state = "pending"
	s.ack = "pending"
	s.commands[body.CommandID] = true
	if kind == "send" {
		s.turnGeneration++
		s.settled = false
		s.settlement = nil
		s.authError = ""
		s.question = nil
		s.questionID = ""
		s.queuedQuestions = nil
		if s.receipts == nil {
			s.receipts = make(map[string]string)
		}
		c.receipt(s, body.CommandID, "pending")
	}
	s.command = body.CommandID
	c.pauseRecap(s)
	if c.journal != nil {
		c.journal.appendInvalidation("pi:" + id)
	}
	c.mu.Unlock()
	// A disconnect must not cancel the native request. Never retry ambiguous writes.
	go func() {
		rpcKind := kind
		if rpcKind == "send" {
			rpcKind = "prompt"
		}
		var accepted bool
		var err error
		if body.FirstChoice != nil {
			err = c.applyFirstChoice(s, body.FirstChoice)
		}
		if err == nil {
			accepted, err = s.rpc.request(rpcKind, body.Message, 15*time.Second)
		}
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
			if kind == "send" && wasSettled {
				s.settled = true // No new native message reached Pi.
				c.scheduleAutomaticRecap(s)
			}
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
			if s.ack == "accepted" {
				s.acceptedMessages++
				if s.acceptedMessages == 1 {
					s.firstText = prefixBytes(body.Message, 2048)
				}
				if s.acceptedMessages == 3 {
					s.thirdText = prefixBytes(body.Message, 2048)
				}
				s.latestText = prefixBytes(body.Message, 2048)
				c.startAutomaticTitle(s)
			}
		} else if c.journal != nil {
			c.journal.appendInvalidation("pi:" + id)
		}
	}()
	historyJSON(w, map[string]any{"schema_version": 1, "command_id": body.CommandID, "state": "pending"})
}
func (c *ConversationController) regenerateTitle(w http.ResponseWriter, r *http.Request, id string) {
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
	if c.closed || s.dead || s.state == "stopping" || s.naming || s.firstText == "" || s.rpc.overflow.Load() {
		c.mu.Unlock()
		snapshotError(w, 409, "control_uncertain")
		return
	}
	s.naming = true
	text := titleExcerpt(s.firstText, s.latestText)
	path := s.historyPath
	continued := s.acceptedMessages >= 4 && s.latestText == ""
	c.mu.Unlock()
	// A continued handle has no in-memory record of the previous turns.
	// Read its current native branch, rather than imposing its first prompt's
	// language on a later request to regenerate.
	if continued && path != "" {
		if recent := latestNativeUserPrompt(path, c.cfg.UID, s.id, s.cwd); recent != "" {
			text = titleExcerpt(s.firstText, recent)
		}
	}
	// Browser disconnect does not cancel the bounded model or native RPC call.
	result := make(chan titleFailure, 1)
	go func() { result <- c.nameConversation(s, text, true) }()
	if reason := <-result; reason == "" {
		historyJSON(w, map[string]any{"schema_version": 1, "state": "done"})
	} else {
		historyJSON(w, map[string]any{"schema_version": 1, "state": "failed", "reason": reason})
	}
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
	runActive := s.runActive
	state, command, ack, cursor, lost := s.state, s.command, s.ack, s.cursor, s.lost
	settlement := s.settlement
	question := s.question
	receipt := ""
	if s.receipts != nil {
		receipt = s.receipts[s.command]
	}
	queueSteering, queueFollowUp, queueRevision := append([]string{}, s.queueSteering...), append([]string{}, s.queueFollowUp...), s.queueRevision
	events := append([]json.RawMessage{}, s.events...)
	cwd, path := s.cwd, s.historyPath
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
	// Discovery checks the native header only until this conversation's path is
	// known. Thereafter status uses metadata, not a JSONL read. A present file
	// is only a change hint; the history endpoint decides readability.
	discoveryUnavailable := false
	if path == "" {
		if sessions, err := nativeSessions(c.nativeCfg()); err == nil {
			for _, n := range sessions {
				if n.id != id {
					continue
				}
				if n.cwd != cwd || n.state != "readable" {
					discoveryUnavailable = true
				} else {
					path = n.path
					c.mu.Lock()
					if c.sessions[id] == s {
						s.historyPath = path
					}
					c.mu.Unlock()
				}
				break
			}
		} else {
			discoveryUnavailable = true
		}
	}
	revision := ""
	history := "missing"
	if discoveryUnavailable {
		history = "unavailable"
	}
	if path != "" {
		info, err := os.Lstat(path)
		switch {
		case errors.Is(err, os.ErrNotExist):
			// A removed file is not readable; do not continue to trust its hint.
		case err != nil || !info.Mode().IsRegular() || info.Size() > maxHistoryFile:
			history = "unavailable"
		default:
			if owner, ok := fileOwner(info); !ok || owner != c.cfg.UID {
				history = "unavailable"
			} else {
				history = "present"
				revision = opaque("rev_", fmt.Sprintf("%d:%d:%d", info.Size(), info.ModTime().UnixNano(), info.Mode()))
			}
		}
	}
	continuation := "unproven"
	if r.URL.Query().Get("continuation") == "true" {
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
	}
	// A concurrent continuation can change the handle while the probe runs.
	// Never advertise eligibility for a superseded handle.
	c.mu.Lock()
	if c.closed || c.sessions[id] != s {
		continuation = "unproven"
	}
	c.mu.Unlock()
	historyJSON(w, map[string]any{"schema_version": 1, "agent_id": "pi:" + id, "workspace_id": s.workspace, "state": state, "run_active": runActive, "startup_choice": s.startupChoice, "continuation": continuation, "command_id": command, "ack": ack, "send_receipt": receipt, "turn_settled": settlement, "auth_error": s.authError, "pending_question": question, "event_cursor": cursor, "events": events, "event_loss": lost, "native_history": history, "native_revision": revision, "history_query": "/api/v1/agents/pi:" + id + "/history", "queue": map[string]any{"revision": queueRevision, "steering": queueSteering, "follow_up": queueFollowUp}})
}

// answerQuestion spends the native request ID before touching Pi. This uncorrelated
// native write has no receipt: delivery is always uncertain, never retryable.
func (c *ConversationController) answerQuestion(w http.ResponseWriter, r *http.Request, id string) {
	var body struct {
		RequestID string          `json:"request_id"`
		Action    string          `json:"action"`
		Value     json.RawMessage `json:"value"`
	}
	if decodeControl(r, &body, 66000) != nil || len(body.RequestID) < 1 || len(body.RequestID) > 200 || (body.Action != "answer" && body.Action != "cancel") {
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
	if c.closed || s.dead || s.rpc.overflow.Load() || s.questionID != body.RequestID || s.spentQuestions[body.RequestID] || s.state == "uncertain" || s.state == "stopping" || s.aborting {
		c.mu.Unlock()
		snapshotError(w, 409, "control_uncertain")
		return
	}
	kind := s.questionKind
	value := any(nil)
	if body.Action == "cancel" {
		if len(body.Value) != 0 {
			c.mu.Unlock()
			snapshotError(w, 400, "invalid_request")
			return
		}
	} else {
		switch kind {
		case "confirm":
			var b bool
			if string(body.Value) != "true" && string(body.Value) != "false" {
				c.mu.Unlock()
				snapshotError(w, 400, "invalid_request")
				return
			}
			_ = json.Unmarshal(body.Value, &b)
			value = b
		case "input", "select":
			var text string
			if json.Unmarshal(body.Value, &text) != nil || len(text) > 65536 || !utf8.ValidString(text) {
				c.mu.Unlock()
				snapshotError(w, 400, "invalid_request")
				return
			}
			if kind == "select" {
				found := false
				for _, choice := range s.questionChoices {
					if choice == text {
						found = true
					}
				}
				if !found {
					c.mu.Unlock()
					snapshotError(w, 400, "invalid_request")
					return
				}
			}
			value = text
		default:
			c.mu.Unlock()
			snapshotError(w, 409, "control_uncertain")
			return
		}
	}
	s.spentQuestions[body.RequestID] = true
	s.questionID = ""
	s.question = nil
	if len(s.queuedQuestions) > 0 {
		c.showQuestion(s, s.queuedQuestions[0])
		s.queuedQuestions = s.queuedQuestions[1:]
	} else if c.journal != nil {
		c.journal.appendInvalidation("pi:" + s.id)
	}
	c.mu.Unlock()
	if err := s.rpc.respondUI(body.RequestID, kind, value, body.Action == "cancel"); err != nil {
		snapshotError(w, 409, "control_uncertain")
		return
	}
	historyJSON(w, map[string]any{"schema_version": 1, "request_id": body.RequestID, "state": "uncertain"})
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
	if c.journal != nil {
		c.journal.appendInvalidation("pi:" + id)
	}
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
	if c.journal != nil {
		c.journal.appendInvalidation("pi:" + id)
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
	if c.journal != nil {
		c.journal.appendInvalidation("pi:" + id)
	}
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
		if c.journal != nil {
			c.journal.appendInvalidation("pi:" + id)
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
		if c.journal != nil {
			c.journal.appendInvalidation("pi:" + id)
		}
		go func() {
			_ = s.rpc.close()
			c.mu.Lock()
			s.state = "uncertain"
			if c.journal != nil {
				c.journal.appendInvalidation("pi:" + id)
			}
			c.mu.Unlock()
		}()
	}
	c.mu.Unlock()
	historyJSON(w, map[string]any{"schema_version": 1, "state": "termination_unknown"})
}

// A completed Pi device login has been checked against native credentials.
// Clearing only login failures leaves unrelated provider/model failures intact.
func (c *ConversationController) ClearPiAuthFailures() {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, s := range c.sessions {
		if s.authError == "pi_auth_failed" {
			s.authError = ""
		}
	}
}

// Pi's native error stays in history; expose only a fixed classification.
// An unsupported account model cannot be repaired by signing in again.
func modelUnsupported(text string) bool {
	lower := strings.ToLower(text)
	return strings.Contains(lower, "model") && strings.Contains(lower, "not supported") && strings.Contains(lower, "account")
}

// Match authentication failures, not arbitrary provider errors.
func modelAuthFailure(text string) bool {
	lower := strings.ToLower(text)
	return strings.Contains(lower, "401") || strings.Contains(lower, "403") || strings.Contains(lower, "unauthorized") || strings.Contains(lower, "authentication failed") || strings.Contains(lower, "invalid api key") || strings.Contains(lower, "invalid_api_key")
}
