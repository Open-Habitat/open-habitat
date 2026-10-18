//go:build linux

package daemon

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Open-Habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

// A worktree place (ADR 0025) is a linked worktree of a discovered main
// checkout, found in Git's own registry, where conversations run. It has an
// opaque ID of the workspace-ID form, so the routes that resolve a
// conversation's directory (start, resume, held sends, Git reads) accept it
// wherever they accept a workspace ID. Nothing about a place is stored: each
// resolution reads the registry again.
type worktreePlace struct {
	ID, WorkspaceID string
	Entry, Name     string
	Path, Branch    string
	// MainBranch is the branch the main checkout has out, the base of a
	// place whose branch records none.
	MainBranch string
	dev, ino   uint64
}

// placeID binds the place to its workspace and registry entry, the two
// names ADR 0025 lets the browser use for a worktree.
func placeID(workspaceID, entry string) string {
	return opaque("ws_", "worktree:"+workspaceID+":"+entry)
}

func workspaceIDOf(cfg transport.Config, entry Workspace) string {
	if entry.WorkspaceID != "" {
		return entry.WorkspaceID
	}
	return opaque("ws_", cfg.Provider+":"+cfg.Subject+":"+entry.Name)
}

// readWorktreePlaces lists the places of one discovered main checkout. A
// registry entry is a place when its checkout is below home, is not itself a
// directory directly under ~/src (that is a workspace of its own), and its
// .git file points back to the same entry. ok is false when the registry
// could not be read.
func readWorktreePlaces(home string, entry Workspace, workspaceID string) ([]worktreePlace, bool) {
	if entry.Kind != "git_main_worktree" || entry.Error != "" {
		return nil, true
	}
	src, _, err := workspaceSource(transport.Config{Home: home, UID: os.Geteuid()})
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
	trees, err := dir(unix.Openat2, fd, ".git/worktrees", true)
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
	wsPath := filepath.Join(home, "src", entry.Name)
	mainBranch := headBranch(fd, ".git/HEAD")
	out := []worktreePlace{}
	for _, name := range names {
		if len(out) >= worktreeListLimit {
			break
		}
		if !validTrashEntry(name) {
			continue
		}
		if p, ok := placeOf(home, wsPath, trees, name); ok {
			p.ID, p.WorkspaceID, p.MainBranch = placeID(workspaceID, name), workspaceID, mainBranch
			out = append(out, p)
		}
	}
	return out, true
}

func placeOf(home, wsPath string, trees int, entry string) (worktreePlace, bool) {
	admin, err := dir(unix.Openat2, trees, entry, true)
	if err != nil {
		return worktreePlace{}, false
	}
	defer unix.Close(admin)
	as, err := stat(admin)
	if err != nil {
		return worktreePlace{}, false
	}
	b, status := readSmall(unix.Openat2, admin, "gitdir", 4096)
	if status != "valid" || !utf8.Valid(b) {
		return worktreePlace{}, false
	}
	target := strings.TrimSuffix(string(b), "\n")
	if target == "" || strings.ContainsAny(target, "\x00\n") {
		return worktreePlace{}, false
	}
	if !filepath.IsAbs(target) {
		target = filepath.Join(wsPath, ".git", "worktrees", entry, target)
	}
	target = filepath.Clean(target)
	if filepath.Base(target) != ".git" {
		return worktreePlace{}, false
	}
	path := filepath.Dir(target)
	if !insidePath(path, home) || path == home || filepath.Dir(path) == filepath.Join(home, "src") || insidePath(wsPath, path) {
		return worktreePlace{}, false
	}
	fd, err := openCheckout(home, path)
	if err != nil {
		return worktreePlace{}, false
	}
	defer unix.Close(fd)
	s, err := stat(fd)
	if err != nil || !gitfileNames(fd, path, as) {
		return worktreePlace{}, false
	}
	p := worktreePlace{Entry: entry, Name: filepath.Base(path), Path: path, Branch: headBranch(admin, "HEAD"), dev: uint64(s.Dev), ino: s.Ino}
	return p, true
}

// headBranch reads the branch a HEAD file names, within the snapshot's
// bound for a branch name; anything else is no branch.
func headBranch(dirFD int, name string) string {
	head, status := readSmall(unix.Openat2, dirFD, name, 512)
	if status != "valid" {
		return ""
	}
	branch, ok := strings.CutPrefix(strings.TrimSuffix(string(head), "\n"), "ref: refs/heads/")
	if !ok || branch == "" || len(branch) > 256 || !utf8.ValidString(branch) || strings.ContainsAny(branch, "\x00\n") {
		return ""
	}
	return branch
}

