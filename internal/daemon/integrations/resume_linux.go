//go:build linux

package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"golang.org/x/sys/unix"
)

// A daemon stop (every release, every reboot) kills a first cloud import that
// the person chose and that may take hours. Ordinary sync never resyncs on its
// own, because a resync is a union that can bring back deleted files. The one
// exception is a first pass whose own native trace shows that the person's
// choice started it and that it never committed: there is no earlier sync
// state for a union to override, and running the same choice again is what
// the person already approved. Nothing is recorded by the host; the evidence
// is rclone's work directory.

// InitialSyncResumeFailed is a sync_failed service whose interrupted first
// pass the daemon started again after a stop, and that resumed pass failed.
const InitialSyncResumeFailed = "initial_sync_resume_failed"

// resumableEntry is a FolderEntry whose interrupted first pass can run again.
type resumableEntry interface {
	FolderEntry
	// interruptedPasses lists the home-relative bisync work directories of
	// the account whose chosen first pass was stopped before committing.
	interruptedPasses(env Env, address string) []string
	// resumeInitial runs those first passes again with the original choice.
	resumeInitial(ctx context.Context, env Env, address string, works []string) error
}

// resumeMark is the daemon's transient view of a resume, never persisted.
type resumeMark int

const (
	resumeQueued resumeMark = iota + 1
	resumeFailed
)

// interruptedResync reports whether a work directory holds exactly what an
// explicitly chosen --resync leaves when it is stopped before committing: the
// new listings and the lock of one session. A committed (.lst), previous
// (.lst-old) or error (.lst-err) listing, or anything else, means a pass
// finished or failed on its own once; such a directory is never resynced
// without the person. Ordinary passes never run without committed listings,
// so only the person's choice can have produced this state.
func interruptedResync(env Env, work string) bool {
	names, fd, err := listHomeDir(env.Home, work)
	if err != nil || fd < 0 {
		return false
	}
	unix.Close(fd)
	session := ""
	for _, n := range names {
		s := ""
		for _, suffix := range []string{".path1.lst-new", ".path2.lst-new", ".lck"} {
			if p, ok := strings.CutSuffix(n, suffix); ok {
				s = p
				break
			}
		}
		if s == "" || (session != "" && s != session) {
			return false
		}
		session = s
	}
	return session != ""
}

type lockState int

const (
	lockAbsent lockState = iota
	lockStale
	lockHeld
	lockForeign
)

// bisyncLock decides whether the lock in an interrupted work directory may be
// removed. Only our own session's lock is considered, and it is stale only
// when no running process refers to the work directory and the PID it names
// is not a process that could be rclone. Anything that cannot be proved is
// held: a live lock is never removed. data is the lock as read, so removal
// can refuse a lock that changed since.
func bisyncLock(env Env, work string) (name string, data []byte, state lockState) {
	names, fd, err := listHomeDir(env.Home, work)
	if err != nil || fd < 0 {
		return "", nil, lockAbsent
	}
	defer unix.Close(fd)
	for _, n := range names {
		if strings.HasSuffix(n, ".lck") {
			name = n
		}
	}
	if name == "" {
		return "", nil, lockAbsent
	}
	data, err = readFileAt(fd, name, 4096)
	if err != nil {
		return name, nil, lockForeign
	}
	abs := filepath.Join(env.Home, work)
	pid := 0
	var lock struct {
		Session string `json:"Session"`
		PID     string `json:"PID"`
	}
	// A pass killed while writing its lock leaves it empty or truncated; the
	// process scan alone then decides. A readable lock must be this session's.
	if json.Unmarshal(data, &lock) == nil {
		if lock.Session != filepath.Join(abs, strings.TrimSuffix(name, ".lck")) {
			return name, nil, lockForeign
		}
		if n, err := strconv.Atoi(lock.PID); err == nil && n > 0 {
			pid = n
		}
	}
	if processUses(abs, pid) {
		return name, data, lockHeld
	}
	return name, data, lockStale
}

