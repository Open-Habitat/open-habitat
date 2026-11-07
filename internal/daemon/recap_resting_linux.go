//go:build linux

package daemon

import (
	"context"
	"os"
	"sort"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/diagnostic"
)

// An automatic recap falls due a quiet interval after a turn ends
// (scheduleAutomaticRecap). Its timer is this daemon's memory, so a restart
// before it fires loses it, and nothing arms it again: Pi is not running and
// no turn will settle (Jari 28.10.2026, test server). What made it due is
// native, though: the branch's latest message, its time, and the recaps
// written through it. A starting daemon derives from those the recaps still
// owed and makes each one, keeping no record of its own.
const (
	// A turn older than this when the daemon starts is no longer owed a
	// recap: a day covers a night of upgrades and a person returning the
	// next morning.
	restingRecapHorizon = 24 * time.Hour
	// Each one starts a Pi, so at most this many, the newest turns first.
	maxRestingRecaps = 8
)

type owedRecap struct {
	id  string
	due time.Time
}

// owedRecaps lists the browser's own active conversations whose latest
// message is the agent's, has no recap through it, and came after as many
// completed turns as the person's first automatic recap waits for. A non-empty
// only asks about that one conversation.
func (c *ConversationController) owedRecaps(now time.Time, delay time.Duration, only string) []owedRecap {
	sessions, err := nativeSessions(c.nativeCfg())
	if err != nil {
		return nil
	}
	visibility, visibilityErr := loadVisibility(c.home)
	settings, err := readRecapSettings(c.home)
	if err != nil {
		settings = defaultRecapSettings
	}
	if settings.Level == "off" {
		return nil
	}
	var owed []owedRecap
	for _, n := range sessions {
		if only != "" && n.id != only || n.state != "readable" || archiveFact(visibility, visibilityErr, "pi:"+n.id) != "active" {
			continue
		}
		// A terminal Pi's conversation was never the browser's to recap.
		if origin, err := peekBrowserOrigin(c.home, n.id); err != nil || origin.Cwd != n.cwd {
			continue
		}
		scan, ok := scanNativeRecap(n.path, c.cfg.UID, n.id, n.cwd, true)
		if !ok || scan.latestKind != "assistant" || scan.recap.Through == scan.latest.ID || scan.turns < settings.FirstAfterTurns {
			continue
		}
		at, err := time.Parse(time.RFC3339Nano, scan.latest.At)
		if err != nil || now.Sub(at) > restingRecapHorizon {
			continue
		}
		owed = append(owed, owedRecap{id: n.id, due: at.Add(delay)})
	}
	sort.Slice(owed, func(i, j int) bool { return owed[i].due.After(owed[j].due) })
	if len(owed) > maxRestingRecaps {
		owed = owed[:maxRestingRecaps]
	}
	sort.Slice(owed, func(i, j int) bool { return owed[i].due.Before(owed[j].due) })
	return owed
}

// recapRestingConversations makes the recaps owed from before this daemon
// started, one at a time, each when it falls due.
func (c *ConversationController) recapRestingConversations(ctx context.Context) {
	c.mu.Lock()
	delay := c.recapIdleDelay
	c.mu.Unlock()
	if delay == 0 {
		delay = recapDelay(c.home)
	}
	for _, owed := range c.owedRecaps(time.Now(), delay, "") {
		if wait := time.Until(owed.due); wait > 0 {
			timer := time.NewTimer(wait)
			select {
			case <-ctx.Done():
				timer.Stop()
				return
			case <-timer.C:
			}
		}
		if ctx.Err() != nil {
			return
		}
		c.recapResting(ctx, owed.id, nil)
	}
}

