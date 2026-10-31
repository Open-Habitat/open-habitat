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
//     for it, or the daemon itself is using the child (title, recap, abort,
//     Habitat's own wake);
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
	case s.runActive, s.aborting, s.naming, s.recapping, s.waking, len(s.held) > 0, len(s.queueSteering)+len(s.queueFollowUp) > 0, s.bash.active():
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
func (c *ConversationController) stopIdleLocked(idle []*conversation, cause string) []*conversation {
	var marked []*conversation
	for _, s := range idle {
		if c.closed || c.sessions[s.id] != s || !liveChild(s) || heldActivity(s) != "" {
			continue
		}
		s.startupCancelled = true
		s.state = "stopping"
		stopFor(s, cause)
		// A recapDue still set is a recap this stop cancels before its timer
		// was admitted: the one the idle stop hands on (recapAfterIdleStop).
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

// makeRoom stops idle children, the longest unused first and those waiting
// only on a Taskfleet run last, until one more child fits under the limit. When every place is busy it stops nothing and
// the caller's own check refuses at capacity.
func (c *ConversationController) makeRoom(ctx context.Context) {
	c.mu.Lock()
	need := c.liveCount() - maxLiveConversations + 1
	c.mu.Unlock()
	if need <= 0 {
		return
	}
	_, idle := c.classify(ctx, func(*conversation) bool { return true })
	// A Pi held only by its working Taskfleet run yields after the truly idle.
	var waiting map[*conversation]bool
	if len(idle) > need {
		waiting = c.waitingOnRuns(ctx, idle)
	}
	c.mu.Lock()
	sort.SliceStable(idle, func(i, j int) bool {
		if waiting[idle[i]] != waiting[idle[j]] {
			return !waiting[idle[i]]
		}
		return lastSeen(idle[i]).Before(lastSeen(idle[j]))
	})
	if len(idle) > need {
		idle = idle[:need]
	}
	marked := c.stopIdleLocked(idle, "room")
	c.mu.Unlock()
	c.closeStopping(marked)
}

// lastSeen is when the child was last used or the person last reported being
// in its conversation. Caller holds c.mu.
func lastSeen(s *conversation) time.Time {
	if s.presentAt.After(s.lastUsed) {
		return s.presentAt
	}
	return s.lastUsed
}

// stopIfIdle stops one conversation's child if it is idle; archive uses it.
func (c *ConversationController) stopIfIdle(ctx context.Context, id string) {
	_, idle := c.classify(ctx, func(s *conversation) bool { return s.id == id })
	c.mu.Lock()
	marked := c.stopIdleLocked(idle, "person") // archiving is the person's act
	c.mu.Unlock()
	c.closeStopping(marked)
}

// Observe rather than guessing from the last prompt: a process bridge can keep
// Pi busy long after the turn settles. Allow a full idle period after that work
// is first observed finished, and after the browser last reported the person
// in the conversation: someone writing a long message or working in the
// terminal beside it is not away (Jari, 2026-10-28). No timer or activity
// state survives daemon exit.
//
// A Pi that waits on something is not stopped for idleness at all (Jari,
// 2026-10-30): a background process it started is already busy, and so is a
// Taskfleet run this conversation created that still works on its own, read
// from Taskfleet's creator-session attribution at each expiry. No time bounds
// either wait: Taskfleet's own stall verdict ends a run's, and memory is bounded
// by maxLiveConversations, because a Pi held only by a run still yields its
// place to another start (makeRoom), after every truly idle one.
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
// locked check also fences a prompt that arrived while the bridge or
// Taskfleet was read.
func (c *ConversationController) stopExpiredIdlePi(ctx context.Context, now time.Time) {
	_, idle := c.classify(ctx, func(*conversation) bool { return true })
	c.mu.Lock()
	candidates := make(map[*conversation]bool, len(idle))
	for _, s := range idle {
		candidates[s] = true
	}
	expiredAt := func(s *conversation) bool {
		return now.Sub(s.idleSince) >= piIdlePeriod && now.Sub(s.presentAt) >= piIdlePeriod
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
		if expiredAt(s) {
			expired = append(expired, s)
		}
	}
	c.mu.Unlock()
	waiting := c.waitingOnRuns(ctx, expired)
	c.mu.Lock()
	var stop []*conversation
	for _, s := range expired {
		if !waiting[s] && !s.idleSince.IsZero() && !s.lastUsed.After(s.idleSince) && expiredAt(s) {
			stop = append(stop, s)
		}
	}
	marked := c.stopIdleLocked(stop, "idle")
	owed := map[*conversation]time.Time{}
	for _, s := range marked {
		owed[s] = s.recapDue
	}
	c.mu.Unlock()
	c.closeStopping(marked)
	for _, s := range marked {
		outcome := "stopped"
		if liveChild(s) {
			outcome = "uncertain"
		}
		diagnostic.New(os.Stderr, "daemon").Info("conversation_idle_stop", "outcome", outcome, "reason", "idle_timeout", "agent_id", "pi:"+s.id)
		if !owed[s].IsZero() && outcome == "stopped" {
			go c.recapAfterIdleStop(ctx, s, owed[s])
		}
	}
}

// waitingOnRuns says which of these conversations created a Taskfleet run
// that still works on its own. One inventory read as the person serves them
// all; an unreadable inventory holds every one, as an unreadable process
// bridge does. Without Taskfleet no run exists. Called without c.mu.
func (c *ConversationController) waitingOnRuns(ctx context.Context, conversations []*conversation) map[*conversation]bool {
	waiting := map[*conversation]bool{}
	if len(conversations) == 0 || c.home == "" || taskfleetBinary(c.home) == "" {
		return waiting
	}
	runs, ok := listTaskfleetRuns(ctx, c.home)
	for _, s := range conversations {
		waiting[s] = !ok || ownsLiveRun(runs, s.id)
	}
	return waiting
}

// ownsLiveRun is the companion's wait-reminder rule (uncoveredRuns): a run
// this conversation's Pi created that a default `run wait` would still wait for.
func ownsLiveRun(runs []nativeSpinoff, id string) bool {
	for _, r := range runs {
		if belongsSpinoff(r, nativeSession{id: id}) && catchUpLive(r) {
			return true
		}
	}
	return false
}

// FixtureIdleStop runs the production idle stop as if every idle child had
// been idle for a full period, in the synthetic host only.
func (c *ConversationController) FixtureIdleStop(ctx context.Context) {
	if !c.fixture {
		return
	}
	// A recap the stop hands on outlives the fixture request that asked
	// for it; the controller's close still ends it.
	ctx = context.WithoutCancel(ctx)
	now := time.Now()
	c.stopExpiredIdlePi(ctx, now)
	c.stopExpiredIdlePi(ctx, now.Add(piIdlePeriod))
}
