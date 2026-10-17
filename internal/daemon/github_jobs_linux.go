//go:build linux

package daemon

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/storagequota"
	"github.com/Open-Habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

const RepoClonesPath = "/api/v1/onboarding/github/clones"
const RepoCloneEventsPath = RepoClonesPath + "/events"

// A clone job belongs to the user's daemon, not to the HTTP request that
// started it: the browser subscribes to its progress and may leave and come
// back. Jobs live in this process's memory only. A daemon restart forgets
// them and the leftover directory is recognised from the filesystem as an
// interrupted clone (github_interrupted_linux.go); nothing restarts a clone
// by itself.
const (
	cloneJobLimit   = 16
	cloneJobCeiling = 45 * time.Minute
	// A subscription ends without a terminal frame before the frame or byte
	// bounds the browser and gateway enforce; the browser resubscribes.
	cloneEventFrames   = 2048
	cloneEventInterval = time.Second
	cloneHeartbeat     = 20 * time.Second
)

var cloneJobID = regexp.MustCompile(`^[0-9a-f]{32}$`)

// CloneJobs serves the clone-job routes of one daemon. The job context is the
// daemon's lifetime, so a job stops only on cancel, failure, its ceiling, or
// daemon shutdown.
type CloneJobs struct {
	ctx     context.Context
	cfg     transport.Config
	trusted func(*http.Request) bool
	home    string
	gh, git string
	run     cloneRunner
	budget  func(int) bool
	now     func() time.Time

	mu   sync.Mutex
	jobs []*cloneJob // newest first
}

// NewCloneJobs runs every gh and git as this daemon's own user in cfg.Home.
func NewCloneJobs(ctx context.Context, cfg transport.Config, trusted func(*http.Request) bool) *CloneJobs {
	return &CloneJobs{ctx: ctx, cfg: cfg, trusted: trusted, home: cfg.Home, gh: "/usr/bin/gh", git: "/usr/bin/git", run: cloneCommand, budget: boundedCloneVolume, now: time.Now}
}

// NewCloneJobsWithFixturePrograms is the offline integration seam. All
// filesystem and command homes belong to the disposable fixture, never cfg.Home,
// and quota admission is not consulted.
func NewCloneJobsWithFixturePrograms(ctx context.Context, cfg transport.Config, trusted func(*http.Request) bool, home, gh, git string) *CloneJobs {
	return &CloneJobs{ctx: ctx, cfg: cfg, trusted: trusted, home: home, gh: gh, git: git, run: func(ctx context.Context, program, _, fd string, args ...string) ([]byte, error) {
		return cloneCommand(ctx, program, home, fd, args...)
	}, budget: func(int) bool { return true }, now: time.Now}
}

type cloneJob struct {
	id, fullName, mode string
	started            time.Time
	cancel             context.CancelFunc
	userCancel         atomic.Bool

	mu      sync.Mutex
	state   cloneJobState
	changed chan struct{}
}

type cloneJobState struct {
	State    string // running, confirmed, failed, cancelled
	Stage    string
	Percent  *int
	Received *uint64
	Reason   string
	Leftover string
	Finished time.Time
}

func (j *cloneJob) snapshot() (cloneJobState, <-chan struct{}) {
	j.mu.Lock()
	defer j.mu.Unlock()
	return j.state, j.changed
}

func (j *cloneJob) update(change func(*cloneJobState)) {
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.state.State != "running" {
		return
	}
	change(&j.state)
	close(j.changed)
	j.changed = make(chan struct{})
}

func (j *cloneJob) stage(stage string) {
	j.update(func(s *cloneJobState) { s.Stage, s.Percent = stage, nil })
}

// progressMeasured makes the job a sink for parsed native progress. Only
// this job's own process writes it; subscribers read the latest state.
func (j *cloneJob) progressMeasured(stage string, percent int, received *uint64) bool {
	j.update(func(s *cloneJobState) {
		if s.Stage != stage {
			s.Received = nil
		}
		s.Stage = stage
		if percent >= 0 && percent <= 100 {
			p := percent
			s.Percent = &p
		}
		if received != nil {
			r := *received
			s.Received = &r
		}
	})
	return true
}

