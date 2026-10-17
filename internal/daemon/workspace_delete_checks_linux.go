//go:build linux

package daemon

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"golang.org/x/sys/unix"
)

// deletionBlocker is one reason a workspace cannot be moved now. A check
// that cannot be completed is a blocker of kind "unknown" naming the check.
type deletionBlocker struct {
	Kind    string `json:"kind"`
	Check   string `json:"check,omitempty"`
	AgentID string `json:"agent_id,omitempty"`
	PID     int    `json:"pid,omitempty"`
	Comm    string `json:"comm,omitempty"`
	RunID   string `json:"run_id,omitempty"`
	Path    string `json:"path,omitempty"`
}

type workspaceProcess struct {
	PID  int    `json:"pid"`
	Comm string `json:"comm,omitempty"`
}

// Test seams: synthetic /proc and mount tables. Production reads the
// daemon's own view.
var (
	deletionProcRoot  = "/proc"
	deletionMountInfo = "/proc/self/mountinfo"
)

func insidePath(p, root string) bool {
	return p == root || strings.HasPrefix(p, root+"/")
}

// scanWorkspaceProcesses reports processes of the daemon UID whose cwd, root,
// executable or any open descriptor lies inside dir, and those whose details
// could not be read. Other UIDs cannot reach a 0700 home and are not read.
func scanWorkspaceProcesses(proc, dir string, uid int, exclude map[int]bool) (inside, unreadable []workspaceProcess, complete bool) {
	entries, err := os.ReadDir(proc)
	if err != nil {
		return nil, nil, false
	}
	complete = true
	for i, entry := range entries {
		if i > 1<<16 {
			return inside, unreadable, false
		}
		pid, err := strconv.Atoi(entry.Name())
		if err != nil || pid <= 0 || pid == os.Getpid() || exclude[pid] {
			continue
		}
		base := filepath.Join(proc, entry.Name())
		info, err := os.Stat(base)
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil {
			unreadable = append(unreadable, workspaceProcess{PID: pid})
			continue
		}
		owner, ok := fileOwner(info)
		if !ok {
			unreadable = append(unreadable, workspaceProcess{PID: pid})
			continue
		}
		if owner != uid {
			continue
		}
		pinned, err := os.Open(base)
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil {
			unreadable = append(unreadable, workspaceProcess{PID: pid})
			continue
		}
		pinnedInfo, err := pinned.Stat()
		if err != nil || !os.SameFile(info, pinnedInfo) {
			_ = pinned.Close()
			unreadable = append(unreadable, workspaceProcess{PID: pid})
			continue
		}
		state := inspectWorkspaceProcess(filepath.Join("/proc/self/fd", strconv.Itoa(int(pinned.Fd()))), dir)
		comm := ""
		if state != "gone" {
			if b, err := os.ReadFile(filepath.Join("/proc/self/fd", strconv.Itoa(int(pinned.Fd())), "comm")); err == nil && len(b) <= 64 {
				comm = strings.TrimSpace(string(b))
			}
		}
		_ = pinned.Close()
		switch state {
		case "inside":
			inside = append(inside, workspaceProcess{PID: pid, Comm: comm})
		case "unknown":
			unreadable = append(unreadable, workspaceProcess{PID: pid, Comm: comm})
		}
	}
	return inside, unreadable, complete
}

// settledProcessScan scans once more when a process could not be read: a
// process that is exiting denies its descriptors until it becomes a zombie,
// and one of the person's processes ending elsewhere would otherwise block a
// deletion that has nothing to do with it. A process that still cannot be
// read blocks, as before.
func settledProcessScan(proc, dir string, uid int, exclude map[int]bool) (inside, unreadable []workspaceProcess, complete bool) {
	inside, unreadable, complete = scanWorkspaceProcesses(proc, dir, uid, exclude)
	if len(unreadable) == 0 || len(inside) > 0 {
		return inside, unreadable, complete
	}
	settleWait()
	return scanWorkspaceProcesses(proc, dir, uid, exclude)
}

// A variable so that a test can end a process during the wait.
var settleWait = func() { time.Sleep(100 * time.Millisecond) }

