//go:build linux

package daemon

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/open-habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

// Worktree cleanup (ADR 0025): the daemon lists every linked worktree of the
// person's Git workspaces from Git's own registry and removes one on request
// with the Trash's safety rules (ADR 0019). Nothing about a worktree is
// stored; each listing and each removal reads Git again.
func worktreeAction(action string) bool {
	switch action {
	case "worktree_list", "worktree_remove", "worktree_clean_merged":
		return true
	}
	return false
}

// Bounds of one listing. A workspace with more registry entries than the
// limit is listed in part and says so.
const (
	worktreeListLimit   = 200
	worktreeGitLimit    = 3 * time.Second
	worktreeCommitLimit = 30 * time.Second
)

var worktreeTokenPattern = regexp.MustCompile(`^wt_[A-Za-z0-9_-]{24}$`)

// The commit message of "Tallenna muutokset haaraan ja poista". It names
// the host so that a person reading the branch later knows where it came from.
const worktreeSaveMessage = "Tallennettu ennen worktreen poistoa (open-habitat)"

type worktreeView struct {
	WorkspaceID      string            `json:"workspace_id"`
	WorkspaceName    string            `json:"workspace_name"`
	Entry            string            `json:"entry"`
	Name             string            `json:"name"`
	Path             string            `json:"path,omitempty"`
	State            string            `json:"state"` // merged, unmerged, dirty, missing, locked, unknown
	Branch           string            `json:"branch,omitempty"`
	Head             string            `json:"head,omitempty"`
	Base             string            `json:"base,omitempty"`
	Ahead            *int              `json:"ahead,omitempty"`
	Changed          int               `json:"changed"`
	Untracked        int               `json:"untracked"`
	Ignored          int               `json:"ignored"`
	IgnoredPaths     []string          `json:"ignored_paths"`
	UnreachableHead  bool              `json:"unreachable_head"`
	LockedReason     string            `json:"locked_reason,omitempty"`
	Conversations    *int              `json:"conversations,omitempty"`
	SizeBytes        *int64            `json:"size_bytes,omitempty"`
	SizeComplete     *bool             `json:"size_complete,omitempty"`
	Blockers         []deletionBlocker `json:"blockers"`
	Owner            *worktreeOwner    `json:"owner,omitempty"`
	Actions          []string          `json:"actions"`
	ObservationToken string            `json:"observation_token"`
}

// worktreeObs is one registry entry as observed now. The private fields are
// what a removal binds to; none of them is taken from the browser.
type worktreeObs struct {
	view               worktreeView
	wsName             string
	wsDev, wsIno       uint64
	path               string // absolute, as Git's registry names it
	adminDev, adminIno uint64
	dev, ino           uint64 // the checkout directory; zero when missing
	branchRef, baseRef string
	digest             string
	outside            bool
}

func (o *worktreeObs) token() string {
	v := o.view
	ahead := -1
	if v.Ahead != nil {
		ahead = *v.Ahead
	}
	return opaque("wt_", strings.Join([]string{
		v.WorkspaceID, strconv.FormatUint(o.wsDev, 10), strconv.FormatUint(o.wsIno, 10),
		v.Entry, strconv.FormatUint(o.adminDev, 10), strconv.FormatUint(o.adminIno, 10),
		o.path, strconv.FormatUint(o.dev, 10), strconv.FormatUint(o.ino, 10),
		v.State, o.branchRef, v.Head, o.baseRef, strconv.Itoa(ahead),
		strconv.Itoa(v.Changed), strconv.Itoa(v.Untracked), o.digest,
		strconv.FormatBool(v.UnreachableHead), v.LockedReason, blockerKey(v.Blockers),
		strconv.Itoa(v.Ignored), strings.Join(v.IgnoredPaths, "\x01"),
	}, "\x00"))
}

// blockerKey is part of the token: a removal the person saw blocked is not
// carried out on a later click, even when the blocker has gone meanwhile.
func blockerKey(blockers []deletionBlocker) string {
	var b strings.Builder
	for _, x := range blockers {
		fmt.Fprintf(&b, "%q %q %q;", x.Kind, x.Check, x.RunID)
	}
	return b.String()
}

// finish settles the actions the daemon would accept now and the token
// that names exactly these facts.
func (o *worktreeObs) finish() {
	v := &o.view
	v.Actions = []string{}
	if len(v.Blockers) == 0 {
		switch v.State {
		case "missing":
			v.Actions = []string{"prune"}
		case "merged":
			v.Actions = []string{"remove"}
		case "unmerged":
			// A detached HEAD that no ref contains would be lost with the
			// checkout; that is a forced removal.
			if v.UnreachableHead {
				v.Actions = []string{"force"}
			} else {
				v.Actions = []string{"remove"}
			}
		case "dirty":
			if o.branchRef != "" {
				v.Actions = []string{"commit", "force"}
			} else {
				v.Actions = []string{"force"}
			}
		}
	}
	v.ObservationToken = o.token()
}

func serveWorktrees(w http.ResponseWriter, cfg transport.Config, c *ConversationController, in workspaceRequest) {
	if in.Name != "" || in.UserObservationToken != "" || in.DisplayName != nil || in.Git != nil || in.Hidden != nil || in.AgentID != "" || in.Archived != nil || in.PreviousArchive != "" {
		snapshotError(w, 400, "invalid_request")
		return
	}
	if in.WorkspaceID != "" && !idPattern.MatchString(in.WorkspaceID) {
		snapshotError(w, 400, "invalid_request")
		return
	}
	switch in.Action {
	case "worktree_list":
		if in.ObservationToken != "" || in.Entry != "" || in.Disposal != "" || in.Confirmation != "" || in.ListingToken != "" {
			snapshotError(w, 400, "invalid_request")
			return
		}
	case "worktree_remove":
		valid := in.WorkspaceID != "" && validTrashEntry(in.Entry) && worktreeTokenPattern.MatchString(in.ObservationToken) && in.ListingToken == "" && len(in.Confirmation) <= 255
		switch in.Disposal {
		case "remove", "commit", "prune":
			valid = valid && in.Confirmation == ""
		case "force":
			valid = valid && in.Confirmation != ""
		default:
			valid = false
		}
		if !valid {
			snapshotError(w, 400, "invalid_request")
			return
		}
	case "worktree_clean_merged":
		if !listingTokenPattern.MatchString(in.ListingToken) || in.ObservationToken != "" || in.Entry != "" || in.Disposal != "" || in.Confirmation != "" {
			snapshotError(w, 400, "invalid_request")
			return
		}
	}
	// Managed sessions are the controller's; without it nothing can prove
	// that no conversation runs in the worktree.
	if c == nil {
		snapshotError(w, 503, "daemon_unavailable")
		return
	}
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(deletionWalkLimit + worktreeCommitLimit + 2*deletionCheckLimit + 10*time.Second))
	switch in.Action {
	case "worktree_list":
		listWorktrees(w, cfg, c, in.WorkspaceID)
	case "worktree_remove":
		removeOneWorktree(w, cfg, c, in)
	case "worktree_clean_merged":
		cleanMergedWorktrees(w, cfg, c, in.WorkspaceID, in.ListingToken)
	}
}

