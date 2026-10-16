//go:build linux

package daemon

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
	"unsafe"

	"github.com/Open-Habitat/open-habitat/internal/nativegh"
	"github.com/Open-Habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

// gitFacts are what a snapshot shows about one Git workspace: the remote
// classification and the branch/dirty summary.
type gitFacts struct {
	remote       string
	continuation bool
	summary      map[string]any // never modified after it is stored
	summaryOK    bool
}

type gitRepoKey struct {
	name, kind string
	dev, ino   uint64
}

// gitRepo is one workspace's watch registration. Any inotify event on its
// worktree, its Git directory or its common directory moves gen; facts are
// answered only while factsGen still equals gen.
type gitRepo struct {
	gen      uint64
	stale    bool // the watch set no longer covers the tree and must be rebuilt
	broken   bool // cannot be watched within the limits: observe until Git's configuration changes
	wds      map[int]bool
	facts    *gitFacts
	factsGen uint64
	global   string
	seen     bool
}

const (
	gitWatchRepoDirs  = 4096
	gitWatchTotalDirs = 8192 // the test server allows 29376 watches per user, shared with Pi and editors
	gitWatchMask      = unix.IN_CREATE | unix.IN_DELETE | unix.IN_MOVED_FROM | unix.IN_MOVED_TO | unix.IN_CLOSE_WRITE | unix.IN_MODIFY | unix.IN_ATTRIB | unix.IN_DELETE_SELF | unix.IN_MOVE_SELF | unix.IN_ONLYDIR | unix.IN_DONT_FOLLOW | unix.IN_EXCL_UNLINK
)

// gitWatch watches every Git workspace's tree, except what Git itself
// ignores and the object store, with one inotify instance. Git status reads
// with GIT_OPTIONAL_LOCKS=0 and writes nothing, so the observation does not
// invalidate itself. If inotify is unavailable, the watch limits are reached
// or the queue overflows, the affected facts are simply observed again.
type gitWatch struct {
	mu    sync.Mutex
	fd    int
	repos map[gitRepoKey]*gitRepo
	byWD  map[int]map[*gitRepo]bool
	total int
	ctx   context.Context
	once  sync.Once
	buf   [64 << 10]byte // read under mu
}

// The inotify instance is created by the first snapshot, not with the
// controller: most controllers in tests never serve one.
func newGitWatch(ctx context.Context) *gitWatch {
	return &gitWatch{fd: -1, repos: map[gitRepoKey]*gitRepo{}, byWD: map[int]map[*gitRepo]bool{}, ctx: ctx}
}

func (w *gitWatch) start() {
	w.once.Do(func() {
		if w.ctx.Err() != nil {
			return
		}
		fd, err := unix.InotifyInit1(unix.IN_NONBLOCK | unix.IN_CLOEXEC)
		if err != nil {
			return
		}
		w.mu.Lock()
		w.fd = fd
		w.mu.Unlock()
		go w.run(w.ctx, fd)
	})
}

func (w *gitWatch) run(ctx context.Context, fd int) {
	defer func() {
		w.mu.Lock()
		w.closeLocked()
		w.mu.Unlock()
	}()
	for ctx.Err() == nil {
		poll := []unix.PollFd{{Fd: int32(fd), Events: unix.POLLIN}}
		n, err := unix.Poll(poll, 1000)
		if err == unix.EINTR || err == nil && n == 0 {
			continue
		}
		if err != nil || poll[0].Revents&(unix.POLLERR|unix.POLLHUP|unix.POLLNVAL) != 0 {
			return
		}
		w.mu.Lock()
		ok := w.drainLocked()
		w.mu.Unlock()
		if !ok {
			return
		}
	}
}

func (w *gitWatch) closeLocked() {
	if w.fd < 0 {
		return
	}
	unix.Close(w.fd)
	w.fd = -1
	for _, repo := range w.repos {
		repo.facts = nil
	}
}

// drainLocked applies every event the kernel has queued. inotify queues an
// event within the system call that changed the file, so a snapshot that
// drains first sees every change that finished before it started.
func (w *gitWatch) drainLocked() bool {
	for w.fd >= 0 {
		size, err := unix.Read(w.fd, w.buf[:])
		if err == unix.EAGAIN {
			return true
		}
		if err == unix.EINTR {
			continue
		}
		if err != nil || size <= 0 {
			w.closeLocked()
			return false
		}
		w.applyLocked(w.buf[:size])
	}
	return false
}

