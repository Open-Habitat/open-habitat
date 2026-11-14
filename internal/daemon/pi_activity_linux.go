//go:build linux

package daemon

import (
	"context"
	"errors"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/open-habitat/open-habitat/internal/core"
	"github.com/open-habitat/open-habitat/internal/diagnostic"
	"github.com/open-habitat/open-habitat/internal/livelimits"
)

// A person may have this many daemon-owned Pi children at once. Only a busy
// child holds its place: an idle one is stopped when the place is needed, and
// its conversation resumes from native history on the next send, as after a
// daemon restart. One more Pi, for the system's background work, comes on
// top of the limit (background_linux.go).
//
// The limit protects the host, not the person's way of working: people run
// eight to ten agents side by side, and a conversation whose background
// process still runs keeps its place for as long as it runs (Jari,
// 2026-11-05). What runs out is memory, about 210 MiB per Pi child, so one
// person's livelimits.HostDefault (32) children take some 7 GiB. The limit
// bounds one person's daemon; people on the same host share its memory, so a
// host for several people who all run that many agents at once needs that
// much each. A fixed number is used rather than a reading of available
// memory because it can be checked and tested exactly; a memory reading
// moves with every other process on the host and would refuse at random.
// The record bound of create is separate: it bounds the controller's
// in-memory records, live or not, at the highest limit plus the reserved
// background place.
//
// The administrator may set another number for the installation and for a
// person (live-conversation-limit-admin). It reaches the daemon only as
// root's live-limits file, which the broker writes after the gateway's
// administrator check; no request to this daemon can change it. A missing
// or untrusted file is the daemon's own default: the limit shares the host
// politely and is not a boundary worth refusing every start over.

// readLiveLimits reads root's live-limits file (a test seam).
var readLiveLimits = func() ([]byte, error) {
	return core.ReadOperatorFile(livelimits.Path, livelimits.MaxFile)
}

// effectiveLimit is this person's limit and where it comes from, read from
// root's file each time so that an administrator's change applies to the
// next start. Caller holds c.mu.
func (c *ConversationController) effectiveLimit() (int, string) {
	if c.maxLive > 0 {
		return c.maxLive, livelimits.SourceDefault
	}
	read := readLiveLimits
	if c.fixtureLimits != nil {
		read = c.fixtureLimits
	}
	b, err := read()
	if err != nil {
		return livelimits.HostDefault, livelimits.SourceDefault
	}
	f, err := livelimits.Parse(b)
	if err != nil {
		return livelimits.HostDefault, livelimits.SourceDefault
	}
	return f.For(uint32(os.Getuid()))
}

// liveLimit is the one place the limit is enforced from. Caller holds c.mu.
func (c *ConversationController) liveLimit() int {
	n, _ := c.effectiveLimit()
	return n
}

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
	case s.runActive, s.aborting, s.naming, s.recapping, s.rewinding, s.compacting, s.waking, len(s.held) > 0, len(s.queueSteering)+len(s.queueFollowUp) > 0, s.bash.active():
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
		// was admitted: the one the stop hands on to the background queue.
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

// capacity answers what a person refused at the limit needs: their limit,
// where it comes from, and which of their conversations hold a place now
// and why. It reads only this daemon's own children; nobody else's use is
// known here.
func (c *ConversationController) capacity(w http.ResponseWriter, r *http.Request) {
	busy, _ := c.classify(r.Context(), holdsPersonsPlace)
	c.mu.Lock()
	limit, source := c.effectiveLimit()
	holding := make([]map[string]any, 0, len(busy))
	for _, b := range busy {
		s := c.sessions[strings.TrimPrefix(b.agentID, "pi:")]
		if s == nil || !liveChild(s) || !holdsPersonsPlace(s) {
			continue
		}
		holding = append(holding, map[string]any{"agent_id": b.agentID, "workspace_id": s.workspace, "activity": b.activity})
	}
	c.mu.Unlock()
	historyJSON(w, map[string]any{"schema_version": 1, "limit": limit, "source": source, "holding": holding})
}

// holdsPersonsPlace is a child counted against the person's limit: every
// live one except the Pi in the reserved background place
// (background_linux.go). Caller holds c.mu.
func holdsPersonsPlace(s *conversation) bool {
	return !holdsBackgroundSlot(s)
}

// liveCount is the number of children holding one of the person's places.
// Caller holds c.mu.
func (c *ConversationController) liveCount() int {
	n := 0
	for _, s := range c.sessions {
		if liveChild(s) && holdsPersonsPlace(s) {
			n++
		}
	}
	return n
}

// makeRoom stops idle children, the longest unused first and those waiting
// only on a Taskfleet run last, until one more child fits under the limit. When every place is busy it stops nothing and
// the caller's own check refuses at capacity. The background Pi holds no
// place of the person's and is never stopped for one. A recap a stopped
// child still owed goes to the background queue, as after the idle stop.
func (c *ConversationController) makeRoom(ctx context.Context) {
	c.mu.Lock()
	need := c.liveCount() - c.liveLimit() + 1
	c.mu.Unlock()
	if need <= 0 {
		return
	}
	_, idle := c.classify(ctx, holdsPersonsPlace)
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
	owed := owedOf(marked)
	c.mu.Unlock()
	c.closeStopping(marked)
	c.handOnOwedRecaps(marked, owed)
}

// owedOf reads the recap each marked handle's stop cancelled. Caller holds
// c.mu.
func owedOf(marked []*conversation) map[*conversation]time.Time {
	owed := make(map[*conversation]time.Time, len(marked))
	for _, s := range marked {
		owed[s] = s.recapDue
	}
	return owed
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
// by the live limit, because a Pi held only by a run still yields its
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
	owed := owedOf(marked)
	c.mu.Unlock()
	c.closeStopping(marked)
	for _, s := range marked {
		outcome := "stopped"
		if liveChild(s) {
			outcome = "uncertain"
		}
		diagnostic.New(os.Stderr, "daemon").Info("conversation_idle_stop", "outcome", outcome, "reason", "idle_timeout", "agent_id", "pi:"+s.id)
	}
	c.handOnOwedRecaps(marked, owed)
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
	now := time.Now()
	c.stopExpiredIdlePi(ctx, now)
	c.stopExpiredIdlePi(ctx, now.Add(piIdlePeriod))
}
