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
	"strings"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

// Deletion actions on the workspace route (ADR 0019). A move into the Trash
// is one rename and is undone by restore; only Trash entries, or a workspace
// whose Git remote holds everything, are ever removed permanently.
func deletionAction(action string) bool {
	switch action {
	case "delete_check", "delete", "trash_list", "trash_inspect", "trash_restore", "trash_delete", "trash_empty":
		return true
	}
	return false
}

type deletionFacts struct {
	Kind           string       `json:"kind"` // directory, git
	Git            *deletionGit `json:"git,omitempty"`
	Conversations  *int         `json:"conversations,omitempty"`
	StaleWorktrees int          `json:"stale_worktrees"`
	SizeBytes      int64        `json:"size_bytes"`
	SizeComplete   bool         `json:"size_complete"`
}

type deletionReport struct {
	Blockers []deletionBlocker
	Facts    deletionFacts
	// Outcome is what deletion would do now: blocked, trash, or permanent
	// when outright permanent deletion is also allowed.
	Outcome string
}

func (r deletionReport) body(state, id, token string) map[string]any {
	blockers := r.Blockers
	if blockers == nil {
		blockers = []deletionBlocker{}
	}
	return map[string]any{"schema_version": 1, "state": state, "workspace_id": id, "observation_token": token, "outcome": r.Outcome, "blockers": blockers, "facts": r.Facts}
}

// Bounded contexts that do not end when the browser disconnects.
const (
	deletionCheckLimit = 20 * time.Second
	deletionFetchLimit = 30 * time.Second
	deletionWalkLimit  = 2 * time.Minute
)

func serveWorkspaceDeletion(w http.ResponseWriter, r *http.Request, cfg transport.Config, c *ConversationController, in workspaceRequest) {
	if in.Name != "" || in.UserObservationToken != "" || in.DisplayName != nil || in.Git != nil || in.Hidden != nil || in.AgentID != "" || in.Archived != nil || in.PreviousArchive != "" {
		snapshotError(w, 400, "invalid_request")
		return
	}
	workspaceAction := in.Action == "delete_check" || in.Action == "delete"
	if (in.Action == "trash_empty") != (in.ListingToken != "") {
		snapshotError(w, 400, "invalid_request")
		return
	}
	if in.Action == "trash_empty" {
		if !listingTokenPattern.MatchString(in.ListingToken) || in.WorkspaceID != "" || in.ObservationToken != "" || in.Disposal != "" || in.Entry != "" || in.Confirmation != "" {
			snapshotError(w, 400, "invalid_request")
			return
		}
	} else if workspaceAction {
		if !idPattern.MatchString(in.WorkspaceID) || in.ObservationToken == "" || len(in.ObservationToken) > 200 || in.Entry != "" || in.Confirmation != "" || (in.Action == "delete") != (in.Disposal == "trash" || in.Disposal == "permanent") || in.Action == "delete_check" && in.Disposal != "" {
			snapshotError(w, 400, "invalid_request")
			return
		}
	} else if in.WorkspaceID != "" || in.ObservationToken != "" || in.Disposal != "" || (in.Action == "trash_list") != (in.Entry == "") || in.Entry != "" && !validTrashEntry(in.Entry) || (in.Action == "trash_delete") != (in.Confirmation != "") || len(in.Confirmation) > 255 {
		snapshotError(w, 400, "invalid_request")
		return
	}
	// Managed sessions are the controller's; without it nothing can prove
	// that no conversation runs in the workspace.
	if c == nil {
		snapshotError(w, 503, "daemon_unavailable")
		return
	}
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(deletionWalkLimit + deletionFetchLimit + 2*deletionCheckLimit + 10*time.Second))
	switch in.Action {
	case "delete_check", "delete":
		deleteWorkspace(w, cfg, c, in)
	case "trash_list":
		listWorkspaceTrash(w, cfg)
	case "trash_inspect":
		inspectTrashEntry(w, cfg, in.Entry)
	case "trash_restore":
		restoreTrashEntry(w, cfg, in.Entry)
	case "trash_delete":
		deleteTrashEntry(w, cfg, in.Entry, in.Confirmation)
	case "trash_empty":
		emptyTrash(w, cfg, in.ListingToken)
	}
}