// base is a pinned process directory, never a recycled PID pathname.
func inspectWorkspaceProcess(base, dir string) string {
	raw, err := os.ReadFile(filepath.Join(base, "cmdline"))
	if errors.Is(err, os.ErrNotExist) {
		return "gone"
	}
	// A zombie holds no cwd or descriptors, yet its fd directory denies
	// reads; it would otherwise block every deletion until it is reaped.
	if b, err := os.ReadFile(filepath.Join(base, "stat")); err == nil {
		if i := bytes.LastIndexByte(b, ')'); i >= 0 && i+2 < len(b) && (b[i+2] == 'Z' || b[i+2] == 'X') {
			return "gone"
		}
	}
	known := err == nil && knownNonPiSystemProcess(raw)
	unknown := false
	for _, link := range []string{"cwd", "root", "exe"} {
		target, err := os.Readlink(filepath.Join(base, link))
		if err == nil {
			if insidePath(target, dir) {
				return "inside"
			}
			continue
		}
		if !errors.Is(err, os.ErrNotExist) {
			unknown = true
		}
	}
	fds, err := os.ReadDir(filepath.Join(base, "fd"))
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		unknown = true
	}
	for i, fd := range fds {
		if i > 1<<16 {
			unknown = true
			break
		}
		target, err := os.Readlink(filepath.Join(base, "fd", fd.Name()))
		if err == nil && insidePath(target, dir) {
			return "inside"
		}
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			unknown = true
		}
	}
	// Some same-UID system processes deny these reads by design and can
	// never be inside a workspace; they would otherwise block every deletion.
	if unknown && !known {
		return "unknown"
	}
	return "clear"
}

// mountsBelow reports mount points at or below dir, or false when the mount
// table cannot be read completely.
func mountsBelow(mountinfo, dir string) ([]string, bool) {
	b, err := os.ReadFile(mountinfo)
	if err != nil || len(b) > 16<<20 {
		return nil, false
	}
	var found []string
	scanner := bufio.NewScanner(bytes.NewReader(b))
	scanner.Buffer(make([]byte, 0, 64<<10), 1<<20)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 10 {
			return nil, false
		}
		point, ok := unescapeMount(fields[4])
		if !ok {
			return nil, false
		}
		if insidePath(point, dir) {
			found = append(found, point)
		}
	}
	return found, scanner.Err() == nil
}

// proc(5): space, tab, newline and backslash are octal escapes.
func unescapeMount(s string) (string, bool) {
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		if s[i] != '\\' {
			b.WriteByte(s[i])
			continue
		}
		if i+4 > len(s) {
			return "", false
		}
		n, err := strconv.ParseUint(s[i+1:i+4], 8, 8)
		if err != nil {
			return "", false
		}
		b.WriteByte(byte(n))
		i += 3
	}
	return b.String(), strings.HasPrefix(b.String(), "/")
}

// worktreeBlockers reads Git's own registry of linked worktrees
// (gitrepository-layout(5)): a live or locked entry blocks, a stale one is
// counted. It also blocks when the workspace or an immediate child is itself
// a linked worktree of some repository.
func worktreeBlockers(child int, wsPath string) ([]deletionBlocker, int) {
	var blockers []deletionBlocker
	stale := 0
	unknown := func() { blockers = append(blockers, deletionBlocker{Kind: "unknown", Check: "worktrees"}) }
	gitDir, err := dir(unix.Openat2, child, ".git", true)
	if err == nil {
		defer unix.Close(gitDir)
		trees, err := dir(unix.Openat2, gitDir, "worktrees", true)
		if err == nil {
			defer unix.Close(trees)
			names, err := readDirNames(trees, 4096)
			if err != nil {
				unknown()
			}
			for _, id := range names {
				entry, err := dir(unix.Openat2, trees, id, true)
				if err != nil {
					unknown()
					continue
				}
				b, status := readSmall(unix.Openat2, entry, "gitdir", maxGitfile)
				var locked unix.Stat_t
				lockErr := unix.Fstatat(entry, "locked", &locked, unix.AT_SYMLINK_NOFOLLOW)
				unix.Close(entry)
				if status != "valid" {
					unknown()
					continue
				}
				target := strings.TrimSuffix(string(b), "\n")
				if !filepath.IsAbs(target) {
					target = filepath.Join(wsPath, ".git", "worktrees", id, target)
				}
				worktree := filepath.Dir(filepath.Clean(target))
				if lockErr == nil {
					blockers = append(blockers, deletionBlocker{Kind: "locked_worktree", Path: worktree})
					continue
				}
				if !errors.Is(lockErr, unix.ENOENT) {
					unknown()
					continue
				}
				if _, err := os.Lstat(target); err == nil {
					blockers = append(blockers, deletionBlocker{Kind: "linked_worktree", Path: worktree})
				} else if errors.Is(err, os.ErrNotExist) {
					stale++
				} else {
					unknown()
				}
			}
		} else if !errors.Is(err, unix.ENOENT) {
			unknown()
		}
	} else if !errors.Is(err, unix.ENOENT) && !errors.Is(err, unix.ENOTDIR) {
		unknown()
	}
	switch linkedGitfile(child, wsPath, wsPath) {
	case "linked":
		blockers = append(blockers, deletionBlocker{Kind: "is_linked_worktree"})
	case "unknown":
		unknown()
	}
	names, err := readDirNames(child, 1<<16)
	if err != nil {
		unknown()
		return blockers, stale
	}
	for _, name := range names {
		if name == ".git" {
			continue
		}
		var s unix.Stat_t
		if unix.Fstatat(child, name, &s, unix.AT_SYMLINK_NOFOLLOW) != nil || s.Mode&unix.S_IFMT != unix.S_IFDIR {
			continue
		}
		sub, err := dir(unix.Openat2, child, name, true)
		if err != nil {
			if !errors.Is(err, unix.EXDEV) && !errors.Is(err, unix.ENOENT) {
				unknown()
			}
			continue
		}
		switch linkedGitfile(sub, filepath.Join(wsPath, name), wsPath) {
		case "linked":
			blockers = append(blockers, deletionBlocker{Kind: "contains_linked_worktree", Path: filepath.Join(wsPath, name)})
		case "unknown":
			unknown()
		}
		unix.Close(sub)
	}
	return blockers, stale
}

