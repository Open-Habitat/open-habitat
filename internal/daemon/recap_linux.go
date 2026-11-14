//go:build linux

package daemon

import (
	_ "embed"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/open-habitat/open-habitat/internal/diagnostic"
)

//go:embed recap-extension.mjs
var recapExtension []byte

// piArgs installs the shipped bridge for the daemon-owned Pi child, not for
// terminal sessions. The extension writes through Pi's own SessionManager.
func (c *ConversationController) piArgs() ([]string, error) {
	args := []string{filepath.Join(filepath.Dir(c.runtime.Entry), "bundle", "cli.js")}
	if c.fixture {
		return args, nil
	}
	// Optional during rollout: the product works with either guest runtime.
	bridge := filepath.Join(filepath.Dir(filepath.Dir(c.runtime.Node)), "node_modules/pi-claude-bridge/src/index.ts")
	if info, err := os.Stat(bridge); err == nil && info.Mode().IsRegular() {
		args = append(args, "--extension", bridge)
	}
	// The provider's own web search, from the same tree as the bridge whose
	// Claude Code the runtime build gives WebSearch and WebFetch.
	search := filepath.Join(filepath.Dir(filepath.Dir(c.runtime.Node)), "web-search/extension.mjs")
	if info, err := os.Stat(search); err == nil && info.Mode().IsRegular() {
		args = append(args, "--extension", search)
	}
	// The agents' page reader, with the headless shell beside it.
	reader := filepath.Join(filepath.Dir(filepath.Dir(c.runtime.Node)), "page-reader/extension.mjs")
	if info, err := os.Stat(reader); err == nil && info.Mode().IsRegular() {
		args = append(args, "--extension", reader)
	}
	// Product tolerates either guest runtime during rollout. Only load the core
	// native owner, not terminal UI extensions. Never rewrite user settings.
	processes := filepath.Join(filepath.Dir(filepath.Dir(c.runtime.Node)), "node_modules/@aliou/pi-processes/extensions/processes/index.ts")
	if info, err := os.Stat(processes); err == nil && info.Mode().IsRegular() && !nativeSettingsProvideProcesses(c.home) {
		args = append(args, "--extension", processes)
	}
	args = append(args, taskfleetSkillsExtension(agentRelease(), filepath.Dir(filepath.Dir(c.runtime.Node)))...)
	// The tmpfiles service can remove a stale /var/tmp directory during a
	// long-lived daemon. Recreate the bridge before launching the next child.
	if c.recapPath != "" {
		if info, err := os.Lstat(c.recapPath); err == nil && info.Mode().IsRegular() {
			if err := installBackgroundModel(filepath.Dir(c.recapPath)); err != nil {
				return nil, err
			}
			companion, err := installProcessExtension(filepath.Dir(c.recapPath))
			if err != nil {
				return nil, err
			}
			skill, err := installStartPageSkill(filepath.Dir(c.recapPath))
			if err != nil {
				return nil, err
			}
			ui, err := installUISkill(filepath.Dir(c.recapPath))
			if err != nil {
				return nil, err
			}
			rewind, err := installRewindExtension(filepath.Dir(c.recapPath))
			if err != nil {
				return nil, err
			}
			args = append(args, "--extension", c.recapPath, "--extension", companion, "--extension", rewind, "--skill", skill, "--skill", ui)
			if browser, ok := c.browser.installSkill(filepath.Dir(c.recapPath)); ok {
				args = append(args, "--skill", browser)
			}
			return args, nil
		}
	}
	dir, err := os.MkdirTemp("/var/tmp", "oh-recap-")
	if err != nil {
		return nil, err
	}
	path := filepath.Join(dir, "recap-extension.mjs")
	if err := installBackgroundModel(dir); err != nil {
		_ = os.RemoveAll(dir)
		return nil, err
	}
	if err := os.WriteFile(path, recapExtension, 0600); err != nil {
		_ = os.RemoveAll(dir)
		return nil, err
	}
	c.recapPath = path
	companion, err := installProcessExtension(dir)
	if err != nil {
		return nil, err
	}
	skill, err := installStartPageSkill(dir)
	if err != nil {
		return nil, err
	}
	ui, err := installUISkill(dir)
	if err != nil {
		return nil, err
	}
	rewind, err := installRewindExtension(dir)
	if err != nil {
		return nil, err
	}
	args = append(args, "--extension", path, "--extension", companion, "--extension", rewind, "--skill", skill, "--skill", ui)
	if browser, ok := c.browser.installSkill(dir); ok {
		args = append(args, "--skill", browser)
	}
	return args, nil
}