// openPlace pins a place's checkout by descriptor below home and checks
// that it is still the directory the registry named.
func openPlace(home string, p worktreePlace) (int, error) {
	fd, err := openCheckout(home, p.Path)
	if err != nil {
		return -1, err
	}
	if s, err := stat(fd); err != nil || uint64(s.Dev) != p.dev || s.Ino != p.ino {
		unix.Close(fd)
		return -1, errors.New("worktree changed")
	}
	return fd, nil
}

// findPlace resolves a place ID against a fresh discovery.
func findPlace(cfg transport.Config, home string, observation Discovery, id string) (worktreePlace, bool) {
	for _, entry := range observation.Entries {
		if entry.Kind != "git_main_worktree" || entry.Error != "" || entry.Metadata == "error" {
			continue
		}
		wid := workspaceIDOf(cfg, entry)
		places, _ := readWorktreePlaces(home, entry, wid)
		for _, p := range places {
			if p.ID == id {
				return p, true
			}
		}
	}
	return worktreePlace{}, false
}

// placeFD is workspaceFD for a worktree place.
func (c *ConversationController) placeFD(observation Discovery, id string) (*os.File, string, error) {
	p, ok := findPlace(c.cfg, c.home, observation, id)
	if !ok {
		return nil, "", errors.New("workspace unavailable")
	}
	fd, err := openPlace(c.home, p)
	if err != nil {
		return nil, "", err
	}
	ws := os.NewFile(uintptr(fd), "worktree")
	c.mu.Lock()
	admitted := c.admits(ws, p.Path)
	c.mu.Unlock()
	if !admitted {
		ws.Close()
		return nil, "", errors.New("workspace busy")
	}
	return ws, p.Path, nil
}

// worktreeContainers names the directories directly under ~/src that hold
// only checkouts of registered worktrees: they are the worktrees' sibling
// container, not workspaces. This is judged from Git's registry, never from
// the directory's name.
func worktreeContainers(home string, entries []Workspace, places []worktreePlace) map[string]bool {
	src := filepath.Join(home, "src")
	byParent := map[string]map[string]bool{}
	for _, p := range places {
		parent := filepath.Dir(p.Path)
		if filepath.Dir(parent) != src {
			continue
		}
		if byParent[parent] == nil {
			byParent[parent] = map[string]bool{}
		}
		byParent[parent][p.Name] = true
	}
	out := map[string]bool{}
	if len(byParent) == 0 {
		return out
	}
	srcFD, _, err := workspaceSource(transport.Config{Home: home, UID: os.Geteuid()})
	if err != nil {
		return out
	}
	defer unix.Close(srcFD)
	for _, e := range entries {
		held := byParent[filepath.Join(src, e.Name)]
		if held == nil || e.Kind != "directory" || e.Metadata != "absent" || e.Error != "" {
			continue
		}
		fd, opened, err := openWorkspace(srcFD, e.Name)
		if err != nil {
			continue
		}
		names, err := readDirNames(fd, 4096)
		unix.Close(fd)
		if err != nil || uint64(opened.Dev) != e.dev || opened.Ino != e.ino {
			continue
		}
		only := len(names) > 0
		for _, n := range names {
			only = only && held[n]
		}
		if only {
			out[e.Name] = true
		}
	}
	return out
}

// taskfleetOwned reports whether a Taskfleet run names this checkout. Such a
// worktree is the run's (ADR 0017): its sessions are observed as a spinoff,
// not listed as conversations of a place.
func taskfleetOwned(runs []nativeSpinoff, path string) bool {
	for _, r := range runs {
		if r.WorktreePath != "" && filepath.Clean(r.WorktreePath) == path {
			return true
		}
		for _, n := range r.Nodes {
			if n.Worktree != "" && filepath.Clean(n.Worktree) == path {
				return true
			}
		}
	}
	return false
}

// placeGitSummary is the snapshot's Git summary for a place, read like a
// workspace's, and whether its branch has moved since it was created.
func placeGitSummary(ctx context.Context, home string, p worktreePlace) (map[string]any, *bool, bool) {
	fd, err := openPlace(home, p)
	if err != nil {
		return nil, nil, false
	}
	defer unix.Close(fd)
	summary, ok := gitSummaryAt(ctx, home, fd, &p)
	if !ok {
		return nil, nil, false
	}
	var moved *bool
	if branch, _ := summary["branch"].(string); branch != "" {
		b, e := cloneCommandWithTimeout(ctx, 2*time.Second, "/usr/bin/git", home, strconv.Itoa(fd), "-c", "core.fsmonitor=false", "reflog", "show", "--format=%H", "-n", "2", "refs/heads/"+branch, "--")
		if e == nil {
			value := len(strings.Fields(string(b))) > 1
			moved = &value
		}
	}
	return summary, moved, true
}