func (w *gitWatch) applyLocked(buf []byte) {
	size := len(buf)
	for offset := 0; offset+unix.SizeofInotifyEvent <= size; {
		event := (*unix.InotifyEvent)(unsafe.Pointer(&buf[offset]))
		end := offset + unix.SizeofInotifyEvent + int(event.Len)
		if end > size {
			return
		}
		name := string(bytes.TrimRight(buf[offset+unix.SizeofInotifyEvent:end], "\x00"))
		offset = end
		if event.Mask&unix.IN_Q_OVERFLOW != 0 {
			for _, repo := range w.repos {
				repo.gen++
				repo.stale = true
			}
			continue
		}
		restructure := event.Mask&(unix.IN_DELETE_SELF|unix.IN_MOVE_SELF|unix.IN_IGNORED|unix.IN_UNMOUNT) != 0 ||
			event.Mask&unix.IN_ISDIR != 0 && event.Mask&(unix.IN_CREATE|unix.IN_MOVED_TO|unix.IN_DELETE|unix.IN_MOVED_FROM) != 0 ||
			// What Git ignores decides which directories are watched: an
			// ignore rule, a force-added file (index) or core.excludesFile
			// (config) can make an unwatched directory count.
			name == ".gitignore" || name == "exclude" || name == "index" || name == "config"
		owners := w.byWD[int(event.Wd)]
		for repo := range owners {
			repo.gen++
			if restructure {
				repo.stale = true
			}
		}
		// The kernel dropped this watch (its directory is gone) and may
		// reuse the number for another directory: forget it now.
		if event.Mask&unix.IN_IGNORED != 0 && owners != nil {
			for repo := range owners {
				delete(repo.wds, int(event.Wd))
			}
			delete(w.byWD, int(event.Wd))
			w.total--
		}
	}
}

// facts answers one Git workspace for this snapshot. global covers Git's
// own configuration files, which every repository reads.
func (w *gitWatch) facts(ctx context.Context, home string, entry Workspace, global string, observe func() (gitFacts, bool)) gitFacts {
	w.start()
	key := gitRepoKey{entry.Name, entry.Kind, entry.dev, entry.ino}
	w.mu.Lock()
	w.drainLocked()
	repo := w.repos[key]
	if repo == nil {
		repo = &gitRepo{stale: true, wds: map[int]bool{}}
		w.repos[key] = repo
	}
	repo.seen = true
	if w.fd >= 0 && repo.facts != nil && !repo.stale && repo.factsGen == repo.gen && repo.global == global {
		facts := *repo.facts
		w.mu.Unlock()
		return facts
	}
	if repo.global != global {
		// Git's configuration changed: its ignore rules, and so the
		// directories that need watching, may have changed too.
		repo.stale, repo.broken = true, false
	}
	watchable := w.fd >= 0 && !repo.broken
	needsWatch := watchable && repo.stale
	w.mu.Unlock()
	var roots []gitWatchRoot
	if needsWatch {
		var ok bool
		if roots, ok = gitWatchRoots(ctx, home, entry); !ok {
			watchable = false
		}
	}
	w.mu.Lock()
	if needsWatch && watchable {
		watchable = w.rewatch(repo, home, entry, roots)
	}
	repo.global = global
	gen := repo.gen
	w.mu.Unlock()
	facts, complete := observe()
	if !watchable || !complete || ctx.Err() != nil {
		return facts
	}
	w.mu.Lock()
	w.drainLocked()
	// An event during the observation moved gen: the facts may predate it.
	if w.fd >= 0 && !repo.stale && repo.gen == gen && repo.global == global {
		stored := facts
		repo.facts, repo.factsGen = &stored, gen
	}
	w.mu.Unlock()
	return facts
}

// sweep drops workspaces no snapshot has asked about since the last sweep:
// renamed, removed, or no longer Git repositories.
func (w *gitWatch) sweep() {
	w.mu.Lock()
	defer w.mu.Unlock()
	for key, repo := range w.repos {
		if !repo.seen {
			w.unwatch(repo)
			delete(w.repos, key)
			continue
		}
		repo.seen = false
	}
}

func (w *gitWatch) unwatch(repo *gitRepo) {
	for wd := range repo.wds {
		owners := w.byWD[wd]
		delete(owners, repo)
		if len(owners) == 0 {
			delete(w.byWD, wd)
			if w.fd >= 0 {
				_, _ = unix.InotifyRmWatch(w.fd, uint32(wd))
			}
			w.total--
		}
	}
	repo.wds = map[int]bool{}
}

type gitWatchRoot struct {
	path    string
	ignored map[string]bool
	skip    map[string]bool
}