// worktreeListingToken names the merged worktrees a listing showed, so that
// "Siivoa kaikki yhdistetyt" removes only that set.
func worktreeListingToken(scope string, obs []worktreeObs) string {
	h := sha256.New()
	fmt.Fprintf(h, "%q\n", scope)
	for i := range obs {
		if obs[i].view.State == "merged" {
			fmt.Fprintf(h, "%q %q %q\n", obs[i].view.WorkspaceID, obs[i].view.Entry, obs[i].view.ObservationToken)
		}
	}
	return hex.EncodeToString(h.Sum(nil))
}

func listWorktrees(w http.ResponseWriter, cfg transport.Config, c *ConversationController, scope string) {
	ctx, cancel := context.WithTimeout(context.Background(), deletionCheckLimit)
	defer cancel()
	obs, truncated, complete, code := observeWorktrees(ctx, cfg, c, scope, true)
	if code != "" {
		snapshotError(w, 409, code)
		return
	}
	views := make([]worktreeView, 0, len(obs))
	for _, o := range obs {
		views = append(views, o.view)
	}
	body := map[string]any{"schema_version": 1, "state": "listed", "worktrees": views, "truncated": truncated, "complete": complete, "listing_token": worktreeListingToken(scope, obs)}
	if scope != "" {
		body["workspace_id"] = scope
	}
	historyJSON(w, body)
}

// observeWorktrees reads the registries of the Git workspaces in scope (all
// of them when scope is empty). complete is false when a workspace's
// registry could not be read; its worktrees are then missing from the list.
func observeWorktrees(ctx context.Context, cfg transport.Config, c *ConversationController, scope string, extras bool) ([]worktreeObs, bool, bool, string) {
	discovery := Discover(cfg)
	if discovery.State == "error" || discovery.Error != "" {
		return nil, false, false, "workspace_uncertain"
	}
	src, _, err := workspaceSource(cfg)
	if err != nil {
		return nil, false, false, "workspace_uncertain"
	}
	defer unix.Close(src)
	var sessions []nativeSession
	sessionsOK := false
	if extras {
		s, err := nativeSessions(cfg)
		sessions, sessionsOK = s, err == nil
	}
	sizeCtx, sizeCancel := context.WithTimeout(ctx, trashListSizeLimit)
	defer sizeCancel()
	budget := trashListSizeBudget
	out := []worktreeObs{}
	truncated, complete, found := false, true, scope == ""
	for _, entry := range discovery.Entries {
		wid := entry.WorkspaceID
		if wid == "" {
			wid = opaque("ws_", cfg.Provider+":"+cfg.Subject+":"+entry.Name)
		}
		if scope != "" && wid != scope {
			continue
		}
		if entry.Error != "" || entry.Metadata == "error" || entry.Kind == "unknown" {
			if scope != "" {
				return nil, false, false, "workspace_uncertain"
			}
			complete = false
			continue
		}
		found = true
		if entry.Kind != "git_main_worktree" {
			continue
		}
		fd, opened, err := openWorkspace(src, entry.Name)
		if err != nil {
			complete = false
			continue
		}
		if uint64(opened.Dev) != entry.dev || opened.Ino != entry.ino {
			unix.Close(fd)
			complete = false
			continue
		}
		ws, ok := observeRegistry(ctx, cfg, entry, wid, fd, "", worktreeListLimit-len(out))
		unix.Close(fd)
		if !ok {
			complete = false
		}
		if len(ws) > worktreeListLimit-len(out) {
			ws, truncated = ws[:worktreeListLimit-len(out)], true
		}
		for i := range ws {
			o := &ws[i]
			if extras && o.view.State != "missing" {
				if sessionsOK {
					n := countConversations(sessions, o.path)
					o.view.Conversations = &n
				}
				if size, done, ok := worktreeSize(sizeCtx, cfg.Home, o, &budget); ok {
					o.view.SizeBytes, o.view.SizeComplete = &size, &done
				}
			}
		}
		out = append(out, ws...)
		if truncated {
			break
		}
	}
	if !found {
		return nil, false, false, "workspace_missing"
	}
	return out, truncated, complete, ""
}

func worktreeSize(ctx context.Context, home string, o *worktreeObs, budget *int) (int64, bool, bool) {
	fd, ok := openCheckout(home, o.path)
	if ok != nil {
		return 0, false, false
	}
	defer unix.Close(fd)
	if s, e := stat(fd); e != nil || uint64(s.Dev) != o.dev || s.Ino != o.ino {
		return 0, false, false
	}
	size, complete := treeSizeWithin(ctx, fd, budget)
	return size, complete, true
}