// taskfleetSkillsExtension loads the core runtime's Taskfleet skills into a
// browser conversation, as the runtime's `pi` launcher does for Taskfleet's
// workers. The extension offers them behind the person's and the project's own
// skills, so a skill of the same name there wins. They come from the same tree
// as the `taskfleet` on the agent PATH, so their text matches the binary.
func taskfleetSkillsExtension(release, selectedRuntime string) []string {
	dir := agentCoreToolsDir(release, selectedRuntime)
	if dir == "" {
		return nil
	}
	extension := filepath.Join(filepath.Dir(dir), "taskfleet", "extension.mjs")
	if info, err := os.Stat(extension); err != nil || !info.Mode().IsRegular() {
		return nil
	}
	return []string{"--extension", extension}
}

// nativeRecap reads the current branch of the user's own native history.
// It does not infer ownership from browser input or store a browser copy.
func (c *ConversationController) nativeRecap(s *conversation) (recapData, latestMessage, bool) {
	sessions, err := nativeSessions(c.nativeCfg())
	if err != nil {
		return recapData{}, latestMessage{}, false
	}
	var selected *nativeSession
	for i := range sessions {
		if sessions[i].id != s.id {
			continue
		}
		if selected != nil || sessions[i].cwd != s.cwd || sessions[i].state != "readable" {
			return recapData{}, latestMessage{}, false
		}
		selected = &sessions[i]
	}
	if selected == nil {
		return recapData{}, latestMessage{}, false
	}
	return latestNativeRecap(selected.path, c.cfg.UID, s.id, s.cwd)
}

// latestMessage is the newest person or agent message on the active branch.
// At is Pi's own timestamp of it, empty when the native entry has none, so
// the browser can say how long the conversation has been quiet.
type latestMessage struct{ ID, At string }

// Scan the active Pi branch backwards once. History windows are deliberately
// small, but a recap remains discoverable after hundreds of later messages.
func latestNativeRecap(path string, uid int, id, cwd string) (recapData, latestMessage, bool) {
	scan, ok := scanNativeRecap(path, uid, id, cwd, false)
	return scan.recap, scan.latest, ok
}

// recapScan is what one backward pass over the active branch found: the
// newest recap, the newest message and whose it is, and, for a full pass,
// the completed turns as recap-extension.mjs counts them (a person's message
// answered by the agent's).
type recapScan struct {
	recap      recapData
	latest     latestMessage
	latestKind string
	turns      int
}