// checkDeletion runs ADR 0019's checks on the pinned workspace. Subprocess
// checks come first so that their own children have exited before /proc is
// read. Every check that cannot complete blocks.
func checkDeletion(ctx context.Context, cfg transport.Config, c *ConversationController, obs Discovery, target Workspace, child int, wsPath string, srcDev uint64, busy []busyConversation) deletionReport {
	var r deletionReport
	r.Facts.Kind = "directory"
	r.Blockers = append(r.Blockers, lastWorkspaceBlockers(ctx, cfg, obs, target)...)
	for _, b := range busy {
		r.Blockers = append(r.Blockers, busyDeletionBlocker(b))
	}
	if target.Kind == "git_linked_worktree" {
		r.Blockers = append(r.Blockers, deletionBlocker{Kind: "is_linked_worktree"})
	}
	if target.Kind == "git_main_worktree" {
		r.Facts.Kind = "git"
		git := readDeletionGit(ctx, cfg.Home, child)
		r.Facts.Git = &git
		blockers, ok := taskfleetBlockers(ctx, cfg.Home, wsPath)
		if !ok {
			blockers = []deletionBlocker{{Kind: "unknown", Check: "taskfleet"}}
		}
		r.Blockers = append(r.Blockers, blockers...)
	}
	worktrees, stale := worktreeBlockers(child, wsPath)
	r.Blockers = append(r.Blockers, worktrees...)
	r.Facts.StaleWorktrees = stale
	if mounts, ok := mountsBelow(deletionMountInfo, wsPath); !ok {
		r.Blockers = append(r.Blockers, deletionBlocker{Kind: "unknown", Check: "mounts"})
	} else {
		for _, m := range mounts {
			r.Blockers = append(r.Blockers, deletionBlocker{Kind: "mount", Path: m})
		}
	}
	if dev, ok := trashDevice(cfg.Home); !ok {
		r.Blockers = append(r.Blockers, deletionBlocker{Kind: "unknown", Check: "trash"})
	} else if dev != srcDev {
		r.Blockers = append(r.Blockers, deletionBlocker{Kind: "different_filesystem"})
	}
	if sessions, err := nativeSessions(cfg); err == nil {
		n := countConversations(sessions, wsPath)
		r.Facts.Conversations = &n
	}
	sizeCtx, cancel := context.WithTimeout(ctx, 1500*time.Millisecond)
	r.Facts.SizeBytes, r.Facts.SizeComplete = treeSize(sizeCtx, child)
	cancel()
	inside, unreadable, complete := settledProcessScan(deletionProcRoot, wsPath, cfg.UID, c.childPIDs())
	if !complete {
		r.Blockers = append(r.Blockers, deletionBlocker{Kind: "unknown", Check: "processes"})
	}
	products := workspaceProductProcesses(ctx, cfg, workspaceIDOf(cfg, target), inside)
	namedProducts := map[string]bool{}
	for _, p := range inside {
		b := deletionBlocker{Kind: "process", PID: p.PID, Comm: p.Comm}
		if product, ok := products[p.PID]; ok {
			b.Product, b.Shell = product.Product, product.Shell
			key := b.Product + ":" + b.Shell
			if namedProducts[key] {
				continue
			}
			namedProducts[key] = true
		}
		r.Blockers = append(r.Blockers, b)
	}
	for _, p := range unreadable {
		r.Blockers = append(r.Blockers, deletionBlocker{Kind: "unknown", Check: "processes", PID: p.PID, Comm: p.Comm})
	}
	switch {
	case len(r.Blockers) > 0:
		r.Outcome = "blocked"
	case r.Facts.Git != nil && r.Facts.Git.permanentAllowed():
		r.Outcome = "permanent"
	default:
		r.Outcome = "trash"
	}
	return r
}

// trashDevice is the device the Trash is, or would be created, on: the
// Trash files directory when it exists, otherwise home's. A variable so that
// a test can present another filesystem without mounting one.
var trashDevice = func(home string) (uint64, bool) {
	t, err := openTrash(home, false)
	if err == nil {
		defer t.close()
		return t.dev, true
	}
	if !errors.Is(err, unix.ENOENT) {
		return 0, false
	}
	var s unix.Stat_t
	if unix.Stat(home, &s) != nil {
		return 0, false
	}
	return uint64(s.Dev), true
}

