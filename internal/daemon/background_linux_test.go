//go:build linux

package daemon

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"
)

// backgroundProbe is a recap generator that records, at each recap the
// background queue makes, which conversation it was for and how the places
// stood, and that can hold the recap until released.
type backgroundProbe struct {
	mu      sync.Mutex
	made    []string
	total   []int // live Pi children of every kind
	persons []int // children counted against the person's limit
	held    []int // children in the reserved background place
	running int
	most    int
	hold    chan struct{} // nil lets every recap finish at once
	entered chan string
}

func (p *backgroundProbe) install(c *ConversationController) {
	c.mu.Lock()
	defer c.mu.Unlock()
	// Long enough that no Pi makes its recap on its own timer during a test.
	c.recapIdleDelay = time.Hour
	c.recapGenerator = func(s *conversation, trigger string, _ uint64) recapOutcome {
		c.mu.Lock()
		total, held := 0, 0
		for _, x := range c.sessions {
			if liveChild(x) {
				total++
			}
			if holdsBackgroundSlot(x) {
				held++
			}
		}
		persons := c.liveCount()
		c.mu.Unlock()
		p.mu.Lock()
		p.made = append(p.made, s.id)
		p.total, p.persons, p.held = append(p.total, total), append(p.persons, persons), append(p.held, held)
		p.running++
		p.most = max(p.most, p.running)
		hold := p.hold
		p.mu.Unlock()
		if p.entered != nil {
			p.entered <- s.id
		}
		if hold != nil {
			<-hold
		}
		p.mu.Lock()
		p.running--
		p.mu.Unlock()
		return recapOutcome{}
	}
}

func (p *backgroundProbe) count() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	return len(p.made)
}

// runQueuedNow makes every queued job due now, as if its quiet interval had
// passed, and asserts which conversations were queued.
func runQueuedNow(t *testing.T, c *ConversationController, want ...string) {
	t.Helper()
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.background) != len(want) {
		t.Fatalf("queued %v, want %v", c.background, want)
	}
	for _, id := range want {
		job, ok := c.background[id]
		if !ok {
			t.Fatalf("%s not queued: %v", id, c.background)
		}
		// The stop hands on the due time of the timer it cancelled.
		if job.old != nil && time.Until(job.due) < 50*time.Minute {
			t.Fatalf("%s due %v, not the cancelled timer's", id, job.due)
		}
		job.due = time.Now().Add(-time.Second)
		c.background[id] = job
	}
	// The presence wait uses the quiet interval too; nobody was present.
	c.recapIdleDelay = time.Millisecond
	select {
	case c.backgroundWake <- struct{}{}:
	default:
	}
}

// Making room for a start stops the longest unused idle Pi; the recap it
// still owed is made by a Pi in the reserved background place, which comes
// on top of the person's N and never reduces it: while it works, the person
// still starts conversations up to their own limit.
func TestMakingRoomHandsTheOwedRecapToTheBackgroundPlace(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	probe := &backgroundProbe{hold: make(chan struct{}), entered: make(chan string, 1)}
	probe.install(c)
	var ids []string
	for i := 0; i < heldLiveLimit; i++ {
		id := h.create(c)
		h.converse(c, id, fmt.Sprintf("Viesti %d", i), activityCommand(i))
		h.quiescent(c, id)
		ids = append(ids, id)
	}
	h.create(c)
	h.eventually("room made", func() bool { return h.stopped(c, ids[0]) })
	runQueuedNow(t, c, ids[0])
	select {
	case id := <-probe.entered:
		if id != ids[0] {
			t.Fatalf("recap for %s, want %s", id, ids[0])
		}
	case <-time.After(15 * time.Second):
		t.Fatal("the owed recap was never made")
	}
	probe.mu.Lock()
	total, persons, held := probe.total[0], probe.persons[0], probe.held[0]
	probe.mu.Unlock()
	if total != heldLiveLimit+1 || persons != heldLiveLimit || held != 1 {
		t.Fatalf("at the recap: total %d, persons %d, background %d; want %d, %d, 1", total, persons, held, heldLiveLimit+1, heldLiveLimit)
	}
	// The person's N is theirs: another start stops one of their own idle
	// Pi, never the background one, and is not refused.
	h.create(c)
	if !h.live(c, ids[0]) {
		t.Fatal("a start stopped the background Pi")
	}
	if h.live(c, ids[1]) {
		t.Fatal("the start did not take its place from the person's longest unused Pi")
	}
	c.mu.Lock()
	persons = c.liveCount()
	c.mu.Unlock()
	if persons != heldLiveLimit {
		t.Fatalf("person's live Pi %d, want %d", persons, heldLiveLimit)
	}
	close(probe.hold)
	h.eventually("background Pi stopped after its recap", func() bool { return h.stopped(c, ids[0]) })
	c.mu.Lock()
	free := c.backgroundSlotFree()
	c.mu.Unlock()
	if !free {
		t.Fatal("the background place stayed taken after the recap")
	}
}