// linkedGitfile classifies a .git file in dir: "linked" when it points into
// some repository's worktrees/ directory, "none" for no file, a separate Git
// directory or a submodule of the workspace itself.
func linkedGitfile(fd int, dirPath, wsPath string) string {
	var s unix.Stat_t
	if err := unix.Fstatat(fd, ".git", &s, unix.AT_SYMLINK_NOFOLLOW); errors.Is(err, unix.ENOENT) {
		return "none"
	} else if err != nil {
		return "unknown"
	}
	if s.Mode&unix.S_IFMT == unix.S_IFDIR {
		return "none"
	}
	b, status := readSmall(unix.Openat2, fd, ".git", maxGitfile)
	if status != "valid" || !bytes.HasPrefix(b, []byte("gitdir: ")) {
		return "unknown"
	}
	target := strings.TrimSpace(string(b[len("gitdir: "):]))
	if !filepath.IsAbs(target) {
		target = filepath.Join(dirPath, target)
	}
	target = filepath.Clean(target)
	if insidePath(target, filepath.Join(wsPath, ".git", "modules")) {
		return "none"
	}
	for _, part := range strings.Split(target, "/") {
		if part == "worktrees" {
			return "linked"
		}
	}
	return "none"
}

// taskfleetBlockers asks Taskfleet, with the fixed argv the spinoff view
// uses, for runs of this repository. A live run blocks, and so does any run
// whose worktree still exists; a finished run whose worktree is gone does not.
func taskfleetBlockers(ctx context.Context, home, wsPath string) ([]deletionBlocker, bool) {
	if taskfleetBinary(home) == "" {
		return nil, true
	}
	var reply struct {
		Schema int `json:"schema_version"`
		Data   struct {
			Runs []nativeSpinoff `json:"runs"`
		} `json:"data"`
	}
	if !taskfleetRead(ctx, home, []string{"run", "list", "--repo", wsPath, "--output", "json"}, &reply) || reply.Schema != 1 || reply.Data.Runs == nil {
		return nil, false
	}
	var blockers []deletionBlocker
	for _, r := range reply.Data.Runs {
		if !taskfleetIDPattern.MatchString(r.ID) {
			return nil, false
		}
		live := r.Status == "pending" || r.Status == "running"
		paths := []string{r.WorktreePath}
		for _, n := range r.Nodes {
			paths = append(paths, n.Worktree)
		}
		exists := false
		for _, p := range paths {
			if p == "" || !filepath.IsAbs(p) {
				continue
			}
			if _, err := os.Lstat(p); err == nil {
				exists = true
			} else if !errors.Is(err, os.ErrNotExist) {
				return nil, false
			}
		}
		if live || exists {
			blockers = append(blockers, deletionBlocker{Kind: "taskfleet_run", RunID: r.ID})
		}
	}
	return blockers, true
}

