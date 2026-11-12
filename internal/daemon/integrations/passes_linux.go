//go:build linux

package integrations

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/sys/unix"
)

// Fixed reasons a steady sync pass failed. They are classified from bounded
// rclone diagnostics inside the daemon; the diagnostics never cross it.
const (
	// DeleteLimit is bisync's --max-delete safety abort: a pass would have
	// deleted more than the limit, so nothing syncs until someone looks.
	DeleteLimit = "delete_limit"
	// NeedsResync is a critical bisync abort that only an explicit --resync
	// recovers from. The daemon never resyncs on its own.
	NeedsResync = "needs_resync"
	// AllChanged is bisync's safety abort for a pass in which every entry
	// of a side's previous listing changed or went away, typically an agent
	// that edited each file of a flat folder. The loop resumes such a pass
	// itself, once, behind a fresh deletion check (syncLoop, forced).
	AllChanged = "all_changed"
	// RemoteUnreachable is a pass that could not reach the provider.
	RemoteUnreachable = "remote_unreachable"
	// PassFailed is any other failed pass.
	PassFailed = "pass_failed"
)

// syncPass is one native bisync invocation of a supervised loop. Work is its
// home-relative working directory, where rclone commits the pass's listings.
// Done is set for a mirror pass: the absolute marker the loop writes after
// the pass succeeds (mirrorDone).
type syncPass struct {
	Work string
	Cmd  Command
	Done string
}

// bisyncCommand is one steady two-way pass between the home-relative dir and
// remote, the same for every provider. bisync's safeguards stay on: a pass
// that would delete more than half of a side's files, or in which every file
// changed, aborts instead of propagating.
//
// On a conflict the cloud version wins its own name on both sides and the
// local version is renamed Name.habitat-YYYY-MM-DD-N.ext and uploaded beside
// it, as Microsoft's own client does. Renaming both copies instead would take
// the colleague's file away from its name, links and version history in the
// cloud, and a suffix after the extension stops the copy from opening.
func bisyncCommand(base Command, env Env, dir, remote, work string) Command {
	base.Args = append(base.Args, "bisync", filepath.Join(env.Home, dir), remote, "--workdir", filepath.Join(env.Home, work),
		"--resilient", "--recover", "--max-lock", "2m", "--max-delete", "50",
		"--conflict-resolve", "path2", "--conflict-loser", "num", "--conflict-suffix", "habitat-{DateOnly}-", "--suffix-keep-extension",
		"--create-empty-src-dirs", "--refresh-times", "--compare", "size,modtime")
	return base
}

// forceEnv names, for one start of a loop, the passes whose latest attempt
// ended in bisync's all-files-changed abort (passObserver.forced).
const forceEnv = "OPEN_HABITAT_FORCE"

// syncInterval is the pause between successful rounds of passes; tests
// shorten it.
var syncInterval = 60 * time.Second

// syncLoop repeats the passes one after another every minute and exits when
// any of them failed, leaving the backoff to the supervisor. Passes share a
// native config (rclone may refresh its token), so they never run
// concurrently. Before and after each pass the loop writes its own marker
// line on stderr, so the daemon can tell which pass rclone's JSON stats and
// diagnostics belong to and how the pass ended.
//
// In the first round after a start, a bisync pass named in $OPEN_HABITAT_FORCE
// runs with --force, which skips both of bisync's safety aborts, only if a
// dry run immediately before it still stops on every file having changed
// and not on too many deletes. bisync checks deletions before changes, so
// the forced pass keeps the mass-deletion safeguard up to the seconds
// between the two listings, and a real mass deletion still stops the pass.
// An edit is never lost to a forced pass either: a file changed on both
// sides is a conflict (bisyncCommand) and a changed file is never deleted.
func syncLoop(passes []syncPass) Command {
	quote := func(s string) string { return "'" + strings.ReplaceAll(s, "'", "'\\''") + "'" }
	var script strings.Builder
	script.WriteString("while true; do failed=0; ")
	work := make([]string, 0, len(passes))
	for i, p := range passes {
		var cmd strings.Builder
		cmd.WriteString(quote(p.Cmd.Path))
		for _, a := range p.Cmd.Args {
			cmd.WriteString(" " + quote(a))
		}
		fmt.Fprintf(&script, `printf '{"open_habitat_pass":%d}\n' >&2; f=; `, i)
		if p.Done == "" {
			// The dry run's own output is read here and discarded, never
			// reaching the daemon; the shell keeps no more than one line.
			fmt.Fprintf(&script, `case " $%s " in *" %d "*) f=$(%s --dry-run 2>&1 >/dev/null | { v=; while IFS= read -r l; do case $l in *"too many deletes"*) v=no;; *"all files were changed"*) v=${v:-yes};; esac; done; [ "$v" != yes ] || echo --force; });; esac; `, forceEnv, i, cmd.String())
		}
		script.WriteString(cmd.String())
		for _, a := range []string{"--use-json-log", "--stats", "1s", "--stats-log-level", "NOTICE"} {
			script.WriteString(" " + quote(a))
		}
		script.WriteString(" $f; rc=$?; ")
		if p.Done != "" {
			script.WriteString(`[ "$rc" -ne 0 ] || : > ` + quote(p.Done) + " || rc=1; ")
		}
		fmt.Fprintf(&script, `printf '{"open_habitat_pass":%d,"exit":%%d}\n' "$rc" >&2; [ "$rc" -eq 0 ] || failed=1; `, i)
		work = append(work, p.Work)
	}
	fmt.Fprintf(&script, `%s=; [ "$failed" -eq 0 ] || exit 1; sleep %g; done`, forceEnv, syncInterval.Seconds())
	return Command{Path: "/bin/sh", Args: []string{"-c", script.String()}, Passes: work}
}