// observeRegistry reads $GIT_DIR/worktrees of one pinned main checkout, the
// registry `git worktree list` reads. With only set, it observes that entry
// alone. ok is false when the registry itself could not be read.
func observeRegistry(ctx context.Context, cfg transport.Config, entry Workspace, wid string, wsFd int, only string, limit int) ([]worktreeObs, bool) {
	wsPath := filepath.Join(cfg.Home, "src", entry.Name)
	trees, err := dir(unix.Openat2, wsFd, ".git/worktrees", true)
	if errors.Is(err, unix.ENOENT) {
		return nil, true
	}
	if err != nil {
		return nil, false
	}
	defer unix.Close(trees)
	names, err := readDirNames(trees, 4096)
	if err != nil {
		return nil, false
	}
	sort.Strings(names)
	mainBranch := ""
	if b, e := worktreeGit(ctx, cfg.Home, wsFd, "symbolic-ref", "--quiet", "HEAD"); e == nil && len(b) <= 512 {
		mainBranch = strings.TrimSpace(string(b))
	}
	var out []worktreeObs
	for _, id := range names {
		if only != "" && id != only || !validTrashEntry(id) {
			continue
		}
		if len(out) > limit {
			break
		}
		o := worktreeObs{wsName: entry.Name, wsDev: entry.dev, wsIno: entry.ino, view: worktreeView{WorkspaceID: wid, WorkspaceName: entry.Name, Entry: id, IgnoredPaths: []string{}, Blockers: []deletionBlocker{}}}
		observeEntry(ctx, cfg.Home, wsPath, trees, wsFd, mainBranch, &o)
		out = append(out, o)
	}
	if len(out) > 0 {
		blockers, owners, ok := worktreeRuns(ctx, cfg.Home, wsPath, out)
		for i := range out {
			if !ok {
				out[i].view.Blockers = append(out[i].view.Blockers, deletionBlocker{Kind: "unknown", Check: "taskfleet"})
			} else if b, live := blockers[i]; live {
				out[i].view.Blockers = append(out[i].view.Blockers, b)
			}
			out[i].view.Owner = owners[i]
			out[i].finish()
		}
	}
	return out, true
}

func worktreeGit(ctx context.Context, home string, fd int, args ...string) ([]byte, error) {
	return cloneCommandWithTimeout(ctx, worktreeGitLimit, "/usr/bin/git", home, strconv.Itoa(fd), append([]string{"-c", "core.fsmonitor=false", "-c", "core.quotepath=false", "-c", "core.hooksPath=/dev/null"}, args...)...)
}

func gitExit(e error) int {
	var exit *nativeCommandExit
	if errors.As(e, &exit) {
		return exit.Code
	}
	return -1
}

// observeEntry fills one registry entry: where Git says its checkout is,
// whether the checkout still points back to this entry, and its Git state.
func observeEntry(ctx context.Context, home, wsPath string, trees, wsFd int, mainBranch string, o *worktreeObs) {
	v := &o.view
	v.State = "unknown"
	unknown := func() { v.Blockers = append(v.Blockers, deletionBlocker{Kind: "unknown", Check: "worktrees"}) }
	// Until the registry names the checkout, the row is its entry.
	v.Name = v.Entry
	admin, err := dir(unix.Openat2, trees, v.Entry, true)
	if err != nil {
		unknown()
		return
	}
	defer unix.Close(admin)
	as, err := stat(admin)
	if err != nil {
		unknown()
		return
	}
	o.adminDev, o.adminIno = uint64(as.Dev), as.Ino
	b, status := readSmall(unix.Openat2, admin, "gitdir", 4096)
	if status != "valid" || !utf8.Valid(b) {
		unknown()
		return
	}
	target := strings.TrimSuffix(string(b), "\n")
	if target == "" || strings.ContainsAny(target, "\x00\n") {
		unknown()
		return
	}
	if !filepath.IsAbs(target) {
		target = filepath.Join(wsPath, ".git", "worktrees", v.Entry, target)
	}
	target = filepath.Clean(target)
	if filepath.Base(target) != ".git" {
		unknown()
		return
	}
	o.path = filepath.Dir(target)
	v.Name, v.Path = filepath.Base(o.path), displayHomePath(home, o.path)
	if lock, status := readSmall(unix.Openat2, admin, "locked", 4096); status == "valid" {
		v.State, v.LockedReason = "locked", lockReason(lock)
		return
	} else if status != "missing" {
		unknown()
		return
	}
	var ls unix.Stat_t
	if err := unix.Lstat(o.path, &ls); errors.Is(err, unix.ENOENT) {
		v.State = "missing"
		return
	} else if err != nil {
		unknown()
		return
	}
	o.outside = !insidePath(o.path, home) || o.path == home || insidePath(wsPath, o.path) || insidePath(filepath.Join(home, "src"), o.path)
	if o.outside {
		v.Blockers = append(v.Blockers, deletionBlocker{Kind: "outside_home", Path: v.Path})
	}
	fd, err := openCheckout(home, o.path)
	if err != nil {
		unknown()
		return
	}
	defer unix.Close(fd)
	s, err := stat(fd)
	if err != nil || !same(s, ls) {
		unknown()
		return
	}
	o.dev, o.ino = uint64(s.Dev), s.Ino
	// Git links both ways: the checkout's .git file names this registry
	// entry. A directory that does not is not this worktree's checkout.
	if !gitfileNames(fd, o.path, as) {
		unknown()
		return
	}
	readWorktreeGit(ctx, home, fd, mainBranch, o)
}

// openCheckout pins a directory by descriptor without following symlinks.
// Below home no mount is crossed, which is where a removal may act; a
// directory elsewhere is opened only to be read.
func openCheckout(home, path string) (int, error) {
	root, e := unix.Open("/", unix.O_PATH|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if e != nil {
		return -1, e
	}
	defer unix.Close(root)
	if !insidePath(path, home) || path == home {
		return dir(unix.Openat2, root, strings.TrimPrefix(path, "/"), false)
	}
	h, e := dir(unix.Openat2, root, strings.TrimPrefix(home, "/"), false)
	if e != nil {
		return -1, e
	}
	defer unix.Close(h)
	return dir(unix.Openat2, h, strings.TrimPrefix(path, home+"/"), true)
}

func gitfileNames(fd int, path string, admin unix.Stat_t) bool {
	b, status := readSmall(unix.Openat2, fd, ".git", maxGitfile)
	if status != "valid" || !strings.HasPrefix(string(b), "gitdir: ") {
		return false
	}
	target := strings.TrimSpace(string(b[len("gitdir: "):]))
	if !filepath.IsAbs(target) {
		target = filepath.Join(path, target)
	}
	// Identity only: the target is compared with the pinned registry entry,
	// never opened or acted on.
	var s unix.Stat_t
	return unix.Stat(target, &s) == nil && same(s, admin)
}

func displayHomePath(home, path string) string {
	if insidePath(path, home) && path != home {
		return "~/" + strings.TrimPrefix(path, home+"/")
	}
	return path
}

// lockReason keeps the text `git worktree lock --reason` wrote, as plain
// printable text.
func lockReason(b []byte) string {
	if !utf8.Valid(b) {
		return ""
	}
	s := strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return ' '
		}
		return r
	}, strings.TrimSpace(string(b)))
	if utf8.RuneCountInString(s) > 200 {
		s = string([]rune(s)[:200])
	}
	return s
}