func (j *cloneJob) view(now cloneJobState) map[string]any {
	v := map[string]any{"job_id": j.id, "full_name": j.fullName, "mode": j.mode, "state": now.State, "started_at": j.started.UTC().Format(time.RFC3339)}
	if now.State == "running" {
		v["stage"] = now.Stage
		if now.Percent != nil {
			v["percent"] = *now.Percent
		}
		if now.Received != nil {
			v["received_bytes"] = *now.Received
		}
		return v
	}
	v["finished_at"] = now.Finished.UTC().Format(time.RFC3339)
	if now.State != "confirmed" {
		v["reason"], v["leftover"] = now.Reason, now.Leftover
	}
	return v
}

func (c *CloneJobs) find(id string) *cloneJob {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, j := range c.jobs {
		if j.id == id {
			return j
		}
	}
	return nil
}

// runningName is the destination name of the running job, if any.
func (c *CloneJobs) runningName() (string, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, j := range c.jobs {
		if s, _ := j.snapshot(); s.State == "running" {
			return strings.Split(j.fullName, "/")[1], true
		}
	}
	return "", false
}

// Handler serves GET (list) and POST (one action) on RepoClonesPath.
func (c *CloneJobs) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != RepoClonesPath || r.URL.EscapedPath() != RepoClonesPath || r.URL.RawQuery != "" || r.RequestURI != RepoClonesPath || r.Host != "unix" || r.ProtoMajor != 1 || r.ProtoMinor != 1 || len(r.TransferEncoding) != 0 {
			snapshotError(w, 400, "invalid_request")
			return
		}
		switch r.Method {
		case "GET":
			if r.ContentLength > 0 {
				snapshotError(w, 400, "invalid_request")
				return
			}
			if !historyAuthorized(c.cfg, c.trusted, r) {
				snapshotError(w, 403, "cross_user_denied")
				return
			}
			c.list(w, r)
		case "POST":
			if r.ContentLength < 1 || r.ContentLength > 256 {
				snapshotError(w, 400, "invalid_request")
				return
			}
			if !historyAuthorized(c.cfg, c.trusted, r) {
				snapshotError(w, 403, "cross_user_denied")
				return
			}
			body, err := io.ReadAll(io.LimitReader(r.Body, 257))
			var in struct {
				Action   string `json:"action"`
				FullName string `json:"full_name"`
				Mode     string `json:"mode"`
				JobID    string `json:"job_id"`
			}
			if err != nil || int64(len(body)) != r.ContentLength || !catalogNoDuplicates(body) || strictCloneJSON(body, &in) != nil || !validCloneAction(body, in.Action, in.FullName, in.Mode, in.JobID) {
				snapshotError(w, 400, "invalid_request")
				return
			}
			switch in.Action {
			case "start", "restart":
				c.start(w, r, in.FullName, in.Mode, in.Action == "restart")
			case "remove":
				c.remove(w, in.FullName)
			case "cancel":
				c.cancelJob(w, in.JobID)
			case "dismiss":
				c.dismiss(w, in.JobID)
			}
		default:
			snapshotError(w, 400, "invalid_request")
		}
	})
}

// validCloneAction admits exactly the request shapes of github-clone.schema.json.
func validCloneAction(body []byte, action, name, mode, id string) bool {
	var keys map[string]json.RawMessage
	if json.Unmarshal(body, &keys) != nil {
		return false
	}
	switch action {
	case "start", "restart":
		return len(keys) == 3 && validCloneName(name) && (mode == "full" || mode == "blobless") && id == ""
	case "remove":
		return len(keys) == 2 && validCloneName(name) && mode == "" && id == ""
	case "cancel", "dismiss":
		return len(keys) == 2 && cloneJobID.MatchString(id) && name == "" && mode == ""
	}
	return false
}

// busy answers a write refused because ~/src has another writer.
func (c *CloneJobs) busy(w http.ResponseWriter) {
	if _, running := c.runningName(); running {
		snapshotError(w, 409, "clone_running")
		return
	}
	snapshotError(w, 409, "checkout_unavailable")
}

