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
	viewMu   sync.Mutex // serialize view offer idempotency observation and export
	noticeMu sync.Mutex // serialize native notice idempotency observation and append

	mu       sync.Mutex
	sessions map[string]*conversation
	cfg      transport.Config
	runtime  *core.PiRuntimeConfig
	status   func(context.Context) string
	trusted  func(*http.Request) bool
	closed   bool
	// facts are the snapshot's derived native facts (snapshot_facts_linux.go).
	facts *snapshotFacts
	// home is the native root; discover resolves workspaces beneath it.
	// Only the synthetic browser host sets them apart from cfg.Home.
	home           string
	discover       func(transport.Config) Discovery
	writerProc     string                       // unit fixture only; empty scans the real /proc
	fixture        bool                         // untrusted synthetic runtime: never set in production
	titleGenerator func(string) (string, error) // unit fixture only
	journal        *eventJournal
	// A short-lived per-daemon gate prevents continuation probes from presenting
	// each other's temporary flock as an external writer. Never hold mu across I/O.
	proofGate      chan struct{}
	recapPath      string
	recapIdleDelay time.Duration                                    // test seam; zero uses the production three-minute interval
	recapGenerator func(*conversation, string, uint64) recapOutcome // synthetic test seam
	// started tells a process cut off by this daemon's restart from one cut
	// off by a Pi stop since (process_interrupted_linux.go). Unix ms.
	started int64
	// Workspace deletion fences, protected by mu (workspace_fence_linux.go).
	fences         map[workspaceInode]int
	fileFences     map[workspaceInode]*os.File
	fileOperations map[*os.File]bool
	editorSlots    chan struct{}
	editorSaves    chan struct{}
	editorFileTest *editorFileTestHooks
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
	startupCancelled                                        bool // per-child fence: stop/cancel wins over late readiness publication
	queueSteering, queueFollowUp                            []string
	queueRevision                                           uint64
	queueTaken, queueCleared, unanswered                    []string // pi_unanswered_linux.go
	clearStop                                               bool     // the clear in flight is a Stop's
	clearReturn                                             []string // what that Stop gives back, set by the drain
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
	recapAttemptedThrough                                   string        // at most one automatic request per native message
	recapFailure                                            *recapFailure // the newest attempt's failure, shown on the card
	automaticName                                           string        // last name written by this controller, never authoritative
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
	// Messages sent before Pi is ready. The daemon holds them in order, keyed by
	// the browser's command ID, and gives Pi their joined text as one prompt.
	// They live only in this daemon incarnation, like receipts.
	held         []heldMessage
	heldChoice   *piStartupChoice // first-message intent travelling with the held prompt
	bash         *bashRun         // the one `!` command: held, running, or its last outcome (bash_linux.go)
	startProblem string           // fixed code of the last failed start; held messages are kept
	created      bool             // started fresh in this incarnation, so no native file is required yet
	lazy         bool             // Pi was started by a held send; it is closed again if nothing is left to deliver
	launchChoice *piStartupChoice // explicit model flags of a created conversation, reused if its first start fails
	interrupted  bool             // the child ended during a turn; its end is unconfirmed until the next prompt
	promptIDs    []string         // every command ID the outstanding native prompt carries
	idleSince    time.Time        // first consecutive idle observation; reset by busy observations
	lastUsed     time.Time        // last start or prompt; makeRoom stops the longest unused idle child first
	// Why and when this child stopped, and the stop it was started from: the
	// facts of the rest card (rest_linux.go). Daemon memory only, like
	// receipts; a daemon restart is itself the cause of every later rest.
	stopCause string
	stoppedAt time.Time
	wokeFrom  restFact
	told      bool // a prompt reached Pi, which gave the agent its catch-up
}