// processUses reports whether any visible process names dir in its command
// line, or whether pid is alive and could be rclone. Unreadable evidence about
// pid counts as use.
func processUses(dir string, pid int) bool {
	entries, err := os.ReadDir("/proc")
	if err != nil {
		return true
	}
	for _, e := range entries {
		n, err := strconv.Atoi(e.Name())
		if err != nil || n <= 0 {
			continue
		}
		data, err := os.ReadFile("/proc/" + e.Name() + "/cmdline")
		if err != nil {
			if n == pid && !errors.Is(err, fs.ErrNotExist) && !errors.Is(err, unix.ESRCH) {
				return true
			}
			continue
		}
		args := strings.Split(strings.TrimRight(string(data), "\x00"), "\x00")
		for _, arg := range args {
			if mentions(arg, dir) {
				return true
			}
		}
		if n == pid && strings.Contains(filepath.Base(args[0]), "rclone") {
			return true
		}
	}
	return false
}

// mentions reports whether arg contains dir as a whole path, including inside
// a shell script argument, and not merely as a prefix of a sibling's name.
func mentions(arg, dir string) bool {
	for i := strings.Index(arg, dir); i >= 0; {
		end := i + len(dir)
		if end == len(arg) || strings.ContainsRune("/'\" \t\n", rune(arg[end])) {
			return true
		}
		next := strings.Index(arg[end:], dir)
		if next < 0 {
			break
		}
		i = end + next
	}
	return false
}

// removeStaleLock unlinks a lock bisyncLock proved stale, unless it changed.
func removeStaleLock(env Env, work, name string, data []byte) error {
	fd, err := openHomeDir(env.Home, false, splitPath(work)...)
	if err != nil {
		return err
	}
	defer unix.Close(fd)
	now, err := readFileAt(fd, name, 4096)
	if err != nil || !bytes.Equal(now, data) {
		return errLockChanged
	}
	return unix.Unlinkat(fd, name, 0)
}

var errLockChanged = errors.New("lock_changed")

// resumeInterrupted resumes, one at a time, every account's interrupted first
// pass. It runs once per daemon start; ctx ends with the daemon.
func (c *Catalog) resumeInterrupted(ctx context.Context) {
	type pending struct {
		entry   resumableEntry
		address string
	}
	var queue []pending
	accounts, _ := c.accounts()
	for _, a := range accounts {
		if e, ok := a.entry.(resumableEntry); ok && e.Available(c.env) && len(e.interruptedPasses(c.env, a.address)) > 0 {
			queue = append(queue, pending{e, a.address})
			c.markResume(key{e.Provider(), a.address}, resumeQueued)
		}
	}
	for _, p := range queue {
		c.resumeAccount(ctx, p.entry, p.address)
	}
}

func (c *Catalog) markResume(k key, mark resumeMark) {
	c.relay.mu.Lock()
	defer c.relay.mu.Unlock()
	if mark == 0 {
		delete(c.relay.resume, k)
		return
	}
	if c.relay.resume == nil {
		c.relay.resume = map[key]resumeMark{}
	}
	c.relay.resume[k] = mark
}

type resumeOutcome int

const (
	resumeDone  resumeOutcome = iota
	resumeWait                // another process or login holds the account
	resumeRetry               // the provider or the home could not take it yet
)

// resumeAccount waits while something else holds the account's pass, backs
// off while the provider is unreachable or the home is full, and otherwise
// resumes once. A failed resume stays failed until the person signs in again.
func (c *Catalog) resumeAccount(ctx context.Context, e resumableEntry, address string) {
	delay := c.resumeFirst
	for ctx.Err() == nil {
		wait := c.resumePoll
		switch c.tryResume(ctx, e, address) {
		case resumeDone:
			return
		case resumeRetry:
			wait, delay = delay, min(2*delay, c.resumeMax)
		}
		select {
		case <-ctx.Done():
		case <-time.After(wait):
		}
	}
}