// readWorktreeGit reads the worktree's branch, status, base and whether the
// branch is merged into it. Every read that fails leaves the state unknown.
func readWorktreeGit(ctx context.Context, home string, fd int, mainBranch string, o *worktreeObs) {
	v := &o.view
	git := func(args ...string) ([]byte, error) { return worktreeGit(ctx, home, fd, args...) }
	if b, e := git("symbolic-ref", "--quiet", "HEAD"); e == nil && len(b) <= 512 {
		o.branchRef = strings.TrimSpace(string(b))
		if !strings.HasPrefix(o.branchRef, "refs/heads/") {
			return
		}
		v.Branch = strings.TrimPrefix(o.branchRef, "refs/heads/")
	} else if gitExit(e) != 1 {
		return
	}
	if b, e := git("rev-parse", "--verify", "--quiet", "HEAD^{commit}"); e == nil {
		v.Head = strings.TrimSpace(string(b))
		if !workspaceCommitHash.MatchString(v.Head) {
			return
		}
	} else if gitExit(e) != 1 {
		return
	}
	status, e := git("status", "--porcelain=v1", "-z", "--untracked-files=normal", "--ignored=traditional")
	if e != nil || len(status) > 1<<20 {
		return
	}
	counts, ok := porcelainCounts(status)
	if !ok {
		return
	}
	v.Changed, v.Untracked, v.Ignored, v.IgnoredPaths = counts.changed, counts.untracked, counts.ignored, counts.ignoredPaths
	o.digest = counts.digest
	merged := false
	if v.Head != "" && o.branchRef != "" {
		b, e := git("for-each-ref", "--format=%(upstream)", o.branchRef)
		if e != nil || len(b) > 512 {
			return
		}
		up := strings.TrimSpace(string(b))
		// The base is the top bar's (readGitBase: the recorded source branch,
		// else origin/HEAD), so both say the same about "merged". Without
		// one, ADR 0025's rule: the branch's local upstream, else the main
		// checkout's branch.
		status := gitStatus{Branch: v.Branch, Upstream: strings.TrimPrefix(strings.TrimPrefix(up, "refs/remotes/"), "refs/heads/")}
		if base := readGitBase(git, status); base != nil {
			o.baseRef, v.Base = base.full, base.Ref
		} else {
			o.baseRef = mainBranch
			if strings.HasPrefix(up, "refs/heads/") {
				o.baseRef = up
			}
			if o.baseRef == o.branchRef || !strings.HasPrefix(o.baseRef, "refs/heads/") {
				o.baseRef = ""
			}
			v.Base = strings.TrimPrefix(o.baseRef, "refs/heads/")
		}
		if o.baseRef != "" {
			_, e := git("merge-base", "--is-ancestor", v.Head, o.baseRef)
			switch gitExit(e) {
			case -1:
				if e != nil {
					return
				}
				merged = true
			case 1:
			default:
				return
			}
			if b, e := git("rev-list", "--count", o.baseRef+".."+v.Head); e == nil {
				if n, err := strconv.Atoi(strings.TrimSpace(string(b))); err == nil && n >= 0 {
					v.Ahead = &n
				}
			}
		}
	}
	if o.branchRef == "" && v.Head != "" {
		b, e := git("for-each-ref", "--count=1", "--format=%(refname)", "--contains", v.Head)
		if e != nil {
			return
		}
		v.UnreachableHead = len(strings.TrimSpace(string(b))) == 0
	}
	switch {
	case v.Changed+v.Untracked > 0:
		v.State = "dirty"
	case merged:
		v.State = "merged"
	default:
		v.State = "unmerged"
	}
}

type statusCounts struct {
	changed, untracked, ignored int
	ignoredPaths, ignoredDirs   []string
	digest                      string // the changed and untracked records
}

// porcelainCounts reads `git status --porcelain=v1 -z --ignored=traditional`.
func porcelainCounts(status []byte) (statusCounts, bool) {
	out := statusCounts{ignoredPaths: []string{}}
	h := sha256.New()
	records := strings.Split(strings.TrimSuffix(string(status), "\x00"), "\x00")
	for i := 0; i < len(records); i++ {
		record := records[i]
		if record == "" {
			continue
		}
		if len(record) < 4 || record[2] != ' ' {
			return out, false
		}
		switch record[:2] {
		case "??":
			out.untracked++
			fmt.Fprintf(h, "%q\n", record)
		case "!!":
			out.ignored++
			if len(out.ignoredPaths) < 20 && len(record) <= 4096+3 {
				out.ignoredPaths = append(out.ignoredPaths, record[3:])
			}
			if strings.HasSuffix(record, "/") {
				out.ignoredDirs = append(out.ignoredDirs, strings.TrimSuffix(record[3:], "/"))
			}
		default:
			out.changed++
			fmt.Fprintf(h, "%q\n", record)
			if strings.ContainsAny(record[:2], "RC") {
				i++
				if i < len(records) {
					fmt.Fprintf(h, "%q\n", records[i])
				}
			}
		}
	}
	out.digest = hex.EncodeToString(h.Sum(nil))
	return out, true
}

// worktreeRuns asks Taskfleet, with the argv the deletion check uses, which
// runs of this repository own a listed worktree. A run that owns one blocks
// unless it has ended: done (merged), cancelled or failed. The same read
// names each worktree's run for the person (owner): a live one, else the
// newest ended run that still names it.
func worktreeRuns(ctx context.Context, home, wsPath string, obs []worktreeObs) (map[int]deletionBlocker, map[int]*worktreeOwner, bool) {
	out := map[int]deletionBlocker{}
	owners := map[int]*worktreeOwner{}
	if taskfleetBinary(home) == "" {
		return out, owners, true
	}
	var reply struct {
		Schema int `json:"schema_version"`
		Data   struct {
			Runs []nativeSpinoff `json:"runs"`
		} `json:"data"`
	}
	if !taskfleetRead(ctx, home, []string{"run", "list", "--repo", wsPath, "--output", "json"}, &reply) || reply.Schema != 1 || reply.Data.Runs == nil {
		return nil, nil, false
	}
	endedAt := map[int]string{}
	for _, r := range reply.Data.Runs {
		if !taskfleetIDPattern.MatchString(r.ID) {
			return nil, nil, false
		}
		ended := r.Status == "done" || r.Status == "cancelled" || r.Status == "failed"
		paths := []string{r.WorktreePath}
		for _, n := range r.Nodes {
			paths = append(paths, n.Worktree)
		}
		// A live run whose worktree is not named cannot be ruled out as
		// the owner of any of them.
		named := false
		for _, p := range paths {
			named = named || p != "" && filepath.IsAbs(p)
		}
		if !named {
			if ended {
				continue
			}
			return nil, nil, false
		}
		for _, p := range paths {
			if p == "" || !filepath.IsAbs(p) {
				continue
			}
			for i := range obs {
				if !sameWorktreePath(filepath.Clean(p), &obs[i]) {
					continue
				}
				if !ended {
					out[i] = deletionBlocker{Kind: "taskfleet_run", RunID: r.ID}
					owners[i] = runOwner(r, &obs[i])
				} else if _, live := out[i]; !live && (owners[i] == nil || r.CreatedAt > endedAt[i]) {
					owners[i], endedAt[i] = runOwner(r, &obs[i]), r.CreatedAt
				}
			}
		}
	}
	return out, owners, true
}

