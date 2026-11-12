//go:build linux

package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/open-habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

const WorkspacePath = "/api/v1/workspaces"

type workspaceRequest struct {
	Action               string  `json:"action"`
	AgentID              string  `json:"agent_id,omitempty"`
	Archived             *bool   `json:"archived,omitempty"`
	PreviousArchive      string  `json:"previous_archive,omitempty"`
	Name                 string  `json:"name,omitempty"`
	WorkspaceID          string  `json:"workspace_id,omitempty"`
	ObservationToken     string  `json:"observation_token,omitempty"`
	UserObservationToken string  `json:"user_observation_token,omitempty"`
	DisplayName          *string `json:"display_name,omitempty"`
	Git                  *bool   `json:"git,omitempty"`
	Hidden               *bool   `json:"hidden,omitempty"`
	// Icon is the `icon` value the page's picker or a suggestion chose, in
	// the config's flat format (workspace_icon_write_linux.go).
	Icon         *string `json:"icon,omitempty"`
	Disposal     string  `json:"disposal,omitempty"`
	Entry        string  `json:"entry,omitempty"`
	Confirmation string  `json:"confirmation,omitempty"`
	ListingToken string  `json:"listing_token,omitempty"`
	// ClientCommandID is the browser's id for this command. It is echoed in
	// the reply and on the published change, never used for authorization.
	ClientCommandID string `json:"client_command_id,omitempty"`
}

// The private state file is presentation only. A malformed or newer version is
// never silently replaced; discovery remains independent of this file.
type workspaceVisibility struct {
	SchemaVersion int `json:"schema_version"`
	Workspaces    map[string]struct {
		Hidden    bool   `json:"hidden"`
		UpdatedAt string `json:"updated_at"`
	} `json:"workspaces"`
	Conversations map[string]json.RawMessage `json:"conversations"`
}

func stateDir(home string, create bool) (int, error) {
	root, e := unix.Open("/", unix.O_PATH|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if e != nil {
		return -1, e
	}
	defer unix.Close(root)
	h, e := dir(unix.Openat2, root, strings.TrimPrefix(home, "/"), false)
	if e != nil {
		return -1, e
	}
	defer unix.Close(h)
	parent := h
	for _, n := range []string{".local", "state", "open-habitat"} {
		if create {
			if e = unix.Mkdirat(parent, n, 0700); e != nil && !errors.Is(e, unix.EEXIST) {
				if parent != h {
					unix.Close(parent)
				}
				return -1, e
			}
		}
		next, err := dir(unix.Openat2, parent, n, true)
		if parent != h {
			unix.Close(parent)
		}
		if err != nil {
			return -1, err
		}
		parent = next
		s, err := stat(parent)
		if err != nil || s.Uid != uint32(os.Geteuid()) || s.Mode&0022 != 0 {
			unix.Close(parent)
			return -1, errors.New("unsafe state directory")
		}
	}
	return parent, nil
}
func loadVisibility(home string) (workspaceVisibility, error) {
	state := workspaceVisibility{SchemaVersion: 1, Workspaces: map[string]struct {
		Hidden    bool   `json:"hidden"`
		UpdatedAt string `json:"updated_at"`
	}{}, Conversations: map[string]json.RawMessage{}}
	d, e := stateDir(home, false)
	if errors.Is(e, unix.ENOENT) {
		return state, nil
	}
	if e != nil {
		return state, e
	}
	defer unix.Close(d)
	b, status := readSmall(unix.Openat2, d, "user-state.json", 1<<20)
	if status == "missing" {
		return state, nil
	}
	if status != "valid" {
		return state, errors.New("state unreadable")
	}
	dec := json.NewDecoder(bytes.NewReader(b))
	dec.DisallowUnknownFields()
	var extra any
	if dec.Decode(&state) != nil || dec.Decode(&extra) != io.EOF || state.SchemaVersion != 1 || state.Workspaces == nil || state.Conversations == nil {
		return state, errors.New("unknown state")
	}
	for id, visibility := range state.Workspaces {
		if !idPattern.MatchString(id) || visibility.UpdatedAt == "" {
			return state, errors.New("state annotation unreadable")
		}
		if _, err := time.Parse(time.RFC3339Nano, visibility.UpdatedAt); err != nil {
			return state, errors.New("state annotation unreadable")
		}
	}
	for id := range state.Conversations {
		if !strings.HasPrefix(id, "pi:") || archiveFact(state, nil, id) == "unknown" {
			return state, errors.New("state annotation unreadable")
		}
	}
	return state, nil
}
func saveVisibility(home string, s workspaceVisibility) error {
	d, e := stateDir(home, true)
	if e != nil {
		return e
	}
	defer unix.Close(d)
	b, e := json.Marshal(s)
	if e != nil {
		return e
	}
	if len(b) > 1<<20 {
		return errors.New("state exceeds readable bound")
	}
	id, e := newWorkspaceID()
	if e != nil {
		return e
	}
	tmp := ".state-" + id
	fd, e := unix.Openat(d, tmp, unix.O_CREAT|unix.O_EXCL|unix.O_WRONLY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0600)
	if e != nil {
		return e
	}
	defer unix.Unlinkat(d, tmp, 0)
	f := os.NewFile(uintptr(fd), tmp)
	_, e = f.Write(b)
	if e == nil {
		e = f.Sync()
	}
	closeErr := f.Close()
	if e != nil {
		return e
	}
	if closeErr != nil {
		return closeErr
	}
	if e = unix.Renameat(d, tmp, d, "user-state.json"); e != nil {
		return e
	}
	return unix.Fsync(d)
}

// WorkspaceHandler is mounted only on the mapped user's daemon socket. Each
// request observes native entries anew; browser names and IDs alone never grant
// access to a path. Deletion moves into the Trash (workspace_delete_linux.go).
func WorkspaceHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return workspaceHandler(cfg, trusted, nil)
}
func WorkspaceHandlerWithArchive(cfg transport.Config, trusted func(*http.Request) bool, controller *ConversationController) http.Handler {
	return workspaceHandler(cfg, trusted, controller)
}
func workspaceHandler(cfg transport.Config, trusted func(*http.Request) bool, controller *ConversationController) http.Handler {
	return workspaceHandlerAt(cfg, trusted, controller, WorkspacePath, false)
}

