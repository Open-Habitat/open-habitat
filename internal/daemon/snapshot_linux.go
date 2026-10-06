//go:build linux

package daemon

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/diagnostic"
	"github.com/Open-Habitat/open-habitat/internal/nativegh"
	"github.com/Open-Habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

const SnapshotPath = "/api/v1/snapshot"
const MaxSnapshotBytes = 16 << 20

func uuid() (string, bool) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", false
	}
	b[6] = b[6]&0x0f | 0x40
	b[8] = b[8]&0x3f | 0x80
	s := hex.EncodeToString(b[:])
	return s[:8] + "-" + s[8:12] + "-" + s[12:16] + "-" + s[16:20] + "-" + s[20:], true
}
func opaque(prefix, input string) string {
	h := sha256.Sum256([]byte(input))
	return prefix + base64.RawURLEncoding.EncodeToString(h[:18])
}
func snapshotError(w http.ResponseWriter, status int, code string) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json")
	b, _ := json.Marshal(map[string]any{"schema_version": 1, "error": map[string]any{"code": code, "message": "Request could not be completed", "retryable": false, "correlation_id": "req_00000000"}})
	w.Header().Set("Content-Length", strconv.Itoa(len(b)))
	w.WriteHeader(status)
	_, _ = w.Write(b)
}

// SnapshotHandler uses the same guarded socket and trusted configuration as the
// native handoff. discover is injectable only at construction, never per request.
func SnapshotHandler(cfg transport.Config, trusted func(*http.Request) bool, discover func(transport.Config) Discovery) http.Handler {
	status := func(context.Context) string { return "unknown" }
	if adapter, err := nativegh.New(cfg.Home, cfg.Subject, nil, nativegh.LinuxSecretService()); err == nil {
		status = adapter.Status
	}
	return SnapshotHandlerWithStatus(cfg, trusted, discover, status)
}

// SnapshotHandlerWithStatus shares the daemon's native adapter with the handoff
// so a snapshot cannot observe credentials midway through a mutation.
func SnapshotHandlerWithStatus(cfg transport.Config, trusted func(*http.Request) bool, discover func(transport.Config) Discovery, status func(context.Context) string) http.Handler {
	return snapshotHandlerWithStatus(cfg, trusted, discover, nativeSessions, cfg.Home, status)
}

