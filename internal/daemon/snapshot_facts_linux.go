//go:build linux

package daemon

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/open-habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

// snapshotFacts remembers facts that are expensive to derive from native
// state, for one daemon's lifetime and only in memory. Each fact is keyed by
// the native inputs it was derived from and is derived again as soon as one
// of them changes, so the native files stay the only truth: a session file's
// stat stamp, the stat stamps of Taskfleet's run records, or inotify events
// on a Git workspace. Anything that cannot be keyed that way is observed on
// every snapshot, as before (processes, Pi inventory, discovery itself).
type snapshotFacts struct {
	sessions  *sessionFileFacts
	taskfleet *taskfleetRunFacts
	git       *gitWatch
}

func newSnapshotFacts(ctx context.Context) *snapshotFacts {
	return &snapshotFacts{sessions: &sessionFileFacts{files: map[string]*sessionFile{}, procs: map[string]*sessionProcesses{}}, taskfleet: &taskfleetRunFacts{}, git: newGitWatch(ctx)}
}

// fileStamp changes with every write, rename, truncation or permission
// change of a file. ctime cannot be set from user space, so a rewrite that
// restores size and mtime still changes the stamp.
type fileStamp struct {
	dev, ino, size uint64
	mode, uid      uint32
	mtime, ctime   unix.Timespec
}

func stampOf(path string) (fileStamp, error) {
	var st unix.Stat_t
	if err := unix.Lstat(path, &st); err != nil {
		return fileStamp{}, err
	}
	return fileStamp{dev: st.Dev, ino: st.Ino, size: uint64(st.Size), mode: st.Mode, uid: st.Uid, mtime: st.Mtim, ctime: st.Ctim}, nil
}

// sessionFileFacts holds what a snapshot reads from each Pi session file:
// its header and its title sources. A file whose stamp differs is read again.
type sessionFileFacts struct {
	mu    sync.Mutex
	files map[string]*sessionFile
	procs map[string]*sessionProcesses
}

// sessionProcesses is the branch's open process starts (process_interrupted_linux.go).
type sessionProcesses struct {
	stamp fileStamp
	scan  branchScan
}

type sessionFile struct {
	stamp  fileStamp
	header nativeSession
	titled bool
	prompt string
	name   string
}

func (f *sessionFileFacts) read(cfg transport.Config) ([]nativeSession, error) {
	seen := map[string]bool{}
	sessions, err := nativeSessionsWith(cfg, func(path string, uid int) nativeSession {
		seen[path] = true
		return f.header(path, uid)
	})
	if err == nil {
		f.mu.Lock()
		for path := range f.files {
			if !seen[path] {
				delete(f.files, path)
			}
		}
		for path := range f.procs {
			if !seen[path] {
				delete(f.procs, path)
			}
		}
		f.mu.Unlock()
	}
	return sessions, err
}

func (f *sessionFileFacts) header(path string, uid int) nativeSession {
	before, err := stampOf(path)
	if err != nil {
		return readNativeHeader(path, uid)
	}
	f.mu.Lock()
	if c := f.files[path]; c != nil && c.stamp == before {
		f.mu.Unlock()
		return c.header
	}
	f.mu.Unlock()
	s := readNativeHeader(path, uid)
	if after, err := stampOf(path); err == nil && after == before {
		f.mu.Lock()
		f.files[path] = &sessionFile{stamp: before, header: s}
		f.mu.Unlock()
	}
	return s
}

// processes scans the whole file, so the process tray's two-second poll reads
// it again only after Pi wrote to it.
func (f *sessionFileFacts) processes(path string, uid int) ([]branchProcess, bool) {
	scan, ok := f.branch(path, uid)
	return scan.open, ok
}

// branch is the active branch's process and catch-up facts, read again only
// after Pi wrote to the file.
func (f *sessionFileFacts) branch(path string, uid int) (branchScan, bool) {
	before, err := stampOf(path)
	if err != nil {
		return branchScan{}, false
	}
	f.mu.Lock()
	if c := f.procs[path]; c != nil && c.stamp == before {
		f.mu.Unlock()
		return c.scan, true
	}
	f.mu.Unlock()
	scan, ok := scanBranchFile(path, uid)
	if !ok {
		return branchScan{}, false
	}
	if after, err := stampOf(path); err == nil && after == before {
		f.mu.Lock()
		f.procs[path] = &sessionProcesses{stamp: before, scan: scan}
		f.mu.Unlock()
	}
	return scan, true
}

