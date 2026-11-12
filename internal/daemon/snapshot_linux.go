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

	"github.com/open-habitat/open-habitat/internal/diagnostic"
	"github.com/open-habitat/open-habitat/internal/nativegh"
	"github.com/open-habitat/open-habitat/internal/transport"
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

func unknownGitHub(context.Context) nativegh.Observation {
	return nativegh.Observation{State: "unknown"}
}

// SnapshotHandler uses the same guarded socket and trusted configuration as the
// native handoff. discover is injectable only at construction, never per request.
func SnapshotHandler(cfg transport.Config, trusted func(*http.Request) bool, discover func(transport.Config) Discovery) http.Handler {
	status := unknownGitHub
	if adapter, err := nativegh.New(cfg.Home, cfg.Subject, nil, nativegh.LinuxSecretService()); err == nil {
		status = adapter.ObservedConnection
	}
	return SnapshotHandlerWithStatus(cfg, trusted, discover, status)
}

// SnapshotHandlerWithStatus shares the daemon's native adapter with the handoff
// so a snapshot cannot observe credentials midway through a mutation.
func SnapshotHandlerWithStatus(cfg transport.Config, trusted func(*http.Request) bool, discover func(transport.Config) Discovery, status func(context.Context) nativegh.Observation) http.Handler {
	return snapshotHandlerWithStatus(cfg, trusted, discover, nativeSessions, cfg.Home, status)
}

// SnapshotHandlerWithNativeRoot is a disposable fixture seam for cross-package
// transport tests; the production constructor always reads the mapped home.
func SnapshotHandlerWithNativeRoot(cfg transport.Config, trusted func(*http.Request) bool, discover func(transport.Config) Discovery, root string) http.Handler {
	return snapshotHandlerWithStatus(cfg, trusted, discover, func(c transport.Config) ([]nativeSession, error) { c.Home = root; return nativeSessions(c) }, root, unknownGitHub)
}

// SnapshotHandlerWithNativeRootAndForges is that seam with the fixture's
// code-host adapters, so workspace origins are matched as production does.
func SnapshotHandlerWithNativeRootAndForges(cfg transport.Config, trusted func(*http.Request) bool, discover func(transport.Config) Discovery, root string, forges Forges) http.Handler {
	return snapshotHandlerWithForges(cfg, trusted, discover, func(c transport.Config) ([]nativeSession, error) { c.Home = root; return nativeSessions(c) }, root, unknownGitHub, nil, nil, forges)
}
func snapshotHandlerWithStatus(cfg transport.Config, trusted func(*http.Request) bool, discover func(transport.Config) Discovery, sessionsReader func(transport.Config) ([]nativeSession, error), nativeHome string, nativeStatus func(context.Context) nativegh.Observation) http.Handler {
	return snapshotHandlerWithJournal(cfg, trusted, discover, sessionsReader, nativeHome, nativeStatus, nil)
}
func snapshotHandlerWithJournal(cfg transport.Config, trusted func(*http.Request) bool, discover func(transport.Config) Discovery, sessionsReader func(transport.Config) ([]nativeSession, error), nativeHome string, nativeStatus func(context.Context) nativegh.Observation, journal *eventJournal) http.Handler {
	return snapshotHandlerWithController(cfg, trusted, discover, sessionsReader, nativeHome, nativeStatus, journal, nil)
}
func snapshotHandlerWithController(cfg transport.Config, trusted func(*http.Request) bool, discover func(transport.Config) Discovery, sessionsReader func(transport.Config) ([]nativeSession, error), nativeHome string, nativeStatus func(context.Context) nativegh.Observation, journal *eventJournal, controller *ConversationController) http.Handler {
	return snapshotHandlerWithForges(cfg, trusted, discover, sessionsReader, nativeHome, nativeStatus, journal, controller, Forges{})
}