// SnapshotHandlerWithNativeRoot is a disposable fixture seam for cross-package
// transport tests; the production constructor always reads the mapped home.
func SnapshotHandlerWithNativeRoot(cfg transport.Config, trusted func(*http.Request) bool, discover func(transport.Config) Discovery, root string) http.Handler {
	return snapshotHandlerWithStatus(cfg, trusted, discover, func(c transport.Config) ([]nativeSession, error) { c.Home = root; return nativeSessions(c) }, root, func(context.Context) string { return "unknown" })
}
func snapshotHandlerWithStatus(cfg transport.Config, trusted func(*http.Request) bool, discover func(transport.Config) Discovery, sessionsReader func(transport.Config) ([]nativeSession, error), nativeHome string, nativeStatus func(context.Context) string) http.Handler {
	return snapshotHandlerWithJournal(cfg, trusted, discover, sessionsReader, nativeHome, nativeStatus, nil)
}
func snapshotHandlerWithJournal(cfg transport.Config, trusted func(*http.Request) bool, discover func(transport.Config) Discovery, sessionsReader func(transport.Config) ([]nativeSession, error), nativeHome string, nativeStatus func(context.Context) string, journal *eventJournal) http.Handler {
	return snapshotHandlerWithController(cfg, trusted, discover, sessionsReader, nativeHome, nativeStatus, journal, nil)
}
func snapshotHandlerWithController(cfg transport.Config, trusted func(*http.Request) bool, discover func(transport.Config) Discovery, sessionsReader func(transport.Config) ([]nativeSession, error), nativeHome string, nativeStatus func(context.Context) string, journal *eventJournal, controller *ConversationController) http.Handler {
	instance, ok := uuid()
	if journal != nil {
		instance, ok = journal.instance, journal.instance != ""
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !ok || trusted == nil || !trusted(r) || r.ProtoMajor != 1 || r.ProtoMinor != 1 || r.Method != http.MethodGet || r.RequestURI != SnapshotPath || r.URL.Path != SnapshotPath || r.URL.RawQuery != "" || r.Host != "unix" {
			snapshotError(w, http.StatusForbidden, "cross_user_denied")
			return
		}
		// Capture the watermark before native observation. Concurrent Pi events
		// during construction are replayed after this cursor, even if already
		// reflected in the image; consumers deduplicate by sequence.
		eventCursor, oldestCursor := "ev1:"+instance+":0", "ev1:"+instance+":0"
		var turnViews map[string]turnTail
		var beforeNative uint64
		var afterNative uint64
		if journal != nil {
			// Native discovery can race with changes outside the controller. Controller
			// state is captured only after native observation, with its cursor.
			beforeNative = journal.nativeGeneration()
		}
		observation := discover(cfg)
		if observation.State == "error" {
			// Discovery.Error is not logged: even native diagnostics must use
			// fixed classifications, never file names or native output.
			diagnostic.New(os.Stderr, "daemon").Warn("snapshot_discovery", "outcome", "failed", "reason", "native_source_unavailable", "user", cfg.Username)
			snapshotError(w, http.StatusServiceUnavailable, "native_source_unavailable")
			return
		}
		if observation.State != "present" && observation.State != "empty" && observation.State != "missing" && observation.State != "partial" {
			diagnostic.New(os.Stderr, "daemon").Warn("snapshot_discovery", "outcome", "failed", "reason", "invalid_native_observation", "user", cfg.Username)
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		snapID, ok := uuid()
		if !ok {
			snapshotError(w, 503, "daemon_unavailable")
			return
		}
		at := time.Now().UTC().Format(time.RFC3339Nano)
		state := "confirmed"
		if observation.State == "missing" {
			state = "absent"
		}
		if observation.State == "partial" {
			state = "unknown"
		}
		fact := func(source, value string) map[string]string {
			return map[string]string{"source": source, "state": value, "observed_at": at}
		}
		visibility, visibilityErr := loadVisibility(nativeHome)
		workspaces := make([]any, 0, len(observation.Entries))
		seen := map[string]bool{}
		for _, entry := range observation.Entries {
			// Discovery may report an unreadable entry: it is not proof of a directory.
			if entry.Name == "" || len(entry.Name) > 255 {
				snapshotError(w, 503, "native_source_unavailable")
				return
			}
			if entry.Error != "" {
				continue
			} // uncertain entry identity is not confirmed present
			id := entry.WorkspaceID
			if id == "" {
				id = opaque("ws_", cfg.Provider+":"+cfg.Subject+":"+entry.Name)
			}
			if !idPattern.MatchString(id) {
				snapshotError(w, 503, "native_source_unavailable")
				return
			}
			if seen[id] {
				snapshotError(w, 503, "native_source_unavailable")
				return
			}
			seen[id] = true
			fs := "confirmed"
			if entry.Error != "" || entry.Kind == "unknown" {
				fs = "unknown"
			}
			annotation := "absent"
			if entry.Metadata == "valid" {
				annotation = "confirmed"
			}
			if entry.Metadata == "error" {
				annotation = "unavailable"
			}
			git := "absent"
			if entry.Kind == "unknown" {
				git = "unknown"
			}
			if strings.HasPrefix(entry.Kind, "git_") {
				git = "unknown" // .git is a bounded hint, not verified repository state
			}
			kind := entry.Kind
			if kind != "directory" && kind != "git_main_worktree" && kind != "git_linked_worktree" && kind != "unknown" {
				snapshotError(w, 503, "native_source_unavailable")
				return
			}
			displayName := entry.DisplayName
			if displayName == "" {
				displayName = entry.Name
			}
			visible := "visible"
			if visibilityErr == nil && visibility.Workspaces[id].Hidden {
				visible = "hidden"
			}
			mutation := "allowed"
			if visibilityErr != nil || observation.State == "partial" && observation.Error != "" || entry.Metadata == "error" || entry.Kind == "unknown" {
				mutation = "blocked_unknown"
			}
			workspaces = append(workspaces, map[string]any{"workspace_id": id, "observation_token": workspaceToken(cfg, entry), "presence": "present", "name": entry.Name, "display_name": displayName, "kind": kind, "visibility": visible, "mutation_state": mutation, "facts": []any{fact("filesystem", fs), fact("annotation", annotation), fact("git", git)}, "capabilities": map[string]any{"agent_start": map[string]string{"state": "unknown", "reason_code": "adapter_not_verified"}, "workspace_delete": map[string]string{"state": "unsupported", "reason_code": "unsafe_cleanup_not_verified"}}})
		}
		// Associate only the native header's exact cwd with a freshly confirmed
		// immediate workspace. History is independent of process observation.
		agents := make([]any, 0)
		sessions, historyErr := sessionsReader(cfg)
		if historyErr == nil {
			for _, session := range sessions {
				for _, entry := range observation.Entries {
					if entry.Error != "" || session.cwd != nativeHome+"/src/"+entry.Name {
						continue
					}
					id := entry.WorkspaceID
					if id == "" {
						id = opaque("ws_", cfg.Provider+":"+cfg.Subject+":"+entry.Name)
					}
					agents = append(agents, sessionFact(session, id, cfg.UID))
					break
				}
			}
		}
		for _, raw := range agents {
			agent := raw.(map[string]any)
			agent["archive"] = archiveFact(visibility, visibilityErr, agent["agent_id"].(string))
		}
		if controller != nil {
			controller.mu.Lock()
			for _, active := range controller.sessions {
				id := "pi:" + active.id
				found := false
				for _, raw := range agents {
					if raw.(map[string]any)["agent_id"] == id {
						found = true
						break
					}
				}
				if !found && seen[active.workspace] {
					agent := sessionFact(nativeSession{id: active.id, state: "missing"}, active.workspace, cfg.UID)
					agent["history"] = "missing"
					agent["archive"] = archiveFact(visibility, visibilityErr, id)
					agents = append(agents, agent)
				}
			}
		}
		if journal != nil {
			eventCursor, oldestCursor, afterNative, turnViews = journal.turnView()
			for _, raw := range agents {
				agent := raw.(map[string]any)
				if t, ok := turnViews[agent["agent_id"].(string)]; ok {
					agent["activity"] = t.activity
					tail := make([]json.RawMessage, 0, len(t.frames))
					tail = append(tail, t.frames...)
					agent["live_tail"] = tail
				}
			}
		}
		if controller != nil {
			controller.mu.Unlock()
		}
		// An archived annotation without a discoverable native session is not
		// an empty archive. No workspace can be inferred from the annotation.
		orphanArchive := false
		if visibilityErr == nil {
			present := make(map[string]bool, len(agents))
			for _, raw := range agents {
				agent := raw.(map[string]any)
				present[agent["agent_id"].(string)] = true
				if agent["archive"] == "archived" && agent["history"] != "readable" {
					orphanArchive = true
				}
			}
			for id := range visibility.Conversations {
				if archiveFact(visibility, nil, id) == "archived" && !present[id] {
					orphanArchive = true
					break
				}
			}
		}
		// Native observations are not journal-atomic. If an observable native
		// change arrived during discovery, leave an explicit resnapshot signal
		// *after* the controller cursor instead of silently consuming it.
		if journal != nil && beforeNative != afterNative {
			journal.appendSnapshotRaceInvalidation()
		}
		expected := opaque("wid_", cfg.Provider+":"+cfg.Subject)
		display := "GitHub user " + cfg.Subject
		ghState := nativeStatus(r.Context())
		if ghState != "connected" && ghState != "disconnected" && ghState != "partial" && ghState != "pending" {
			ghState = "unknown"
		}
		// Local workspace writes are available only with a confirmed source.
		// A missing source still gets a valid but unusable observation token.
		userToken := opaque("obs_", snapID+":user")
		writeState := "read_only"
		if observation.State == "present" || observation.State == "empty" || observation.State == "partial" && observation.Error == "" {
			nativeCfg := cfg
			nativeCfg.Home = nativeHome // synthetic snapshots must not observe the runner's real home
			if fd, s, err := workspaceSource(nativeCfg); err == nil {
				userToken = workspaceUserToken(nativeCfg, s)
				writeState = "enabled"
				unix.Close(fd)
			}
		}
		body := map[string]any{"schema_version": 1, "snapshot_id": snapID, "captured_at": at, "server_instance_id": instance, "event_cursor": eventCursor, "oldest_replay_cursor": oldestCursor, "user_observation_token": userToken, "write_state": writeState, "identity": map[string]string{"web_identity_id": expected, "display_name": display}, "sources": []any{fact("filesystem", state), fact("annotation", func() string {
			if visibilityErr != nil {
				return "unavailable"
			}
			return "confirmed"
		}()), fact("pi_history", func() string {
			if historyErr != nil {
				return "unavailable"
			}
			if orphanArchive {
				return "unknown"
			}
			return "confirmed"
		}()), fact("daemon_owner", "unknown")}, "workspaces": workspaces, "agents": agents, "operations": []any{}, "command_ledger": map[string]any{"epoch": instance, "max_entries": 10000, "max_age_seconds": 86400, "entries": []any{}}, "auth": map[string]any{"provider": cfg.Provider, "provider_account_id": cfg.Subject, "native_github": map[string]string{"state": ghState}}}
		b, err := json.Marshal(body)
		if err != nil || len(b) > MaxSnapshotBytes {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Length", strconv.Itoa(len(b)))
		w.WriteHeader(200)
		_, _ = w.Write(b)
	})
}
