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
// completed turns as the person's first automatic recap waits for.
func (c *ConversationController) owedRecaps(now time.Time, delay time.Duration) []owedRecap {
	sessions, err := nativeSessions(c.nativeCfg())
	if err != nil {
		return nil
	}
	visibility, visibilityErr := loadVisibility(c.home)
	settings, err := readRecapSettings(c.home)
	if err != nil {
		settings = defaultRecapSettings
	}
	var owed []owedRecap
	for _, n := range sessions {
		if n.state != "readable" || archiveFact(visibility, visibilityErr, "pi:"+n.id) != "active" {
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
	for _, owed := range c.owedRecaps(time.Now(), delay) {
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
		c.recapResting(ctx, owed.id)
	}
}

// recapResting starts Pi for one resting conversation only to make its owed
// recap and stops it again. No turn runs and the rest stays as it was, so the
// agent's catch-up still comes with the person's next message. The person
// comes first: a conversation this daemon already has a handle for follows
// its own schedule, nobody's Pi is stopped to make room, and a Pi the person
// wakes, writes to or runs a command in meanwhile stays theirs.
func (c *ConversationController) recapResting(ctx context.Context, id string) {
	log := diagnostic.New(os.Stderr, "daemon")
	c.mu.Lock()
	skip := ""
	switch {
	case c.closed:
		skip = "closed"
	case c.sessions[id] != nil:
		skip = "controlled"
	case c.liveCount() >= maxLiveConversations-1:
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
	started := time.Now()
	s, problem := c.resume(id, nil, startRecap)
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
	ready := !c.closed && c.sessions[id] == s && s.recapOnly && recapIdle(s) && !s.dead && !s.recapping && !s.rpc.overflow.Load()
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