// worktreeOwner is what a worktree is for the person: a helper (a named
// resident worker), a worker, or the leftover of an ended run, and the
// conversation that started it. The browser joins the conversation to its
// own list for the title and whether it is archived.
type worktreeOwner struct {
	RunID string `json:"run_id"`
	Role  string `json:"role"` // helper, worker, ended
	Title string `json:"title,omitempty"`
	Name  string `json:"name,omitempty"`
	// working; waiting (a helper between rounds, or an interactive worker
	// waiting for its conversation to merge or cancel it); attention
	// (stalled, its supervisor gone, or idle expiry kept unlanded work);
	// ended.
	State          string `json:"state"`
	ConversationID string `json:"conversation_id,omitempty"`
	// When Taskfleet's idle expiry removes a helper's wholly landed
	// worktree by itself.
	ReleasesAt string `json:"releases_at,omitempty"`
}

func runOwner(r nativeSpinoff, o *worktreeObs) *worktreeOwner {
	w := &worktreeOwner{RunID: r.ID, Role: "worker", Title: prefixBytes(r.Title, 200)}
	if r.CreatorRun == nil && r.Creator != nil && r.Creator.Harness == "pi" && sessionIDPattern.MatchString(r.Creator.SessionID) {
		w.ConversationID = "pi:" + r.Creator.SessionID
	}
	switch r.Status {
	case "done", "cancelled", "failed":
		w.Role, w.State = "ended", "ended"
		return w
	}
	v := r.resident()
	if v != nil {
		w.Role, w.Name = "helper", v.Name
	}
	switch spinoffState(r) {
	case "working":
		w.State = "working"
	case "waiting_parent":
		w.State = "waiting"
	default:
		w.State = "attention"
	}
	if v == nil || w.State != "waiting" {
		return w
	}
	if v.ExpiryAttentionAt != "" {
		w.State = "attention"
		return w
	}
	// Idle expiry counts from the open round's report once the worker has
	// exited, and removes the worktree only when nothing would be lost:
	// Git sees it merged into its source branch.
	if v.RoundState == "waiting" && !v.WorkerRunning && v.IdleExpirySecs > 0 && v.IdleExpirySecs <= 366*24*3600 && v.LastRound != nil && v.LastRound.Open && o.view.State == "merged" {
		if at, err := time.Parse(time.RFC3339Nano, v.LastRound.ReportedAt); err == nil {
			w.ReleasesAt = at.Add(time.Duration(v.IdleExpirySecs) * time.Second).UTC().Format(time.RFC3339)
		}
	}
	return w
}

func sameWorktreePath(p string, o *worktreeObs) bool {
	if o.path == "" {
		return false
	}
	if p == o.path {
		return true
	}
	var s unix.Stat_t
	return o.ino != 0 && unix.Stat(p, &s) == nil && uint64(s.Dev) == o.dev && s.Ino == o.ino
}

// resolveWorktree observes one registry entry of a freshly discovered
// workspace and pins that workspace. The caller closes the descriptor.
func resolveWorktree(ctx context.Context, cfg transport.Config, wid, entryID string) (worktreeObs, Workspace, int, string) {
	discovery := Discover(cfg)
	if discovery.State == "error" || discovery.Error != "" {
		return worktreeObs{}, Workspace{}, -1, "workspace_uncertain"
	}
	var target *Workspace
	for i := range discovery.Entries {
		entry := &discovery.Entries[i]
		id := entry.WorkspaceID
		if id == "" {
			id = opaque("ws_", cfg.Provider+":"+cfg.Subject+":"+entry.Name)
		}
		if id == wid && entry.Error == "" {
			target = entry
			break
		}
	}
	if target == nil {
		return worktreeObs{}, Workspace{}, -1, "workspace_missing"
	}
	if target.Metadata == "error" || target.Kind != "git_main_worktree" {
		return worktreeObs{}, Workspace{}, -1, "workspace_uncertain"
	}
	src, _, err := workspaceSource(cfg)
	if err != nil {
		return worktreeObs{}, Workspace{}, -1, "workspace_uncertain"
	}
	defer unix.Close(src)
	fd, opened, err := openWorkspace(src, target.Name)
	if err != nil || uint64(opened.Dev) != target.dev || opened.Ino != target.ino {
		if err == nil {
			unix.Close(fd)
		}
		return worktreeObs{}, Workspace{}, -1, "workspace_changed"
	}
	obs, ok := observeRegistry(ctx, cfg, *target, wid, fd, entryID, 1)
	if !ok || len(obs) != 1 {
		unix.Close(fd)
		if !ok {
			return worktreeObs{}, Workspace{}, -1, "workspace_uncertain"
		}
		return worktreeObs{}, Workspace{}, -1, "worktree_missing"
	}
	return obs[0], *target, fd, ""
}

func removeOneWorktree(w http.ResponseWriter, cfg transport.Config, c *ConversationController, in workspaceRequest) {
	// Removals clicked one after another queue rather than refuse.
	if code := cloneWriter.waitBriefly(context.Background(), "workspace_worktree_cleanup_running"); code != "" {
		snapshotError(w, 409, code)
		return
	}
	defer cloneWriter.Unlock()
	ctx, cancel := context.WithTimeout(context.Background(), deletionCheckLimit)
	defer cancel()
	o, ws, wsFd, code := resolveWorktree(ctx, cfg, in.WorkspaceID, in.Entry)
	if code != "" {
		snapshotError(w, 409, code)
		return
	}
	defer unix.Close(wsFd)
	if o.view.ObservationToken != in.ObservationToken {
		snapshotError(w, 409, "worktree_changed")
		return
	}
	result, code := c.removeWorktree(cfg, ws, wsFd, o, in.Disposal, in.Confirmation)
	if code != "" {
		snapshotError(w, 409, code)
		return
	}
	result["schema_version"] = 1
	historyJSON(w, result)
}