// title returns the first prompt and the native session name. Both can need
// a scan of the whole file, which is the costly part of a large history.
func (f *sessionFileFacts) title(s nativeSession, uid int) (string, string) {
	before, err := stampOf(s.path)
	if err == nil {
		f.mu.Lock()
		c := f.files[s.path]
		if c != nil && c.stamp == before && c.titled && c.header.revision == s.revision {
			prompt, name := c.prompt, c.name
			f.mu.Unlock()
			return prompt, name
		}
		f.mu.Unlock()
	}
	prompt, name := firstPrompt(s, uid), nativeNameDisplay(s, uid)
	if err != nil {
		return prompt, name
	}
	if after, e := stampOf(s.path); e == nil && after == before {
		f.mu.Lock()
		if c := f.files[s.path]; c != nil && c.stamp == before && c.header.revision == s.revision {
			c.titled, c.prompt, c.name = true, prompt, name
		}
		f.mu.Unlock()
	}
	return prompt, name
}

// taskfleetRunFacts remembers `taskfleet run list` while its run records are
// unchanged. The listing takes about 0.1 s on the test server and 0.9 s with
// a thousand runs; the stat stamps of the records take milliseconds.
type taskfleetRunFacts struct {
	mu    sync.Mutex
	stamp string
	runs  []nativeSpinoff
	valid bool
	// until bounds a listing that holds unsettled runs: Taskfleet probes a
	// supervisor's liveness at list time, and a killed supervisor changes no
	// stamped file.
	until time.Time
}

// taskfleetLivenessTTL bounds how long a working spinoff whose supervisor
// died can still count as working in the snapshot.
const taskfleetLivenessTTL = 10 * time.Second

// list answers `taskfleet run list`, from memory while the run records are
// unchanged. Run status lives in each run's manifest.json, which the stamp
// covers, so a settled run is listed afresh; supervisor liveness is not in
// any record, so a listing with unsettled runs expires after a short time.
func (t *taskfleetRunFacts) list(ctx context.Context, home string) ([]nativeSpinoff, bool) {
	binary := taskfleetBinary(home)
	if binary == "" {
		return nil, false
	}
	stamp, stamped := taskfleetStamp(home, binary)
	t.mu.Lock()
	if stamped && t.valid && t.stamp == stamp && (t.until.IsZero() || time.Now().Before(t.until)) {
		runs := t.runs
		t.mu.Unlock()
		return runs, true
	}
	t.mu.Unlock()
	runs, ok := listTaskfleetRuns(ctx, home)
	if !ok {
		return nil, false
	}
	if after, still := taskfleetStamp(home, binary); stamped && still && after == stamp {
		var until time.Time
		for _, r := range runs {
			if r.Status == "pending" || r.Status == "running" {
				until = time.Now().Add(taskfleetLivenessTTL)
				break
			}
		}
		t.mu.Lock()
		t.stamp, t.runs, t.valid, t.until = stamp, runs, true, until
		t.mu.Unlock()
	}
	return runs, true
}

func (t *taskfleetRunFacts) exclude(ctx context.Context, home string, entries []Workspace) []Workspace {
	runs, ok := t.list(ctx, home)
	if !ok {
		return entries
	}
	return filterTaskfleetWorkspaces(home, entries, runs)
}

// taskfleetStamp covers what the workspace filter reads from a run: kind,
// owner, source and node worktrees, which Taskfleet keeps in each run's
// manifest.json and nodes/. Supervisor heartbeats, event logs and agent logs
// change every second while a run is alive and are deliberately left out. A
// run directory without a manifest (one being created, or a Taskfleet whose
// layout has changed) makes the listing uncacheable rather than stale.
func taskfleetStamp(home, binary string) (string, bool) {
	var b strings.Builder
	add := func(path string, missingOK bool) bool {
		s, err := stampOf(path)
		if errors.Is(err, os.ErrNotExist) && missingOK {
			b.WriteString("-;")
			return true
		}
		// A symlinked record would be listed through its target: not a
		// layout this stamp knows, so the listing is not reused.
		if err != nil || s.mode&unix.S_IFMT == unix.S_IFLNK && path != binary {
			return false
		}
		fmt.Fprintf(&b, "%v;", s)
		return true
	}
	target, err := filepath.EvalSymlinks(binary)
	if err != nil || !add(binary, false) || !add(target, false) {
		return "", false
	}
	root := filepath.Join(home, ".taskfleet")
	if !add(filepath.Join(root, "config.toml"), true) || !add(filepath.Join(root, "runs"), true) {
		return "", false
	}
	runs, err := os.ReadDir(filepath.Join(root, "runs"))
	if errors.Is(err, os.ErrNotExist) {
		return b.String(), true
	}
	if err != nil || len(runs) > 20000 {
		return "", false
	}
	for _, run := range runs {
		if !run.IsDir() {
			continue
		}
		dir := filepath.Join(root, "runs", run.Name())
		b.WriteString(run.Name())
		if !add(filepath.Join(dir, "manifest.json"), false) || !add(filepath.Join(dir, "nodes"), true) {
			return "", false
		}
		nodes, err := os.ReadDir(filepath.Join(dir, "nodes"))
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			return "", false
		}
		for _, node := range nodes {
			b.WriteString(node.Name())
			if !add(filepath.Join(dir, "nodes", node.Name()), false) {
				return "", false
			}
		}
	}
	return b.String(), true
}