func deleteWorkspace(w http.ResponseWriter, cfg transport.Config, c *ConversationController, in workspaceRequest) {
	mutate := in.Action == "delete"
	if mutate {
		if !cloneWriter.TryLock("workspace_deletion_running") {
			snapshotError(w, 409, "workspace_busy")
			return
		}
		defer cloneWriter.Unlock()
		if !trashWriter.TryLock() {
			snapshotError(w, 409, "workspace_busy")
			return
		}
		defer trashWriter.Unlock()
	}
	src, source, e := workspaceSource(cfg)
	if e != nil {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	defer unix.Close(src)
	obs, target, child, initial, code := resolveWorkspace(cfg, src, in.WorkspaceID, in.ObservationToken)
	if code != "" {
		snapshotError(w, 409, code)
		return
	}
	defer unix.Close(child)
	wsPath := filepath.Join(cfg.Home, "src", target.Name)
	ctx, cancel := context.WithTimeout(context.Background(), deletionCheckLimit)
	defer cancel()
	var busy []busyConversation
	release := func() {}
	if mutate {
		var fence func()
		busy, fence = c.fenceWorkspace(ctx, filepath.Join(c.home, "src", target.Name), inodeOf(initial))
		if fence != nil {
			release = fence
		}
	} else {
		busy = c.busySessions(ctx, filepath.Join(c.home, "src", target.Name))
	}
	defer func() { release() }()
	report := checkDeletion(ctx, cfg, c, obs, target, child, wsPath, uint64(source.Dev), busy)
	if !workspaceStillNamed(src, target.Name, initial) || !cloneSourceStillNamed(cfg.Home, source) {
		snapshotError(w, 409, "workspace_changed")
		return
	}
	if !mutate || report.Outcome == "blocked" {
		state := "checked"
		if mutate {
			state = "blocked"
		}
		historyJSON(w, report.body(state, in.WorkspaceID, in.ObservationToken))
		return
	}
	if in.Disposal == "permanent" && report.Outcome != "permanent" {
		snapshotError(w, 409, "workspace_not_clean")
		return
	}
	t, e := openTrash(cfg.Home, true)
	if e != nil {
		snapshotError(w, 503, "trash_unavailable")
		return
	}
	defer t.close()
	if t.dev != uint64(source.Dev) {
		snapshotError(w, 409, "trash_unavailable")
		return
	}
	if e = trashHook("checked"); e != nil {
		snapshotError(w, 409, "workspace_partial")
		return
	}
	entry, moved, e := moveToTrash(src, target.Name, initial, cfg.Home, t)
	switch {
	case errors.Is(e, errWorkspaceSwapped) && entry != "":
		// Not the observed directory, and it could not be put back. It is
		// whole in the Trash and the person can restore it there.
		historyJSON(w, map[string]any{"schema_version": 1, "state": "replaced", "workspace_id": in.WorkspaceID, "entry": entry})
		return
	case errors.Is(e, errWorkspaceSwapped):
		snapshotError(w, 409, "workspace_changed")
		return
	case errors.Is(e, unix.EXDEV):
		snapshotError(w, 409, "trash_unavailable")
		return
	case e != nil:
		snapshotError(w, 409, "workspace_partial")
		return
	}
	defer unix.Close(moved)
	entryPath := filepath.Join(append(append([]string{cfg.Home}, trashPath...), "files", entry)...)
	inside, unreadable, complete := settledProcessScan(deletionProcRoot, entryPath, cfg.UID, c.childPIDs())
	if inside == nil {
		inside = []workspaceProcess{}
	}
	result := map[string]any{"schema_version": 1, "state": "trashed", "workspace_id": in.WorkspaceID, "entry": entry, "processes_inside": inside}
	if in.Disposal == "permanent" {
		// Check the moved inode once more: nothing can reach it by its old
		// name now, so what is verified here is what is removed. A fetch
		// first brings the remote-tracking refs up to date, so a remote
		// branch deleted or rewritten since the last fetch keeps the
		// commits in the Trash; a fetch that fails keeps everything there.
		kept := ""
		if len(inside) > 0 || len(unreadable) > 0 || !complete {
			kept = "process_inside"
		} else {
			kept = deletionFetch(cfg.Home, moved)
		}
		recheck, recheckCancel := context.WithTimeout(context.Background(), deletionCheckLimit)
		defer recheckCancel()
		if kept == "" {
			if git := readDeletionGit(recheck, cfg.Home, moved); !git.permanentAllowed() {
				kept = "changed_after_check"
			}
		}
		if mounts, ok := mountsBelow(deletionMountInfo, entryPath); kept == "" && (!ok || len(mounts) > 0) {
			kept = "changed_after_check"
		}
		if kept != "" {
			result["kept_reason"] = kept
			historyJSON(w, result)
			return
		}
		walkCtx, walkCancel := context.WithTimeout(context.Background(), deletionWalkLimit)
		remaining, err := removeTrashTree(walkCtx, t, entry, moved)
		walkCancel()
		if err != nil || remaining > 0 {
			result["state"] = "partial"
			result["remaining"] = max(remaining, 1)
			historyJSON(w, result)
			return
		}
		historyJSON(w, map[string]any{"schema_version": 1, "state": "deleted", "workspace_id": in.WorkspaceID})
		return
	}
	historyJSON(w, result)
}

// resolveWorkspace binds a request to a freshly discovered workspace by its
// observation token and pins it by descriptor, as the other mutations do. The
// discovery is returned too, so that the checks count the same catalog.
func resolveWorkspace(cfg transport.Config, src int, id, token string) (Discovery, Workspace, int, unix.Stat_t, string) {
	obs := Discover(cfg)
	if obs.State == "error" || obs.Error != "" {
		return obs, Workspace{}, -1, unix.Stat_t{}, "workspace_uncertain"
	}
	var target *Workspace
	for i := range obs.Entries {
		entry := &obs.Entries[i]
		if catalogID(cfg, *entry) == id && entry.Error == "" {
			target = entry
			break
		}
	}
	if target == nil {
		return obs, Workspace{}, -1, unix.Stat_t{}, "workspace_missing"
	}
	if target.Metadata == "error" || target.Kind == "unknown" {
		return obs, Workspace{}, -1, unix.Stat_t{}, "workspace_uncertain"
	}
	if token != workspaceToken(cfg, *target) {
		return obs, Workspace{}, -1, unix.Stat_t{}, "workspace_changed"
	}
	child, initial, e := openWorkspace(src, target.Name)
	if e != nil || uint64(initial.Dev) != target.dev || initial.Ino != target.ino {
		if e == nil {
			unix.Close(child)
		}
		return obs, Workspace{}, -1, unix.Stat_t{}, "workspace_changed"
	}
	return obs, *target, child, initial, ""
}

// catalogID is the workspace ID the snapshot gives an entry.
func catalogID(cfg transport.Config, entry Workspace) string {
	if entry.WorkspaceID != "" {
		return entry.WorkspaceID
	}
	return opaque("ws_", cfg.Provider+":"+cfg.Subject+":"+entry.Name)
}

// lastWorkspaceBlockers refuses the person's only visible workspace (Jari
// 18.10.2026: for many it is the only place they work). The browser's
// single-workspace mode never offers it; this holds for a stale tab or any
// other client too. Visible is counted as the snapshot counts it: readable
// entries that are not hidden, without Taskfleet's worktree containers. A
// hidden target is never the last, because hiding already left the count.
func lastWorkspaceBlockers(ctx context.Context, cfg transport.Config, obs Discovery, target Workspace) []deletionBlocker {
	visibility, e := loadVisibility(cfg.Home)
	if e != nil {
		return []deletionBlocker{{Kind: "unknown", Check: "workspaces"}}
	}
	if visibility.Workspaces[catalogID(cfg, target)].Hidden {
		return nil
	}
	entries := obs.Entries
	if taskfleetBinary(cfg.Home) != "" {
		if runs, ok := listTaskfleetRuns(ctx, cfg.Home); ok {
			entries = filterTaskfleetWorkspaces(cfg.Home, entries, runs)
		}
	}
	for _, entry := range entries {
		if entry.Error == "" && entry.Name != target.Name && !visibility.Workspaces[catalogID(cfg, entry)].Hidden {
			return nil
		}
	}
	return []deletionBlocker{{Kind: "last_workspace"}}
}

func (c *ConversationController) childPIDs() map[int]bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	pids := map[int]bool{}
	for _, s := range c.sessions {
		if s.rpc != nil && s.rpc.cmd != nil && s.rpc.cmd.Process != nil {
			pids[s.rpc.cmd.Process.Pid] = true
		}
	}
	return pids
}