// removeWorktree acts on an observed entry. Blockers found now are a
// blocked reply; facts that differ from the observation are a refusal and
// nothing changes. Only "remove", "commit" and "force" touch the checkout.
func (c *ConversationController) removeWorktree(cfg transport.Config, ws Workspace, wsFd int, o worktreeObs, disposal, confirmation string) (map[string]any, string) {
	v := o.view
	result := map[string]any{"workspace_id": v.WorkspaceID, "entry": v.Entry}
	blocked := func(blockers []deletionBlocker) (map[string]any, string) {
		result["state"], result["blockers"] = "blocked", blockers
		return result, ""
	}
	if len(v.Blockers) > 0 {
		return blocked(v.Blockers)
	}
	allowed := false
	for _, a := range v.Actions {
		allowed = allowed || a == disposal
	}
	if !allowed {
		return nil, "worktree_changed"
	}
	if disposal == "force" && confirmation != v.Name {
		return nil, "confirmation_mismatch"
	}
	wsPath := filepath.Join(cfg.Home, "src", ws.Name)
	trees, err := dir(unix.Openat2, wsFd, ".git/worktrees", true)
	if err != nil {
		return nil, "worktree_missing"
	}
	defer unix.Close(trees)
	if disposal == "prune" {
		var s unix.Stat_t
		if err := unix.Lstat(o.path, &s); !errors.Is(err, unix.ENOENT) {
			return nil, "worktree_changed"
		}
		if !removeAdminEntry(trees, v.Entry, o.adminIno) {
			result["state"], result["remaining"] = "partial", 1
			return result, ""
		}
		result["state"] = "pruned"
		return result, ""
	}
	// A checkout directly in ~/src is itself a workspace, and the person's
	// only visible workspace is never removed (Jari 18.10.2026).
	if blockers := lastWorkspaceWorktree(cfg, o); len(blockers) > 0 {
		return blocked(blockers)
	}
	// Pin the checkout and the directory that names it before anything
	// changes, so that what is checked is what is removed.
	fd, err := openCheckout(cfg.Home, o.path)
	if err != nil {
		return nil, "worktree_changed"
	}
	defer unix.Close(fd)
	pinned, err := stat(fd)
	if err != nil || uint64(pinned.Dev) != o.dev || pinned.Ino != o.ino {
		return nil, "worktree_changed"
	}
	parent, err := openCheckout(cfg.Home, filepath.Dir(o.path))
	if err != nil {
		return nil, "worktree_changed"
	}
	defer unix.Close(parent)
	name := filepath.Base(o.path)
	var named unix.Stat_t
	if unix.Fstatat(parent, name, &named, unix.AT_SYMLINK_NOFOLLOW) != nil || !same(named, pinned) {
		return nil, "worktree_changed"
	}
	ctx, cancel := context.WithTimeout(context.Background(), deletionCheckLimit)
	defer cancel()
	busy, release := c.fenceWorkspace(ctx, o.path, inodeOf(pinned))
	if release == nil {
		// Fencing may fail because a native process removed/substituted the
		// checkout, not because a file operation is active there.
		again, err := openCheckout(cfg.Home, o.path)
		if err != nil {
			return nil, "worktree_changed"
		}
		current, err := stat(again)
		unix.Close(again)
		if err != nil || !same(current, pinned) {
			return nil, "worktree_changed"
		}
		var blockers []deletionBlocker
		for _, b := range busy {
			blockers = append(blockers, busyDeletionBlocker(b))
		}
		return blocked(blockers)
	}
	defer release()
	// Facts are read again on the pinned directory, under the fence.
	again, ok := observeRegistry(ctx, cfg, ws, v.WorkspaceID, wsFd, v.Entry, 1)
	if !ok || len(again) != 1 || again[0].view.ObservationToken != v.ObservationToken {
		return nil, "worktree_changed"
	}
	var blockers []deletionBlocker
	inside, unreadable, complete := settledProcessScan(deletionProcRoot, o.path, cfg.UID, c.childPIDs())
	if !complete {
		blockers = append(blockers, deletionBlocker{Kind: "unknown", Check: "processes"})
	}
	for _, p := range inside {
		blockers = append(blockers, deletionBlocker{Kind: "process", PID: p.PID, Comm: p.Comm})
	}
	for _, p := range unreadable {
		blockers = append(blockers, deletionBlocker{Kind: "unknown", Check: "processes", PID: p.PID, Comm: p.Comm})
	}
	if mounts, ok := mountsBelow(deletionMountInfo, o.path); !ok {
		blockers = append(blockers, deletionBlocker{Kind: "unknown", Check: "mounts"})
	} else {
		for _, m := range mounts {
			blockers = append(blockers, deletionBlocker{Kind: "mount", Path: displayHomePath(cfg.Home, m)})
		}
	}
	if nested := nestedWorktrees(trees, v.Entry, o.path, wsPath); nested != "" {
		blockers = append(blockers, deletionBlocker{Kind: "contains_linked_worktree", Path: displayHomePath(cfg.Home, nested)})
	}
	// A submodule, an embedded clone or another repository's worktree below
	// the checkout has history or changes that neither this branch nor a
	// commit to it would keep; `git worktree remove` refuses submodules too.
	scanCtx, scanCancel := context.WithTimeout(ctx, deletionCheckLimit/2)
	budget := 2000000
	nested, complete := nestedGit(scanCtx, fd, uint64(pinned.Dev), 0, "", &budget)
	scanCancel()
	if !complete {
		blockers = append(blockers, deletionBlocker{Kind: "unknown", Check: "worktrees"})
	} else if nested != "" {
		blockers = append(blockers, deletionBlocker{Kind: "nested_repository", Path: displayHomePath(cfg.Home, filepath.Join(o.path, nested))})
	}
	if len(blockers) > 0 {
		return blocked(blockers)
	}
	if disposal == "commit" {
		hash, ok := saveToBranch(cfg.Home, fd, o)
		if !ok {
			return nil, "commit_failed"
		}
		result["committed"] = hash
	}
	if err := worktreeHook("checked"); err != nil {
		return nil, "worktree_changed"
	}
	walkCtx, walkCancel := context.WithTimeout(context.Background(), deletionWalkLimit)
	remaining := removeCheckout(walkCtx, parent, name, fd, pinned)
	walkCancel()
	if remaining > 0 {
		result["state"], result["remaining"] = "partial", remaining
		return result, ""
	}
	if !removeAdminEntry(trees, v.Entry, o.adminIno) {
		// The checkout is gone; the stale entry lists as missing and prunes.
		result["state"], result["remaining"] = "partial", 1
		return result, ""
	}
	result["state"] = "removed"
	if v.Branch != "" {
		result["branch"] = v.Branch
		switch {
		case v.State != "merged" || disposal != "remove":
			result["branch_kept"] = "not_merged"
		default:
			if reason := deleteMergedBranch(cfg.Home, wsFd, trees, o); reason != "" {
				result["branch_kept"] = reason
			} else {
				result["branch_deleted"] = true
			}
		}
	}
	return result, ""
}