// scanNativeRecap stops at the newest recap and message unless full asks
// for the whole branch, which counting turns needs.
func scanNativeRecap(path string, uid int, id, cwd string, full bool) (recapScan, bool) {
	header := readNativeHeader(path, uid)
	if header.id != id || header.cwd != cwd || header.state != "readable" {
		return recapScan{}, false
	}
	before, err := os.Lstat(path)
	if err != nil || !before.Mode().IsRegular() {
		return recapScan{}, false
	}
	if uid >= 0 {
		owner, owned := fileOwner(before)
		if !owned || owner != uid {
			return recapScan{}, false
		}
	}
	file, err := os.Open(path)
	if err != nil {
		return recapScan{}, false
	}
	defer file.Close()
	opened, err := file.Stat()
	if err != nil || !os.SameFile(before, opened) {
		return recapScan{}, false
	}
	var scan recapScan
	var target string
	var leaf, broken, answered bool
	err = reverseLines(file, before.Size(), func(line []byte) bool {
		var entry nativeEntry
		if json.Unmarshal(line, &entry) != nil {
			broken = true
			return false
		}
		if entry.Type == "session" {
			return false
		}
		if !entryIDPattern.MatchString(entry.ID) {
			broken = true
			return false
		}
		if !leaf {
			leaf = true
			target = entry.ID
		}
		if entry.ID != target {
			return true
		}
		root := entry.ParentID == nil
		if !root {
			target = *entry.ParentID
		}
		entry.Raw = line
		projected := nativeBlocks(entry)
		if scan.latest.ID == "" && (projected.Kind == "user" || projected.Kind == "assistant") {
			scan.latest = latestMessage{ID: entry.ID, At: nativeTimestamp(entry.Timestamp)}
			scan.latestKind = projected.Kind
		}
		// Backwards, a turn completes where a person's message meets an
		// answer read after it; the extension's forward count agrees.
		switch {
		case projected.Kind == "assistant":
			answered = true
		case projected.Kind == "user" && answered:
			scan.turns++
			answered = false
		}
		if scan.recap.Through == "" && projected.Recap != nil {
			scan.recap = *projected.Recap
		}
		return !root && (full || scan.recap.Through == "" || scan.latest.ID == "")
	})
	after, statErr := os.Lstat(path)
	if err != nil || statErr != nil || broken || !os.SameFile(before, after) || before.Size() != after.Size() || !before.ModTime().Equal(after.ModTime()) {
		return recapScan{}, false
	}
	return scan, true
}

// The daemon, not browser focus, observes native work. Called with c.mu held.
func recapIdle(s *conversation) bool {
	return s.state == "idle" || (s.state == "rejected" && s.settled)
}

func (c *ConversationController) pauseRecap(s *conversation) {
	s.recapActivity++
	if s.recapTimer != nil {
		s.recapTimer.Stop()
		s.recapTimer = nil
	}
	s.recapDue = time.Time{}
}

func (c *ConversationController) noteRecapActivity(s *conversation) {
	c.pauseRecap(s)
	s.recapLastActivity = time.Now()
	if s.recapping {
		s.recapReschedule = true
	} else if s.settled && recapIdle(s) {
		c.scheduleAutomaticRecap(s)
	}
}

// Called after a verified native settlement, with c.mu held. One timer per
// controlled session survives tab disconnects; its epoch fences later work.
func (c *ConversationController) scheduleAutomaticRecap(s *conversation) {
	if c.closed || s.dead || s.recapping || s.compacting || !recapIdle(s) || !automaticRecapsEnabled(c.home) {
		return
	}
	s.recapReschedule = false
	// The person's quiet time (recap_settings_linux.go), read at each
	// schedule so a changed setting applies from the next settlement.
	delay := c.recapIdleDelay
	if delay == 0 {
		delay = recapDelay(c.home) + time.Millisecond
	}
	// A rejected browser command did not produce a native message. Continue
	// counting from the last real activity rather than restarting the interval.
	if !s.recapLastActivity.IsZero() {
		delay = max(0, delay-time.Since(s.recapLastActivity))
	}
	epoch := s.recapActivity
	if s.recapTimer != nil {
		s.recapTimer.Stop()
	}
	s.recapDue = time.Now().Add(delay)
	var timer *time.Timer
	timer = time.AfterFunc(delay, func() {
		c.mu.Lock()
		// Fired and admitted under the lock: nothing is pending any more for
		// the idle stop to hand on. A stop that took the lock first kept it.
		if s.recapTimer == timer {
			s.recapDue = time.Time{}
		}
		if s.recapping && s.recapActivity == epoch {
			s.recapReschedule = true
		}
		if c.closed || c.sessions[s.id] != s || s.dead || !recapIdle(s) || !s.settled || s.recapping || s.compacting || s.rpc.overflow.Load() || s.recapActivity != epoch {
			c.mu.Unlock()
			return
		}
		s.recapping = true
		c.mu.Unlock()
		c.runRecap(s, "automatic", epoch)
		c.mu.Lock()
		s.recapping = false
		if s.recapReschedule && recapIdle(s) && s.settled {
			s.recapReschedule = false
			c.scheduleAutomaticRecap(s)
		}
		c.mu.Unlock()
	})
	s.recapTimer = timer
}

