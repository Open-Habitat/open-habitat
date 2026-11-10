//go:build linux

package daemon

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/open-habitat/open-habitat/internal/diagnostic"
)

// Tiivistä nyt (experimental, the context page) is Pi's own RPC `compact`:
// Pi chooses the cut with the person's settings, writes the summary with its
// own prompt and the person's instructions, and records the compaction in
// its session. The daemon only relays the request and Pi's answer.

const maxCompactInstructions = 2000

// compactWait bounds how long the request waits for Pi's summary; the
// gateway's ceiling for the route is longer. Pi itself is not cut off.
var compactWait = 10 * time.Minute

// takeCompactReply identifies a registered `compact` by its native RPC ID.
// Pi answers only when the summary is written, long after any other request,
// so the reader hands the reply to its waiter instead of the request queue.
func (p *piRPC) takeCompactReply(frame json.RawMessage) chan json.RawMessage {
	p.bashMu.Lock()
	defer p.bashMu.Unlock()
	if len(p.compactReplies) == 0 {
		return nil
	}
	var head struct {
		ID      string `json:"id"`
		Command string `json:"command"`
	}
	if json.Unmarshal(frame, &head) != nil || head.Command != "compact" {
		return nil
	}
	reply := p.compactReplies[head.ID]
	delete(p.compactReplies, head.ID)
	return reply
}

// startCompact writes one `compact` request and returns at once. A failed or
// partial write is uncertain: Pi may have started. Never retry it.
func (p *piRPC) startCompact(instructions string) (<-chan json.RawMessage, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.poisoned || p.closing.Load() || p.overflow.Load() {
		return nil, errors.New("Pi compaction uncertain: channel closed")
	}
	id, ok := uuid()
	if !ok {
		return nil, errors.New("request ID unavailable")
	}
	reply := make(chan json.RawMessage, 1)
	p.bashMu.Lock()
	if p.compactReplies == nil {
		p.compactReplies = make(map[string]chan json.RawMessage)
	}
	p.compactReplies[id] = reply
	p.bashMu.Unlock()
	wire := map[string]any{"id": id, "type": "compact"}
	if instructions != "" {
		wire["customInstructions"] = instructions
	}
	b, _ := json.Marshal(wire)
	b = append(b, '\n')
	if err := p.in.SetWriteDeadline(time.Now().Add(4 * time.Second)); err != nil {
		p.poisoned = true
		return nil, errors.New("Pi compaction uncertain: write deadline unavailable")
	}
	n, err := p.in.Write(b)
	if err != nil || n != len(b) || p.closing.Load() {
		p.poisoned = true
		p.endInput("a failed write of compact to Pi")
		return nil, errors.New("Pi compaction uncertain: incomplete write")
	}
	return reply, nil
}

// compactOutcome is what Pi's answer says. Pi's error text stays in the
// service log (it may quote the person's content); only its kind crosses.
type compactOutcome struct {
	Outcome      string // done, already_compacted, nothing_to_compact, cancelled, failed, uncertain
	TokensBefore int64
	TokensAfter  int64
}

func parseCompactReply(frame json.RawMessage) compactOutcome {
	var response struct {
		Type    string `json:"type"`
		Command string `json:"command"`
		Success *bool  `json:"success"`
		Error   string `json:"error"`
		Data    *struct {
			TokensBefore         *float64 `json:"tokensBefore"`
			EstimatedTokensAfter *float64 `json:"estimatedTokensAfter"`
		} `json:"data"`
	}
	if json.Unmarshal(frame, &response) != nil || response.Type != "response" || response.Command != "compact" || response.Success == nil {
		return compactOutcome{Outcome: "uncertain"}
	}
	if !*response.Success {
		// Pi 1.3's own refusals (AgentSession.compact).
		switch {
		case response.Error == "Already compacted":
			return compactOutcome{Outcome: "already_compacted"}
		case strings.HasPrefix(response.Error, "Nothing to compact"):
			return compactOutcome{Outcome: "nothing_to_compact"}
		case response.Error == "Compaction cancelled":
			return compactOutcome{Outcome: "cancelled"}
		}
		return compactOutcome{Outcome: "failed"}
	}
	tokens := func(v *float64) int64 {
		if v == nil || *v < 0 || *v > 1e12 {
			return 0
		}
		return int64(*v)
	}
	if response.Data == nil {
		return compactOutcome{Outcome: "done"}
	}
	return compactOutcome{Outcome: "done", TokensBefore: tokens(response.Data.TokensBefore), TokensAfter: tokens(response.Data.EstimatedTokensAfter)}
}

