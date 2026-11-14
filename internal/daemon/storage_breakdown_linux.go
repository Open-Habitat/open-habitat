//go:build linux

package daemon

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"

	"golang.org/x/sys/unix"

	"github.com/open-habitat/open-habitat/internal/transport"
)

// StorageBreakdownPath answers what fills the person's home: the known
// regenerable caches, the build directories of worktrees and checkouts, the
// Trash, workspaces and agent history. The quota itself is the broker's
// (/api/v1/account/storage); this only names its larger parts.
const StorageBreakdownPath = "/api/v1/account/storage/breakdown"

const (
	// A result older than this is measured again when Storage reads it.
	breakdownStale = 15 * time.Minute
	// Asking again sooner than this returns the running or last result.
	breakdownMinInterval = 30 * time.Second
	// One measurement walks at most this long and this many entries; a go
	// build cache alone can hold hundreds of thousands of files.
	breakdownLimit  = 3 * time.Minute
	breakdownBudget = 4_000_000
	breakdownItems  = 1900
)

// breakdownItem is one measured place; Path is below home, "~/...".
type breakdownItem struct {
	Group     string `json:"group"`
	Kind      string `json:"kind"`
	Path      string `json:"path"`
	Bytes     int64  `json:"bytes"`
	Complete  bool   `json:"complete"`
	Workspace string `json:"workspace,omitempty"`
	RunID     string `json:"run_id,omitempty"`
	Title     string `json:"title,omitempty"`
	Merged    bool   `json:"merged,omitempty"`
}

type breakdownResult struct {
	at       time.Time
	complete bool
	items    []breakdownItem
}

// storageBreakdown holds the latest result in memory only: a restart
// measures again, and no second record of the home is kept on disk.
type storageBreakdown struct {
	cfg     transport.Config
	measure func(context.Context, transport.Config) breakdownResult
	now     func() time.Time

	mu        sync.Mutex
	result    *breakdownResult
	measuring bool
	started   time.Time
	done      chan struct{} // closed when the running measurement ends
}

func newStorageBreakdown(cfg transport.Config) *storageBreakdown {
	return &storageBreakdown{cfg: cfg, measure: measureStorage, now: time.Now}
}

// start begins a measurement unless one runs or one began moments ago. It
// never waits for it.
func (b *storageBreakdown) start(force bool) {
	b.mu.Lock()
	defer b.mu.Unlock()
	now := b.now()
	if b.measuring || (!b.started.IsZero() && now.Sub(b.started) < breakdownMinInterval) {
		return
	}
	if !force && b.result != nil && now.Sub(b.result.at) < breakdownStale {
		return
	}
	b.measuring, b.started, b.done = true, now, make(chan struct{})
	done := b.done
	go func() {
		defer close(done)
		// The walk runs on its own thread at the lowest CPU and I/O
		// priority, so the person's agents and builds go first. The thread
		// is never unlocked: it ends with the goroutine and takes its
		// priority with it.
		runtime.LockOSThread()
		tid := unix.Gettid()
		_ = unix.Setpriority(unix.PRIO_PROCESS, tid, 19)
		const ioprioWhoProcess, ioprioClassIdle = 1, 3
		_, _, _ = unix.Syscall(unix.SYS_IOPRIO_SET, ioprioWhoProcess, uintptr(tid), ioprioClassIdle<<13)
		ctx, cancel := context.WithTimeout(context.Background(), breakdownLimit)
		defer cancel()
		r := b.measure(ctx, b.cfg)
		r.at = b.now()
		b.mu.Lock()
		b.result, b.measuring = &r, false
		b.mu.Unlock()
	}()
}

func (b *storageBreakdown) reply() map[string]any {
	b.mu.Lock()
	defer b.mu.Unlock()
	body := map[string]any{"schema_version": 1, "measuring": b.measuring, "complete": false, "items": []breakdownItem{}}
	if b.result != nil {
		body["measured_at"] = b.result.at.UTC().Format(time.RFC3339)
		body["complete"] = b.result.complete
		body["items"] = b.result.items
	}
	return body
}

// StorageBreakdownHandler measures only its own person's home; nothing it
// is sent names a path.
func StorageBreakdownHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return newStorageBreakdown(cfg).handler(trusted)
}