// passState is what the daemon currently knows about one pass of a
// supervised loop. It is transient process observation: a daemon restart
// forgets it and the next pass establishes it again.
type passState struct {
	Running  bool
	Progress SyncProgress
	// Failure is the fixed reason the latest finished pass failed, cleared
	// by the next successful pass.
	Failure string
}

// passObserver follows a supervised loop's stderr across restarts of the
// loop, so a failure stays visible while the supervisor backs off.
type passObserver struct {
	mu     sync.Mutex
	work   []string
	passes []passState
}

func newPassObserver(work []string) *passObserver {
	return &passObserver{work: work, passes: make([]passState, len(work))}
}

// snapshot returns the state of each pass keyed by its working directory.
func (o *passObserver) snapshot() map[string]passState {
	o.mu.Lock()
	defer o.mu.Unlock()
	out := make(map[string]passState, len(o.work))
	for i, w := range o.work {
		out[w] = o.passes[i]
	}
	return out
}

// forced lists, for forceEnv, the indices of the passes whose latest attempt
// ended in bisync's all-files-changed abort. A pass resumed this way finishes
// with another outcome, so each abort is resumed once.
func (o *passObserver) forced() string {
	o.mu.Lock()
	defer o.mu.Unlock()
	var out []string
	for i, p := range o.passes {
		if p.Failure == AllChanged {
			out = append(out, strconv.Itoa(i))
		}
	}
	return strings.Join(out, " ")
}

// output returns the stderr sink for one run of the loop.
func (o *passObserver) output() *passOutput {
	return &passOutput{observer: o, current: -1}
}

// passOutput reads one run's stderr line by line. Like statsOutput it keeps
// at most one small line, discards oversized ones and never retains text.
type passOutput struct {
	observer  *passObserver
	line      []byte
	oversized bool
	current   int
	started   time.Time
	reason    string
}

func (w *passOutput) Write(data []byte) (int, error) {
	for _, b := range data {
		if b == '\n' {
			if !w.oversized {
				w.event()
			}
			w.line, w.oversized = w.line[:0], false
		} else if len(w.line) < 16384 && !w.oversized {
			w.line = append(w.line, b)
		} else {
			w.oversized = true
		}
	}
	return len(data), nil
}

func (w *passOutput) event() {
	var e struct {
		Pass  *int   `json:"open_habitat_pass"`
		Exit  *int   `json:"exit"`
		Level string `json:"level"`
		Msg   string `json:"msg"`
		Stats *struct {
			Bytes          uint64 `json:"bytes"`
			TotalBytes     uint64 `json:"totalBytes"`
			Transfers      uint64 `json:"transfers"`
			TotalTransfers uint64 `json:"totalTransfers"`
		} `json:"stats"`
	}
	if json.Unmarshal(w.line, &e) != nil {
		return
	}
	o := w.observer
	o.mu.Lock()
	defer o.mu.Unlock()
	switch {
	case e.Pass != nil:
		i := *e.Pass
		if i < 0 || i >= len(o.passes) {
			return
		}
		if e.Exit == nil {
			w.current, w.started, w.reason = i, time.Now(), ""
			o.passes[i].Running, o.passes[i].Progress = true, SyncProgress{Phase: "preparing"}
			return
		}
		if i != w.current {
			return
		}
		w.finish(*e.Exit)
	case w.current < 0:
	case e.Stats != nil:
		s := e.Stats
		if s.Bytes > maxSyncBytes || s.TotalBytes > maxSyncBytes || s.Transfers > maxSyncBytes || s.TotalTransfers > maxSyncBytes {
			return
		}
		phase := "preparing"
		if s.TotalBytes > 0 || s.TotalTransfers > 0 {
			phase = "transferring"
		}
		o.passes[w.current].Progress = SyncProgress{Phase: phase, ElapsedSeconds: uint64(max(0, time.Since(w.started).Seconds())), Bytes: s.Bytes, TotalBytes: s.TotalBytes, Files: s.Transfers, TotalFiles: s.TotalTransfers}
	case e.Level == "error" || e.Level == "critical":
		if r := passFailure(e.Msg); rank(r) > rank(w.reason) {
			w.reason = r
		}
	}
}

