//go:build linux

package daemon

import (
	"context"
	"errors"
	"os"
	"sort"
	"sync"
	"syscall"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/diagnostic"
)

// A person may have this many daemon-owned Pi children at once. Only a busy
// child holds its place: an idle one is stopped when the place is needed, and
// its conversation resumes from native history on the next send, as after a
// daemon restart.
const maxLiveConversations = 4

// The one definition of a conversation that is doing something. The per-person
// limit, workspace and worktree deletion, and archive all use it, and the
// browser's "Pi työskentelee" label is its "turn" case. A conversation is busy
// when its daemon-owned Pi child is alive and
//
//   - "turn": a turn runs or is being submitted, messages are held or queued
//     for it, or the daemon itself is using the child (title, recap, abort);
//   - "question": Pi waits for the person's answer inside a turn;
//   - "processes": a background process Pi started still runs, and stopping
//     Pi would stop it too;
//   - "unknown": the child's state cannot be read with certainty (stopping
//     without a confirmed end, or an unreadable process inventory).
//
// Anything else with a live child is idle, and stopping it loses nothing that
// native history does not keep.

// liveChild reports a daemon-owned Pi child that has not been reaped.
func liveChild(s *conversation) bool {
	if s.rpc == nil {
		return false
	}
	select {
	case <-s.rpc.exited:
		return false
	default:
		return true
	}
}

// heldActivity is the part of the definition the controller knows in memory.
// "" means idle as far as the controller knows; background processes still
// have to be asked from Pi. Caller holds c.mu.
func heldActivity(s *conversation) string {
	switch {
	case s.questionID != "":
		return "question"
	case s.runActive, s.aborting, s.naming, s.recapping, len(s.held) > 0, len(s.queueSteering)+len(s.queueFollowUp) > 0:
		return "turn"
	case s.settled && s.settlement == nil:
		return "turn" // the finished turn's native history is still being published
	}
	switch s.state {
	case "idle", "rejected":
		return ""
	case "pending", "accepted", "starting":
		return "turn"
	}
	return "unknown"
}

// backgroundActivity asks Pi's process bridge whether anything it started
// still runs. A bridge that does not exist runs nothing; a bridge that does
// not answer clearly is unknown, never idle.
func (p *piRPC) backgroundActivity(ctx context.Context) string {
	var reply struct {
		Records  []nativeProcess `json:"records"`
		Protocol int             `json:"protocol"`
	}
	if err := p.processRequest(ctx, map[string]string{"op": "list"}, &reply); err != nil {
		if err.Error() == "extension_missing" || errors.Is(err, syscall.ENOENT) || errors.Is(err, syscall.ECONNREFUSED) {
			return ""
		}
		return "unknown"
	}
	if reply.Protocol != 1 || reply.Records == nil {
		return "unknown"
	}
	for _, r := range reply.Records {
		switch r.Status {
		case "exited", "killed":
		default:
			return "processes"
		}
	}
	return ""
}

// busyConversation names one conversation that is doing something.
type busyConversation struct {
	agentID, activity string
}

// classify sorts the live children of the conversations match selects into
// busy ones and idle ones. Pi is asked about background processes without
// holding c.mu. An idle answer is only an observation: stopIdleLocked checks it
// again under the lock before acting on it.
func (c *ConversationController) classify(ctx context.Context, match func(*conversation) bool) ([]busyConversation, []*conversation) {
	var busy []busyConversation
	var candidates []*conversation
	c.mu.Lock()
	for id, s := range c.sessions {
		if !liveChild(s) || !match(s) {
			continue
		}
		if activity := heldActivity(s); activity != "" {
			busy = append(busy, busyConversation{"pi:" + id, activity})
		} else {
			candidates = append(candidates, s)
		}
	}
	c.mu.Unlock()
	answers := make([]string, len(candidates))
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	var wg sync.WaitGroup
	for i, s := range candidates {
		wg.Add(1)
		go func(i int, p *piRPC) {
			defer wg.Done()
			answers[i] = p.backgroundActivity(ctx)
		}(i, s.rpc)
	}
	wg.Wait()
	var idle []*conversation
	for i, s := range candidates {
		if answers[i] != "" {
			busy = append(busy, busyConversation{"pi:" + s.id, answers[i]})
		} else {
			idle = append(idle, s)
		}
	}
	sort.Slice(busy, func(i, j int) bool { return busy[i].agentID < busy[j].agentID })
	return busy, idle
}

