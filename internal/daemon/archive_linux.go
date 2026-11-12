//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// archive changes only the mapped user's presentation annotation, never Pi history.
// The shared workspace writer serializes all updates of user-state.json.
type archiveRequest struct {
	WorkspaceID      string `json:"workspace_id"`
	Archived         bool   `json:"archived"`
	ObservationToken string `json:"observation_token"`
	PreviousArchive  string `json:"previous_archive"`
	ClientCommandID  string `json:"client_command_id,omitempty"`
}

// Archive changes presentation, not history content. A completed turn or stop
// may append native entries after the browser's observation. Bind the token to
// the native identity and location instead; PreviousArchive fences competing
// annotation changes, and archiveInput re-proves settled history and ownership.
func archiveObservation(s nativeSession) string {
	return opaque("obs_", fmt.Sprintf("%q:%q:%q", s.id, s.cwd, s.path))
}

func (c *ConversationController) archive(w http.ResponseWriter, r *http.Request, id string) {
	var in archiveRequest
	if decodeControl(r, &in, 1024) != nil {
		snapshotError(w, 400, "invalid_request")
		return
	}
	c.archiveInput(r.Context(), w, id, in)
}
func (c *ConversationController) archiveInput(ctx context.Context, w http.ResponseWriter, id string, in archiveRequest) {
	if !sessionIDPattern.MatchString(id) || (in.ClientCommandID != "" && !sessionIDPattern.MatchString(in.ClientCommandID)) || !idPattern.MatchString(in.WorkspaceID) || len(in.ObservationToken) < 8 || len(in.ObservationToken) > 200 || (in.PreviousArchive != "active" && in.PreviousArchive != "archived") {
		snapshotError(w, 400, "invalid_request")
		return
	}
	// Archives clicked in quick succession queue here instead of refusing.
	if code := cloneWriter.waitBriefly(ctx, "workspace_archive_running"); code != "" {
		snapshotError(w, 409, code)
		return
	}
	defer cloneWriter.Unlock()
	// Discovery and the native header, not a browser-supplied workspace or ID,
	// establish that this session belongs to the selected workspace.
	ws, cwd, err := c.workspaceFD(in.WorkspaceID)
	if err != nil {
		snapshotError(w, 409, "control_uncertain")
		return
	}
	defer ws.Close()
	histories, err := nativeSessions(c.nativeCfg())
	if err != nil {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	var native *nativeSession
	for i := range histories {
		if histories[i].id == id {
			if native != nil || histories[i].cwd != cwd || histories[i].state != "readable" {
				snapshotError(w, 409, "control_uncertain")
				return
			}
			native = &histories[i]
		}
	}
	if native == nil {
		snapshotError(w, 409, "control_uncertain")
		return
	}
	if in.ObservationToken != archiveObservation(*native) {
		snapshotError(w, 409, "control_uncertain")
		return
	}
	// A readable header alone does not establish a native history. Prove both
	// ends of a settled file, then reject a changed header observation.
	// Archive is an annotation, so it never reads a long history whole.
	a, _, aOK := nativeTailProof(native.path, c.cfg.UID, id, cwd)
	b, _, bOK := nativeTailProof(native.path, c.cfg.UID, id, cwd)
	if !aOK || !bOK || a != b || readNativeHeader(native.path, c.cfg.UID).revision != native.revision {
		snapshotError(w, 409, "control_uncertain")
		return
	}
	if in.Archived {
		// Archive must be ordered against browser admission and native writers.
		// Restore only changes presentation. A terminal Pi must not block it
		// merely by being present; native proof still has to remain settled.
		releasePermit, ok := c.proofPermit(ctx)
		if !ok {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
		defer releasePermit()
		c.mu.Lock()
		live := false
		if old := c.sessions[id]; old != nil && old.rpc != nil {
			select {
			case <-old.rpc.exited:
				if old.owner != nil {
					_ = old.owner.release()
				}
			default:
				live = true
			}
		}
		c.mu.Unlock()
		// A live daemon-owned child is already fenced and can be archived when
		// idle. For every other history, hold its ownership fence through the
		// census and annotation commit.
		if !live {
			owner, err := acquirePiOwnership(c.home, id)
			if err != nil {
				snapshotError(w, 409, "writer_conflict")
				return
			}
			defer owner.release()
		}
		switch c.piWriter(native.path, cwd) {
		case "writer_present":
			snapshotError(w, 409, "writer_conflict")
			return
		case "not_observed":
		default:
			snapshotError(w, 409, "control_uncertain")
			return
		}
	}
	// Keep admission and the durable annotation commit ordered against sendKind.
	// This is a short bounded state-file fsync under mu; releasing mu before
	// fsync would permit a new Pi turn to start while the archive lands.
	c.mu.Lock()
	defer c.mu.Unlock()
	session := c.sessions[id]
	if c.closed {
		snapshotError(w, 409, "control_uncertain")
		return
	}
	if in.Archived && session != nil && (session.workspace != in.WorkspaceID || session.cwd != cwd) {
		snapshotError(w, 409, "control_uncertain")
		return
	}
	if in.Archived && session != nil && (len(session.held) > 0 || session.state == "starting" || session.waking) {
		// Messages wait for a Pi that is starting, or Habitat's own wake is
		// about to give the agent a turn; archiving would hide them.
		snapshotError(w, 409, "writer_conflict")
		return
	}
	if in.Archived && session != nil {
		// A settled turn does not prove that a process exited. Only idle or
		// positively reaped daemon-owned processes may leave the active list.
		select {
		case <-session.rpc.exited:
		default:
			if session.state != "idle" && session.state != "rejected" {
				snapshotError(w, 409, "writer_conflict")
				return
			}
		}
	}
	state, err := loadVisibility(c.home)
	if err != nil {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	actual := archiveFact(state, nil, "pi:"+id)
	if actual == "unknown" {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	if actual != in.PreviousArchive {
		snapshotError(w, 409, "control_uncertain")
		return
	}
	key := "pi:" + id
	if !in.Archived && archiveFact(state, nil, key) != "archived" {
		snapshotError(w, 409, "control_uncertain")
		return
	}
	var annotation map[string]json.RawMessage
	if raw, ok := state.Conversations[key]; ok {
		if json.Unmarshal(raw, &annotation) != nil || annotation == nil {
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
	} else {
		annotation = make(map[string]json.RawMessage)
	}
	if in.Archived {
		stamp, _ := json.Marshal(time.Now().UTC().Format(time.RFC3339Nano))
		annotation["archived_at"] = stamp
	} else {
		delete(annotation, "archived_at")
	}
	if len(annotation) == 0 {
		delete(state.Conversations, key)
	} else {
		raw, _ := json.Marshal(annotation)
		state.Conversations[key] = raw
	}
	if saveVisibility(c.home, state) != nil {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	if in.Archived {
		// An archived conversation is put away: it neither waits raised nor
		// comes back raised when restored.
		c.clearTurnMark(id)
	}
	cursor := ""
	if c.journal != nil {
		cursor = c.journal.appendInvalidation(key)
	}
	value := "active"
	if in.Archived {
		value = "archived"
	}
	reply := map[string]any{"schema_version": 1, "agent_id": key, "archive": value}
	if cursor != "" {
		reply["event_cursor"] = cursor
	}
	if in.ClientCommandID != "" {
		reply["client_command_id"] = in.ClientCommandID
	}
	if in.Archived && session != nil && liveChild(session) {
		// An archived conversation keeps no idle Pi: it would hold a place
		// under the limit for a conversation the person has put away. A busy
		// one keeps running; native history is untouched either way, and a
		// send after restoring resumes it.
		go c.stopIfIdle(context.Background(), id)
	}
	historyJSON(w, reply)
}