type trashEntryView struct {
	Entry         string `json:"entry"`
	Kind          string `json:"kind"` // workspace, unlabelled
	Name          string `json:"name,omitempty"`
	DeletedAt     string `json:"deleted_at,omitempty"`
	Restore       string `json:"restore"` // available, name_taken, unavailable
	Conversations *int   `json:"conversations,omitempty"`
	SizeBytes     *int64 `json:"size_bytes,omitempty"`
	SizeComplete  *bool  `json:"size_complete,omitempty"`
}

// Listing sizes share one bound, so a large Trash answers in about the same
// time as a small one; entries beyond it report a lower bound.
const (
	trashListSizeLimit  = 1500 * time.Millisecond
	trashListSizeBudget = 400000
)

var listingTokenPattern = regexp.MustCompile(`^[0-9a-f]{64}$`)

// trashListingToken names the exact set of entries a listing showed: entry
// names with their inodes and info. Emptying the Trash removes only that set,
// so an entry that arrived after the person looked is never part of it.
func trashListingToken(entries []trashListing) string {
	h := sha256.New()
	for _, e := range entries {
		fmt.Fprintf(h, "%q %q %d %d %d\n", e.entry, e.name, e.deleted.Unix(), e.dev, e.ino)
	}
	return hex.EncodeToString(h.Sum(nil))
}

