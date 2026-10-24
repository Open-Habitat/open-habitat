//go:build linux

package daemon

import (
	"context"
	"os"
	"strings"

	"github.com/Open-Habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

// The site's default repositories (ADR 0030) reach this daemon only inside
// the gateway's first-login handoff, as names the gateway has checked this
// person can read. Each is either already present in ~/src or waits here to
// be started as an ordinary clone job, one after another, whenever no other
// clone holds ~/src. Like the jobs, the waiting names live in memory only: a
// daemon restart forgets those not yet started, and nothing starts a refused
// one again by itself.

const maxPlanned = 64

type plannedClone struct {
	fullName string
	state    string // waiting or refused
	reason   string
}

// Plan answers each default of a validated handoff plan, in order. The plan
// selects only among this person's own clones: their gh, their ~/src.
func (c *CloneJobs) Plan(_ context.Context, p transport.Plan) []transport.PlanOutcome {
	// An unreadable ~/src is not evidence of absence either way: the start
	// that follows checks again, and its refusal shows as that name's problem.
	present := map[string]bool{}
	if src, err := cloneSource(c.cfg, c.home, false); err == nil {
		_ = eachSourceEntry(src, func(entry os.DirEntry) { present[strings.ToLower(entry.Name())] = true })
		unix.Close(src)
	}
	out := make([]transport.PlanOutcome, 0, len(p.Defaults))
	c.mu.Lock()
	defer c.mu.Unlock()
	// One plan arrives per binding; a gateway sending more than the bound
	// gets no answer rather than a false one.
	if len(c.planned)+len(p.Defaults) > maxPlanned {
		return nil
	}
	for _, name := range p.Defaults {
		if present[strings.ToLower(strings.Split(name, "/")[1])] {
			out = append(out, transport.PlanOutcome{FullName: name, Outcome: "already_present"})
			continue
		}
		out = append(out, transport.PlanOutcome{FullName: name, Outcome: "queued"})
		if !c.plannedLocked(name) {
			c.planned = append(c.planned, &plannedClone{fullName: name, state: "waiting"})
		}
	}
	if !c.planRunning && len(c.planned) > 0 {
		c.planRunning = true
		go c.runPlan()
	}
	return out
}

func (c *CloneJobs) plannedLocked(name string) bool {
	for _, p := range c.planned {
		if strings.EqualFold(p.fullName, name) {
			return true
		}
	}
	return false
}

// dropPlanned forgets a name once a job for it has started, whoever asked.
func (c *CloneJobs) dropPlanned(name string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	kept := c.planned[:0]
	for _, p := range c.planned {
		if !strings.EqualFold(p.fullName, name) {
			kept = append(kept, p)
		}
	}
	c.planned = kept
}

// runPlan starts the waiting names one at a time. It waits for ~/src's
// writer like any other start; a refusal is kept for the person to see and
// is never tried again here.
func (c *CloneJobs) runPlan() {
	for {
		c.mu.Lock()
		var next *plannedClone
		for _, p := range c.planned {
			if p.state == "waiting" {
				next = p
				break
			}
		}
		if next == nil || c.ctx.Err() != nil {
			c.planRunning = false
			c.mu.Unlock()
			return
		}
		name := next.fullName
		c.mu.Unlock()
		if cloneWriter.wait(c.ctx, "workspace_clone_running") != "" {
			c.mu.Lock()
			c.planRunning = false
			c.mu.Unlock()
			return
		}
		job, _, code := c.admit(c.ctx, name, "full", false)
		if job != nil {
			continue // admit dropped the name
		}
		c.mu.Lock()
		if code == "checkout_exists" {
			// Another start or the person got there first.
			kept := c.planned[:0]
			for _, p := range c.planned {
				if p != next {
					kept = append(kept, p)
				}
			}
			c.planned = kept
		} else {
			next.state, next.reason = "refused", code
		}
		c.mu.Unlock()
	}
}

func (c *CloneJobs) plannedView() []map[string]any {
	c.mu.Lock()
	defer c.mu.Unlock()
	out := make([]map[string]any, 0, len(c.planned))
	for _, p := range c.planned {
		v := map[string]any{"full_name": p.fullName, "state": p.state}
		if p.state == "refused" {
			v["reason"] = p.reason
		}
		out = append(out, v)
	}
	return out
}