// compactionEndOutcome is the kind of Pi's compaction_end, whoever asked for
// the compaction: the conversation says it ended and how, also to a tab that
// did not ask. Pi's error text stays out (it may quote the person's content).
func compactionEndOutcome(result json.RawMessage, aborted bool, errorMessage string) string {
	switch {
	case aborted:
		return "cancelled"
	case len(result) > 0 && string(result) != "null":
		return "done"
	}
	switch reason := strings.TrimPrefix(errorMessage, "Compaction failed: "); {
	case reason == "Already compacted":
		return "already_compacted"
	case strings.HasPrefix(reason, "Nothing to compact"):
		return "nothing_to_compact"
	case reason == "Compaction cancelled":
		return "cancelled"
	}
	return "failed"
}

func validCompactInstructions(text string) bool {
	return utf8.ValidString(text) && utf8.RuneCountInString(text) <= maxCompactInstructions && !strings.ContainsRune(text, 0)
}

var compactRefusals = map[string]int{
	"already_compacted":  409,
	"nothing_to_compact": 409,
	"cancelled":          409,
	"failed":             409,
}

// compact asks the conversation's running Pi to compact now. It is offered
// only while the agent waits: Pi's compact would abort a running turn, and
// the person did not ask for that. Messages sent meanwhile are held and
// reach Pi once it is done, because Pi refuses a prompt while it compacts.
func (c *ConversationController) compact(w http.ResponseWriter, r *http.Request, id string) {
	var body struct {
		Instructions string `json:"instructions"`
	}
	if decodeControl(r, &body, 4*maxCompactInstructions+64) != nil || !validCompactInstructions(body.Instructions) {
		snapshotError(w, 400, "invalid_request")
		return
	}
	instructions := strings.TrimSpace(body.Instructions)
	c.mu.Lock()
	s := c.sessions[id]
	if s == nil || (notRunning(s) && s.state != "starting") {
		c.mu.Unlock()
		// The browser wakes the conversation and asks once more.
		snapshotError(w, 404, "resource_not_found")
		return
	}
	if s.compacting {
		c.mu.Unlock()
		snapshotError(w, 409, "compacting")
		return
	}
	if c.closed || s.state == "starting" || s.state == "stopping" || s.state == "uncertain" || s.rewinding || s.recapping || s.naming || s.waking || s.aborting || s.rpc.overflow.Load() {
		c.mu.Unlock()
		snapshotError(w, 409, "control_uncertain")
		return
	}
	if !recapIdle(s) || s.runActive || len(s.held) > 0 || s.bash.active() || s.questionID != "" || len(s.queueSteering)+len(s.queueFollowUp) > 0 {
		c.mu.Unlock()
		snapshotError(w, 409, "turn_running")
		return
	}
	s.compacting = true
	c.pauseRecap(s)
	if c.journal != nil {
		c.journal.appendInvalidation("pi:" + id)
	}
	c.mu.Unlock()
	log := diagnostic.New(os.Stderr, "daemon")
	finish := func(outcome compactOutcome) {
		c.mu.Lock()
		s.compacting = false
		// The recap paused for the compaction is due again: a compaction is
		// no new turn, so nothing else would reschedule it.
		if c.sessions[id] == s && s.settled && recapIdle(s) {
			c.scheduleAutomaticRecap(s)
		}
		if c.journal != nil {
			c.journal.appendInvalidation("pi:" + id)
		}
		c.mu.Unlock()
		if _, refused := compactRefusals[outcome.Outcome]; outcome.Outcome == "done" || refused && outcome.Outcome != "failed" {
			log.Info("conversation_compact", "outcome", outcome.Outcome, "agent_id", "pi:"+id)
		} else {
			log.Warn("conversation_compact", "outcome", outcome.Outcome, "agent_id", "pi:"+id)
		}
		go c.deliverHeld(s)
	}
	reply, err := s.rpc.startCompact(instructions)
	if err != nil {
		finish(compactOutcome{Outcome: "uncertain"})
		snapshotError(w, 503, "control_uncertain")
		return
	}
	// Leaving the page does not stop Pi, and Pi compacts until it answers
	// or ends: only then are held messages and another compaction let in.
	result := make(chan compactOutcome, 1)
	go func() {
		outcome := compactOutcome{Outcome: "uncertain"}
		select {
		case frame := <-reply:
			outcome = parseCompactReply(frame)
		case <-s.rpc.done:
		}
		finish(outcome)
		result <- outcome
	}()
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(compactWait + 30*time.Second))
	timer := time.NewTimer(compactWait)
	defer timer.Stop()
	var outcome compactOutcome
	select {
	case outcome = <-result:
	case <-timer.C:
		outcome = compactOutcome{Outcome: "uncertain"}
	case <-r.Context().Done():
		return
	}
	if status, refused := compactRefusals[outcome.Outcome]; refused {
		code := outcome.Outcome
		if code == "failed" {
			code = "compaction_failed"
		}
		snapshotError(w, status, code)
		return
	}
	if outcome.Outcome != "done" {
		snapshotError(w, 503, "control_uncertain")
		return
	}
	historyJSON(w, map[string]any{"schema_version": 1, "agent_id": "pi:" + id, "state": "done", "tokens_before": outcome.TokensBefore, "estimated_tokens_after": outcome.TokensAfter})
}