// A test seam for a crash or a race between the last check and the removal.
var worktreeHook = func(stage string) error { return nil }

// lastWorkspaceWorktree applies the deletion check's last-workspace rule to
// a linked checkout that the snapshot lists as a workspace of its own.
func lastWorkspaceWorktree(cfg transport.Config, o worktreeObs) []deletionBlocker {
	if filepath.Dir(o.path) != filepath.Join(cfg.Home, "src") {
		return nil
	}
	discovery := Discover(cfg)
	if discovery.State == "error" || discovery.Error != "" {
		return []deletionBlocker{{Kind: "unknown", Check: "workspaces"}}
	}
	for _, entry := range discovery.Entries {
		if entry.Name == filepath.Base(o.path) && entry.Error == "" && entry.ino == o.ino && entry.dev == o.dev {
			ctx, cancel := context.WithTimeout(context.Background(), deletionCheckLimit)
			defer cancel()
			return lastWorkspaceBlockers(ctx, cfg, discovery, entry)
		}
	}
	return nil
}

// nestedGit finds a .git entry below the root of the pinned checkout (its
// own .git excluded), without following symlinks or leaving the device. It
// reports false when the walk could not be completed.
func nestedGit(ctx context.Context, fd int, dev uint64, depth int, rel string, budget *int) (string, bool) {
	if depth > 512 {
		return "", false
	}
	names, err := readDirNames(fd, 1<<20)
	if err != nil {
		return "", false
	}
	for _, name := range names {
		if *budget--; *budget < 0 || ctx.Err() != nil {
			return "", false
		}
		if name == ".git" {
			if depth > 0 {
				return rel, true
			}
			continue
		}
		var s unix.Stat_t
		if unix.Fstatat(fd, name, &s, unix.AT_SYMLINK_NOFOLLOW) != nil {
			return "", false
		}
		if s.Mode&unix.S_IFMT != unix.S_IFDIR {
			continue
		}
		if uint64(s.Dev) != dev {
			return "", false
		}
		child, err := dir(unix.Openat2, fd, name, true)
		if err != nil {
			return "", false
		}
		found, ok := nestedGit(ctx, child, dev, depth+1, filepath.Join(rel, name), budget)
		unix.Close(child)
		if !ok || found != "" {
			return found, ok
		}
	}
	return "", true
}

// nestedWorktrees names another registered worktree inside this one, or the
// workspace itself; removing the outer checkout would take it along.
func nestedWorktrees(trees int, self, path, wsPath string) string {
	if insidePath(wsPath, path) {
		return wsPath
	}
	names, err := readDirNames(trees, 4096)
	if err != nil {
		return path
	}
	for _, id := range names {
		if id == self {
			continue
		}
		admin, err := dir(unix.Openat2, trees, id, true)
		if err != nil {
			return path
		}
		b, status := readSmall(unix.Openat2, admin, "gitdir", 4096)
		unix.Close(admin)
		if status != "valid" {
			return path
		}
		target := strings.TrimSuffix(string(b), "\n")
		if !filepath.IsAbs(target) {
			target = filepath.Join(wsPath, ".git", "worktrees", id, target)
		}
		other := filepath.Dir(filepath.Clean(target))
		if insidePath(other, path) {
			return other
		}
	}
	return ""
}

// saveToBranch commits everything, untracked files included, to the
// worktree's branch. Hooks and signing are off: the commit exists only to
// keep the work, and a hook or a signing prompt must not stand in the way.
// It then checks that the branch moved by exactly this commit and that
// nothing is left uncommitted.
func saveToBranch(home string, fd int, o worktreeObs) (string, bool) {
	ctx, cancel := context.WithTimeout(context.Background(), worktreeCommitLimit)
	defer cancel()
	git := func(args ...string) ([]byte, error) {
		return cloneCommandWithTimeout(ctx, worktreeCommitLimit, "/usr/bin/git", home, strconv.Itoa(fd), append([]string{"-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", "-c", "maintenance.auto=false", "-c", "gc.auto=0"}, args...)...)
	}
	if _, e := git("add", "--all", "--", "."); e != nil {
		return "", false
	}
	if _, e := git("commit", "--quiet", "--no-verify", "--no-gpg-sign", "-m", worktreeSaveMessage); e != nil {
		return "", false
	}
	branch, e := git("symbolic-ref", "--quiet", "HEAD")
	if e != nil || strings.TrimSpace(string(branch)) != o.branchRef {
		return "", false
	}
	head, e := git("rev-parse", "--verify", "--quiet", "HEAD^{commit}")
	hash := strings.TrimSpace(string(head))
	if e != nil || !workspaceCommitHash.MatchString(hash) {
		return "", false
	}
	parent, e := git("rev-parse", "--verify", "--quiet", "HEAD^1")
	if o.view.Head == "" {
		if e == nil {
			return "", false
		}
	} else if e != nil || strings.TrimSpace(string(parent)) != o.view.Head {
		return "", false
	}
	status, e := git("status", "--porcelain=v1", "-z", "--untracked-files=normal")
	if e != nil || len(strings.TrimSpace(string(status))) != 0 {
		return "", false
	}
	return hash, true
}