func workspaceHandlerAt(cfg transport.Config, trusted func(*http.Request) bool, controller *ConversationController, path string, agent bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		if r.URL.Path != path || r.RequestURI != path || r.Method != "POST" || r.URL.RawQuery != "" || r.ContentLength < 2 || r.ContentLength > 2048 || len(r.TransferEncoding) != 0 || r.Header.Get("Content-Type") != "application/json" {
			snapshotError(w, 400, "invalid_request")
			return
		}
		b, e := io.ReadAll(io.LimitReader(r.Body, 2049))
		var in workspaceRequest
		var extra any
		dec := json.NewDecoder(bytes.NewReader(b))
		dec.DisallowUnknownFields()
		if e != nil || int64(len(b)) != r.ContentLength || !catalogNoDuplicates(b) || dec.Decode(&in) != nil || dec.Decode(&extra) != io.EOF {
			snapshotError(w, 400, "invalid_request")
			return
		}
		// Agent routes admit only this batch's operations, never future browser additions.
		if agent && !agentWorkspaceAction(in.Action) {
			snapshotError(w, 404, "route_not_found")
			return
		}
		if in.ClientCommandID != "" && !sessionIDPattern.MatchString(in.ClientCommandID) {
			snapshotError(w, 400, "invalid_request")
			return
		}
		if deletionAction(in.Action) {
			serveWorkspaceDeletion(w, r, cfg, controller, in)
			return
		}
		if worktreeAction(in.Action) {
			serveWorktrees(w, cfg, controller, in)
			return
		}
		if in.Disposal != "" || in.Entry != "" || in.Confirmation != "" || in.ListingToken != "" || in.Icon != nil && in.Action != "icon" {
			snapshotError(w, 400, "invalid_request")
			return
		}
		if in.Action == "conversation_archive" {
			if controller == nil || in.Name != "" || in.UserObservationToken != "" || in.DisplayName != nil || in.Git != nil || in.Hidden != nil || in.Archived == nil || !strings.HasPrefix(in.AgentID, "pi:") {
				snapshotError(w, 400, "invalid_request")
				return
			}
			// The writer wait and the proof permit can each take up to 2 s
			// before the work itself; keep the reply past the socket's 5 s.
			extendReply(w, 15*time.Second)
			controller.archiveInput(r.Context(), w, strings.TrimPrefix(in.AgentID, "pi:"), archiveRequest{WorkspaceID: in.WorkspaceID, Archived: *in.Archived, ObservationToken: in.ObservationToken, PreviousArchive: in.PreviousArchive, ClientCommandID: in.ClientCommandID})
			return
		}
		if in.AgentID != "" || in.Archived != nil || in.PreviousArchive != "" {
			snapshotError(w, 400, "invalid_request")
			return
		}
		if in.Action != "create" && in.Action != "settings" && in.Action != "visibility" && in.Action != "git_init" && in.Action != "icon" {
			snapshotError(w, 400, "invalid_request")
			return
		}
		if in.Action == "create" {
			if !validWorkspaceName(in.Name) || in.WorkspaceID != "" || in.ObservationToken != "" || len(in.UserObservationToken) < 8 || len(in.UserObservationToken) > 200 || in.Hidden != nil || in.Git == nil || in.DisplayName != nil && !validDisplay(*in.DisplayName) {
				snapshotError(w, 400, "invalid_request")
				return
			}
		} else if in.Name != "" || in.UserObservationToken != "" || !idPattern.MatchString(in.WorkspaceID) || in.ObservationToken == "" || len(in.ObservationToken) > 200 || (in.Action == "settings" && (in.DisplayName == nil || in.Git != nil || in.Hidden != nil || *in.DisplayName != "" && !validDisplay(*in.DisplayName))) || (in.Action == "visibility" && (in.Hidden == nil || in.DisplayName != nil || in.Git != nil)) || (in.Action == "git_init" && (in.Hidden != nil || in.Git != nil || in.DisplayName != nil)) || (in.Action == "icon" && (in.Icon == nil || in.Hidden != nil || in.Git != nil || in.DisplayName != nil || len(*in.Icon) > maxIconPath)) {
			snapshotError(w, 400, "invalid_request")
			return
		}
		extendReply(w, 15*time.Second) // the writer wait precedes the work
		if code := cloneWriter.waitBriefly(r.Context(), "workspace_settings_running"); code != "" {
			snapshotError(w, 409, code)
			return
		}
		defer cloneWriter.Unlock()
		src, source, e := workspaceSource(cfg)
		if e != nil {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		defer unix.Close(src)
		if in.Action == "create" {
			if in.UserObservationToken != workspaceUserToken(cfg, source) {
				snapshotError(w, 409, "workspace_changed")
				return
			}
			// A partial entry does not hide a name when the source listing and
			// source identity were both read completely.
			obs := Discover(cfg)
			if obs.State == "error" || obs.Error != "" {
				snapshotError(w, 409, "workspace_uncertain")
				return
			}
			for _, ent := range obs.Entries {
				if strings.EqualFold(ent.Name, in.Name) {
					snapshotError(w, 409, "workspace_exists")
					return
				}
			}
			if e = unix.Mkdirat(src, in.Name, 0700); e != nil {
				snapshotError(w, 409, "workspace_exists")
				return
			}
			child, initial, err := openWorkspace(src, in.Name)
			if err != nil {
				snapshotError(w, 409, "workspace_uncertain")
				return
			}
			defer unix.Close(child)
			id, err := newWorkspaceID()
			if err == nil {
				display := ""
				if in.DisplayName != nil {
					display = *in.DisplayName
				}
				err = writeWorkspaceSettings(child, id, display)
			}
			if err == nil && *in.Git {
				err = initWorkspaceGit(child, cfg.Home)
			}
			if err != nil || !workspaceStillNamed(src, in.Name, initial) || !cloneSourceStillNamed(cfg.Home, source) {
				snapshotError(w, 409, "workspace_partial")
				return
			}
			reply := map[string]any{"schema_version": 1, "workspace_id": id, "state": "created"}
			if in.ClientCommandID != "" {
				reply["client_command_id"] = in.ClientCommandID
			}
			historyJSON(w, reply)
			return
		}
		obs := Discover(cfg)
		if obs.State == "error" || obs.Error != "" {
			snapshotError(w, 409, "workspace_uncertain")
			return
		}
		var target *Workspace
		for i := range obs.Entries {
			entry := &obs.Entries[i]
			// The name-derived ID still names a directory that has since been
			// given a durable one: a command queued behind the first rename, or
			// another tab's older snapshot, addresses the same directory.
			derived := opaque("ws_", cfg.Provider+":"+cfg.Subject+":"+entry.Name)
			if (entry.WorkspaceID == in.WorkspaceID || derived == in.WorkspaceID) && entry.Error == "" {
				target = entry
				break
			}
		}
		if target == nil {
			snapshotError(w, 409, "workspace_missing")
			return
		}
		if target.Metadata == "error" || target.Kind == "unknown" {
			snapshotError(w, 409, "workspace_uncertain")
			return
		}
		// Native identity and inode, not the browser's path, bind the mutation.
		expected := workspaceToken(cfg, *target)
		if in.ObservationToken != expected {
			snapshotError(w, 409, "workspace_changed")
			return
		}
		child, initial, e := openWorkspace(src, target.Name)
		if e != nil || uint64(initial.Dev) != target.dev || initial.Ino != target.ino {
			if e == nil {
				unix.Close(child)
			}
			snapshotError(w, 409, "workspace_changed")
			return
		}
		defer unix.Close(child)
		// Annotations and the reply use the directory's current ID.
		responseID := target.WorkspaceID
		if responseID == "" {
			responseID = in.WorkspaceID
		}
		display := target.DisplayName
		hidden := false
		changeKnown := true
		commit := ""
		switch in.Action {
		case "icon":
			commit, e = setWorkspaceIcon(r.Context(), cfg.Home, child, target.Kind, *in.Icon)
			if errors.Is(e, errIconInvalid) || errors.Is(e, errIconConfig) {
				snapshotError(w, 409, e.Error())
				return
			}
		case "settings":
			if target.Kind == "git_main_worktree" {
				if e = ensureWorkspaceExclude(child); e != nil {
					break
				}
			}
			id := target.WorkspaceID
			if id == "" {
				id, e = newWorkspaceID()
				if e != nil {
					break
				}
			}
			e = writeWorkspaceSettings(child, id, *in.DisplayName)
			responseID = id
			display = *in.DisplayName
			if e != nil {
				break
			}
			// The first settings write gives the workspace a durable ID; its
			// visibility annotation moves with it rather than being lost. An
			// unreadable annotation file does not undo the rename: the reply
			// then carries no change and the next snapshot shows the facts.
			state, err := loadVisibility(cfg.Home)
			if err != nil {
				changeKnown = false
				break
			}
			prior, ok := state.Workspaces[id]
			if !ok {
				prior = state.Workspaces[in.WorkspaceID]
			}
			if _, moved := state.Workspaces[in.WorkspaceID]; moved && id != in.WorkspaceID {
				state.Workspaces[id] = prior
				delete(state.Workspaces, in.WorkspaceID)
				if saveVisibility(cfg.Home, state) != nil {
					changeKnown = false
				}
			}
			hidden = prior.Hidden
		case "visibility":
			var state workspaceVisibility
			state, e = loadVisibility(cfg.Home)
			if e == nil {
				state.Workspaces[responseID] = struct {
					Hidden    bool   `json:"hidden"`
					UpdatedAt string `json:"updated_at"`
				}{*in.Hidden, time.Now().UTC().Format(time.RFC3339Nano)}
				e = saveVisibility(cfg.Home, state)
			}
			hidden = *in.Hidden
		case "git_init":
			if target.Kind != "directory" {
				snapshotError(w, 409, "workspace_has_git")
				return
			}
			e = initWorkspaceGit(child, cfg.Home)
		}
		if e != nil || !workspaceStillNamed(src, target.Name, initial) || !cloneSourceStillNamed(cfg.Home, source) {
			snapshotError(w, 409, "workspace_partial")
			return
		}
		reply := map[string]any{"schema_version": 1, "workspace_id": responseID, "state": "updated"}
		if in.ClientCommandID != "" {
			reply["client_command_id"] = in.ClientCommandID
		}
		if commit != "" {
			reply["icon_commit"] = commit
			// Other tabs read the new icon from the next snapshot. This one
			// shows it at once and keeps it until a snapshot has passed the
			// invalidation's cursor, so an older read still on its way does
			// not put the previous icon back.
			if controller != nil && controller.journal != nil && commit != iconUnchanged {
				if cursor := controller.journal.appendInvalidation(""); cursor != "" {
					reply["event_cursor"] = cursor
				}
			}
		}
		if changeKnown && (in.Action == "settings" || in.Action == "visibility") {
			// The reply and the journal carry the changed facts, so neither
			// this tab nor another needs a snapshot to see them.
			if display == "" {
				display = target.Name
			}
			visibility := "visible"
			if hidden {
				visibility = "hidden"
			}
			change := map[string]any{"workspace_id": responseID, "observation_token": expected, "name": target.Name, "display_name": display, "visibility": visibility}
			if responseID != in.WorkspaceID {
				change["previous_workspace_id"] = in.WorkspaceID
			}
			reply["workspace"] = change
			if controller != nil && controller.journal != nil {
				if cursor := controller.journal.appendWorkspaceChange(change, in.ClientCommandID); cursor != "" {
					reply["event_cursor"] = cursor
				}
			}
		}
		historyJSON(w, reply)
	})
}
func validDisplay(s string) bool {
	return len(s) > 0 && len(s) <= 255 && utf8.ValidString(s) && !strings.ContainsRune(s, 0)
}
func workspaceToken(cfg transport.Config, w Workspace) string {
	return opaque("obs_", cfg.Provider+":"+cfg.Subject+":"+w.Name+":"+stringJSON(w.dev)+":"+stringJSON(w.ino))
}
func workspaceUserToken(cfg transport.Config, s unix.Stat_t) string {
	return opaque("obs_", cfg.Provider+":"+cfg.Subject+":src:"+stringJSON(uint64(s.Dev))+":"+stringJSON(s.Ino))
}
func stringJSON(n uint64) string { b, _ := json.Marshal(n); return string(b) }
func initWorkspaceGit(fd int, home string) error {
	copyFD, e := unix.Dup(fd)
	if e != nil {
		return e
	}
	f := os.NewFile(uintptr(copyFD), "workspace")
	defer f.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "/usr/bin/git", "init", "--quiet")
	cmd.Dir = filepath.Join("/proc", stringJSON(uint64(os.Getpid())), "fd", stringJSON(uint64(f.Fd())))
	cmd.Env = []string{"HOME=" + home, "PATH=/usr/bin:/bin", "GIT_CONFIG_NOSYSTEM=1", "GIT_TERMINAL_PROMPT=0"}
	if e := cmd.Run(); e != nil {
		return e
	}
	return ensureWorkspaceExclude(fd)
}

