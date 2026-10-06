//go:build linux

package daemon

import (
	"encoding/json"
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
}

func (c *ConversationController) archive(w http.ResponseWriter, r *http.Request, id string) {
	var in archiveRequest
	if decodeControl(r, &in, 1024) != nil {
		snapshotError(w, 400, "invalid_request")
		return
	}
	c.archiveInput(w, id, in)
}
func (c *ConversationController) archiveInput(w http.ResponseWriter, id string, in archiveRequest) {
	if !sessionIDPattern.MatchString(id) || !idPattern.MatchString(in.WorkspaceID) || len(in.ObservationToken) < 8 || len(in.ObservationToken) > 200 || (in.PreviousArchive != "active" && in.PreviousArchive != "archived") {
		snapshotError(w, 400, "invalid_request")
		return
	}
	if !cloneWriter.TryLock() {
		snapshotError(w, 409, "workspace_busy")
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
	if in.ObservationToken != opaque("obs_", id+":"+native.revision) {
		snapshotError(w, 409, "control_uncertain")
		return
	}
	// A readable header alone does not establish readable native history.
	// Check the entire settled file, then reject a changed header observation.
	if _, err := reconciledNativeHistory(native.path, c.cfg.UID, id, cwd); err != nil || readNativeHeader(native.path, c.cfg.UID).revision != native.revision {
		snapshotError(w, 409, "control_uncertain")
		return
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
	if in.Archived && (session == nil || session.workspace != in.WorkspaceID || session.cwd != cwd) {
		snapshotError(w, 409, "read_only_history")
		return
	}
	if in.Archived {
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
	if c.journal != nil {
		c.journal.appendInvalidation(key)
	}
	value := "active"
	if in.Archived {
		value = "archived"
	}
	historyJSON(w, map[string]any{"schema_version": 1, "agent_id": key, "archive": value})
}
