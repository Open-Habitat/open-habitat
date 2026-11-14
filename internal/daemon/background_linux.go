//go:build linux

package daemon

import (
	"context"
	"time"
)

// Background work is the system's own work nobody is waiting on right now;
// today that is automatic recaps of conversations whose Pi has stopped
// (Jari 14.11.2026). It never takes one of the person's places and never
// stops one of their conversations: a person's limit is N live Pi
// (liveLimit) plus one place reserved for it, and a queue serves that place
// one job at a time. So background work costs at most one more Pi, and only
// while the queue has work, and a burst of finished conversations waits its
// turn rather than competing with the person.
//
// Every stop that leaves a recap owed hands it here: the idle stop and the
// stop that makes room for another start alike. A Pi that resumes the
// person's own conversation (a send, a wake, Habitat's own wake) is not
// background work and takes an ordinary place.
//
// The queue is this daemon's memory only. What it holds is derivable from
// native history (owedRecaps), so a starting daemon fills it again from the
// conversations themselves and nothing else is stored.

// backgroundJob is one owed recap. old is the stopped handle this daemon
// left, or nil when the recap was derived from native history after a
// restart. due is when it may run; for a handle it waits as the stopped
// recap timer would have, and longer while the person still reads the
// conversation.
type backgroundJob struct {
	id  string
	old *conversation
	due time.Time
}

// While the reserved place is taken (by the job still finishing, or after a
// person took over a background Pi and so has one place more than their
// limit for a while), the queue looks again this often.
const backgroundRecheck = 2 * time.Second

// holdsBackgroundSlot is a live Pi in the reserved place: started only for a
// recap, its job not finished, and not taken over by the person (which
// clears recapOnly). Caller holds c.mu.
func holdsBackgroundSlot(s *conversation) bool {
	return s.backgroundSlot && s.recapOnly && liveChild(s)
}

// backgroundSlotFree says whether one background Pi may start now: nothing
// holds the reserved place and the person's own Pi leave it. Their Pi can
// exceed N by one after they took over a background Pi; the reserved place
// then waits, so the total never passes N+1. Caller holds c.mu.
func (c *ConversationController) backgroundSlotFree() bool {
	total := 0
	for _, s := range c.sessions {
		if holdsBackgroundSlot(s) {
			return false
		}
		if liveChild(s) {
			total++
		}
	}
	return total < c.liveLimit()+1
}

// enqueueBackground adds one owed recap to the queue, replacing an earlier
// entry for the same conversation, and starts the server if none runs.
// Caller holds c.mu.
func (c *ConversationController) enqueueBackground(job backgroundJob) {
	if c.closed {
		return
	}
	if c.background == nil {
		c.background = map[string]backgroundJob{}
		c.backgroundWake = make(chan struct{}, 1)
	}
	c.background[job.id] = job
	select {
	case c.backgroundWake <- struct{}{}:
	default:
	}
	if c.backgroundCancel == nil {
		ctx, cancel := context.WithCancel(context.Background())
		c.backgroundCancel = cancel
		go c.serveBackground(ctx)
	}
}

// handOnOwedRecaps queues the recaps a stop cancelled. owed holds each marked
// handle's recapDue as read when it was marked; only a stop that reaped its
// Pi hands on, as an uncertain one may still be running.
func (c *ConversationController) handOnOwedRecaps(marked []*conversation, owed map[*conversation]time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, s := range marked {
		if !owed[s].IsZero() && !liveChild(s) && c.sessions[s.id] == s {
			c.enqueueBackground(backgroundJob{id: s.id, old: s, due: owed[s]})
		}
	}
}

// backgroundDelay is the person's recap quiet interval. Called without c.mu.
func (c *ConversationController) backgroundDelay() time.Duration {
	c.mu.Lock()
	delay := c.recapIdleDelay
	c.mu.Unlock()
	if delay == 0 {
		delay = recapDelay(c.home)
	}
	return delay
}

// serveBackground runs the queue's jobs one at a time, the earliest due
// first, each only once the reserved place is free. It ends when the queue
// is empty or the controller closes; the next enqueue starts it again.
// Only shutdown cancels ctx, and a closed controller starts no new server.
func (c *ConversationController) serveBackground(ctx context.Context) {
	for {
		delay := c.backgroundDelay()
		c.mu.Lock()
		if c.closed || len(c.background) == 0 {
			c.backgroundCancel = nil
			c.mu.Unlock()
			return
		}
		var next backgroundJob
		var nextDue time.Time
		for id, job := range c.background {
			// A conversation the person resumed follows its own schedule.
			if job.old != nil && c.sessions[id] != job.old {
				delete(c.background, id)
				continue
			}
			due := job.due
			if job.old != nil {
				if seen := job.old.presentAt.Add(delay); seen.After(due) {
					due = seen
				}
			}
			if next.id == "" || due.Before(nextDue) {
				next, nextDue = job, due
			}
		}
		wake := c.backgroundWake
		if next.id == "" {
			c.mu.Unlock()
			continue
		}
		wait := time.Until(nextDue)
		if wait <= 0 && !c.backgroundSlotFree() {
			wait = backgroundRecheck
		}
		if wait <= 0 {
			delete(c.background, next.id)
		}
		c.mu.Unlock()
		if wait > 0 {
			timer := time.NewTimer(wait)
			select {
			case <-ctx.Done():
				timer.Stop()
				return
			case <-wake:
				timer.Stop()
			case <-timer.C:
			}
			continue
		}
		// Native history decides whether the recap is still owed now.
		for _, owed := range c.owedRecaps(time.Now(), delay, next.id) {
			c.recapResting(ctx, owed, next.old)
		}
	}
}