func listWorkspaceTrash(w http.ResponseWriter, cfg transport.Config) {
	t, e := openTrash(cfg.Home, false)
	if errors.Is(e, unix.ENOENT) {
		historyJSON(w, map[string]any{"schema_version": 1, "state": "listed", "entries": []trashEntryView{}, "truncated": false, "listing_token": trashListingToken(nil)})
		return
	}
	if e != nil {
		snapshotError(w, 503, "trash_unavailable")
		return
	}
	defer t.close()
	clean := trashWriter.TryLock()
	if clean {
		defer trashWriter.Unlock()
	}
	entries, truncated, e := listTrash(cfg.Home, t, clean, 500)
	if e != nil {
		snapshotError(w, 503, "trash_unavailable")
		return
	}
	names, namesOK := sourceNames(cfg)
	sessions, sessionErr := nativeSessions(cfg)
	views := make([]trashEntryView, 0, len(entries))
	sizeCtx, cancel := context.WithTimeout(context.Background(), trashListSizeLimit)
	defer cancel()
	budget := trashListSizeBudget
	for _, entry := range entries {
		view := trashView(cfg, entry, names, namesOK, sessions, sessionErr == nil)
		if fd, e := dir(unix.Openat2, t.files, entry.entry, true); e == nil {
			size, complete := treeSizeWithin(sizeCtx, fd, &budget)
			unix.Close(fd)
			view.SizeBytes, view.SizeComplete = &size, &complete
		}
		views = append(views, view)
	}
	historyJSON(w, map[string]any{"schema_version": 1, "state": "listed", "entries": views, "truncated": truncated, "listing_token": trashListingToken(entries)})
}

// sourceNames lists ~/src so a Trash row can say whether its name is free.
func sourceNames(cfg transport.Config) ([]string, bool) {
	src, _, err := workspaceSource(cfg)
	if err != nil {
		return nil, false
	}
	defer unix.Close(src)
	names, err := readDirNames(src, 1<<16)
	return names, err == nil
}

func trashView(cfg transport.Config, entry trashListing, names []string, namesOK bool, sessions []nativeSession, sessionsOK bool) trashEntryView {
	v := trashEntryView{Entry: entry.entry, Kind: "unlabelled", Restore: "unavailable"}
	if entry.name == "" {
		return v
	}
	v.Kind, v.Name, v.DeletedAt = "workspace", entry.name, entry.deleted.UTC().Format(time.RFC3339)
	if namesOK {
		v.Restore = "available"
		for _, n := range names {
			if strings.EqualFold(n, entry.name) {
				v.Restore = "name_taken"
			}
		}
	}
	if sessionsOK {
		n := countConversations(sessions, filepath.Join(cfg.Home, "src", entry.name))
		v.Conversations = &n
	}
	return v
}

