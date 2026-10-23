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
	"sync"
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
		status = adapter.ObservedStatus
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
		// Phase durations are measured side by side; they overlap, not add up.
		started := time.Now()
		observation := discover(cfg)
		diagnostic.Phase(r.Context(), "discovery", started)
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
		var facts *snapshotFacts
		if controller != nil {
			facts = controller.facts
		}
		// The parts below are independent native observations: run them side
		// by side rather than adding up their latencies.
		ghDone := make(chan string, 1)
		go func() {
			started := time.Now()
			state := nativeStatus(r.Context())
			diagnostic.Phase(r.Context(), "github", started)
			ghDone <- state
		}()
		var waitingViews map[string][]waitingProcess
		waitingDone := make(chan struct{})
		go func() {
			defer close(waitingDone)
			if controller != nil {
				started := time.Now()
				waitingViews = controller.processWaitingViews(r.Context())
				diagnostic.Phase(r.Context(), "processes", started)
			}
		}()
		var sessions []nativeSession
		var historyErr error
		sessionsDone := make(chan struct{})
		go func() {
			defer close(sessionsDone)
			defer diagnostic.Phase(r.Context(), "sessions", time.Now())
			if facts != nil {
				historyCfg := cfg
				historyCfg.Home = nativeHome
				sessions, historyErr = facts.sessions.read(historyCfg)
			} else {
				sessions, historyErr = sessionsReader(cfg)
			}
		}()
		started = time.Now()
		var taskRuns []nativeSpinoff
		taskRunsOK := false
		if facts != nil {
			taskRuns, taskRunsOK = facts.taskfleet.list(r.Context(), nativeHome)
		} else if taskfleetBinary(nativeHome) != "" {
			taskRuns, taskRunsOK = listTaskfleetRuns(r.Context(), nativeHome)
		}
		if taskRunsOK {
			observation.Entries = filterTaskfleetWorkspaces(nativeHome, observation.Entries, taskRuns)
		}
		diagnostic.Phase(r.Context(), "taskfleet", started)
		// Worktree places (ADR 0025): every main checkout's registered
		// worktrees. A directory under ~/src that holds only their checkouts
		// is their container, not a workspace. A Taskfleet run's worktree
		// is observed as its spinoff, not listed as a place.
		started = time.Now()
		placesOf := map[string][]worktreePlace{}
		placeByPath := map[string]worktreePlace{}
		var allPlaces []worktreePlace
		for _, entry := range observation.Entries {
			if entry.Kind != "git_main_worktree" || entry.Error != "" || entry.Metadata == "error" {
				continue
			}
			found, _ := readWorktreePlaces(nativeHome, entry, workspaceIDOf(cfg, entry))
			allPlaces = append(allPlaces, found...)
			for _, p := range found {
				if taskRunsOK && taskfleetOwned(taskRuns, p.Path) {
					continue
				}
				placesOf[p.WorkspaceID] = append(placesOf[p.WorkspaceID], p)
				placeByPath[p.Path] = p
			}
		}
		if containers := worktreeContainers(nativeHome, observation.Entries, allPlaces); len(containers) > 0 {
			kept := make([]Workspace, 0, len(observation.Entries))
			for _, e := range observation.Entries {
				if !containers[e.Name] {
					kept = append(kept, e)
				}
			}
			observation.Entries = kept
		}
		placeViews := map[string]map[string]any{}
		diagnostic.Phase(r.Context(), "worktrees", started)
		visibility, visibilityErr := loadVisibility(nativeHome)
		workspaces := make([]any, 0, len(observation.Entries))
		gitEntries := make([]Workspace, 0, len(observation.Entries))
		// Bound remote inspection for the entire catalog, not per repository.
		// Uninspected entries remain unknown rather than becoming publishable.
		remoteCtx, stopRemote := context.WithTimeout(r.Context(), 2*time.Second)
		defer stopRemote()
		seen := map[string]bool{}
		// A controlled conversation keeps the workspace ID it started under; the
		// first rename gives the directory a durable ID, so match by directory.
		idByPath := map[string]string{}
		for _, entry := range observation.Entries {
			// Discovery may report an unreadable entry: it is not proof of a directory.
			if entry.Name == "" || len(entry.Name) > 255 {
				snapshotError(w, 503, "native_source_unavailable")
				return
			}
			if entry.Error != "" {
				continue
			} // uncertain entry identity is not confirmed present
			id := workspaceID(cfg, entry)
			if !idPattern.MatchString(id) {
				snapshotError(w, 503, "native_source_unavailable")
				return
			}
			if seen[id] {
				snapshotError(w, 503, "native_source_unavailable")
				return
			}
			seen[id] = true
			idByPath[nativeHome+"/src/"+entry.Name] = id
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
			ws := map[string]any{"path": nativeHome + "/src/" + entry.Name, "workspace_id": id, "observation_token": workspaceToken(cfg, entry), "presence": "present", "name": entry.Name, "display_name": displayName, "kind": kind, "visibility": visible, "mutation_state": mutation, "facts": []any{fact("filesystem", fs), fact("annotation", annotation), fact("git", git)}, "capabilities": map[string]any{"agent_start": map[string]string{"state": "unknown", "reason_code": "adapter_not_verified"}, "workspace_delete": map[string]string{"state": "unsupported", "reason_code": "unsafe_cleanup_not_verified"}}}
			if found := placesOf[id]; len(found) > 0 {
				list := make([]any, 0, len(found))
				for _, p := range found {
					view := map[string]any{"worktree_id": p.ID, "entry": p.Entry, "name": p.Name, "path": p.Path}
					if p.Branch != "" {
						view["branch"] = p.Branch
					}
					placeViews[p.ID] = view
					list = append(list, view)
				}
				ws["worktrees"] = list
			}
			workspaces = append(workspaces, ws)
			gitEntries = append(gitEntries, entry)
		}
		// Git status can walk a large tree; give home-only hints a separate,
		// bounded catalog budget. Workspaces are observed side by side, and a
		// workspace whose inputs have not changed is answered from gitWatch.
		summaryCtx, stopSummary := context.WithTimeout(r.Context(), 1500*time.Millisecond)
		defer stopSummary()
		started = time.Now()
		global := gitGlobalStamp(nativeHome)
		var gitWork sync.WaitGroup
		gitSlots := make(chan struct{}, 4)
		for i, entry := range gitEntries {
			if entry.Kind != "git_main_worktree" && entry.Kind != "git_linked_worktree" {
				continue
			}
			ws := workspaces[i].(map[string]any)
			gitWork.Add(1)
			go func() {
				defer gitWork.Done()
				gitSlots <- struct{}{}
				defer func() { <-gitSlots }()
				observe := func() (gitFacts, bool) {
					var f gitFacts
					if entry.Kind == "git_main_worktree" {
						f.remote, f.continuation = workspaceRemote(remoteCtx, nativeHome, entry)
					}
					f.summary, f.summaryOK = workspaceGitSummary(summaryCtx, nativeHome, entry)
					// A budget that ran out made "unknown" a timeout, not a fact.
					return f, remoteCtx.Err() == nil && summaryCtx.Err() == nil
				}
				var f gitFacts
				if facts != nil {
					f = facts.git.facts(summaryCtx, nativeHome, entry, global, observe)
				} else {
					f, _ = observe()
				}
				if entry.Kind == "git_main_worktree" {
					ws["git_remote"] = f.remote
					if f.continuation {
						ws["publish_continuation"] = true
					}
				}
				if f.summaryOK {
					ws["git_summary"] = f.summary
				}
			}()
		}
		gitWork.Wait()
		diagnostic.Phase(r.Context(), "git", started)
		if facts != nil {
			facts.git.sweep()
		}
		// Associate only the native header's exact cwd with a freshly confirmed
		// immediate workspace. History is independent of process observation.
		agents := make([]any, 0)
		usedPlaces := map[string]worktreePlace{}
		<-sessionsDone
		if historyErr == nil {
			var ownPIDs map[int]bool
			if controller != nil {
				ownPIDs = controller.ownPiPIDs()
			}
			processes := snapshotPiWriters(sessions, cfg.UID, ownPIDs)
			for _, session := range sessions {
				id, worktree := "", ""
				for _, entry := range observation.Entries {
					if entry.Error == "" && session.cwd == nativeHome+"/src/"+entry.Name {
						id = workspaceIDOf(cfg, entry)
						break
					}
				}
				if p, ok := placeByPath[session.cwd]; ok && id == "" && seen[p.WorkspaceID] {
					id, worktree = p.WorkspaceID, p.ID
					usedPlaces[p.ID] = p
				}
				if id != "" {
					// The place's own ID is what a conversation in it started
					// and resumes under.
					startedUnder := id
					if worktree != "" {
						startedUnder = worktree
					}
					var agent map[string]any
					if facts != nil {
						prompt, name := facts.sessions.title(session, cfg.UID)
						agent = sessionFactTitled(session, id, prompt, name)
					} else {
						agent = sessionFact(session, id, cfg.UID)
					}
					if worktree != "" {
						agent["worktree_id"] = worktree
					}
					if session.state == "readable" {
						if n := workingSpinoffs(taskRuns, session); n > 0 {
							agent["spinoffs_working"] = n
						}
						switch processes[session.path] {
						case "writer_present":
							agent["process"] = "terminal_observed_live"
						case "not_observed":
							agent["process"] = "not_observed"
						}
						// A browser-started conversation resumes when the person
						// sends to it. This is an offer, not a reservation: the
						// start repeats the full ownership proof.
						if origin, err := peekBrowserOrigin(nativeHome, session.id); err == nil && origin.Workspace == startedUnder && origin.Cwd == session.cwd && agent["process"] != "terminal_observed_live" {
							agent["control"] = "transfer_possible"
							agent["capabilities"] = map[string]any{"agent_resume": map[string]string{"state": "supported", "reason_code": "browser_origin"}}
						}
					}
					agents = append(agents, agent)
				}
			}
		}
		for _, raw := range agents {
			agent := raw.(map[string]any)
			agent["archive"] = archiveFact(visibility, visibilityErr, agent["agent_id"].(string))
		}
		<-waitingDone
		if controller != nil {
			controller.mu.Lock()
			for _, active := range controller.sessions {
				id := "pi:" + active.id
				found := false
				for _, raw := range agents {
					if raw.(map[string]any)["agent_id"] == id {
						found = true
						select {
						case <-active.rpc.exited:
							// A reaped child leaves the conversation as it is after a
							// daemon restart: resumable on send, not finished. Keep the
							// native process census.
						default:
							raw.(map[string]any)["process"] = "daemon_managed_live"
						}
						break
					}
				}
				workspace, worktree := active.workspace, ""
				if current, ok := idByPath[active.cwd]; ok {
					workspace = current
				} else if p, ok := placeByPath[active.cwd]; ok {
					workspace, worktree = p.WorkspaceID, p.ID
				}
				if !found && seen[workspace] {
					agent := sessionFact(nativeSession{id: active.id, state: "missing"}, workspace, cfg.UID)
					if worktree != "" {
						agent["worktree_id"] = worktree
						usedPlaces[worktree] = placeByPath[active.cwd]
					}
					agent["history"] = "missing"
					agent["archive"] = archiveFact(visibility, visibilityErr, id)
					agents = append(agents, agent)
				}
			}
		}
		if controller != nil {
			for _, raw := range agents {
				agent := raw.(map[string]any)
				id := strings.TrimPrefix(agent["agent_id"].(string), "pi:")
				if active := controller.sessions[id]; active != nil {
					// Naming is a controller operation, independent of the agent's turn.
					if active.naming {
						agent["title"].(map[string]any)["generation_state"] = "pending"
					}
					agent["run_active"] = active.runActive
					agent["pending_question"] = active.question
					if !active.runActive && active.questionID == "" {
						if waiting, ok := waitingViews[id]; ok {
							agent["waiting_on"] = waiting
						}
					}
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
		// A place with conversations gets its Git summary, for the top bar's
		// chip and the rail's merged mark, within its own bounded budget.
		if len(usedPlaces) > 0 {
			started := time.Now()
			placeCtx, stopPlaces := context.WithTimeout(r.Context(), 1500*time.Millisecond)
			var placeWork sync.WaitGroup
			var placeMu sync.Mutex
			placeSlots := make(chan struct{}, 4)
			for _, p := range usedPlaces {
				view := placeViews[p.ID]
				if view == nil {
					continue
				}
				placeWork.Add(1)
				go func() {
					defer placeWork.Done()
					placeSlots <- struct{}{}
					defer func() { <-placeSlots }()
					summary, moved, ok := placeGitSummary(placeCtx, nativeHome, p)
					placeMu.Lock()
					defer placeMu.Unlock()
					if ok {
						view["git_summary"] = summary
					}
					if moved != nil {
						view["branch_moved"] = *moved
					}
				}()
			}
			placeWork.Wait()
			stopPlaces()
			diagnostic.Phase(r.Context(), "worktree_git", started)
		}
		// Archive completeness concerns native history, not its membership in
		// today's workspace catalog. In particular, trashing a workspace leaves
		// Pi's readable histories in place; restoring it maps them back again.
		orphanArchive := false
		if visibilityErr == nil {
			nativeState := make(map[string]string, len(sessions))
			for _, session := range sessions {
				nativeState["pi:"+session.id] = session.state
			}
			for id := range visibility.Conversations {
				if archiveFact(visibility, nil, id) == "archived" && nativeState[id] != "readable" {
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
		ghState := <-ghDone
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
