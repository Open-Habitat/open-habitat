//go:build linux

package integrations

import (
	"context"
	"io"
	"log/slog"
	"slices"
	"sync"
	"time"
)

type key struct {
	provider Provider
	address  string
}

// Supervisor runs each syncing account's client as the daemon's child for as
// long as the account exists, so files sync whether or not a browser is open.
// A client that exits is restarted with exponential backoff; the clients
// resume from their own state, so a daemon restart simply starts them again.
type Supervisor struct {
	env        Env
	log        *slog.Logger
	first, max time.Duration
	mu         sync.Mutex
	children   map[key]*child
}

type child struct {
	cmd    Command
	cancel context.CancelFunc
	done   chan struct{}
	// failing is set while the client is waiting to be restarted after it
	// exited without being asked to.
	failing bool
	// passes follows a syncLoop's markers; nil for other commands.
	passes *passObserver
}

func newSupervisor(env Env, log *slog.Logger) *Supervisor {
	if log == nil {
		log = slog.New(slog.DiscardHandler)
	}
	return &Supervisor{env: env, log: log, first: time.Second, max: 5 * time.Minute, children: map[key]*child{}}
}

// reconcile starts the clients in desired that are not running, restarts one
// whose command changed (new folders chosen) and stops those no longer
// desired.
func (s *Supervisor) reconcile(desired map[key]Command) {
	s.mu.Lock()
	var stop []*child
	for k, c := range s.children {
		if d, ok := desired[k]; !ok || !sameCommand(d, c.cmd) {
			stop = append(stop, c)
			delete(s.children, k)
		}
	}
	for k, cmd := range desired {
		if _, ok := s.children[k]; !ok {
			ctx, cancel := context.WithCancel(context.Background())
			c := &child{cmd: cmd, cancel: cancel, done: make(chan struct{})}
			if len(cmd.Passes) > 0 {
				c.passes = newPassObserver(cmd.Passes)
			}
			s.children[k] = c
			go s.run(ctx, k, c)
		}
	}
	s.mu.Unlock()
	for _, c := range stop {
		c.cancel()
		<-c.done
	}
}

func sameCommand(a, b Command) bool {
	return a.Path == b.Path && slices.Equal(a.Args, b.Args) && slices.Equal(a.Env, b.Env) && slices.Equal(a.Passes, b.Passes)
}

func (s *Supervisor) run(ctx context.Context, k key, c *child) {
	defer close(c.done)
	delay := s.first
	for ctx.Err() == nil {
		started := time.Now()
		cmd := s.env.command(ctx, c.cmd)
		cmd.Stdout, cmd.Stderr = io.Discard, io.Discard
		var out *passOutput
		if c.passes != nil {
			if f := c.passes.forced(); f != "" {
				cmd.Env = append(cmd.Env, forceEnv+"="+f)
				s.log.Warn("integration_sync", "provider", string(k.provider), "outcome", "resuming", "reason", AllChanged)
			}
			out = c.passes.output()
			cmd.Stderr = out
		}
		err := cmd.Start()
		if err == nil {
			s.setFailing(c, false)
			err = cmd.Wait()
			killGroup(cmd)
		}
		if out != nil {
			out.exited(ctx.Err() != nil)
		}
		if ctx.Err() != nil {
			return
		}
		// A client that ran for a while before exiting is not failing
		// repeatedly; start the backoff again.
		if time.Since(started) > s.max {
			delay = s.first
		}
		s.setFailing(c, true)
		s.log.Warn("integration_sync", "provider", string(k.provider), "outcome", "exited", "reason", "restart_scheduled")
		select {
		case <-ctx.Done():
			return
		case <-time.After(delay):
		}
		delay = min(2*delay, s.max)
	}
}

func (s *Supervisor) setFailing(c *child, failing bool) {
	s.mu.Lock()
	c.failing = failing
	s.mu.Unlock()
}

// restarting reports whether the account's client exited and is waiting to
// be started again.
func (s *Supervisor) restarting(k key) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	c := s.children[k]
	return c != nil && c.failing
}

// passes returns what the account's supervised loop last showed about each
// of its passes, keyed by working directory; nil without a loop.
func (s *Supervisor) passes(k key) map[string]passState {
	s.mu.Lock()
	c := s.children[k]
	s.mu.Unlock()
	if c == nil || c.passes == nil {
		return nil
	}
	return c.passes.snapshot()
}

// supervised reports whether the account has a supervised client.
func (s *Supervisor) supervised(k key) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.children[k] != nil
}

// running returns the commands of the clients supervised for providers.
func (s *Supervisor) running(providers map[Provider]bool) map[key]Command {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := map[key]Command{}
	for k, c := range s.children {
		if providers[k.provider] {
			out[k] = c.cmd
		}
	}
	return out
}

// stop waits until the account's process group has exited before its native
// configuration is replaced or removed.
func (s *Supervisor) stop(k key) {
	s.mu.Lock()
	c := s.children[k]
	delete(s.children, k)
	s.mu.Unlock()
	if c != nil {
		c.cancel()
		<-c.done
	}
}

func (s *Supervisor) stopAll() { s.reconcile(nil) }