// Git's local exclude keeps host annotations out of this checkout only.
// Linked worktree git-dir files are intentionally not followed.
func ensureWorkspaceExclude(fd int) error {
	gitDir, e := dir(unix.Openat2, fd, ".git", true)
	if e != nil {
		return e
	}
	defer unix.Close(gitDir)
	if e = unix.Mkdirat(gitDir, "info", 0700); e != nil && !errors.Is(e, unix.EEXIST) {
		return e
	}
	info, e := dir(unix.Openat2, gitDir, "info", true)
	if e != nil {
		return e
	}
	defer unix.Close(info)
	item, e := unix.Openat2(info, "exclude", &unix.OpenHow{Flags: unix.O_RDWR | unix.O_CREAT | unix.O_NONBLOCK | unix.O_CLOEXEC | unix.O_NOFOLLOW, Mode: 0600, Resolve: resolve})
	if e != nil {
		return e
	}
	file := os.NewFile(uintptr(item), "exclude")
	defer file.Close()
	fileStat, e := stat(item)
	if e != nil || fileStat.Mode&unix.S_IFMT != unix.S_IFREG {
		return errors.New("unsafe git exclude")
	}
	contents, e := io.ReadAll(io.LimitReader(file, 1<<20+1))
	if e != nil || len(contents) > 1<<20 {
		return errors.New("git exclude unreadable")
	}
	if !strings.Contains("\n"+string(contents)+"\n", "\n.agent-host/\n") {
		if len(contents) > 0 && contents[len(contents)-1] != '\n' {
			if _, e = file.WriteString("\n"); e != nil {
				return e
			}
		}
		if _, e = file.WriteString(".agent-host/\n"); e != nil {
			return e
		}
		return file.Sync()
	}
	return nil
}