// deletionGit holds the informational Git facts. They never block a move to
// the Trash; they decide only whether outright permanent deletion is allowed.
type deletionGit struct {
	State        string   `json:"state"` // observed, unknown
	Branch       string   `json:"branch,omitempty"`
	HasCommits   bool     `json:"has_commits"`
	RemoteRefs   bool     `json:"remote_refs"`
	Changed      int      `json:"changed"`
	Untracked    int      `json:"untracked"`
	Ignored      int      `json:"ignored"`
	IgnoredPaths []string `json:"ignored_paths"`
	Stash        int      `json:"stash"`
	Unpushed     int      `json:"unpushed"`
	Nested       int      `json:"nested_repositories"`
	FetchedAt    *int64   `json:"fetched_at,omitempty"`
}

// readDeletionGit uses the read-only Git layer's command runner on a pinned
// descriptor. It makes no fetch itself: "pushed" means contained in a local
// remote-tracking ref, which deletionFetch refreshes before an outright
// deletion.
func readDeletionGit(ctx context.Context, home string, fd int) deletionGit {
	out := deletionGit{State: "unknown", IgnoredPaths: []string{}}
	read := func(args ...string) ([]byte, error) {
		return cloneCommandWithTimeout(ctx, 3*time.Second, "/usr/bin/git", home, strconv.Itoa(fd), append([]string{"-c", "core.fsmonitor=false", "-c", "core.quotepath=false"}, args...)...)
	}
	exitCode := func(e error) int {
		var exit *nativeCommandExit
		if errors.As(e, &exit) {
			return exit.Code
		}
		return -1
	}
	if b, e := read("symbolic-ref", "--quiet", "--short", "HEAD"); e == nil && len(b) <= 256 {
		out.Branch = strings.TrimSpace(string(b))
	}
	_, e := read("rev-parse", "--verify", "--quiet", "HEAD^{commit}")
	switch {
	case e == nil:
		out.HasCommits = true
	case exitCode(e) != 1:
		return out
	}
	status, e := read("status", "--porcelain=v1", "-z", "--untracked-files=normal", "--ignored=traditional")
	var ignoredDirs []string
	if e != nil || len(status) > 1<<20 {
		return out
	}
	records := strings.Split(strings.TrimSuffix(string(status), "\x00"), "\x00")
	for i := 0; i < len(records); i++ {
		record := records[i]
		if record == "" {
			continue
		}
		if len(record) < 4 || record[2] != ' ' {
			return out
		}
		switch record[:2] {
		case "??":
			out.Untracked++
		case "!!":
			out.Ignored++
			if len(out.IgnoredPaths) < 20 && len(record) <= 4096+3 {
				out.IgnoredPaths = append(out.IgnoredPaths, record[3:])
			}
			if strings.HasSuffix(record, "/") {
				ignoredDirs = append(ignoredDirs, strings.TrimSuffix(record[3:], "/"))
			}
		default:
			out.Changed++
			if strings.ContainsAny(record[:2], "RC") {
				i++
			}
		}
	}
	remotes, e := read("for-each-ref", "--count=1", "--format=%(refname)", "refs/remotes")
	if e != nil {
		return out
	}
	out.RemoteRefs = len(bytes.TrimSpace(remotes)) > 0
	if out.HasCommits {
		count, e := read("rev-list", "--count", "HEAD", "--all", "--not", "--remotes")
		n, err := strconv.Atoi(strings.TrimSpace(string(count)))
		if e != nil || err != nil || n < 0 {
			return out
		}
		out.Unpushed = n
	}
	_, e = read("rev-parse", "--verify", "--quiet", "refs/stash")
	if e == nil {
		count, e := read("rev-list", "--walk-reflogs", "--count", "refs/stash")
		n, err := strconv.Atoi(strings.TrimSpace(string(count)))
		if e != nil || err != nil || n < 1 {
			return out
		}
		out.Stash = n
	} else if exitCode(e) != 1 {
		return out
	}
	// Commits of a submodule or of a clone Git ignores are in neither the
	// superproject's refs nor its status; their remotes are not checked.
	nested, ok := nestedRepositories(fd, ignoredDirs)
	if !ok {
		return out
	}
	out.Nested = nested
	if fetchFD, e := open(unix.Openat2, fd, ".git/FETCH_HEAD", unix.O_RDONLY|unix.O_NONBLOCK, true); e == nil {
		if st, e := stat(fetchFD); e == nil && st.Mode&unix.S_IFMT == unix.S_IFREG && st.Mtim.Sec >= 0 {
			value := st.Mtim.Sec
			out.FetchedAt = &value
		}
		unix.Close(fetchFD)
	}
	out.State = "observed"
	return out
}