func (b *storageBreakdown) handler(trusted func(*http.Request) bool) http.Handler {
	cfg := b.cfg
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		post := r.Method == http.MethodPost
		if r.URL.Path != StorageBreakdownPath || r.URL.EscapedPath() != StorageBreakdownPath || r.URL.RawQuery != "" || len(r.TransferEncoding) != 0 || (!post && r.Method != http.MethodGet) || (!post && r.ContentLength > 0) {
			snapshotError(w, 400, "invalid_request")
			return
		}
		if cfg.UID != os.Geteuid() || cfg.Home == "" {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		if post {
			if r.ContentLength < 2 || r.ContentLength > 64 || r.Header.Get("Content-Type") != "application/json" || len(r.Header.Values("Content-Type")) != 1 {
				snapshotError(w, 400, "invalid_request")
				return
			}
			var in struct {
				Measure bool `json:"measure"`
			}
			raw, err := io.ReadAll(io.LimitReader(r.Body, 65))
			dec := json.NewDecoder(bytes.NewReader(raw))
			dec.DisallowUnknownFields()
			if err != nil || !catalogNoDuplicates(raw) || dec.Decode(&in) != nil || !in.Measure || dec.Decode(new(any)) != io.EOF {
				snapshotError(w, 400, "invalid_request")
				return
			}
		}
		b.start(post)
		historyJSON(w, b.reply())
	})
}

// knownCaches are the tools' own caches in their default places, each of
// which the tool fills again when it needs it.
var knownCaches = []struct{ kind, rel string }{
	{"go-build", ".cache/go-build"},
	{"go-mod", "go/pkg/mod"},
	{"npm", ".npm/_cacache"},
	{"npm", ".npm/_npx"},
	{"cargo", ".cargo/registry"},
	{"cargo", ".cargo/git"},
	{"playwright", ".cache/ms-playwright"},
	{"uv", ".cache/uv"},
	{"pip", ".cache/pip"},
}

// cacheDirTag is the Cache Directory Tagging Specification's signature.
const cacheDirTag = "Signature: 8a477f597d28d172789f06886806bc55"

type fileID struct{ dev, ino uint64 }

// homeWalk sizes trees below one pinned home: allocated blocks, symbolic
// links never followed, other filesystems never entered, each hard-linked
// file counted once, and the places measured on their own skipped.
type homeWalk struct {
	ctx    context.Context
	home   int
	dev    uint64
	budget int
	seen   map[fileID]bool
	skip   map[fileID]bool
}

func (z *homeWalk) open(rel string) (int, unix.Stat_t, bool) {
	fd, err := dir(unix.Openat2, z.home, rel, true)
	if err != nil {
		return -1, unix.Stat_t{}, false
	}
	s, err := stat(fd)
	if err != nil || uint64(s.Dev) != z.dev {
		unix.Close(fd)
		return -1, unix.Stat_t{}, false
	}
	return fd, s, true
}

// size measures rel; ok is false when it is not a directory on the home's
// filesystem.
func (z *homeWalk) size(rel string) (int64, bool, bool) {
	fd, s, ok := z.open(rel)
	if !ok {
		return 0, false, false
	}
	defer unix.Close(fd)
	total := s.Blocks * 512
	complete := z.walk(fd, 0, &total)
	return total, complete, true
}

func (z *homeWalk) exhausted() bool { return z.budget < 0 || z.ctx.Err() != nil }

func (z *homeWalk) walk(fd, depth int, total *int64) bool {
	// Checked before listing: a directory's names are read whole.
	if depth > 256 || z.exhausted() {
		return false
	}
	names, err := readDirNames(fd, 1<<20)
	if err != nil {
		return false
	}
	complete := true
	for _, name := range names {
		z.budget--
		if z.budget < 0 || z.ctx.Err() != nil {
			return false
		}
		var s unix.Stat_t
		if unix.Fstatat(fd, name, &s, unix.AT_SYMLINK_NOFOLLOW) != nil {
			complete = false
			continue
		}
		id := fileID{uint64(s.Dev), s.Ino}
		if s.Mode&unix.S_IFMT == unix.S_IFDIR {
			if z.skip[id] {
				continue
			}
			if uint64(s.Dev) != z.dev {
				complete = false
				continue
			}
			*total += s.Blocks * 512
			child, err := dir(unix.Openat2, fd, name, true)
			if err != nil {
				complete = false
				continue
			}
			if !z.walk(child, depth+1, total) {
				complete = false
			}
			unix.Close(child)
			continue
		}
		if s.Nlink > 1 {
			if z.seen[id] {
				continue
			}
			z.seen[id] = true
		}
		*total += s.Blocks * 512
	}
	return complete
}

// exists reports whether rel names an entry of the given type, without
// following a symbolic link.
func (z *homeWalk) exists(rel string, mode uint32) bool {
	parent, err := dir(unix.Openat2, z.home, filepath.Dir(rel), true)
	if err != nil {
		return false
	}
	defer unix.Close(parent)
	var s unix.Stat_t
	return unix.Fstatat(parent, filepath.Base(rel), &s, unix.AT_SYMLINK_NOFOLLOW) == nil && s.Mode&unix.S_IFMT == mode
}