// finish records how the current pass ended. The caller holds the lock.
func (w *passOutput) finish(code int) {
	p := &w.observer.passes[w.current]
	p.Running, p.Progress = false, SyncProgress{}
	if code == 0 {
		p.Failure = ""
	} else if w.reason != "" {
		p.Failure = w.reason
	} else {
		// rclone's exit codes do not say why (2 is a usage error, 7 also
		// covers retryable resilient aborts), so only messages classify.
		p.Failure = PassFailed
	}
	w.current = -1
}

// exited is called when the loop's process has exited. A pass that never
// wrote its end marker died with it; unless the daemon stopped it on
// purpose, that is a failed pass.
func (w *passOutput) exited(stopped bool) {
	o := w.observer
	o.mu.Lock()
	defer o.mu.Unlock()
	if w.current < 0 {
		return
	}
	if stopped {
		o.passes[w.current].Running, o.passes[w.current].Progress = false, SyncProgress{}
		w.current = -1
		return
	}
	w.finish(1)
}

// passFailure classifies one rclone error message by fixed substrings. The
// message itself is discarded.
func passFailure(msg string) string {
	m := strings.ToLower(msg)
	switch {
	case strings.Contains(m, "too many deletes"):
		return DeleteLimit
	case strings.Contains(m, "must run --resync"), strings.Contains(m, "cannot find prior path1 or path2 listings"):
		return NeedsResync
	case strings.Contains(m, "all files were changed"):
		return AllChanged
	}
	for _, s := range []string{"dial tcp", "no such host", "connection refused", "connection reset", "i/o timeout", "tls handshake timeout", "network is unreachable", "temporary failure in name resolution"} {
		if strings.Contains(m, s) {
			return RemoteUnreachable
		}
	}
	return ""
}

// rank orders reasons so a safeguard is never hidden by a later, more
// generic error of the same pass.
func rank(reason string) int {
	switch reason {
	case DeleteLimit:
		return 4
	case NeedsResync:
		return 3
	case AllChanged:
		return 2
	case RemoteUnreachable:
		return 1
	}
	return 0
}

// listingsFailed reports whether bisync set the working directory's listings
// aside as "-err" after a critical abort and no committed pair replaced them.
// Only an explicit resync recovers from that, which the daemon never runs.
func listingsFailed(home, work string) bool {
	names, fd, err := listHomeDir(home, work)
	if err != nil || fd < 0 {
		return false
	}
	unix.Close(fd)
	failed, committed := false, false
	for _, n := range names {
		failed = failed || strings.HasSuffix(n, ".path1.lst-err") || strings.HasSuffix(n, ".path2.lst-err")
		committed = committed || strings.HasSuffix(n, ".path1.lst") || strings.HasSuffix(n, ".path2.lst")
	}
	return failed && !committed
}

// lastSynced is when rclone last committed both bisync listings in a
// home-relative working directory, or a mirror pass last finished there: the
// end of the latest successful pass, read from the files on every request
// rather than remembered.
func lastSynced(home, work string) (time.Time, bool) {
	if t, ok := mirrorSynced(home, work); ok {
		return t, true
	}
	names, fd, err := listHomeDir(home, work)
	if err != nil || fd < 0 {
		return time.Time{}, false
	}
	defer unix.Close(fd)
	var one, two time.Time
	for _, n := range names {
		side := &one
		if strings.HasSuffix(n, ".path2.lst") {
			side = &two
		} else if !strings.HasSuffix(n, ".path1.lst") {
			continue
		}
		var st unix.Stat_t
		if unix.Fstatat(fd, n, &st, unix.AT_SYMLINK_NOFOLLOW) != nil || st.Mode&unix.S_IFMT != unix.S_IFREG {
			continue
		}
		*side = time.Unix(st.Mtim.Unix())
	}
	if one.IsZero() || two.IsZero() {
		return time.Time{}, false
	}
	if two.Before(one) {
		return two, true
	}
	return one, true
}