// snapshotHandlerWithForges also matches each workspace's origin to the
// person's connected Gitea and GitLab bases.
func snapshotHandlerWithForges(cfg transport.Config, trusted func(*http.Request) bool, discover func(transport.Config) Discovery, sessionsReader func(transport.Config) ([]nativeSession, error), nativeHome string, nativeStatus func(context.Context) nativegh.Observation, journal *eventJournal, controller *ConversationController, forges Forges) http.Handler {
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
		ghDone := make(chan nativegh.Observation, 1)
		go func() {
			started := time.Now()
			obs := nativeStatus(r.Context())
			diagnostic.Phase(r.Context(), "github", started)
			ghDone <- obs
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
			if entry.Icon.Kind != "" {
				ws["icon"] = iconView(entry.Icon)
			}
			if entry.Icon.Auto {
				ws["icon_auto"] = true
			}
			if entry.Icon.LogoPath != "" {
				ws["icon_logo"] = map[string]any{"path": entry.Icon.LogoPath, "version": entry.Icon.LogoVersion}
			}
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
		bases, glBases := giteaBases(forges.Gitea), gitlabBases(forges.GitLab)
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
						f.remote, f.continuation, f.origin = workspaceRemote(remoteCtx, nativeHome, entry)
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
					if match := giteaOriginMatch(f.origin, bases); match != nil {
						ws["gitea_origin"] = match
					} else if match := gitlabOriginMatch(f.origin, glBases); match != nil {
						ws["gitlab_origin"] = match
					}
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
			// A live worker's own session says whether it is at work.
			homeDir, _ := os.Open(nativeHome)
			if homeDir != nil {
				defer homeDir.Close()
			}
			now := time.Now()
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
						working, idle := workingSpinoffs(homeDir, cfg.UID, taskRuns, session, now)
						if working > 0 {
							agent["spinoffs_working"] = working
						}
						if idle > 0 {
							agent["spinoffs_idle"] = idle
						}
						if workerFailedUnseen(nativeHome, cfg.UID, taskRuns, session) {
							agent["failure"] = "worker_failed"
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
		// Unreadable marks are left out: the rows then stand as their
		// replies place them, and the person can mark again.
		marks, _ := readTurnMarks(nativeHome)
		for _, raw := range agents {
			agent := raw.(map[string]any)
			agent["archive"] = archiveFact(visibility, visibilityErr, agent["agent_id"].(string))
			if agent["archive"] == "archived" {
				if at := archivedAt(visibility, agent["agent_id"].(string)); at != "" {
					agent["archived_at"] = at
				}
			}
			if mark, ok := marks.Marks[agent["agent_id"].(string)]; ok {
				agent["turn_mark"] = mark
			}
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
					// Pi holds a name given before its first message in memory
					// and writes it with that message.
					agent := sessionFactTitled(nativeSession{id: active.id, state: "missing"}, workspace, "", active.givenName)
					if worktree != "" {
						agent["worktree_id"] = worktree
						usedPlaces[worktree] = placeByPath[active.cwd]
					}
					agent["history"] = "missing"
					agent["archive"] = archiveFact(visibility, visibilityErr, id)
					if agent["archive"] == "archived" {
						if at := archivedAt(visibility, id); at != "" {
							agent["archived_at"] = at
						}
					}
					if mark, ok := marks.Marks[id]; ok {
						agent["turn_mark"] = mark
					}
					agents = append(agents, agent)
				}
			}
		}
		if controller != nil {
			for _, raw := range agents {
				agent := raw.(map[string]any)
				id := strings.TrimPrefix(agent["agent_id"].(string), "pi:")
				// Only a conversation this daemon may start again rests; a
				// terminal-held or foreign history has no card.
				if caps, ok := agent["capabilities"].(map[string]any); ok && agent["process"] != "terminal_observed_live" {
					if resume, ok := caps["agent_resume"].(map[string]string); ok && resume["state"] == "supported" {
						if rest, awake, resting := controller.restOf(controller.sessions[id]); resting {
							view := restView(rest)
							view["awake"] = awake
							agent["rest"] = view
						}
					}
				}
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
		// A turn that ended in an error is read from the branch of a Pi that
		// runs now, where the person can still act on it, and a turn Pi never
		// finished from the branch of a resting one: its Pi stopped mid-turn,
		// for example when the daemon restarted for an upgrade. The branch
		// scan reads the whole file (again only after a change), so a closed
		// or archived conversation's is not read at all.
		readable := map[string]nativeSession{}
		for _, session := range sessions {
			if session.state == "readable" {
				readable["pi:"+session.id] = session
			}
		}
		// The branches read here also tell whether an AI provider refuses the
		// person's sign-in now.
		scans := []branchScan{}
		for _, raw := range agents {
			agent := raw.(map[string]any)
			session, ok := readable[agent["agent_id"].(string)]
			live := agent["process"] == "terminal_observed_live" || agent["process"] == "daemon_managed_live"
			rest, _ := agent["rest"].(map[string]any)
			asleep := rest != nil && rest["awake"] != true && agent["archive"] == "active"
			if !ok || !live && !asleep {
				continue
			}
			var scan branchScan
			if facts != nil {
				scan, ok = facts.sessions.branch(session.path, cfg.UID)
			} else {
				scan, ok = scanBranchFile(session.path, cfg.UID)
			}
			if ok {
				scans = append(scans, scan)
			}
			if ok && live && scan.turnError {
				agent["failure"] = "turn_error"
			}
			if ok && asleep && scan.turnCut {
				agent["interrupted_turn"] = true
			}
			if waiting, has := agent["waiting_on"].([]waitingProcess); ok && has {
				markWaitsBeforeTurn(waiting, scan.turnAt)
			}
			// The turn's answer, by which the browser knows a turn ended that
			// the person may not have seen, however it missed the turn's event.
			if ok && scan.reply != "" && scan.replyAt > 0 && agent["archive"] == "active" {
				agent["last_reply"] = map[string]any{"id": scan.reply, "at": time.UnixMilli(scan.replyAt).UTC().Format(time.RFC3339Nano)}
			}
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
		gh := <-ghDone
		ghState := gh.State
		switch ghState {
		case "connected", "disconnected", "expired", "partial", "pending", "unreachable", "verifying":
		default:
			ghState = "unknown"
		}
		// The person's own login, for "Kirjautunut käyttäjänä …"; only a
		// login gh works with is named.
		nativeGitHub := map[string]any{"state": ghState}
		if (ghState == "connected" || ghState == "partial") && gh.Login != "" {
			nativeGitHub["login"] = gh.Login
		}
		// Why the state is unknown, so the page can say it.
		if ghState == "unknown" {
			switch gh.Reason {
			case nativegh.ReasonChecking, nativegh.ReasonTimeout, nativegh.ReasonGitHubError, nativegh.ReasonUnrecognized:
				nativeGitHub["reason"] = gh.Reason
			}
		}
		// The host's own retry of an outage: the page says it is trying,
		// and warns once the retry is over.
		if ghState == "unreachable" && gh.Attempt > 0 && !gh.Since.IsZero() && !gh.NextAt.IsZero() {
			nativeGitHub["retry"] = map[string]any{"attempt": min(gh.Attempt, 100000), "attempts": nativegh.RetryAttempts, "since": gh.Since.UTC().Format(time.RFC3339), "next_at": gh.NextAt.UTC().Format(time.RFC3339)}
		}
		if orgs := controller.githubOrgs().list(); len(orgs) > 0 {
			restricted := make([]map[string]string, 0, len(orgs))
			for _, o := range orgs {
				restricted = append(restricted, map[string]string{"owner": o.Owner, "restriction": o.Kind})
			}
			nativeGitHub["restricted_orgs"] = restricted
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
		}()), fact("daemon_owner", "unknown")}, "workspaces": workspaces, "agents": agents, "operations": []any{}, "command_ledger": map[string]any{"epoch": instance, "max_entries": 10000, "max_age_seconds": 86400, "entries": []any{}}, "auth": map[string]any{"provider": cfg.Provider, "provider_account_id": cfg.Subject, "native_github": nativeGitHub, "ai_refused": aiRefusals(nativeHome, scans)}}
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