// removeCheckout empties the pinned checkout with the Trash's descriptor
// walk, keeping its .git file until everything else is gone so that an
// interrupted removal still lists as this worktree. It removes the name
// only while it still is the pinned directory.
func removeCheckout(ctx context.Context, parent int, name string, fd int, pinned unix.Stat_t) int {
	remaining := walkRemoveKeep(ctx, fd, uint64(pinned.Dev), 0, ".git")
	if remaining > 0 {
		return remaining
	}
	if e := unix.Unlinkat(fd, ".git", 0); e != nil && !errors.Is(e, unix.ENOENT) {
		return 1
	}
	var named unix.Stat_t
	if unix.Fstatat(parent, name, &named, unix.AT_SYMLINK_NOFOLLOW) != nil || !same(named, pinned) {
		return 1
	}
	if e := unix.Unlinkat(parent, name, unix.AT_REMOVEDIR); e != nil && !errors.Is(e, unix.ENOENT) {
		return 1
	}
	unix.Fsync(parent)
	return 0
}

// removeAdminEntry deletes $GIT_DIR/worktrees/<id>, the registry entry, if
// it is still the observed directory. This is what `git worktree prune`
// does for a stale entry, for this entry only.
func removeAdminEntry(trees int, id string, ino uint64) bool {
	admin, err := dir(unix.Openat2, trees, id, true)
	if errors.Is(err, unix.ENOENT) {
		return true
	}
	if err != nil {
		return false
	}
	defer unix.Close(admin)
	s, err := stat(admin)
	if err != nil || s.Ino != ino {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), deletionCheckLimit)
	defer cancel()
	if walkRemove(ctx, admin, uint64(s.Dev), 0) > 0 {
		return false
	}
	if e := unix.Unlinkat(trees, id, unix.AT_REMOVEDIR); e != nil && !errors.Is(e, unix.ENOENT) {
		return false
	}
	unix.Fsync(trees)
	return true
}

// deleteMergedBranch is compare and delete: the branch goes only if no
// checkout uses it, its tip is still the observed commit and that commit is
// still in the base. It returns why the branch was kept, or "".
func deleteMergedBranch(home string, wsFd, trees int, o worktreeObs) string {
	ctx, cancel := context.WithTimeout(context.Background(), deletionCheckLimit)
	defer cancel()
	if b, e := worktreeGit(ctx, home, wsFd, "symbolic-ref", "--quiet", "HEAD"); e == nil && strings.TrimSpace(string(b)) == o.branchRef {
		return "checked_out"
	} else if e != nil && gitExit(e) != 1 {
		return "checked_out"
	}
	names, err := readDirNames(trees, 4096)
	if err != nil {
		return "checked_out"
	}
	for _, id := range names {
		admin, err := dir(unix.Openat2, trees, id, true)
		if err != nil {
			return "checked_out"
		}
		b, status := readSmall(unix.Openat2, admin, "HEAD", 4096)
		unix.Close(admin)
		if status != "valid" || strings.TrimSpace(string(b)) == "ref: "+o.branchRef {
			return "checked_out"
		}
	}
	b, e := worktreeGit(ctx, home, wsFd, "rev-parse", "--verify", "--quiet", o.baseRef+"^{commit}")
	base := strings.TrimSpace(string(b))
	if e != nil || !workspaceCommitHash.MatchString(base) {
		return "not_merged"
	}
	if _, e := worktreeGit(ctx, home, wsFd, "merge-base", "--is-ancestor", o.view.Head, base); e != nil {
		return "not_merged"
	}
	// One transaction: the base must still be the commit checked above and
	// the branch still the observed tip, or nothing is deleted.
	tx := "start\nverify " + o.baseRef + " " + base + "\ndelete " + o.branchRef + " " + o.view.Head + "\nprepare\ncommit\n"
	if _, e := cloneCommandInput(ctx, worktreeGitLimit, "/usr/bin/git", home, strconv.Itoa(wsFd), tx, "-c", "core.hooksPath=/dev/null", "update-ref", "--no-deref", "--stdin"); e != nil {
		return "moved"
	}
	return ""
}

// cleanMergedWorktrees removes every merged worktree of the listing the
// person confirmed. A merged set that changed since is refused whole.
func cleanMergedWorktrees(w http.ResponseWriter, cfg transport.Config, c *ConversationController, scope, token string) {
	// Removals clicked one after another queue rather than refuse.
	if code := cloneWriter.waitBriefly(context.Background(), "workspace_worktree_cleanup_running"); code != "" {
		snapshotError(w, 409, code)
		return
	}
	defer cloneWriter.Unlock()
	ctx, cancel := context.WithTimeout(context.Background(), deletionCheckLimit)
	defer cancel()
	obs, _, _, code := observeWorktrees(ctx, cfg, c, scope, false)
	if code != "" {
		snapshotError(w, 409, code)
		return
	}
	if worktreeListingToken(scope, obs) != token {
		snapshotError(w, 409, "worktrees_changed")
		return
	}
	src, _, err := workspaceSource(cfg)
	if err != nil {
		snapshotError(w, 409, "workspace_uncertain")
		return
	}
	defer unix.Close(src)
	removed, kept, branches := 0, []map[string]any{}, []map[string]any{}
	for _, o := range obs {
		if o.view.State != "merged" {
			continue
		}
		keep := map[string]any{"workspace_id": o.view.WorkspaceID, "entry": o.view.Entry}
		fd, opened, err := openWorkspace(src, o.wsName)
		if err != nil || uint64(opened.Dev) != o.wsDev || opened.Ino != o.wsIno {
			if err == nil {
				unix.Close(fd)
			}
			keep["state"] = "changed"
			kept = append(kept, keep)
			continue
		}
		ws := Workspace{Name: o.wsName, Kind: "git_main_worktree", dev: o.wsDev, ino: o.wsIno}
		result, code := c.removeWorktree(cfg, ws, fd, o, "remove", "")
		unix.Close(fd)
		switch {
		case code != "":
			keep["state"] = "changed"
		case result["state"] == "removed":
			removed++
			if result["branch_kept"] != nil {
				branches = append(branches, map[string]any{"workspace_id": o.view.WorkspaceID, "entry": o.view.Entry, "branch": o.view.Branch, "reason": result["branch_kept"]})
			}
			continue
		default:
			keep["state"] = result["state"]
			if b, ok := result["blockers"]; ok {
				keep["blockers"] = b
			}
			if r, ok := result["remaining"]; ok {
				keep["remaining"] = r
			}
		}
		kept = append(kept, keep)
	}
	historyJSON(w, map[string]any{"schema_version": 1, "state": "cleaned", "removed": removed, "kept": kept, "branches_kept": branches})
}