// A burst of idle stops queues their recaps, and the one background place
// makes them one at a time.
func TestBackgroundRecapsRunOneAtATime(t *testing.T) {
	h := newHeldHarness(t)
	c, stop := h.daemon()
	defer stop()
	probe := &backgroundProbe{}
	probe.install(c)
	var ids []string
	for i := 0; i < 3; i++ {
		id := h.create(c)
		h.converse(c, id, fmt.Sprintf("Viesti %d", i), activityCommand(i))
		h.quiescent(c, id)
		ids = append(ids, id)
	}
	now := time.Now()
	c.stopExpiredIdlePi(context.Background(), now)
	c.stopExpiredIdlePi(context.Background(), now.Add(piIdlePeriod))
	for _, id := range ids {
		h.eventually("idle stop", func() bool { return h.stopped(c, id) })
	}
	runQueuedNow(t, c, ids...)
	h.eventually("every recap made", func() bool { return probe.count() == len(ids) })
	probe.mu.Lock()
	defer probe.mu.Unlock()
	if probe.most != 1 {
		t.Fatalf("%d recaps at once, want one", probe.most)
	}
	for i := range probe.made {
		if probe.held[i] != 1 || probe.total[i] != 1 {
			t.Fatalf("recap %d: background %d, total %d; want one Pi", i, probe.held[i], probe.total[i])
		}
	}
	seen := map[string]bool{}
	for _, id := range probe.made {
		seen[id] = true
	}
	for _, id := range ids {
		if !seen[id] {
			t.Fatalf("no recap for %s: %v", id, probe.made)
		}
	}
}

// The queue is the daemon's memory only. A restarted daemon finds the
// recaps still owed from native history and makes them in the background
// place, even when the person's own places are all taken.
func TestRestartedDaemonDerivesPendingRecaps(t *testing.T) {
	h := newHeldHarness(t)
	before, stopBefore := h.daemon()
	(&backgroundProbe{}).install(before)
	owed := h.create(before)
	h.converse(before, owed, "Tee työ", activityCommand(1))
	h.quiescent(before, owed)
	stopBefore()

	after, stop := h.daemon()
	defer stop()
	probe := &backgroundProbe{}
	probe.install(after)
	h.setFile("prompt-hold", "1")
	for i := 0; i < heldLiveLimit; i++ {
		id := h.create(after)
		h.eventually("ready", func() bool { _, v := h.status(after, id); return v.State == "idle" })
		if w := h.send(after, id, fmt.Sprintf("Työ %d", i), activityCommand(10+i)); w.Code != 200 {
			t.Fatalf("send %d: %d", i, w.Code)
		}
		h.eventually("turn running", func() bool {
			after.mu.Lock()
			defer after.mu.Unlock()
			return after.sessions[id].runActive
		})
	}
	after.mu.Lock()
	after.recapIdleDelay = time.Millisecond
	after.mu.Unlock()
	after.recapRestingConversations(context.Background())
	h.eventually("derived recap made", func() bool { return probe.count() == 1 })
	probe.mu.Lock()
	defer probe.mu.Unlock()
	if probe.made[0] != owed || probe.persons[0] != heldLiveLimit || probe.total[0] != heldLiveLimit+1 {
		t.Fatalf("made %v with persons %v, total %v", probe.made, probe.persons, probe.total)
	}
	h.setFile("prompt-hold", "")
}