// archivedAt is when the person archived the conversation, read only for
// one that archiveFact calls archived.
func archivedAt(state workspaceVisibility, id string) string {
	var fields struct {
		ArchivedAt string `json:"archived_at"`
	}
	if json.Unmarshal(state.Conversations[id], &fields) != nil {
		return ""
	}
	at, err := time.Parse(time.RFC3339Nano, fields.ArchivedAt)
	if err != nil {
		return ""
	}
	return at.UTC().Format(time.RFC3339Nano)
}

// archiveFact never treats an unreadable annotation as an empty archive.
func archiveFact(state workspaceVisibility, readErr error, id string) string {
	if readErr != nil {
		return "unknown"
	}
	raw, ok := state.Conversations[id]
	if !ok {
		return "active"
	}
	var fields map[string]json.RawMessage
	if json.Unmarshal(raw, &fields) != nil || fields == nil {
		return "unknown"
	}
	for field := range fields {
		if field != "archived_at" && field != "title" && field != "parent" {
			return "unknown"
		}
	}
	if stamp, present := fields["archived_at"]; present {
		var at string
		if json.Unmarshal(stamp, &at) != nil || at == "" {
			return "unknown"
		}
		if _, err := time.Parse(time.RFC3339Nano, at); err != nil {
			return "unknown"
		}
		return "archived"
	}
	return "active"
}
