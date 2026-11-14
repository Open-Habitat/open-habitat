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

// resumableEntry is a SyncEntry whose interrupted first pass can run again.
type resumableEntry interface {
	SyncEntry
	// interruptedPasses lists the home-relative bisync work directories of
	// the account whose chosen first pass was stopped before committing.
	interruptedPasses(env Env, address string) []string
	// resumeInitial runs those first passes again with the original choice,
	// each only while its work directory still shows the stopped pass.
	resumeInitial(ctx context.Context, env Env, address string, works []string) error
	// passService is the service whose files a work directory syncs.
	passService(work string) string
}

// resumeMark is the daemon's transient view of a resume, never persisted.
type resumeMark int

// resumeNote is the mark of one account and the services whose first pass
// was stopped.
type resumeNote struct {
	mark     resumeMark
	services map[string]bool
}

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
	lockAbsent  lockState = iota
	lockStale             // nobody holds it, and no other rclone could take it over
	lockExpired           // nobody holds it; rclone itself takes over an expired lock
	lockHeld              // a process uses the pair, or it cannot be proved otherwise
	lockForeign
)

// lockMargin keeps a lock that is about to expire from being judged either
// way: rclone might take it over during the decision.
const lockMargin = 15 * time.Second

// bisyncLock decides what may be done with the lock of an interrupted work
// directory. Any visible process that names the work directory, or a live
// process at the lock's PID that could be rclone, holds the pair even when no
// lock file is there. A lock nobody holds may be removed only while no other
// rclone could take it over, which rclone does only for an expired lock: an
// unexpired or unreadable lock is stale, an expired one is left to rclone. A
// live lock is never removed. data is the lock as read, so removal can refuse
// a lock that changed since.
func bisyncLock(env Env, work string, now time.Time) (name string, data []byte, state lockState) {
	names, fd, err := listHomeDir(env.Home, work)
	if err != nil || fd < 0 {
		return "", nil, lockAbsent
	}
	defer unix.Close(fd)
	abs := filepath.Join(env.Home, work)
	for _, n := range names {
		if strings.HasSuffix(n, ".lck") {
			name = n
		}
	}
	if name == "" {
		if processUses(abs, 0) {
			return "", nil, lockHeld
		}
		return "", nil, lockAbsent
	}
	data, err = readFileAt(fd, name, 4096)
	if err != nil {
		return name, nil, lockForeign
	}
	pid := 0
	var lock struct {
		Session     string    `json:"Session"`
		PID         string    `json:"PID"`
		TimeExpires time.Time `json:"TimeExpires"`
	}
	// A pass killed while writing its lock leaves it empty or truncated;
	// rclone never takes such a lock over. A readable lock must be ours.
	parsed := json.Unmarshal(data, &lock) == nil
	if parsed {
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
	switch {
	case !parsed || lock.TimeExpires.IsZero() || lock.TimeExpires.After(now.Add(lockMargin)):
		return name, data, lockStale
	case lock.TimeExpires.Before(now.Add(-lockMargin)):
		return name, data, lockExpired
	}
	return name, data, lockHeld
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

// removeLock unlinks a lock bisyncLock judged, unless it changed since.
func removeLock(env Env, work, name string, data []byte) error {
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

// forgetInterruptedPasses makes the account's stopped first passes
// unresumable. A pass the person cancelled, or one that failed on its own,
// waits for the person's next choice; only a daemon stop leaves a pass to
// resume. The uncommitted new listings go, and a lock nobody holds with them.
func forgetInterruptedPasses(env Env, e resumableEntry, address string) {
	for _, work := range e.interruptedPasses(env, address) {
		name, data, state := bisyncLock(env, work, time.Now())
		if state == lockHeld || state == lockForeign {
			continue
		}
		if name != "" && removeLock(env, work, name, data) != nil {
			continue
		}
		names, fd, err := listHomeDir(env.Home, work)
		if err != nil || fd < 0 {
			continue
		}
		for _, n := range names {
			if strings.HasSuffix(n, ".lst-new") {
				_ = unix.Unlinkat(fd, n, 0)
			}
		}
		unix.Close(fd)
	}
}

type pendingResume struct {
	entry     resumableEntry
	address   string
	delay     time.Duration
	notBefore time.Time
}

// interruptedQueue lists, once per daemon start, the accounts whose first
// pass a stop interrupted, and marks them queued. The caller holds c.write.
func (c *Catalog) interruptedQueue() []*pendingResume {
	var queue []*pendingResume
	accounts, _ := c.accounts()
	for _, a := range accounts {
		if e, ok := a.entry.(resumableEntry); ok && e.Available(c.env) && len(e.interruptedPasses(c.env, a.address)) > 0 {
			queue = append(queue, &pendingResume{entry: e, address: a.address, delay: c.resumeFirst})
			services := map[string]bool{}
			for _, w := range e.interruptedPasses(c.env, a.address) {
				services[e.passService(w)] = true
			}
			c.relay.mu.Lock()
			if c.relay.resume == nil {
				c.relay.resume = map[key]resumeNote{}
			}
			c.relay.resume[key{e.Provider(), a.address}] = resumeNote{resumeQueued, services}
			c.relay.mu.Unlock()
		}
	}
	return queue
}

// resumeInterrupted resumes the queued first passes, one pass at a time. An
// account that must wait does not hold up the others. ctx ends with the
// daemon.
func (c *Catalog) resumeInterrupted(ctx context.Context, queue []*pendingResume) {
	for len(queue) > 0 && ctx.Err() == nil {
		next := queue[:0]
		wake := time.Now().Add(c.resumeMax)
		for _, p := range queue {
			if now := time.Now(); now.Before(p.notBefore) {
				next = append(next, p)
				wake = minTime(wake, p.notBefore)
				continue
			}
			switch c.tryResume(ctx, p.entry, p.address) {
			case resumeDone:
				continue
			case resumeWait:
				p.notBefore = time.Now().Add(c.resumePoll)
			case resumeRetry:
				p.notBefore = time.Now().Add(p.delay)
				p.delay = min(2*p.delay, c.resumeMax)
			}
			next = append(next, p)
			wake = minTime(wake, p.notBefore)
		}
		queue = next
		if len(queue) == 0 {
			return
		}
		select {
		case <-ctx.Done():
		case <-time.After(time.Until(wake)):
		}
	}
}

func minTime(a, b time.Time) time.Time {
	if b.Before(a) {
		return b
	}
	return a
}

func (c *Catalog) markResume(k key, mark resumeMark) {
	c.relay.mu.Lock()
	defer c.relay.mu.Unlock()
	if mark == 0 {
		delete(c.relay.resume, k)
		return
	}
	if note, ok := c.relay.resume[k]; ok {
		note.mark = mark
		c.relay.resume[k] = note
	}
}

type resumeOutcome int

const (
	resumeDone  resumeOutcome = iota
	resumeWait                // another process or login holds the account
	resumeRetry               // the provider or the home could not take it yet
)

// filesFree reports whether the relay may take a resumed first pass: no
// sign-in of a provider that copies files is running, and the last one's
// worker has finished its cleanup. The caller holds relay.mu.
func (c *Catalog) filesFree() bool {
	for p, a := range c.relay.attempts {
		if !c.copiesFiles(p) {
			continue
		}
		if !finished(a.state) {
			return false
		}
		select {
		case <-a.done:
		default:
			return false
		}
	}
	return true
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
	busy := !c.filesFree()
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
		switch name, data, state := bisyncLock(c.env, w, c.now()); state {
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
	// A process that finished the pass between the first look and the lock
	// check has committed its listings: that pair is no longer a first pass.
	for _, w := range works {
		if !interruptedResync(c.env, w) {
			c.write.Unlock()
			return resumeWait
		}
	}
	runCtx, cancel := context.WithCancel(ctx)
	a := &attempt{id: c.now().UTC().Format("20060102T150405.000000000"), provider: k.provider, address: address, relogin: true, resume: true, state: "completing", syncing: true, cancel: cancel, until: c.now().Add(100 * 365 * 24 * time.Hour), existing: map[string]bool{address: true}, done: make(chan struct{})}
	// startLogin does not take c.write: claim the place only if it is still free.
	c.relay.mu.Lock()
	if !c.filesFree() {
		c.relay.mu.Unlock()
		c.write.Unlock()
		cancel()
		return resumeWait
	}
	c.relay.put(a)
	c.relay.mu.Unlock()
	// A library already syncing shares the account's native config; its
	// client stops until the resumed pass ends, as for a chosen first pass.
	c.sync.stop(k)
	for _, l := range locks {
		if err := removeLock(c.env, l.work, l.name, l.data); err != nil {
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
	// any other failure is the resume's own and is shown to the person. Like
	// a chosen pass that failed, it then waits for the person's next choice.
	for _, s := range e.Check(ctx, c.env, address) {
		if s.State == StateUnreachable {
			c.markResume(k, resumeQueued)
			log("waiting", "unreachable")
			return resumeRetry
		}
	}
	c.write.Lock()
	forgetInterruptedPasses(c.env, e, address)
	c.write.Unlock()
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
	if c.relay.holds(a) {
		delete(c.relay.attempts, a.provider)
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

// resumeView applies the daemon's resume outcome to the services whose first
// pass was stopped. The tool alone sees only an unready or unknown pair.
// Concrete states (rejected login, unreachable, full) stand.
func resumeView(note resumeNote, services []Service) {
	if note.mark == 0 {
		return
	}
	for i := range services {
		s := &services[i]
		open := s.State == StateUnknown || s.State == StateOK || (s.State == StateSyncFailed && s.Failure == InitialSyncIncomplete)
		if !note.services[s.ID] || !open {
			continue
		}
		if note.mark == resumeQueued {
			s.State, s.Failure = StateSyncing, ""
		} else {
			s.State, s.Failure = StateSyncFailed, InitialSyncResumeFailed
		}
	}
}