// stopIdleLocked marks the children of idle conversations as stopping, after
// checking under the lock that each is still the same, live and idle handle.
// It returns those it marked; the caller closes them with closeStopping after
// releasing c.mu. Caller holds c.mu.
func (c *ConversationController) stopIdleLocked(idle []*conversation) []*conversation {
	var marked []*conversation
	for _, s := range idle {
		if c.closed || c.sessions[s.id] != s || !liveChild(s) || heldActivity(s) != "" {
			continue
		}
		s.startupCancelled = true
		s.state = "stopping"
		if s.recapTimer != nil {
			s.recapTimer.Stop()
		}
		if c.journal != nil {
			c.journal.appendInvalidation("pi:" + s.id)
		}
		marked = append(marked, s)
	}
	return marked
}

// closeStopping ends the marked children and waits until each is reaped or
// its end stays unknown. A child reaped never runs again, so a later
// liveChild check of the marked handles is final.
func (c *ConversationController) closeStopping(marked []*conversation) {
	var wg sync.WaitGroup
	for _, s := range marked {
		wg.Add(1)
		go func(s *conversation) {
			defer wg.Done()
			_ = s.rpc.close()
			c.mu.Lock()
			// EOF can mark the handle uncertain before the exit watcher runs.
			// The reap proof from close wins, but never overwrite a new start.
			if s.state == "stopping" || s.state == "uncertain" {
				s.state = stoppedState(s)
			}
			if c.journal != nil {
				c.journal.appendInvalidation("pi:" + s.id)
			}
			c.mu.Unlock()
		}(s)
	}
	wg.Wait()
}

// liveCount is the number of children holding a place. Caller holds c.mu.
func (c *ConversationController) liveCount() int {
	n := 0
	for _, s := range c.sessions {
		if liveChild(s) {
			n++
		}
	}
	return n
}

// makeRoom stops idle children, the longest unused first, until one more
// child fits under the limit. When every place is busy it stops nothing and
// the caller's own check refuses at capacity.
func (c *ConversationController) makeRoom(ctx context.Context) {
	c.mu.Lock()
	need := c.liveCount() - maxLiveConversations + 1
	c.mu.Unlock()
	if need <= 0 {
		return
	}
	_, idle := c.classify(ctx, func(*conversation) bool { return true })
	c.mu.Lock()
	sort.Slice(idle, func(i, j int) bool { return idle[i].lastUsed.Before(idle[j].lastUsed) })
	if len(idle) > need {
		idle = idle[:need]
	}
	marked := c.stopIdleLocked(idle)
	c.mu.Unlock()
	c.closeStopping(marked)
}

// stopIfIdle stops one conversation's child if it is idle; archive uses it.
func (c *ConversationController) stopIfIdle(ctx context.Context, id string) {
	_, idle := c.classify(ctx, func(s *conversation) bool { return s.id == id })
	c.mu.Lock()
	marked := c.stopIdleLocked(idle)
	c.mu.Unlock()
	c.closeStopping(marked)
}

// Observe rather than guessing from the last prompt: a process bridge can keep
// Pi busy long after the turn settles. Allow a full idle period after that work
// is first observed finished. No timer or activity state survives daemon exit.
const piIdlePeriod = 10 * time.Minute
const piIdleCheckInterval = time.Minute

func (c *ConversationController) watchIdlePi(ctx context.Context) {
	ticker := time.NewTicker(piIdleCheckInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-ticker.C:
			c.stopExpiredIdlePi(ctx, now)
		}
	}
}

// now is supplied by the watcher (or an injected clock in tests). The final
// locked check also fences a prompt that arrived while the bridge was probed.
func (c *ConversationController) stopExpiredIdlePi(ctx context.Context, now time.Time) {
	_, idle := c.classify(ctx, func(*conversation) bool { return true })
	c.mu.Lock()
	candidates := make(map[*conversation]bool, len(idle))
	for _, s := range idle {
		candidates[s] = true
	}
	var expired []*conversation
	for _, s := range c.sessions {
		if !candidates[s] || !liveChild(s) || heldActivity(s) != "" {
			s.idleSince = time.Time{}
			continue
		}
		if s.idleSince.IsZero() || s.lastUsed.After(s.idleSince) {
			s.idleSince = now
		}
		if now.Sub(s.idleSince) >= piIdlePeriod {
			expired = append(expired, s)
		}
	}
	marked := c.stopIdleLocked(expired)
	c.mu.Unlock()
	c.closeStopping(marked)
	for _, s := range marked {
		outcome := "stopped"
		if liveChild(s) {
			outcome = "uncertain"
		}
		diagnostic.New(os.Stderr, "daemon").Info("conversation_idle_stop", "outcome", outcome, "reason", "idle_timeout", "agent_id", "pi:"+s.id)
	}
}
