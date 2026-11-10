//go:build linux

package daemon

import (
	"context"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/open-habitat/open-habitat/internal/transport"
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
	// Only a checkout of that very repository is already present. Anything
	// else at the destination, or an unreadable ~/src, is left to the start,
	// whose refusal then shows as that name's problem.
	c.mu.Lock()
	// One plan arrives per binding; a gateway sending more than the bound
	// gets no answer rather than a false one.
	full := len(c.planned)+len(p.Defaults) > maxPlanned
	c.mu.Unlock()
	if full {
		return nil
	}
	present := map[string]bool{}
	for _, name := range p.Defaults {
		present[name] = c.presentCheckout(name)
	}
	out := make([]transport.PlanOutcome, 0, len(p.Defaults))
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.planned)+len(p.Defaults) > maxPlanned {
		return nil
	}
	for _, name := range p.Defaults {
		if present[name] {
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

// dropPlannedLocked forgets a name once a job for it has started, whoever
// asked; c.mu is held.
func (c *CloneJobs) dropPlannedLocked(name string) {
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
		// Another start or the person may have fetched this very repository
		// meanwhile; any other tree at the destination is a conflict to show.
		done := code == "checkout_exists" && c.presentCheckout(name)
		c.mu.Lock()
		if done {
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

// presentCheckout reports whether ~/src already holds a Git checkout whose
// origin is this repository (GitHub names compare case-insensitively). It
// only reads; a dirty or unfinished tree of the right origin still counts.
func (c *CloneJobs) presentCheckout(name string) bool {
	src, err := cloneSource(c.cfg, c.home, false)
	if err != nil {
		return false
	}
	defer unix.Close(src)
	target := strings.Split(name, "/")[1]
	matches := []string{}
	if eachSourceEntry(src, func(entry os.DirEntry) {
		if strings.EqualFold(entry.Name(), target) {
			matches = append(matches, entry.Name())
		}
	}) != nil || len(matches) != 1 {
		return false
	}
	child, err := dir(unix.Openat2, src, matches[0], true)
	if err != nil {
		return false
	}
	defer unix.Close(child)
	ctx, cancel := context.WithTimeout(c.ctx, 8*time.Second)
	defer cancel()
	remote, err := c.run(ctx, c.git, c.home, strconv.Itoa(child), "-c", "core.fsmonitor=false", "config", "--local", "--get-all", "remote.origin.url")
	return err == nil && strings.EqualFold(string(remote), "https://github.com/"+name+".git\n")
}

// plannedViewLocked is the planned names as the list shows them; c.mu is held.
func (c *CloneJobs) plannedViewLocked() []map[string]any {
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