// readSmall reads at most limit bytes of a regular file below home. It
// opens without blocking and refuses anything else, so a FIFO named like a
// tag cannot hold the measurement.
func (z *homeWalk) readSmall(rel string, limit int) []byte {
	fd, err := open(unix.Openat2, z.home, rel, unix.O_RDONLY|unix.O_NONBLOCK, true)
	if err != nil {
		return nil
	}
	defer unix.Close(fd)
	if s, err := stat(fd); err != nil || s.Mode&unix.S_IFMT != unix.S_IFREG {
		return nil
	}
	buf := make([]byte, limit)
	n := 0
	for n < len(buf) {
		m, err := unix.Read(fd, buf[n:])
		if err != nil || m <= 0 {
			break
		}
		n += m
	}
	return buf[:n]
}

func (z *homeWalk) tagged(rel string) bool {
	return string(z.readSmall(filepath.Join(rel, "CACHEDIR.TAG"), len(cacheDirTag))) == cacheDirTag
}

func (z *homeWalk) names(rel string, limit int) []string {
	fd, _, ok := z.open(rel)
	if !ok {
		return nil
	}
	defer unix.Close(fd)
	names, err := readDirNames(fd, limit)
	if err != nil {
		return nil
	}
	sort.Strings(names)
	return names
}

func (z *homeWalk) id(rel string) (fileID, bool) {
	fd, s, ok := z.open(rel)
	if !ok {
		return fileID{}, false
	}
	unix.Close(fd)
	return fileID{uint64(s.Dev), s.Ino}, true
}

// goEnvPath reads one path from the person's `go env -w` file. A value
// outside the home is not the home's to count.
//
// Unlike the measured places, the file is read through symbolic links:
// dotfile managers link ~/.config, and the read is the person's own. It is
// opened without blocking and must be a regular file, so a FIFO cannot hold
// the measurement.
func goEnvPath(home, key string) (string, bool) {
	f, err := os.OpenFile(filepath.Join(home, ".config", "go", "env"), os.O_RDONLY|unix.O_NONBLOCK, 0)
	if err != nil {
		return "", false
	}
	defer f.Close()
	if st, err := f.Stat(); err != nil || !st.Mode().IsRegular() {
		return "", false
	}
	sc := bufio.NewScanner(io.LimitReader(f, 64<<10))
	for sc.Scan() {
		k, v, ok := strings.Cut(sc.Text(), "=")
		if !ok || strings.TrimSpace(k) != key {
			continue
		}
		v = filepath.Clean(strings.TrimSpace(v))
		rel, err := filepath.Rel(home, v)
		if !filepath.IsAbs(v) || err != nil || rel == "." || strings.HasPrefix(rel, "..") {
			return "", false
		}
		return rel, true
	}
	return "", false
}

// buildDirs are a root's own Cargo target and node_modules, and those one
// level down (a web/ beside a Go module). A directory holding a linked
// worktree's .git file is that worktree's, not this root's.
func (z *homeWalk) buildDirs(root string) []struct{ kind, rel string } {
	var out []struct{ kind, rel string }
	look := func(base string) {
		if t := filepath.Join(base, "target"); z.exists(t, unix.S_IFDIR) && z.tagged(t) {
			out = append(out, struct{ kind, rel string }{"target", t})
		}
		if n := filepath.Join(base, "node_modules"); z.exists(n, unix.S_IFDIR) && z.exists(filepath.Join(base, "package.json"), unix.S_IFREG) {
			out = append(out, struct{ kind, rel string }{"node_modules", n})
		}
	}
	look(root)
	for _, name := range z.names(root, 512) {
		if strings.HasPrefix(name, ".") || name == "target" || name == "node_modules" {
			continue
		}
		child := filepath.Join(root, name)
		if !z.exists(child, unix.S_IFDIR) || z.exists(filepath.Join(child, ".git"), unix.S_IFREG) {
			continue
		}
		look(child)
	}
	return out
}

// worktreeGroup tells a live worker's build directory from a finished
// one's by the same Taskfleet facts that block a worktree's removal: a
// live run, or a run state that could not be read, keeps it live.
func worktreeGroup(o *worktreeObs) (group string, merged bool) {
	for _, b := range o.view.Blockers {
		if b.Kind == "taskfleet_run" || b.Kind == "process" || (b.Kind == "unknown" && b.Check == "taskfleet") {
			return "live", false
		}
	}
	if o.view.Owner != nil {
		if o.view.Owner.State == "ended" {
			return "finished", false
		}
		return "live", false
	}
	if o.view.State == "merged" {
		return "finished", true
	}
	return "own", false
}

func workspaceOf(rel string) string {
	if rest, ok := strings.CutPrefix(rel, "src/"); ok {
		name, _, _ := strings.Cut(rest, "/")
		return name
	}
	return ""
}