// Creating a worktree agent (ADR 0025): a new branch from the workspace's
// current branch, checked out in ~/src/<workspace>__worktrees/<name>.
var worktreeNameHint = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,39}$`)

const worktreeAddLimit = 25 * time.Second

type worktreeCreateError struct{ code string }

func (e worktreeCreateError) Error() string { return e.code }

// createWorktreePlace makes the branch and the worktree as the user and
// returns the new place's ID. The caller holds cloneWriter, so two creations
// cannot pick the same free name. The base is recorded as the branch's
// workmux-base, the record the top bar and the cleanup list read.
func createWorktreePlace(ctx context.Context, cfg transport.Config, home string, observation Discovery, workspaceID, hint string) (string, error) {
	if !worktreeNameHint.MatchString(hint) {
		return "", worktreeCreateError{"invalid_request"}
	}
	var entry *Workspace
	for i := range observation.Entries {
		e := &observation.Entries[i]
		if workspaceIDOf(cfg, *e) == workspaceID && e.Error == "" && e.Metadata != "error" {
			entry = e
		}
	}
	if entry == nil {
		return "", worktreeCreateError{"resource_not_found"}
	}
	if entry.Kind != "git_main_worktree" {
		return "", worktreeCreateError{"worktree_base_unavailable"}
	}
	src, _, err := workspaceSource(transport.Config{Home: home, UID: os.Geteuid()})
	if err != nil {
		return "", worktreeCreateError{"native_source_unavailable"}
	}
	defer unix.Close(src)
	fd, opened, err := openWorkspace(src, entry.Name)
	if err != nil {
		return "", worktreeCreateError{"resource_not_found"}
	}
	defer unix.Close(fd)
	if uint64(opened.Dev) != entry.dev || opened.Ino != entry.ino {
		return "", worktreeCreateError{"resource_not_found"}
	}
	git := func(limit time.Duration, args ...string) ([]byte, error) {
		return cloneCommandWithTimeout(ctx, limit, "/usr/bin/git", home, strconv.Itoa(fd), append([]string{"-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null"}, args...)...)
	}
	// The base is the branch the workspace has checked out now; a detached
	// HEAD or an unborn branch has none.
	b, err := git(worktreeGitLimit, "symbolic-ref", "--quiet", "HEAD")
	ref := strings.TrimSpace(string(b))
	base, isBranch := strings.CutPrefix(ref, "refs/heads/")
	if err != nil || !isBranch || base == "" || !validGitBaseName(base) {
		return "", worktreeCreateError{"worktree_base_unavailable"}
	}
	if _, err := git(worktreeGitLimit, "rev-parse", "--verify", "--quiet", ref+"^{commit}"); err != nil {
		return "", worktreeCreateError{"worktree_base_unavailable"}
	}
	container := entry.Name + "__worktrees"
	if !validWorkspaceName(container) {
		return "", worktreeCreateError{"worktree_unavailable"}
	}
	if e := unix.Mkdirat(src, container, 0700); e != nil && !errors.Is(e, unix.EEXIST) {
		return "", worktreeCreateError{"worktree_unavailable"}
	}
	parent, err := dir(unix.Openat2, src, container, true)
	if err != nil {
		return "", worktreeCreateError{"worktree_unavailable"}
	}
	defer unix.Close(parent)
	name := ""
	for n := 1; n <= 50 && name == ""; n++ {
		candidate := hint
		if n > 1 {
			candidate = hint + "-" + strconv.Itoa(n)
		}
		var s unix.Stat_t
		if e := unix.Fstatat(parent, candidate, &s, unix.AT_SYMLINK_NOFOLLOW); !errors.Is(e, unix.ENOENT) {
			continue
		}
		if _, e := git(worktreeGitLimit, "show-ref", "--verify", "--quiet", "refs/heads/wt/"+candidate); gitExit(e) != 1 {
			continue
		}
		name = candidate
	}
	if name == "" {
		return "", worktreeCreateError{"worktree_unavailable"}
	}
	path := filepath.Join(home, "src", container, name)
	branch := "wt/" + name
	if _, err := git(worktreeAddLimit, "worktree", "add", "--quiet", "--no-track", "-b", branch, path, ref); err != nil {
		return "", worktreeCreateError{"worktree_unavailable"}
	}
	if _, err := git(worktreeGitLimit, "config", "--local", "branch."+branch+".workmux-base", base); err != nil {
		return "", worktreeCreateError{"worktree_unavailable"}
	}
	places, _ := readWorktreePlaces(home, *entry, workspaceID)
	for _, p := range places {
		if p.Path == path {
			return p.ID, nil
		}
	}
	return "", worktreeCreateError{"worktree_unavailable"}
}