func inspectTrashEntry(w http.ResponseWriter, cfg transport.Config, name string) {
	t, e := openTrash(cfg.Home, false)
	if e != nil {
		snapshotError(w, 409, "trash_entry_missing")
		return
	}
	defer t.close()
	entry, ok := trashEntry(cfg.Home, t, name)
	if !ok {
		snapshotError(w, 409, "trash_entry_missing")
		return
	}
	fd, e := dir(unix.Openat2, t.files, entry.entry, true)
	if e != nil {
		snapshotError(w, 409, "trash_entry_missing")
		return
	}
	defer unix.Close(fd)
	ctx, cancel := context.WithTimeout(context.Background(), deletionCheckLimit)
	defer cancel()
	facts := deletionFacts{Kind: "directory"}
	var gitDir unix.Stat_t
	if unix.Fstatat(fd, ".git", &gitDir, unix.AT_SYMLINK_NOFOLLOW) == nil && gitDir.Mode&unix.S_IFMT == unix.S_IFDIR {
		git := readDeletionGit(ctx, cfg.Home, fd)
		facts.Kind, facts.Git = "git", &git
	}
	sizeCtx, sizeCancel := context.WithTimeout(ctx, 1500*time.Millisecond)
	facts.SizeBytes, facts.SizeComplete = treeSize(sizeCtx, fd)
	sizeCancel()
	names, namesOK := sourceNames(cfg)
	sessions, sessionErr := nativeSessions(cfg)
	view := trashView(cfg, entry, names, namesOK, sessions, sessionErr == nil)
	facts.Conversations = view.Conversations
	historyJSON(w, map[string]any{"schema_version": 1, "state": "inspected", "entry": view, "facts": facts})
}

func restoreTrashEntry(w http.ResponseWriter, cfg transport.Config, name string) {
	if !cloneWriter.TryLock("workspace_deletion_running") {
		snapshotError(w, 409, "workspace_busy")
		return
	}
	defer cloneWriter.Unlock()
	if !trashWriter.TryLock() {
		snapshotError(w, 409, "workspace_busy")
		return
	}
	defer trashWriter.Unlock()
	t, e := openTrash(cfg.Home, false)
	if e != nil {
		snapshotError(w, 409, "trash_entry_missing")
		return
	}
	defer t.close()
	entry, ok := trashEntry(cfg.Home, t, name)
	if !ok || entry.name == "" {
		snapshotError(w, 409, "trash_entry_missing")
		return
	}
	src, source, e := workspaceSource(cfg)
	if e != nil {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	defer unix.Close(src)
	if t.dev != uint64(source.Dev) {
		snapshotError(w, 409, "trash_unavailable")
		return
	}
	// The same case-insensitive rule as create: restore never renames and
	// never shadows an existing workspace.
	obs := Discover(cfg)
	if obs.State == "error" {
		snapshotError(w, 409, "workspace_uncertain")
		return
	}
	for _, existing := range obs.Entries {
		if strings.EqualFold(existing.Name, entry.name) {
			snapshotError(w, 409, "workspace_exists")
			return
		}
	}
	var before unix.Stat_t
	if unix.Fstatat(t.files, entry.entry, &before, unix.AT_SYMLINK_NOFOLLOW) != nil {
		snapshotError(w, 409, "trash_entry_missing")
		return
	}
	e = restoreFromTrash(src, t, entry.entry, entry.name)
	switch {
	case errors.Is(e, unix.EEXIST) || errors.Is(e, unix.ENOTEMPTY):
		snapshotError(w, 409, "workspace_exists")
		return
	case e != nil && !workspaceStillNamed(src, entry.name, before):
		snapshotError(w, 409, "workspace_partial")
		return
	}
	fd, opened, e := openWorkspace(src, entry.name)
	if e != nil {
		snapshotError(w, 409, "workspace_partial")
		return
	}
	defer unix.Close(fd)
	id := opaque("ws_", cfg.Provider+":"+cfg.Subject+":"+entry.name)
	if state, metaID, _ := metadata(unix.Openat2, fd); state == "valid" {
		id = metaID
	}
	result := map[string]any{"schema_version": 1, "state": "restored", "workspace_id": id, "name": entry.name}
	if !same(before, opened) {
		result["state"] = "partial"
	}
	historyJSON(w, result)
}

func deleteTrashEntry(w http.ResponseWriter, cfg transport.Config, name, confirmation string) {
	if !trashWriter.TryLock() {
		snapshotError(w, 409, "workspace_busy")
		return
	}
	defer trashWriter.Unlock()
	t, e := openTrash(cfg.Home, false)
	if e != nil {
		snapshotError(w, 409, "trash_entry_missing")
		return
	}
	defer t.close()
	entry, ok := trashEntry(cfg.Home, t, name)
	if !ok {
		snapshotError(w, 409, "trash_entry_missing")
		return
	}
	expected := entry.name
	if expected == "" {
		expected = entry.entry
	}
	if confirmation != expected {
		snapshotError(w, 409, "confirmation_mismatch")
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), deletionWalkLimit)
	defer cancel()
	result := purgeTrashEntry(ctx, cfg, t, entry)
	if result["state"] == "missing" {
		snapshotError(w, 409, "trash_entry_missing")
		return
	}
	result["schema_version"] = 1
	historyJSON(w, result)
}