type heldMessage struct {
	id, text string
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
	c := &ConversationController{started: time.Now().UnixMilli(), cfg: cfg, runtime: runtime, trusted: trusted, status: status, sessions: make(map[string]*conversation), home: cfg.Home, discover: Discover, facts: newSnapshotFacts(ctx)}
	go func() { <-ctx.Done(); c.shutdown() }()
	go c.watchIdlePi(ctx)
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

// FixtureShutdown reaps native children before a browser-host incarnation is
// replaced. Cancelling its context only schedules shutdown in another goroutine.
func (c *ConversationController) FixtureShutdown() {
	if c.fixture {
		c.shutdown()
	}
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
	return c.FixtureSnapshotWithForges(Forges{})
}

// FixtureSnapshotWithForges also matches workspace origins to the fixture's
// Gitea and GitLab connections, as the production snapshot does.
func (c *ConversationController) FixtureSnapshotWithForges(forges Forges) http.Handler {
	if !c.fixture {
		return http.NotFoundHandler()
	}
	sessions := func(cfg transport.Config) ([]nativeSession, error) {
		cfg.Home = c.home
		return nativeSessions(cfg)
	}
	return snapshotHandlerWithForges(c.cfg, c.trusted, c.discover, sessions, c.home, func(context.Context) string { return "unknown" }, c.journal, c, forges)
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
		stopFor(s, "restart")
		if c.journal != nil {
			c.journal.appendInvalidation("pi:" + s.id)
		}
		if s.ack == "pending" {
			s.ack = "uncertain"
		}
		c.uncertainPrompt(s)
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

// workspaceFD resolves only a freshly discovered immediate child or a
// worktree place of one, using the kernel's beneath/no-symlink/no-mount
// constraints. The open descriptor is
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
		// Not a workspace: a worktree place of one (ADR 0025), or nothing.
		return c.placeFD(observation, id)
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
	ws := os.NewFile(uintptr(fd), "workspace")
	cwd := filepath.Join(c.home, "src", name)
	c.mu.Lock()
	admitted := c.admits(ws, cwd)
	c.mu.Unlock()
	if !admitted {
		ws.Close()
		return nil, "", errors.New("workspace busy")
	}
	return ws, cwd, nil
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
	case r.Method == http.MethodGet && parts[1] == "rest":
		c.restReport(w, r, parts[0])
	case r.Method == http.MethodGet && parts[1] == "eligibility":
		c.historyEligibility(w, r, parts[0])
	case r.Method == http.MethodGet && parts[1] == "commands":
		c.conversationCommands(w, r, parts[0])
	case r.Method == http.MethodPost && parts[1] == "bash":
		c.startCommand(w, r, parts[0])
	case r.Method == http.MethodPost && parts[1] == "abort_bash":
		c.abortCommand(w, r, parts[0])
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
	case r.Method == http.MethodPost && parts[1] == "presence":
		c.notePresence(w, r, parts[0])
	case r.Method == http.MethodPost && parts[1] == "question":
		c.answerQuestion(w, r, parts[0])
	case r.Method == http.MethodPost && parts[1] == "abort":
		c.abort(w, r, parts[0])
	case r.Method == http.MethodPost && parts[1] == "cancel_held":
		c.cancelHeld(w, r, parts[0])
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
		NewWorktree *struct {
			Name string `json:"name"`
		} `json:"new_worktree"`
	}
	if decodeControl(r, &body, 1024) != nil || !idPattern.MatchString(body.WorkspaceID) || len(body.Model) > 160 || (body.Thinking != "" && (!validThinking(body.Thinking) || body.Model == "")) || body.NewWorktree != nil && !worktreeNameHint.MatchString(body.NewWorktree.Name) {
		snapshotError(w, 400, "invalid_request")
		return
	}
	if body.Provider == "" {
		body.Provider = "openai-codex"
	}
	if !piConversationProvider(body.Provider) {
		snapshotError(w, 400, "invalid_request")
		return
	}
	if c.runtime == nil {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	// The socket server's default write deadline is five seconds. Native catalog
	// validation can take twelve seconds; retain the create reply instead of
	// losing an already-created session to that shorter transport deadline.
	// Stay below the gateway's sixty-second finite-request ceiling.
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
	// A worktree agent's first message creates its branch and worktree from
	// the workspace's current branch; Pi then starts there like anywhere.
	worktreeOf := ""
	if body.NewWorktree != nil {
		place, status, code := c.createWorktree(r.Context(), w, body.WorkspaceID, body.NewWorktree.Name)
		if code != "" {
			snapshotError(w, status, code)
			return
		}
		worktreeOf, body.WorkspaceID = body.WorkspaceID, place
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
	c.makeRoom(r.Context())
	c.mu.Lock()
	if c.closed || c.liveCount() >= maxLiveConversations || len(c.sessions) >= 128 {
		c.mu.Unlock()
		snapshotError(w, 429, "capacity_exceeded")
		return
	}
	if !c.admits(ws, cwd) {
		c.mu.Unlock()
		snapshotError(w, 409, "workspace_busy")
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
	p, err := launchPiRPCCommand(c.runtime.Node, prefix, c.home, cwd, []string{agentPath(c.home), "USER=" + c.cfg.Username}, owner, ws, body.WorkspaceID)
	if err != nil {
		c.mu.Unlock()
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	s := &conversation{id: id, workspace: body.WorkspaceID, cwd: cwd, rpc: p, owner: owner, state: "starting", created: true, lastUsed: time.Now(), events: make([]json.RawMessage, 0, 64), commands: make(map[string]bool)}
	if body.Model != "" {
		s.startupChoice = &piStartupChoice{Provider: body.Provider, Model: body.Model, Thinking: body.Thinking}
		s.launchChoice = s.startupChoice
	}
	c.sessions[id] = s
	releaseOwner = false
	if c.journal != nil {
		c.journal.appendInvalidation("pi:" + id)
	}
	choice := s.startupChoice
	c.mu.Unlock()
	// The daemon retains the advisory lock until the direct child is reaped;
	// stopped sessions stay as tombstones for lost-request lookup.
	go c.watch(s)
	go c.drain(s)
	go c.watchProcesses(s)
	// Reply as soon as the child exists. Pi's own start can take many seconds;
	// messages sent meanwhile are held and delivered once it is ready.
	go c.awaitReady(s)
	reply := map[string]any{"schema_version": 1, "agent_id": "pi:" + id, "workspace_id": body.WorkspaceID, "state": "starting", "startup_choice": choice}
	if worktreeOf != "" {
		reply["worktree_of"] = worktreeOf
	}
	historyJSON(w, reply)
}

// createWorktree makes a new worktree agent's branch and worktree. It holds
// the ~/src writer lock, as workspace deletion does for its checks and move,
// so a worktree cannot appear in a repository that deletion has already
// checked; and it refuses at capacity before anything is created.
func (c *ConversationController) createWorktree(ctx context.Context, w http.ResponseWriter, workspaceID, name string) (string, int, string) {
	// A checkout observation or a state-file fsync may overlap a send. Wait
	// briefly before doing any work, rather than making the person resubmit.
	// Long operations still return a definite refusal identifying the holder.
	waitCtx, cancelWait := context.WithTimeout(ctx, 2*time.Second)
	defer cancelWait()
	if code := cloneWriter.wait(waitCtx, "workspace_worktree_create_running"); code != "" {
		return "", 409, code
	}
	defer cloneWriter.Unlock()
	// The workspace must be one a conversation could start in now (not
	// fenced by a deletion).
	parent, _, err := c.workspaceFD(workspaceID)
	if err != nil {
		return "", 404, "resource_not_found"
	}
	parent.Close()
	c.makeRoom(ctx)
	c.mu.Lock()
	full := c.closed || c.liveCount() >= maxLiveConversations || len(c.sessions) >= 128
	c.mu.Unlock()
	if full {
		return "", 429, "capacity_exceeded"
	}
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(55 * time.Second))
	ctx, cancel := context.WithTimeout(ctx, worktreeAddLimit+5*time.Second)
	defer cancel()
	place, err := createWorktreePlace(ctx, c.cfg, c.home, c.discover(c.cfg), workspaceID, name)
	if err != nil {
		switch code := err.Error(); code {
		case "resource_not_found":
			return "", 404, code
		case "invalid_request":
			return "", 400, code
		case "native_source_unavailable":
			return "", 503, code
		default:
			return "", 409, code
		}
	}
	return place, 0, ""
}

func (c *ConversationController) watch(s *conversation) {
	<-s.rpc.exited
	_ = s.rpc.in.Close()
	_ = s.rpc.out.Close()
	c.mu.Lock()
	s.dead = true
	if s.stoppedAt.IsZero() { // restOf may have seen the reap first
		s.stoppedAt = time.Now()
	}
	stopFor(s, "crash") // nobody here asked it to stop
	s.interrupted = s.runActive || s.state == "pending" || s.state == "accepted"
	s.runActive = false // a reaped child runs nothing, whatever its last event said
	if s.recapTimer != nil {
		s.recapTimer.Stop()
	}
	// No child means no control, not uncertainty: the last command's own
	// receipt keeps any uncertainty. awaitReady owns startup failure so an
	// old child's watcher cannot overwrite a retry's starting state.
	switch s.state {
	case "starting", "start_failed":
	default:
		s.state = "stopped"
	}
	if s.ack == "pending" {
		s.ack = "uncertain"
	}
	c.uncertainPrompt(s)
	if c.sessions[s.id] == s && c.journal != nil {
		c.journal.reset("pi:"+s.id, "unknown")
		c.journal.appendInvalidation("pi:" + s.id)
	}
	c.mu.Unlock()
	_ = s.owner.release()
}

// uncertainPrompt resolves every still-pending command of the outstanding
// prompt, including all IDs a joined held prompt carries. Caller holds c.mu.
func (c *ConversationController) uncertainPrompt(s *conversation) {
	for _, id := range append(append([]string{}, s.promptIDs...), s.command) {
		if s.receipts != nil && s.receipts[id] == "pending" {
			c.receipt(s, id, "uncertain")
		}
	}
}

// receipt records the Pi RPC acknowledgement, never completion of the turn.
// Caller holds c.mu. A missing entry after restart is unknown, never accepted.
func (c *ConversationController) receipt(s *conversation, id, outcome string) {
	if s.receipts == nil {
		s.receipts = make(map[string]string)
	}
	s.receipts[id] = outcome
	if c.journal != nil {
		payload := map[string]string{"client_command_id": id, "acceptance": outcome, "execution": "unknown"}
		switch outcome {
		case "held": // the daemon holds it; Pi has not received it
			payload["acceptance"], payload["execution"] = "pending", "not_started"
		case "cancelled": // removed before Pi ran; its text went back to the person
			payload["acceptance"], payload["execution"], payload["error_code"] = "rejected", "not_started", "cancelled_before_start"
		}
		c.journal.appendEvent("command.changed", "pi:"+s.id, payload)
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
	// A conversation without a handle in this incarnation can still be resumed
	// on send if the browser started it. Read that proof before taking the lock.
	var origin *browserOrigin
	if kind == "send" {
		c.mu.Lock()
		missing := c.sessions[id] == nil
		c.mu.Unlock()
		if missing {
			if o, err := c.resumableOrigin(id); err == nil {
				origin = &o
			}
		}
	}
	c.mu.Lock()
	s := c.sessions[id]
	if s == nil && origin != nil && !c.closed && len(c.sessions) < 128 {
		s = &conversation{id: id, workspace: origin.Workspace, cwd: origin.Cwd, rpc: stoppedRPC(), state: "stopped", dead: true, events: make([]json.RawMessage, 0, 64), commands: make(map[string]bool)}
		c.sessions[id] = s
	}
	if s == nil {
		c.mu.Unlock()
		if kind == "send" {
			// Definitely not held: terminal history and unknown IDs are not controllable.
			snapshotError(w, 409, "read_only_history")
		} else {
			snapshotError(w, 404, "resource_not_found")
		}
		return
	}
	archiveState := "active"
	if c.home != "" {
		annotations, annotationErr := loadVisibility(c.home)
		archiveState = archiveFact(annotations, annotationErr, "pi:"+id)
	}
	// Held messages form one native prompt: admit a new message only if the
	// combined attachment and expanded-text budget still fits, preserving the
	// previous held messages when it does not.
	texts := make([]string, 0, len(s.held)+1)
	for _, h := range s.held {
		texts = append(texts, h.text)
	}
	texts = append(texts, body.Message)
	if expanded, _, err := promptAttachments(c.home, strings.Join(texts, "\n\n"), false); err != nil || len(expanded) > 65536 {
		c.mu.Unlock()
		snapshotError(w, 400, "invalid_attachments")
		return
	}
	// A plain send to a conversation whose Pi is not running (yet) is held by
	// the daemon and starts Pi if nothing is starting it already.
	if kind == "send" && notRunning(s) {
		if archiveState != "active" {
			c.mu.Unlock()
			snapshotError(w, 409, "control_uncertain")
			return
		}
		c.holdLocked(w, s, body.Message, body.CommandID, body.FirstChoice)
		return
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
	previousSettlement := s.settlement
	ids, message, choice := []string{body.CommandID}, body.Message, body.FirstChoice
	if kind == "send" && len(s.held) > 0 {
		// Messages still held reach Pi first, joined with this one: a direct
		// send never overtakes them. Over Pi's prompt limit, refuse only this
		// message and keep what is held.
		texts := make([]string, 0, len(s.held)+1)
		ids = make([]string, 0, len(s.held)+1)
		for _, h := range s.held {
			ids = append(ids, h.id)
			texts = append(texts, h.text)
		}
		ids = append(ids, body.CommandID)
		message = strings.Join(append(texts, body.Message), "\n\n")
		if len(message) > maxHeldBytes {
			c.mu.Unlock()
			snapshotError(w, 409, "control_uncertain")
			return
		}
		if choice == nil {
			choice = s.heldChoice
		}
		s.held, s.heldChoice, s.lazy = nil, nil, false
	}
	s.commands[body.CommandID] = true
	c.beginPrompt(s, kind, ids)
	c.mu.Unlock()
	// A disconnect must not cancel the native request. Never retry ambiguous writes.
	go c.finishPrompt(s, kind, ids, message, choice, oldState, wasSettled, previousSettlement)
	historyJSON(w, map[string]any{"schema_version": 1, "command_id": body.CommandID, "state": "pending"})
}

// beginPrompt marks a native message write as pending. Caller holds c.mu and
// has spent the command IDs. A send starts a new turn; steer/follow_up do not.
func (c *ConversationController) beginPrompt(s *conversation, kind string, ids []string) {
	s.state = "pending"
	s.lastUsed = time.Now()
	s.ack = "pending"
	if kind == "send" {
		s.turnGeneration++
		s.interrupted = false
		s.settled = false
		s.settlement = nil
		s.authError = ""
		s.question = nil
		s.questionID = ""
		s.queuedQuestions = nil
		for _, id := range ids {
			c.receipt(s, id, "pending")
		}
		s.promptIDs = ids
	}
	s.command = ids[len(ids)-1]
	c.pauseRecap(s)
	if c.journal != nil {
		c.journal.appendInvalidation("pi:" + s.id)
	}
}

// finishPrompt performs one correlated native write and records its receipt
// for every command ID it carries. A held prompt carries several IDs: their
// texts reached Pi together, so they share one outcome.
func (c *ConversationController) finishPrompt(s *conversation, kind string, ids []string, message string, choice *piStartupChoice, oldState string, wasSettled bool, previousSettlement map[string]string) {
	rpcKind := kind
	if rpcKind == "send" {
		rpcKind = "prompt"
	}
	var accepted bool
	var err error
	expanded, images, attachmentErr := promptAttachments(c.home, message, true)
	// A file removed since admission is a definite rejection: Pi received
	// nothing. Do not turn this local pre-send failure into an uncertain write.
	if attachmentErr == nil {
		if choice != nil {
			err = c.applyFirstChoice(s, choice)
		}
		if err == nil {
			accepted, err = s.rpc.request(rpcKind, expanded, 15*time.Second, images...)
		}
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	// A prompt Pi may have taken carries the catch-up of the rest it woke
	// from; the card has said its piece.
	if err != nil || accepted {
		s.told = true
	}
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
			s.settlement = previousSettlement
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
		for _, id := range ids {
			c.receipt(s, id, s.ack)
		}
		if s.ack == "accepted" {
			s.acceptedMessages++
			if s.acceptedMessages == 1 {
				s.firstText = prefixBytes(message, 2048)
			}
			if s.acceptedMessages == 3 {
				s.thirdText = prefixBytes(message, 2048)
			}
			s.latestText = prefixBytes(message, 2048)
			c.startAutomaticTitle(s)
		}
	} else if c.journal != nil {
		c.journal.appendInvalidation("pi:" + s.id)
	}
}
func (c *ConversationController) regenerateTitle(w http.ResponseWriter, r *http.Request, id string) {
	// The bounded model call (15s) and Pi write (4s) outlive the transport's
	// ordinary 5s deadline. Keep the reply deliverable after native work.
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(45 * time.Second))
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
	c.beginNaming(s)
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
	c.mu.Lock()
	s := c.sessions[id]
	c.mu.Unlock()
	if s == nil {
		// No handle in this incarnation. A browser-started conversation is still
		// readable and resumable on send; opening it never starts Pi.
		c.stoppedStatus(w, id)
		return
	}
	c.mu.Lock()
	runActive := s.runActive
	held := heldView(s.held)
	startProblem, interrupted := s.startProblem, s.interrupted
	var recapFailed map[string]string
	if f := s.recapFailure; f != nil {
		recapFailed = map[string]string{"reason": f.Reason, "through": f.Through, "trigger": f.Trigger}
	}
	startupChoice, authError := s.startupChoice, s.authError
	state, command, ack, cursor, lost := s.state, s.command, s.ack, s.cursor, s.lost
	settlement := s.settlement
	question := s.question
	receipt := ""
	if s.receipts != nil {
		receipt = s.receipts[s.command]
	}
	queueSteering, queueFollowUp, queueRevision := append([]string{}, s.queueSteering...), append([]string{}, s.queueFollowUp...), s.queueRevision
	bash := s.bash.view()
	events := append([]json.RawMessage{}, s.events...)
	cwd, path := s.cwd, s.historyPath
	// A lost frame makes a live child's control uncertain. A reaped child's
	// stream always ends in a read error; its receipts already say what is
	// uncertain, and the conversation is simply stopped.
	if s.rpc.overflow.Load() && !s.dead {
		state = "uncertain"
		lost = true
		s.state = state
		if s.ack == "pending" {
			s.ack = "uncertain"
			ack = "uncertain"
		}
		if receipt == "pending" {
			receipt = "uncertain"
		}
		c.uncertainPrompt(s)
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
	historyJSON(w, map[string]any{"schema_version": 1, "agent_id": "pi:" + id, "workspace_id": s.workspace, "state": state, "run_active": runActive, "startup_choice": startupChoice, "continuation": continuation, "command_id": command, "ack": ack, "send_receipt": receipt, "turn_settled": settlement, "auth_error": authError, "pending_question": question, "event_cursor": cursor, "events": events, "event_loss": lost, "native_history": history, "native_revision": revision, "history_query": "/api/v1/agents/pi:" + id + "/history", "queue": map[string]any{"revision": queueRevision, "steering": queueSteering, "follow_up": queueFollowUp}, "held": held, "start_problem": startProblem, "interrupted": interrupted, "bash": bash, "recap_failure": recapFailed})
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
// A Stop also asks for the queued messages Pi delivered that the model has not
// answered (pi_unanswered_linux.go); the turn it stops will never answer them.
func (c *ConversationController) clearQueue(w http.ResponseWriter, r *http.Request, id string) {
	var body struct {
		CommandID  string `json:"command_id"`
		Unanswered bool   `json:"unanswered"`
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
	s.clearStop, s.clearReturn = body.Unanswered, nil
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
	unanswered := s.clearReturn
	s.clearStop, s.clearReturn = false, nil
	// A correlated clear receipt remains valid even if Pi exits or a stop races
	// after the native removal. Never discard the only copy of these texts.
	c.mu.Unlock()
	if !accepted {
		snapshotError(w, 409, "control_uncertain")
		return
	}
	written := func(texts []string) []string {
		out := make([]string, len(texts))
		for i, text := range texts {
			out[i] = writtenText(c.home, text)
		}
		return out
	}
	result := map[string]any{"schema_version": 1, "command_id": body.CommandID, "state": "accepted", "removed_queue": map[string]any{"steering": written(reply.Steering), "follow_up": written(reply.FollowUp)}}
	if body.Unanswered {
		result["unanswered"] = written(unanswered)
	}
	historyJSON(w, result)
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
		s.startupCancelled = true
		s.state = "stopping"
		stopFor(s, "person")
		if c.journal != nil {
			c.journal.appendInvalidation("pi:" + id)
		}
		go func() {
			_ = s.rpc.close()
			c.mu.Lock()
			s.state = stoppedState(s)
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