// recapAfterIdleStop makes the automatic recap whose timer the idle stop
// cancelled. A quiet time may outlast Pi's ten idle minutes (Jari 30.10.2026:
// a delay of 15 or 60 minutes is as reasonable as 5), and the timer ends with
// the Pi. The recap falls due as the timer would have, later if the person
// still read the rested conversation, and is still made only if native
// history owes it then.
func (c *ConversationController) recapAfterIdleStop(ctx context.Context, s *conversation, due time.Time) {
	c.mu.Lock()
	delay := c.recapIdleDelay
	c.mu.Unlock()
	if delay == 0 {
		delay = recapDelay(c.home)
	}
	for {
		c.mu.Lock()
		if seen := s.presentAt.Add(delay); seen.After(due) {
			due = seen
		}
		gone := c.closed || c.sessions[s.id] != s
		c.mu.Unlock()
		if gone {
			return
		}
		wait := time.Until(due)
		if wait <= 0 {
			break
		}
		timer := time.NewTimer(wait)
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		}
	}
	if len(c.owedRecaps(time.Now(), delay, s.id)) > 0 {
		c.recapResting(ctx, s.id, s)
	}
}

// recapResting starts Pi for one resting conversation only to make its owed
// recap and stops it again. No turn runs and the rest stays as it was, so the
// agent's catch-up still comes with the person's next message. The person
// comes first: a conversation this daemon already has a handle for follows
// its own schedule, nobody's Pi is stopped to make room, and a Pi the person
// wakes, writes to or runs a command in meanwhile stays theirs. old is the
// stopped handle this daemon left, or nil after a restart.
func (c *ConversationController) recapResting(ctx context.Context, id string, old *conversation) {
	// Recheck after waiting: the person may have disabled recaps meanwhile.
	if !automaticRecapsEnabled(c.home) {
		return
	}
	log := diagnostic.New(os.Stderr, "daemon")
	c.mu.Lock()
	skip := ""
	switch {
	case c.closed:
		skip = "closed"
	case c.sessions[id] != old, old != nil && (liveChild(old) || old.state != "stopped" || len(old.held) > 0 || old.bash.active()):
		skip = "controlled"
	case c.liveCount() >= c.liveLimit()-1:
		skip = "capacity"
	}
	c.mu.Unlock()
	if skip != "" {
		log.Info("conversation_recap", "outcome", "skipped", "reason", skip, "trigger", "resting", "agent_id", "pi:"+id)
		return
	}
	release, ok := c.proofPermit(ctx)
	if !ok {
		log.Info("conversation_recap", "outcome", "skipped", "reason", "source_unavailable", "trigger", "resting", "agent_id", "pi:"+id)
		return
	}
	// Archive holds the same permit while it commits: read it under the permit.
	if visibility, err := loadVisibility(c.home); archiveFact(visibility, err, "pi:"+id) != "active" {
		release()
		log.Info("conversation_recap", "outcome", "skipped", "reason", "not_active", "trigger", "resting", "agent_id", "pi:"+id)
		return
	}
	started := time.Now()
	s, problem := c.resume(id, old, startRecap)
	release()
	if problem != "" {
		log.Info("conversation_recap", "outcome", "skipped", "reason", problem, "trigger", "resting", "agent_id", "pi:"+id)
		return
	}
	// awaitReady makes the child idle, or stops it again, within
	// piReadyTimeout and its close.
	deadline := time.Now().Add(piReadyTimeout + 15*time.Second)
	for {
		c.mu.Lock()
		starting := c.sessions[id] == s && s.state == "starting"
		c.mu.Unlock()
		if !starting || time.Now().After(deadline) || ctx.Err() != nil {
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
	c.mu.Lock()
	ready := !c.closed && c.sessions[id] == s && s.recapOnly && recapIdle(s) && !s.dead && !s.recapping && !s.compacting && !s.rpc.overflow.Load()
	epoch := s.recapActivity
	if ready {
		s.recapping = true
	}
	c.mu.Unlock()
	if ready {
		c.runRecap(s, "automatic", epoch)
		c.mu.Lock()
		s.recapping = false
		if s.recapReschedule && recapIdle(s) && s.settled {
			s.recapReschedule = false
			c.scheduleAutomaticRecap(s)
		}
		c.mu.Unlock()
	}
	c.mu.Lock()
	var marked []*conversation
	// A person reading the conversation meanwhile may be about to write:
	// their Pi is left to the idle stop rather than closed under them.
	if c.sessions[id] == s && s.recapOnly && s.presentAt.Before(started) {
		marked = c.stopIdleLocked([]*conversation{s}, "idle")
	}
	c.mu.Unlock()
	c.closeStopping(marked)
}