// start admits one job. Admission runs within the request, so its refusals
// are ordinary errors; after the destination is reserved, the job owns the
// writer lock, the descriptors and the process until it settles.
func (c *CloneJobs) start(w http.ResponseWriter, r *http.Request, fullName, mode string, restart bool) {
	if !cloneWriter.TryLock() {
		c.busy(w)
		return
	}
	handedOff := false
	defer func() {
		if !handedOff {
			cloneWriter.Unlock()
		}
	}()
	parts := strings.Split(fullName, "/")
	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()
	identity, err := c.run(ctx, c.gh, c.home, "", "api", "--method", "GET", "/user")
	var user struct {
		ID json.Number `json:"id"`
	}
	if err != nil || strictRepoJSON(identity, &user) != nil || string(user.ID) != c.cfg.Subject {
		snapshotError(w, 409, "github_auth_unavailable")
		return
	}
	raw, err := c.run(ctx, c.gh, c.home, "", "api", "--method", "GET", "/repos/"+fullName)
	var repo struct {
		Name     string `json:"name"`
		FullName string `json:"full_name"`
		CloneURL string `json:"clone_url"`
		Owner    struct {
			Login string `json:"login"`
		} `json:"owner"`
	}
	if err != nil || strictRepoJSON(raw, &repo) != nil || repo.Owner.Login != parts[0] || repo.Name != parts[1] || repo.FullName != fullName || repo.CloneURL != "https://github.com/"+fullName+".git" {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	src, err := cloneSource(c.cfg, c.home, true)
	if err != nil {
		snapshotError(w, 409, "checkout_unavailable")
		return
	}
	srcOwned := true
	defer func() {
		if srcOwned {
			unix.Close(src)
		}
	}()
	if restart {
		child, e := dir(unix.Openat2, src, parts[1], true)
		if e != nil {
			snapshotError(w, 409, "not_interrupted")
			return
		}
		_, interrupted := interruptedClone(ctx, c.home, c.git, c.run, c.cfg.UID, child, parts[1], fullName)
		removed := interrupted && removeCreated(c.ctx, src, child, parts[1])
		unix.Close(child)
		if !interrupted {
			snapshotError(w, 409, "not_interrupted")
			return
		}
		if !removed {
			snapshotError(w, 409, "interrupted_remaining")
			return
		}
	}
	srcMode, modeErr := stat(src)
	if modeErr != nil || srcMode.Mode&0777 != 0700 || !c.budget(src) || ctx.Err() != nil {
		// Only report quota_full when a fresh native read confirms it.
		// All other admission errors stay generic: an unreadable quota,
		// unsafe source or cancellation does not establish fullness.
		var homeStat unix.Stat_t
		if ctx.Err() == nil && modeErr == nil && srcMode.Mode&0777 == 0700 && srcMode.Uid == uint32(os.Geteuid()) && unix.Stat("/home", &homeStat) == nil && srcMode.Dev == homeStat.Dev {
			if q, err := storagequota.Read(uint32(os.Geteuid())); err == nil && q.Usage >= q.Limit {
				snapshotError(w, 409, "quota_full")
				return
			}
		}
		snapshotError(w, 409, "checkout_unavailable")
		return
	}
	// GitHub repo names are case insensitive. Never conflate an existing tree
	// (including a partial prior attempt) with a successful import.
	conflict := false
	if eachSourceEntry(src, func(entry os.DirEntry) {
		if strings.EqualFold(entry.Name(), parts[1]) {
			conflict = true
		}
	}) != nil {
		snapshotError(w, 409, "checkout_unavailable")
		return
	}
	if conflict {
		snapshotError(w, 409, "checkout_exists")
		return
	}
	if ctx.Err() != nil {
		snapshotError(w, 409, "checkout_uncertain")
		return
	}
	if unix.Mkdirat(src, parts[1], 0700) != nil {
		snapshotError(w, 409, "checkout_exists")
		return
	}
	child, e := dir(unix.Openat2, src, parts[1], true)
	initial, e2 := stat(child)
	if e != nil || e2 != nil || initial.Uid != uint32(c.cfg.UID) {
		if e == nil {
			unix.Close(child)
		}
		snapshotError(w, 409, "checkout_uncertain")
		return
	}
	srcInitial, _ := stat(src)
	id := make([]byte, 16)
	if _, err := rand.Read(id); err != nil {
		removeCreated(c.ctx, src, child, parts[1])
		unix.Close(child)
		snapshotError(w, 503, "checkout_unavailable")
		return
	}
	jobCtx, jobCancel := context.WithTimeout(c.ctx, cloneJobCeiling)
	job := &cloneJob{id: hex.EncodeToString(id), fullName: fullName, mode: mode, started: c.now(), cancel: jobCancel, state: cloneJobState{State: "running", Stage: "reserving"}, changed: make(chan struct{})}
	c.mu.Lock()
	kept := []*cloneJob{job}
	for _, old := range c.jobs {
		if len(kept) < cloneJobLimit {
			kept = append(kept, old)
		}
	}
	c.jobs = kept
	c.mu.Unlock()
	handedOff, srcOwned = true, false
	go c.runJob(jobCtx, job, src, child, srcInitial, parts[1], repo.CloneURL)
	now, _ := job.snapshot()
	historyJSON(w, map[string]any{"schema_version": 1, "job": job.view(now)})
}

// runJob owns cloneWriter, src and child from start until it settles. The
// final state is published only after they are released, so a terminal job
// never refuses the next start as busy.
func (c *CloneJobs) runJob(ctx context.Context, job *cloneJob, src, child int, srcInitial unix.Stat_t, name, cloneURL string) {
	state, reason, leftover := c.clone(ctx, job, src, child, srcInitial, name, cloneURL)
	job.cancel()
	unix.Close(child)
	unix.Close(src)
	cloneWriter.Unlock()
	c.finish(job, state, reason, leftover)
}

func (c *CloneJobs) clone(ctx context.Context, job *cloneJob, src, child int, srcInitial unix.Stat_t, name, cloneURL string) (string, string, string) {
	job.stage("connecting")
	// An open cwd, not a pathname, pins Git inside the reserved destination.
	err := cloneProgressCommand(ctx, c.git, c.home, child, cloneURL, job.mode, job)
	reason := cloneReason(err)
	if err == nil {
		job.stage("verifying")
		if !c.verify(ctx, src, child, srcInitial, name, cloneURL) {
			reason = "verification_failed"
		}
	}
	if reason == "" && ctx.Err() == nil {
		return "confirmed", "", ""
	}
	if reason == "" {
		reason = cloneReason(ctx.Err())
	}
	// A stopping daemon keeps the directory: after the restart it is an
	// interrupted clone the person explicitly removes or starts again.
	if c.ctx.Err() != nil && !job.userCancel.Load() {
		return "failed", "daemon_stopping", "kept"
	}
	state := "failed"
	if job.userCancel.Load() {
		state, reason = "cancelled", "cancelled"
	}
	leftover := "kept"
	if removeCreated(context.Background(), src, child, name) {
		leftover = "removed"
	}
	return state, reason, leftover
}

func (c *CloneJobs) finish(job *cloneJob, state, reason, leftover string) {
	job.update(func(s *cloneJobState) {
		s.State, s.Reason, s.Leftover, s.Finished = state, reason, leftover, c.now()
	})
}

// verify establishes the checkout natively: the expected repository and
// origin, a clean work tree and a HEAD commit, still at the reserved name.
func (c *CloneJobs) verify(ctx context.Context, src, child int, srcInitial unix.Stat_t, name, cloneURL string) bool {
	initial, e := stat(child)
	if e != nil {
		return false
	}
	gd, e := dir(unix.Openat2, child, ".git", true)
	if e != nil {
		return false
	}
	unix.Close(gd)
	fd := strconv.Itoa(child)
	top, e1 := c.run(ctx, c.git, c.home, fd, "rev-parse", "--is-inside-work-tree")
	remote, e2 := c.run(ctx, c.git, c.home, fd, "remote", "get-url", "origin")
	status, e3 := c.run(ctx, c.git, c.home, fd, "status", "--porcelain")
	head, e5 := c.run(ctx, c.git, c.home, fd, "rev-parse", "--verify", "HEAD^{commit}")
	named, e4 := dir(unix.Openat2, src, name, true)
	var now unix.Stat_t
	if e4 == nil {
		now, e4 = stat(named)
		unix.Close(named)
	}
	return e1 == nil && e2 == nil && e3 == nil && e4 == nil && e5 == nil && validCloneCommit(head) && cloneSourceStillNamed(c.home, srcInitial) && same(initial, now) && string(top) == "true\n" && string(remote) == cloneURL+"\n" && len(status) == 0 && ctx.Err() == nil
}

// cancelJob stops a running job and waits briefly for it to settle, so the
// reply usually already says whether its directory was removed.
func (c *CloneJobs) cancelJob(w http.ResponseWriter, id string) {
	job := c.find(id)
	if job == nil {
		snapshotError(w, 404, "job_not_found")
		return
	}
	now, changed := job.snapshot()
	if now.State == "running" {
		job.userCancel.Store(true)
		job.cancel()
		deadline := time.NewTimer(10 * time.Second)
		defer deadline.Stop()
		for now.State == "running" {
			select {
			case <-changed:
			case <-deadline.C:
				historyJSON(w, map[string]any{"schema_version": 1, "job": job.view(now)})
				return
			}
			now, changed = job.snapshot()
		}
	}
	historyJSON(w, map[string]any{"schema_version": 1, "job": job.view(now)})
}

func (c *CloneJobs) dismiss(w http.ResponseWriter, id string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for i, j := range c.jobs {
		if j.id != id {
			continue
		}
		if s, _ := j.snapshot(); s.State == "running" {
			snapshotError(w, 409, "job_running")
			return
		}
		c.jobs = append(c.jobs[:i:i], c.jobs[i+1:]...)
		historyJSON(w, map[string]any{"schema_version": 1, "state": "dismissed", "job_id": id})
		return
	}
	snapshotError(w, 404, "job_not_found")
}

// remove deletes the interrupted clone of fullName: the daemon itself
// recognises ~/src/<name> as one before touching it.
func (c *CloneJobs) remove(w http.ResponseWriter, fullName string) {
	if !cloneWriter.TryLock() {
		c.busy(w)
		return
	}
	defer cloneWriter.Unlock()
	name := strings.Split(fullName, "/")[1]
	src, err := cloneSource(c.cfg, c.home, false)
	if err != nil {
		snapshotError(w, 409, "not_interrupted")
		return
	}
	defer unix.Close(src)
	child, err := dir(unix.Openat2, src, name, true)
	if err != nil {
		snapshotError(w, 409, "not_interrupted")
		return
	}
	defer unix.Close(child)
	ctx, cancel := context.WithTimeout(c.ctx, 30*time.Second)
	defer cancel()
	if _, ok := interruptedClone(ctx, c.home, c.git, c.run, c.cfg.UID, child, name, fullName); !ok {
		snapshotError(w, 409, "not_interrupted")
		return
	}
	state := "partial"
	if removeCreated(c.ctx, src, child, name) {
		state = "removed"
	}
	historyJSON(w, map[string]any{"schema_version": 1, "state": state, "full_name": fullName})
}

// list reports the jobs and the interrupted clones under ~/src. It reads
// without the writer lock; the running job's own directory is skipped.
func (c *CloneJobs) list(w http.ResponseWriter, r *http.Request) {
	c.mu.Lock()
	jobs := make([]map[string]any, 0, len(c.jobs))
	for _, j := range c.jobs {
		now, _ := j.snapshot()
		jobs = append(jobs, j.view(now))
	}
	c.mu.Unlock()
	running, _ := c.runningName()
	interrupted := []map[string]any{}
	complete := true
	src, err := cloneSource(c.cfg, c.home, false)
	if errors.Is(err, unix.ENOENT) {
		historyJSON(w, map[string]any{"schema_version": 1, "jobs": jobs, "interrupted": interrupted, "interrupted_complete": true})
		return
	}
	if err != nil {
		historyJSON(w, map[string]any{"schema_version": 1, "jobs": jobs, "interrupted": interrupted, "interrupted_complete": false})
		return
	}
	defer unix.Close(src)
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	names := []string{}
	if eachSourceEntry(src, func(entry os.DirEntry) {
		if entry.IsDir() || entry.Type() == 0 {
			names = append(names, entry.Name())
		}
	}) != nil {
		complete = false
	}
	for _, name := range names {
		if name == running || !repoName.MatchString(name) || name == "." || name == ".." {
			continue
		}
		child, err := dir(unix.Openat2, src, name, true)
		if err != nil {
			continue
		}
		owner, ok := interruptedCloneOwner(unix.Openat2, child, name)
		if ok {
			if len(interrupted) == 64 || ctx.Err() != nil {
				complete = false
			} else if size, ok := interruptedClone(ctx, c.home, c.git, c.run, c.cfg.UID, child, name, owner+"/"+name); ok {
				interrupted = append(interrupted, map[string]any{"full_name": owner + "/" + name, "size_bytes": size})
			}
		}
		unix.Close(child)
	}
	historyJSON(w, map[string]any{"schema_version": 1, "jobs": jobs, "interrupted": interrupted, "interrupted_complete": complete})
}

// cloneEventFrame is one github-clone-progress.schema.json frame.
type cloneEventFrame struct {
	SchemaVersion int     `json:"schema_version"`
	Sequence      int     `json:"sequence"`
	JobID         string  `json:"job_id"`
	Kind          string  `json:"kind"`
	Stage         string  `json:"stage,omitempty"`
	Percent       *int    `json:"percent,omitempty"`
	ReceivedBytes *uint64 `json:"received_bytes,omitempty"`
	Outcome       string  `json:"outcome,omitempty"`
	Reason        string  `json:"reason,omitempty"`
	Leftover      string  `json:"leftover,omitempty"`
}

// Events streams one job. Each subscription starts with the job's current
// state; closing it leaves the job running.
func (c *CloneJobs) Events() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" || r.URL.Path != RepoCloneEventsPath || r.URL.EscapedPath() != RepoCloneEventsPath || r.Host != "unix" || r.ProtoMajor != 1 || r.ProtoMinor != 1 || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
			snapshotError(w, 400, "invalid_request")
			return
		}
		q, err := url.ParseQuery(r.URL.RawQuery)
		id := q.Get("job_id")
		if err != nil || len(q) != 1 || len(q["job_id"]) != 1 || !cloneJobID.MatchString(id) || r.RequestURI != RepoCloneEventsPath+"?job_id="+id {
			snapshotError(w, 400, "invalid_request")
			return
		}
		if !historyAuthorized(c.cfg, c.trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		job := c.find(id)
		if job == nil {
			snapshotError(w, 404, "job_not_found")
			return
		}
		flusher, ok := w.(http.Flusher)
		if !ok {
			snapshotError(w, 503, "checkout_unavailable")
			return
		}
		w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.WriteHeader(200)
		controller := http.NewResponseController(w)
		sequence := 0
		send := func(f cloneEventFrame) bool {
			sequence++
			f.SchemaVersion, f.Sequence, f.JobID = 1, sequence, job.id
			b, _ := json.Marshal(f)
			if err := controller.SetWriteDeadline(time.Now().Add(10 * time.Second)); err != nil && !errors.Is(err, http.ErrNotSupported) {
				return false
			}
			if _, err := io.WriteString(w, "event: "+f.Kind+"\ndata: "+string(b)+"\n\n"); err != nil {
				return false
			}
			flusher.Flush()
			return true
		}
		heartbeat := time.NewTicker(cloneHeartbeat)
		defer heartbeat.Stop()
		var last time.Time
		for sequence < cloneEventFrames {
			now, changed := job.snapshot()
			if now.State != "running" {
				send(cloneEventFrame{Kind: "terminal", Outcome: now.State, Reason: now.Reason, Leftover: now.Leftover})
				return
			}
			if !send(cloneEventFrame{Kind: "progress", Stage: now.Stage, Percent: now.Percent, ReceivedBytes: now.Received}) {
				return
			}
			last = time.Now()
			select {
			case <-r.Context().Done():
				return
			case <-heartbeat.C:
				continue
			case <-changed:
			}
			// Coalesce native progress to at most one frame a second; a
			// terminal state is never held back.
			for {
				s, ch := job.snapshot()
				remaining := time.Until(last.Add(cloneEventInterval))
				if s.State != "running" || remaining <= 0 {
					break
				}
				t := time.NewTimer(remaining)
				select {
				case <-r.Context().Done():
					t.Stop()
					return
				case <-ch:
					t.Stop()
					continue
				case <-t.C:
				}
				break
			}
		}
	})
}

// observeRunning reports whether name's destination is this daemon's running job.
func (c *CloneJobs) observeRunning(fullName string) bool {
	running, ok := c.runningName()
	return ok && strings.EqualFold(running, strings.Split(fullName, "/")[1])
}