// recapOutcome is why one recap attempt ended. Reason is empty on success.
// Model and Detail come from the extension and reach only the journal: a
// provider's error text is not for the browser.
type recapOutcome struct{ Reason, Model, Detail, Through string }

// recapFailure is what the person sees on the card when the newest recap
// attempt failed. It lives with the controlled conversation, as
// recapAttemptedThrough does, and is not a store: a restart forgets it.
type recapFailure struct{ Reason, Through, Trigger string }

// Reasons the browser may show; anything else from a changed extension is
// reported as an unknown outcome rather than passed through.
var recapReasons = map[string]bool{
	"no_message": true, "no_model": true, "model_error": true, "model_timeout": true,
	"model_incomplete": true, "invalid_response": true, "superseded": true, "busy": true,
	"write_failed": true, "history_unavailable": true, "command_unavailable": true,
	"controller_unavailable": true, "outcome_unknown": true, "not_written": true,
	// The conversation has fewer completed turns than the person's first
	// automatic recap waits for. Not a failure: nothing is shown.
	"too_early": true,
	"fenced":    true,
}

type recapExtensionOutcome struct {
	Outcome string `json:"outcome"`
	Model   string `json:"model"`
	Detail  string `json:"detail"`
}

const recapOutcomePrefix = "oh-conversation-recap:"

// noteRecapOutcome keeps the recap extension's report out of the live stream:
// it is the daemon's own signal, not something Pi asked to show.
func (p *piRPC) noteRecapOutcome(frame json.RawMessage) bool {
	var request struct {
		Method  string `json:"method"`
		Message string `json:"message"`
	}
	if json.Unmarshal(frame, &request) != nil || request.Method != "notify" || !strings.HasPrefix(request.Message, recapOutcomePrefix) {
		return false
	}
	var note recapExtensionOutcome
	if len(request.Message) > 4096 || json.Unmarshal([]byte(strings.TrimPrefix(request.Message, recapOutcomePrefix)), &note) != nil {
		note = recapExtensionOutcome{Outcome: "outcome_unknown"}
	}
	if note.Outcome != "done" && !recapReasons[note.Outcome] {
		note.Outcome = "outcome_unknown"
	}
	note.Model, note.Detail = prefixBytes(strings.ToValidUTF8(note.Model, ""), 200), prefixBytes(strings.ToValidUTF8(note.Detail, ""), 200)
	p.recapMu.Lock()
	p.recapNote = &note
	p.recapMu.Unlock()
	return true
}

func (p *piRPC) takeRecapOutcome() *recapExtensionOutcome {
	p.recapMu.Lock()
	defer p.recapMu.Unlock()
	note := p.recapNote
	p.recapNote = nil
	return note
}

func (c *ConversationController) runRecap(s *conversation, trigger string, epoch uint64) string {
	if trigger == "automatic" && !automaticRecapsEnabled(c.home) {
		return ""
	}
	generate := c.generateRecap
	if c.recapGenerator != nil {
		generate = c.recapGenerator
	}
	out := generate(s, trigger, epoch)
	// A provider's slow tail passes on the next call, so an automatic recap
	// that timed out tries once more before the card shows the failure. The
	// activity fence still holds: if the person went on, the retry is fenced.
	// One the person asked for is not retried: they are waiting on the reply.
	if trigger == "automatic" && out.Reason == "model_timeout" {
		diagnostic.New(os.Stderr, "daemon").Warn("conversation_recap", "outcome", "retrying", "reason", out.Reason, "trigger", trigger, "model", out.Model, "detail", out.Detail, "agent_id", "pi:"+s.id)
		c.mu.Lock()
		if s.recapAttemptedThrough == out.Through {
			s.recapAttemptedThrough = ""
		}
		c.mu.Unlock()
		out = generate(s, trigger, epoch)
	}
	c.recordRecapOutcome(s, trigger, out)
	return out.Reason
}