// rewatch runs with w.mu held, so events read meanwhile wait for the new
// registrations. Each directory is watched before it is listed: a child
// created after the listing produces an event, one created before is walked.
func (w *gitWatch) rewatch(repo *gitRepo, home string, entry Workspace, roots []gitWatchRoot) bool {
	w.unwatch(repo)
	repo.facts = nil
	fail := func() bool {
		w.unwatch(repo)
		repo.broken = true
		return false
	}
	count := 0
	for _, root := range roots {
		err := filepath.WalkDir(root.path, func(path string, d os.DirEntry, walkErr error) error {
			if walkErr != nil {
				if path == root.path {
					return walkErr
				}
				return nil // vanished meanwhile: its parent's event already marked the repo
			}
			if !d.IsDir() || d.Type()&os.ModeSymlink != 0 {
				return nil
			}
			if root.ignored[path] || root.skip[path] || d.Name() == "objects" && isGitDir(filepath.Dir(path)) {
				return filepath.SkipDir
			}
			count++
			if count > gitWatchRepoDirs || w.total >= gitWatchTotalDirs {
				return unix.ENOSPC
			}
			wd, err := unix.InotifyAddWatch(w.fd, path, gitWatchMask)
			if err == unix.ENOENT && path != root.path {
				return filepath.SkipDir // removed meanwhile; the parent's event marks the repo
			}
			if err != nil {
				return err // an unwatched directory would hide its changes
			}
			if !repo.wds[wd] {
				repo.wds[wd] = true
				if w.byWD[wd] == nil {
					w.byWD[wd] = map[*gitRepo]bool{}
					w.total++
				}
				w.byWD[wd][repo] = true
			}
			return nil
		})
		if err != nil {
			return fail()
		}
	}
	// The registered root must still be the directory discovery opened.
	var st unix.Stat_t
	if unix.Lstat(filepath.Join(home, "src", entry.Name), &st) != nil || st.Dev != entry.dev || st.Ino != entry.ino {
		return fail()
	}
	repo.stale = false
	repo.gen++
	return true
}

func isGitDir(path string) bool {
	var st unix.Stat_t
	return unix.Lstat(filepath.Join(path, "HEAD"), &st) == nil && st.Mode&unix.S_IFMT == unix.S_IFREG
}

// gitWatchRoots asks Git for the directories the snapshot's facts depend on:
// the worktree minus what Git ignores, the worktree's Git directory and the
// common directory with refs and configuration. A linked worktree keeps the
// last two outside its tree.
func gitWatchRoots(ctx context.Context, home string, entry Workspace) ([]gitWatchRoot, bool) {
	cfg := transport.Config{Home: home, UID: os.Geteuid()}
	src, _, err := workspaceSource(cfg)
	if err != nil {
		return nil, false
	}
	defer unix.Close(src)
	fd, opened, err := openWorkspace(src, entry.Name)
	if err != nil {
		return nil, false
	}
	defer unix.Close(fd)
	if uint64(opened.Dev) != entry.dev || opened.Ino != entry.ino {
		return nil, false
	}
	read := func(args ...string) ([]byte, error) {
		return cloneCommandWithTimeout(ctx, 2*time.Second, "/usr/bin/git", home, strconv.Itoa(fd), append([]string{"-c", "core.fsmonitor=false", "-c", "core.quotepath=false"}, args...)...)
	}
	dirs, err := read("rev-parse", "--path-format=absolute", "--git-dir", "--git-common-dir")
	lines := strings.Split(strings.TrimSuffix(string(dirs), "\n"), "\n")
	if err != nil || len(lines) != 2 || !filepath.IsAbs(lines[0]) || !filepath.IsAbs(lines[1]) {
		return nil, false
	}
	gitDir, commonDir := filepath.Clean(lines[0]), filepath.Clean(lines[1])
	listed, err := read("ls-files", "-z", "--others", "--ignored", "--exclude-standard", "--directory", "--no-empty-directory")
	if err != nil {
		return nil, false
	}
	root := filepath.Join(home, "src", entry.Name)
	// Git reports paths below the real directory; discovery's path is the
	// account's own, which it checked for symlinks. Map one onto the other.
	real, err := filepath.EvalSymlinks(root)
	if err != nil {
		return nil, false
	}
	ignored := map[string]bool{}
	for _, p := range strings.Split(string(listed), "\x00") {
		if strings.HasSuffix(p, "/") {
			ignored[filepath.Join(root, strings.TrimSuffix(p, "/"))] = true
		}
	}
	under := func(p, dir string) bool { return p == dir || strings.HasPrefix(p, dir+"/") }
	local := func(p string) string {
		if under(p, real) {
			return filepath.Join(root, strings.TrimPrefix(p, real))
		}
		return p
	}
	gitDir, commonDir = local(gitDir), local(commonDir)
	// Other worktrees' state under worktrees/ is not this workspace's; a
	// linked worktree's own Git directory there is watched as its own root.
	skip := map[string]bool{filepath.Join(commonDir, "worktrees"): true}
	roots := []gitWatchRoot{{path: root, ignored: ignored, skip: skip}}
	if !under(commonDir, root) {
		roots = append(roots, gitWatchRoot{path: commonDir, skip: skip})
	}
	if gitDir != commonDir && !under(gitDir, root) {
		roots = append(roots, gitWatchRoot{path: gitDir})
	}
	return roots, true
}

// gitGlobalStamp covers the configuration every Git command here reads
// besides the repository's own (GIT_CONFIG_NOSYSTEM=1 leaves out /etc),
// including symlink targets and included files, and Git itself. When it
// cannot be made, every snapshot gets a stamp of its own: nothing is reused.
func gitGlobalStamp(home string) string {
	config, ok := nativegh.GitConfigStamp(home)
	program, err := stampOf("/usr/bin/git")
	if !ok || err != nil {
		id, _ := uuid()
		return "unstamped:" + id
	}
	return config + fmt.Sprintf("%v", program)
}