func (c *Catalog) tryResume(ctx context.Context, e resumableEntry, address string) resumeOutcome {
	k := key{e.Provider(), address}
	log := func(outcome, reason string) {
		c.log.Info("integration_resume", "provider", string(k.provider), "outcome", outcome, "reason", reason)
	}
	c.write.Lock()
	if c.stopping {
		c.write.Unlock()
		return resumeDone
	}
	exists, err := c.has(e, address)
	if err != nil {
		c.write.Unlock()
		return resumeRetry
	}
	// The person may have removed the account or finished the choice again.
	works := e.interruptedPasses(c.env, address)
	if !exists || len(works) == 0 {
		c.write.Unlock()
		c.markResume(k, 0)
		return resumeDone
	}
	c.relay.mu.Lock()
	busy := c.relay.a != nil && !finished(c.relay.a.state)
	c.relay.mu.Unlock()
	if busy {
		c.write.Unlock()
		return resumeWait
	}
	if c.quota().Full {
		c.write.Unlock()
		return resumeRetry
	}
	type stale struct {
		work, name string
		data       []byte
	}
	var locks []stale
	for _, w := range works {
		switch name, data, state := bisyncLock(c.env, w); state {
		case lockHeld:
			c.write.Unlock()
			log("waiting", "lock_held")
			return resumeWait
		case lockForeign:
			c.write.Unlock()
			c.markResume(k, resumeFailed)
			log("failed", "lock_unverifiable")
			return resumeDone
		case lockStale:
			locks = append(locks, stale{w, name, data})
		}
	}
	runCtx, cancel := context.WithCancel(ctx)
	a := &attempt{id: c.now().UTC().Format("20060102T150405.000000000"), provider: k.provider, address: address, relogin: true, resume: true, state: "completing", syncing: true, cancel: cancel, until: c.now().Add(100 * 365 * 24 * time.Hour), existing: map[string]bool{address: true}, done: make(chan struct{})}
	c.relay.mu.Lock()
	c.relay.a = a
	c.relay.mu.Unlock()
	// A library already syncing shares the account's native config; its
	// client stops until the resumed pass ends, as for a chosen first pass.
	c.sync.stop(k)
	for _, l := range locks {
		if err := removeStaleLock(c.env, l.work, l.name, l.data); err != nil {
			c.finishResume(a, err)
			c.reconcile()
			c.write.Unlock()
			log("waiting", "lock_changed")
			return resumeWait
		}
	}
	c.write.Unlock()
	log("started", "interrupted_initial_sync")
	syncCtx := context.WithValue(runCtx, syncProgressKey{}, func(p SyncProgress) {
		c.setAttempt(a, func() { a.progress = &p })
	})
	err = e.resumeInitial(syncCtx, c.env, address, works)
	removed := c.finishResume(a, err)
	if ctx.Err() != nil || removed {
		return resumeDone
	}
	c.write.Lock()
	c.reconcile()
	c.write.Unlock()
	if err == nil {
		c.markResume(k, 0)
		log("completed", "interrupted_initial_sync")
		return resumeDone
	}
	// A provider that was unreachable (a boot before the network) is retried;
	// any other failure is the resume's own and is shown to the person.
	for _, s := range e.Check(ctx, c.env, address) {
		if s.State == StateUnreachable {
			c.markResume(k, resumeQueued)
			log("waiting", "unreachable")
			return resumeRetry
		}
	}
	c.markResume(k, resumeFailed)
	log("failed", "tool_failed")
	return resumeDone
}

// finishResume releases the relay slot and reports whether a removal of the
// account ended the pass. It never takes c.write: a removal holds it while it
// waits for done.
func (c *Catalog) finishResume(a *attempt, err error) bool {
	c.relay.mu.Lock()
	removed := a.discard
	if c.relay.a == a {
		c.relay.a = nil
	}
	if !finished(a.state) {
		a.state = "completed"
		if err != nil {
			a.state, a.failure = "failed", err
		}
	}
	c.relay.mu.Unlock()
	a.stop()
	close(a.done)
	return removed
}