// recordRecapOutcome leaves a trace of every attempt: the operator's journal
// line, and for a failure the card's reason until a later attempt replaces it.
// A fenced automatic attempt (the person resumed, or this message was already
// tried) did nothing and is not reported.
func (c *ConversationController) recordRecapOutcome(s *conversation, trigger string, out recapOutcome) {
	if out.Reason == "fenced" || out.Reason == "too_early" {
		return
	}
	log := diagnostic.New(os.Stderr, "daemon")
	if out.Reason == "" {
		log.Info("conversation_recap", "outcome", "done", "trigger", trigger, "model", out.Model, "agent_id", "pi:"+s.id)
	} else {
		log.Warn("conversation_recap", "outcome", "failed", "reason", out.Reason, "trigger", trigger, "model", out.Model, "detail", out.Detail, "agent_id", "pi:"+s.id)
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.sessions[s.id] != s {
		return
	}
	if out.Reason == "" {
		s.recapFailure = nil
	} else {
		s.recapFailure = &recapFailure{Reason: out.Reason, Through: out.Through, Trigger: trigger}
	}
	if c.journal != nil {
		c.journal.appendInvalidation("pi:" + s.id)
	}
}

// The native branch and latest message are authoritative. The RPC child and
// extension both decline duplicates; this gate prevents parallel model calls.
func (c *ConversationController) generateRecap(s *conversation, trigger string, epoch uint64) recapOutcome {
	before, latest, ok := c.nativeRecap(s)
	if !ok {
		return recapOutcome{Reason: "history_unavailable"}
	}
	if latest.ID == "" {
		return recapOutcome{Reason: "no_message"}
	}
	if before.Through == latest.ID {
		return recapOutcome{Through: latest.ID}
	}
	c.mu.Lock()
	attempted := trigger == "automatic" && s.recapAttemptedThrough == latest.ID
	valid := !c.closed && c.sessions[s.id] == s && !s.dead && recapIdle(s) && s.recapActivity == epoch && !attempted
	if valid && trigger == "automatic" {
		s.recapAttemptedThrough = latest.ID
	}
	c.mu.Unlock()
	if !valid {
		if trigger == "automatic" {
			return recapOutcome{Reason: "fenced"}
		}
		return recapOutcome{Reason: "superseded", Through: latest.ID}
	}
	commands, err := s.rpc.requestQueue("get_commands", "", 4*time.Second)
	if err != nil || !commands.Accepted || !commands.RecapCommand {
		return recapOutcome{Reason: "command_unavailable", Through: latest.ID}
	}
	c.mu.Lock()
	valid = !c.closed && c.sessions[s.id] == s && !s.dead && recapIdle(s) && s.recapActivity == epoch
	c.mu.Unlock()
	if !valid {
		if trigger == "automatic" {
			return recapOutcome{Reason: "fenced"}
		}
		return recapOutcome{Reason: "superseded", Through: latest.ID}
	}
	command := "/oh-conversation-recap"
	if trigger == "automatic" {
		command += " automatic"
	}
	_ = s.rpc.takeRecapOutcome()
	// The longest request the RPC channel takes; the extension's model budget
	// (recap-extension.mjs) ends five seconds before it.
	accepted, err := s.rpc.request("prompt", command, 30*time.Second)
	if err != nil || !accepted {
		return recapOutcome{Reason: "controller_unavailable", Through: latest.ID}
	}
	out := recapOutcome{Reason: "outcome_unknown", Through: latest.ID}
	if note := s.rpc.takeRecapOutcome(); note != nil {
		out.Model, out.Detail = note.Model, note.Detail
		if note.Outcome != "done" {
			out.Reason = note.Outcome
			return out
		}
	}
	// The extension's word is not proof: the native entry is.
	after, _, ok := c.nativeRecap(s)
	if ok && after.Through == latest.ID && after.GeneratedAt > 0 {
		out.Reason = ""
	} else if out.Reason != "outcome_unknown" || out.Model != "" {
		out.Reason = "not_written"
	}
	return out
}

// notePresence hears from the browser that the person is at work in this
// conversation (writing, reading, the terminal or editor beside it). It
// restarts the idle interval of a pending automatic recap and the idle stop's
// ten minutes. The report only postpones work the daemon would otherwise start
// on its own, so it needs no proof beyond the user's own socket. It never
// fences a recap already running: one the person asked for must still finish.
func (c *ConversationController) notePresence(w http.ResponseWriter, r *http.Request, id string) {
	if r.ContentLength != 0 || len(r.TransferEncoding) != 0 {
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
	if !c.closed {
		// A stopped handle keeps it too: a recap the idle stop handed on
		// waits for the person as the timer would have (serveBackground).
		s.recapLastActivity = time.Now()
		s.presentAt = s.recapLastActivity
	}
	if !c.closed && !s.dead {
		if s.recapTimer != nil && !s.recapping {
			c.pauseRecap(s)
			if s.settled && recapIdle(s) {
				c.scheduleAutomaticRecap(s)
			}
		}
	}
	c.mu.Unlock()
	historyJSON(w, map[string]any{"schema_version": 1, "state": "noted"})
}

func (c *ConversationController) requestRecap(w http.ResponseWriter, r *http.Request, id string) {
	if r.ContentLength != 0 || len(r.TransferEncoding) != 0 {
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
	if c.closed || s.dead || s.recapping || s.compacting || !recapIdle(s) || s.rpc.overflow.Load() {
		c.mu.Unlock()
		snapshotError(w, 409, "control_uncertain")
		return
	}
	s.recapping = true
	epoch := s.recapActivity
	c.mu.Unlock()
	// A disconnected tab cannot cancel this native model call. Other tabs see
	// the in-flight guard and can read the persisted entry after it completes.
	done := make(chan string, 1)
	go func() {
		reason := c.runRecap(s, "manual", epoch)
		c.mu.Lock()
		s.recapping = false
		if s.recapReschedule && recapIdle(s) && s.settled {
			s.recapReschedule = false
			c.scheduleAutomaticRecap(s)
		}
		c.mu.Unlock()
		done <- reason
	}()
	if reason := <-done; reason == "" {
		historyJSON(w, map[string]any{"schema_version": 1, "state": "done"})
	} else {
		historyJSON(w, map[string]any{"schema_version": 1, "state": "failed", "reason": reason})
	}
}

// Do not register a second native owner when the user already loads the package.
// The companion additionally rejects duplicate bus responders (local/project
// copies can be configured in arbitrary ways), rather than choosing a manager.
func nativeSettingsProvideProcesses(home string) bool {
	file, err := os.Open(filepath.Join(home, ".pi/agent/settings.json"))
	if err != nil {
		return false
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, 65537))
	if err != nil || len(data) > 65536 {
		return false
	}
	var settings struct {
		Packages   []json.RawMessage `json:"packages"`
		Extensions []string          `json:"extensions"`
	}
	if json.Unmarshal(data, &settings) != nil {
		return false
	}
	for _, raw := range settings.Packages {
		var source string
		if json.Unmarshal(raw, &source) != nil {
			var pkg struct {
				Source string `json:"source"`
			}
			_ = json.Unmarshal(raw, &pkg)
			source = pkg.Source
		}
		if source == "npm:@aliou/pi-processes" || strings.HasPrefix(source, "npm:@aliou/pi-processes@") {
			return true
		}
	}
	for _, path := range settings.Extensions {
		if strings.Contains(filepath.ToSlash(path), "/@aliou/pi-processes/") {
			return true
		}
	}
	return false
}