// deletionFetch updates the remote-tracking refs of the pinned repository
// before an outright deletion is verified (Jari, 2026-10-17). It reports ""
// when the facts can be read again, fetch_failed when any remote did not
// answer (or none is configured, or the fetch ran out of time), and
// changed_after_check when the fetch moved a ref outside refs/remotes: a
// configured refspec may write local branches, and a commit that lost its
// last local ref would otherwise look pushed. Every remote is named
// explicitly, so remote.<name>.skipFetchAll cannot leave its refs stale. Tags
// are not fetched, hooks and automatic maintenance are off (a detached gc
// would outlive the fetch inside the entry). A variable so that a test can
// observe or replace it.
var deletionFetch = func(home string, fd int) string {
	ctx, cancel := context.WithTimeout(context.Background(), deletionFetchLimit)
	defer cancel()
	git := func(args ...string) ([]byte, error) {
		return cloneCommandWithTimeout(ctx, deletionFetchLimit, "/usr/bin/git", home, strconv.Itoa(fd), append([]string{"-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", "-c", "maintenance.auto=false", "-c", "gc.auto=0"}, args...)...)
	}
	localRefs := func() (string, bool) {
		b, e := git("for-each-ref", "--format=%(refname) %(objectname)")
		if e != nil || len(b) > 4<<20 {
			return "", false
		}
		var keep []string
		for _, line := range strings.Split(string(b), "\n") {
			if line != "" && !strings.HasPrefix(line, "refs/remotes/") {
				keep = append(keep, line)
			}
		}
		head, e := git("rev-parse", "--verify", "--quiet", "HEAD")
		if e != nil {
			return "", false
		}
		return strings.Join(keep, "\n") + "\nHEAD " + strings.TrimSpace(string(head)), true
	}
	out, e := git("remote")
	if e != nil {
		return "fetch_failed"
	}
	remotes := strings.Fields(string(out))
	if len(remotes) == 0 {
		return "fetch_failed"
	}
	for _, r := range remotes {
		if strings.HasPrefix(r, "-") {
			return "fetch_failed"
		}
	}
	before, ok := localRefs()
	if !ok {
		return "fetch_failed"
	}
	args := append([]string{"fetch", "--multiple", "--prune", "--no-tags", "--no-recurse-submodules", "--no-auto-maintenance", "--quiet"}, remotes...)
	if _, e = git(args...); e != nil {
		return "fetch_failed"
	}
	if after, ok := localRefs(); !ok || after != before {
		return "changed_after_check"
	}
	return ""
}

// permanentAllowed is Jari's amendment to ADR 0019: a Git repository that is
// clean and whose commits all exist on a remote may be deleted at once.
// Ignored files do not count against it; they are reported so the person
// sees what is lost.
func (g deletionGit) permanentAllowed() bool {
	return g.State == "observed" && g.HasCommits && g.RemoteRefs && g.Changed == 0 && g.Untracked == 0 && g.Stash == 0 && g.Unpushed == 0 && g.Nested == 0
}

// nestedRepositories counts initialized submodules (.git/modules/*) and
// ignored directories that are Git repositories themselves.
func nestedRepositories(fd int, ignoredDirs []string) (int, bool) {
	n := 0
	modules, err := dir(unix.Openat2, fd, ".git/modules", true)
	if err == nil {
		names, err := readDirNames(modules, 4096)
		unix.Close(modules)
		if err != nil {
			return 0, false
		}
		n += len(names)
	} else if !errors.Is(err, unix.ENOENT) {
		return 0, false
	}
	for _, d := range ignoredDirs {
		var s unix.Stat_t
		sub, err := dir(unix.Openat2, fd, d, true)
		if err != nil {
			if errors.Is(err, unix.EXDEV) || errors.Is(err, unix.ELOOP) {
				continue
			}
			return 0, false
		}
		if unix.Fstatat(sub, ".git", &s, unix.AT_SYMLINK_NOFOLLOW) == nil {
			n++
		}
		unix.Close(sub)
	}
	return n, true
}

func countConversations(sessions []nativeSession, wsPath string) int {
	n := 0
	for _, s := range sessions {
		if s.cwd != "" && insidePath(filepath.Clean(s.cwd), wsPath) {
			n++
		}
	}
	return n
}
