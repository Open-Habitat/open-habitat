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

	"github.com/maintainer/native-agent-host/internal/transport"
	"golang.org/x/sys/unix"
)

const WorkspacePath = "/api/v1/workspaces"

type workspaceRequest struct {
	Action           string  `json:"action"`
	Name             string  `json:"name,omitempty"`
	WorkspaceID      string  `json:"workspace_id,omitempty"`
	ObservationToken string  `json:"observation_token,omitempty"`
	DisplayName      *string `json:"display_name,omitempty"`
	Git              *bool   `json:"git,omitempty"`
	Hidden           *bool   `json:"hidden,omitempty"`
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
	for _, n := range []string{".local", "state", "native-agent-host"} {
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
	fd, e := open(unix.Openat2, d, "user-state.json", unix.O_RDONLY, true)
	if errors.Is(e, unix.ENOENT) {
		return state, nil
	}
	if e != nil {
		return state, e
	}
	f := os.NewFile(uintptr(fd), "user-state.json")
	defer f.Close()
	b, e := io.ReadAll(io.LimitReader(f, 1<<20+1))
	if e != nil || len(b) > 1<<20 {
		return state, errors.New("state unreadable")
	}
	dec := json.NewDecoder(bytes.NewReader(b))
	dec.DisallowUnknownFields()
	var extra any
	if dec.Decode(&state) != nil || dec.Decode(&extra) != io.EOF || state.SchemaVersion != 1 || state.Workspaces == nil || state.Conversations == nil {
		return state, errors.New("unknown state")
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
// access to a path. Destructive removal is intentionally not exposed.
func WorkspaceHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		if r.URL.Path != WorkspacePath || r.RequestURI != WorkspacePath || r.Method != "POST" || r.URL.RawQuery != "" || r.ContentLength < 2 || r.ContentLength > 2048 || len(r.TransferEncoding) != 0 || r.Header.Get("Content-Type") != "application/json" {
			snapshotError(w, 400, "invalid_request")
			return
		}
		if !cloneWriter.TryLock() {
			snapshotError(w, 409, "workspace_busy")
			return
		}
		defer cloneWriter.Unlock()
		b, e := io.ReadAll(io.LimitReader(r.Body, 2049))
		var in workspaceRequest
		var extra any
		dec := json.NewDecoder(bytes.NewReader(b))
		dec.DisallowUnknownFields()
		if e != nil || int64(len(b)) != r.ContentLength || !catalogNoDuplicates(b) || dec.Decode(&in) != nil || dec.Decode(&extra) != io.EOF {
			snapshotError(w, 400, "invalid_request")
			return
		}
		if in.Action != "create" && in.Action != "settings" && in.Action != "visibility" && in.Action != "git_init" {
			snapshotError(w, 400, "invalid_request")
			return
		}
		if in.Action == "create" {
			if !validWorkspaceName(in.Name) || in.WorkspaceID != "" || in.ObservationToken != "" || in.Hidden != nil || in.Git == nil || in.DisplayName != nil && !validDisplay(*in.DisplayName) {
				snapshotError(w, 400, "invalid_request")
				return
			}
		} else if in.Name != "" || !idPattern.MatchString(in.WorkspaceID) || in.ObservationToken == "" || len(in.ObservationToken) > 200 || (in.Action == "settings" && (in.DisplayName == nil || in.Git != nil || in.Hidden != nil || *in.DisplayName != "" && !validDisplay(*in.DisplayName))) || (in.Action == "visibility" && (in.Hidden == nil || in.DisplayName != nil || in.Git != nil)) || (in.Action == "git_init" && (in.Hidden != nil || in.Git != nil || in.DisplayName != nil)) {
			snapshotError(w, 400, "invalid_request")
			return
		}
		src, source, e := workspaceSource(cfg)
		if e != nil {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		defer unix.Close(src)
		if in.Action == "create" {
			// Scan the whole source; unreadable names cannot prove availability.
			obs := Discover(cfg)
			if obs.State == "error" || obs.State == "partial" {
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
			historyJSON(w, map[string]any{"schema_version": 1, "workspace_id": id, "state": "created"})
			return
		}
		obs := Discover(cfg)
		if obs.State == "partial" || obs.State == "error" {
			snapshotError(w, 409, "workspace_uncertain")
			return
		}
		var target *Workspace
		for i := range obs.Entries {
			entry := &obs.Entries[i]
			id := entry.WorkspaceID
			if id == "" {
				id = opaque("ws_", cfg.Provider+":"+cfg.Subject+":"+entry.Name)
			}
			if id == in.WorkspaceID && entry.Error == "" {
				target = entry
				break
			}
		}
		if target == nil {
			snapshotError(w, 409, "workspace_missing")
			return
		}
		// Snapshot observation tokens are snapshot-scoped, not reconstructible from
		// native discovery. Mutations instead require a fresh, pathname-independent
		// token derived from the observed inode, supplied in the snapshot.
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
		switch in.Action {
		case "settings":
			id := target.WorkspaceID
			if id == "" {
				id = in.WorkspaceID
			}
			e = writeWorkspaceSettings(child, id, *in.DisplayName)
		case "visibility":
			var state workspaceVisibility
			state, e = loadVisibility(cfg.Home)
			if e == nil {
				state.Workspaces[in.WorkspaceID] = struct {
					Hidden    bool   `json:"hidden"`
					UpdatedAt string `json:"updated_at"`
				}{*in.Hidden, time.Now().UTC().Format(time.RFC3339Nano)}
				e = saveVisibility(cfg.Home, state)
			}
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
		historyJSON(w, map[string]any{"schema_version": 1, "workspace_id": in.WorkspaceID, "state": "updated"})
	})
}
func validDisplay(s string) bool {
	return len(s) > 0 && len(s) <= 255 && utf8.ValidString(s) && !strings.ContainsRune(s, 0)
}
func workspaceToken(cfg transport.Config, w Workspace) string {
	return opaque("obs_", cfg.Provider+":"+cfg.Subject+":"+w.Name+":"+stringJSON(w.dev)+":"+stringJSON(w.ino))
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
	// Git's local exclude avoids committing host annotations in a new repository.
	gitDir, e := dir(unix.Openat2, fd, ".git", true)
	if e != nil {
		return e
	}
	defer unix.Close(gitDir)
	info, e := dir(unix.Openat2, gitDir, "info", true)
	if e != nil {
		return e
	}
	defer unix.Close(info)
	item, e := open(unix.Openat2, info, "exclude", unix.O_RDWR, true)
	if e != nil {
		return e
	}
	file := os.NewFile(uintptr(item), "exclude")
	defer file.Close()
	contents, e := io.ReadAll(io.LimitReader(file, 1<<20+1))
	if e != nil || len(contents) > 1<<20 {
		return errors.New("git exclude unreadable")
	}
	if !bytes.Contains(contents, []byte("\n.agent-host/\n")) {
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