// purgeTrashEntry permanently removes one entry unless a process or a mount
// is inside it, and reports the entry's state: deleted, partial or blocked.
func purgeTrashEntry(ctx context.Context, cfg transport.Config, t trashDirs, listed trashListing) map[string]any {
	entry := listed.entry
	entryPath := filepath.Join(append(append([]string{cfg.Home}, trashPath...), "files", entry)...)
	// A process that cannot be inspected does not stop the person emptying
	// their own Trash; whatever it holds open stays allocated until it exits.
	inside, _, complete := settledProcessScan(deletionProcRoot, entryPath, cfg.UID, nil)
	mounts, mountsOK := mountsBelow(deletionMountInfo, entryPath)
	if len(inside) > 0 || !complete || len(mounts) > 0 || !mountsOK {
		blockers := []deletionBlocker{}
		if !complete {
			blockers = append(blockers, deletionBlocker{Kind: "unknown", Check: "processes"})
		}
		for _, p := range inside {
			blockers = append(blockers, deletionBlocker{Kind: "process", PID: p.PID, Comm: p.Comm})
		}
		if !mountsOK {
			blockers = append(blockers, deletionBlocker{Kind: "unknown", Check: "mounts"})
		}
		for _, m := range mounts {
			blockers = append(blockers, deletionBlocker{Kind: "mount", Path: m})
		}
		return map[string]any{"state": "blocked", "entry": entry, "blockers": blockers}
	}
	remaining, e := removeTrashEntry(ctx, t, entry, listed.ino)
	if errors.Is(e, errWorkspaceSwapped) {
		return map[string]any{"state": "missing", "entry": entry}
	}
	if e != nil || remaining > 0 {
		return map[string]any{"state": "partial", "entry": entry, "remaining": max(remaining, 1)}
	}
	return map[string]any{"state": "deleted", "entry": entry}
}

// emptyTrash permanently removes every entry of the listing the person
// confirmed, identified by its token. A Trash that changed since then is
// refused whole; the browser lists again and asks again.
func emptyTrash(w http.ResponseWriter, cfg transport.Config, token string) {
	if !trashWriter.TryLock() {
		snapshotError(w, 409, "workspace_busy")
		return
	}
	defer trashWriter.Unlock()
	t, e := openTrash(cfg.Home, false)
	if errors.Is(e, unix.ENOENT) {
		if token != trashListingToken(nil) {
			snapshotError(w, 409, "trash_changed")
			return
		}
		historyJSON(w, map[string]any{"schema_version": 1, "state": "emptied", "deleted": 0, "kept": []any{}})
		return
	}
	if e != nil {
		snapshotError(w, 503, "trash_unavailable")
		return
	}
	defer t.close()
	entries, _, e := listTrash(cfg.Home, t, false, 500)
	if e != nil {
		snapshotError(w, 503, "trash_unavailable")
		return
	}
	if trashListingToken(entries) != token {
		snapshotError(w, 409, "trash_changed")
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), deletionWalkLimit)
	defer cancel()
	deleted, kept := 0, []map[string]any{}
	for _, entry := range entries {
		result := purgeTrashEntry(ctx, cfg, t, entry)
		if result["state"] == "deleted" {
			deleted++
			continue
		}
		kept = append(kept, result)
	}
	historyJSON(w, map[string]any{"schema_version": 1, "state": "emptied", "deleted": deleted, "kept": kept})
}