// measureStorage walks the fixed places of cfg's home. It reads the home
// as its own person and nothing outside it.
func measureStorage(ctx context.Context, cfg transport.Config) breakdownResult {
	res := breakdownResult{complete: true, items: []breakdownItem{}}
	home, err := unix.Open(cfg.Home, unix.O_DIRECTORY|unix.O_RDONLY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err != nil {
		res.complete = false
		return res
	}
	defer unix.Close(home)
	hs, err := stat(home)
	if err != nil {
		res.complete = false
		return res
	}
	z := &homeWalk{ctx: ctx, home: home, dev: uint64(hs.Dev), budget: breakdownBudget, seen: map[fileID]bool{}, skip: map[fileID]bool{}}
	add := func(it breakdownItem) {
		if len(res.items) >= breakdownItems {
			res.complete = false
			return
		}
		if !it.Complete {
			res.complete = false
		}
		res.items = append(res.items, it)
	}
	measure := func(rel string, it breakdownItem) {
		if z.exhausted() {
			res.complete = false
			return
		}
		id, ok := z.id(rel)
		if !ok || z.skip[id] {
			return
		}
		if n, complete, ok := z.size(rel); ok {
			z.skip[id] = true
			it.Path, it.Bytes, it.Complete = "~/"+rel, n, complete
			if len(it.Path) <= 4096 {
				add(it)
			}
		}
	}
	// Build directories first: the workspaces' sizes leave them out.
	type found struct {
		kind, rel string
		item      breakdownItem
	}
	var builds []found
	taken := map[fileID]bool{}
	obs, truncated, complete, code := observeWorktrees(ctx, cfg, nil, "", false)
	if code != "" || truncated || !complete {
		res.complete = false
	}
	for i := range obs {
		o := &obs[i]
		if o.path == "" || o.view.State == "missing" || o.outside {
			continue
		}
		rel, err := filepath.Rel(cfg.Home, o.path)
		if err != nil || rel == "." || strings.HasPrefix(rel, "..") {
			continue
		}
		group, merged := worktreeGroup(o)
		for _, d := range z.buildDirs(rel) {
			id, ok := z.id(d.rel)
			if !ok || taken[id] {
				continue
			}
			taken[id] = true
			it := breakdownItem{Group: group, Kind: d.kind, Workspace: workspaceOf(rel), Merged: merged}
			if o.view.Owner != nil {
				it.RunID, it.Title = o.view.Owner.RunID, o.view.Owner.Title
			}
			builds = append(builds, found{d.kind, d.rel, it})
		}
	}
	srcNames := z.names("src", 4096)
	for _, name := range srcNames {
		root := filepath.Join("src", name)
		// A linked worktree here is classified only through its registry
		// and Taskfleet, above; one not seen there is never "own".
		if strings.HasPrefix(name, ".") || !z.exists(root, unix.S_IFDIR) || z.exists(filepath.Join(root, ".git"), unix.S_IFREG) {
			continue
		}
		for _, d := range z.buildDirs(root) {
			id, ok := z.id(d.rel)
			if !ok || taken[id] {
				continue
			}
			taken[id] = true
			builds = append(builds, found{d.kind, d.rel, breakdownItem{Group: "own", Kind: d.kind, Workspace: name}})
		}
	}
	// Caches next: the largest freeable space is usually there.
	caches := []struct{ kind, rel string }{}
	for _, c := range knownCaches {
		rel := c.rel
		if c.kind == "go-build" {
			if v, ok := goEnvPath(cfg.Home, "GOCACHE"); ok {
				rel = v
			}
		}
		if c.kind == "go-mod" {
			if v, ok := goEnvPath(cfg.Home, "GOMODCACHE"); ok {
				rel = v
			}
		}
		caches = append(caches, struct{ kind, rel string }{c.kind, rel})
	}
	known := map[string]bool{}
	for _, c := range caches {
		known[c.rel] = true
	}
	for _, name := range z.names(".cache", 512) {
		rel := filepath.Join(".cache", name)
		if !known[rel] && z.exists(rel, unix.S_IFDIR) && z.tagged(rel) {
			caches = append(caches, struct{ kind, rel string }{"cache-tag", rel})
		}
	}
	for _, c := range caches {
		measure(c.rel, breakdownItem{Group: "caches", Kind: c.kind})
	}
	for _, b := range builds {
		measure(b.rel, b.item)
	}
	measure(".local/share/Trash", breakdownItem{Group: "trash", Kind: "trash"})
	measure(historyRoot, breakdownItem{Group: "history", Kind: "history"})
	measure(".pi/agent/file-history", breakdownItem{Group: "history", Kind: "history"})
	for _, name := range srcNames {
		root := filepath.Join("src", name)
		if strings.HasPrefix(name, ".") || !z.exists(root, unix.S_IFDIR) {
			continue
		}
		measure(root, breakdownItem{Group: "workspaces", Kind: "workspace", Workspace: name})
	}
	if ctx.Err() != nil || z.budget < 0 {
		res.complete = false
	}
	return res
}
