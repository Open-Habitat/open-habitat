//go:build linux

package daemon

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"syscall"
)

// emptyNativeFile checks every branch, not just the active leaf projected by
// readNative. A malformed or changing history is never evidence of emptiness.
func emptyNativeFile(path string, uid int, id, cwd string) (os.FileInfo, error) {
	s := readNativeSettled(path, uid)
	if s.state != "readable" || s.id != id || s.cwd != cwd {
		return nil, errors.New("history unavailable")
	}
	f, err := os.OpenFile(path, os.O_RDONLY|syscall.O_NOFOLLOW, 0)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil || !info.Mode().IsRegular() {
		return nil, errors.New("history changed")
	}
	if owner, ok := fileOwner(info); !ok || owner != uid {
		return nil, errors.New("history owner changed")
	}
	data, err := io.ReadAll(io.LimitReader(f, maxLegacyHistoryFile+1))
	if err != nil || len(data) > maxLegacyHistoryFile || len(data) == 0 || data[len(data)-1] != '\n' {
		return nil, errors.New("history incomplete")
	}
	scanner := bufio.NewScanner(bytes.NewReader(data))
	scanner.Buffer(make([]byte, 4096), maxLegacyHistoryFile+1)
	if !scanner.Scan() {
		return nil, errors.New("history header missing")
	}
	var header nativeHeader
	if json.Unmarshal(scanner.Bytes(), &header) != nil || header.Type != "session" || header.Version != 3 || header.ID != id || header.Cwd != cwd {
		return nil, errors.New("history header changed")
	}
	for scanner.Scan() {
		var entry nativeEntry
		if json.Unmarshal(scanner.Bytes(), &entry) != nil || !entryIDPattern.MatchString(entry.ID) {
			return nil, errors.New("history invalid")
		}
		// Only native session settings are inert before the first user turn.
		// Custom messages and assistant/tool messages are visible content, even
		// when an extension wrote them before the browser sent a prompt.
		switch entry.Type {
		case "model_change", "thinking_level_change", "session_info", "label":
		default:
			return nil, errors.New("history contains conversation content")
		}
	}
	if scanner.Err() != nil {
		return nil, scanner.Err()
	}
	current, err := os.Lstat(path)
	if err != nil || !os.SameFile(info, current) || readNativeSettled(path, uid).revision != s.revision {
		return nil, errors.New("history changed")
	}
	return info, nil
}

// Close is restricted to a fresh browser child owned by this daemon. The
// stopping state fences browser sends while native source is checked and
// the child is reaped. A terminal Pi does not honor this state; census remains
// a conservative observation, not a promise about future terminal starts.
func (c *ConversationController) closeEmpty(w http.ResponseWriter, r *http.Request, id string) {
	if r.ContentLength != 0 || len(r.TransferEncoding) != 0 {
		snapshotError(w, 400, "invalid_request")
		return
	}
	release, ok := c.proofPermit(r.Context())
	if !ok {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	defer release()
	c.mu.Lock()
	s := c.sessions[id]
	if c.closed || s == nil || s.rpc == nil || s.owner == nil || s.dead || s.state != "idle" || len(s.commands) != 0 || s.acceptedMessages != 0 || s.aborting || s.naming || s.recapping || s.questionID != "" || s.owner.id != id {
		c.mu.Unlock()
		snapshotError(w, 409, "control_uncertain")
		return
	}
	origin, err := s.owner.browserOrigin()
	if err != nil || origin.Cwd != s.cwd || origin.Workspace != s.workspace {
		c.mu.Unlock()
		snapshotError(w, 409, "read_only_history")
		return
	}
	s.state = "stopping"
	c.mu.Unlock()
	defer func() {
		c.mu.Lock()
		if c.sessions[id] == s && s.state == "stopping" {
			s.state = "idle"
		}
		c.mu.Unlock()
	}()
	annotations, err := loadVisibility(c.home)
	if err != nil {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	if archiveFact(annotations, nil, "pi:"+id) != "active" {
		snapshotError(w, 409, "control_uncertain")
		return
	}
	sessions, err := nativeSessions(c.nativeCfg())
	if err != nil {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	var path string
	for _, native := range sessions {
		if native.id != id {
			continue
		}
		if path != "" || native.state != "readable" || native.cwd != s.cwd {
			snapshotError(w, 409, "control_uncertain")
			return
		}
		path = native.path
	}
	if path != "" {
		if _, err := emptyNativeFile(path, c.cfg.UID, id, s.cwd); err != nil {
			snapshotError(w, 409, "control_uncertain")
			return
		}
		if c.piWriter(path, s.cwd) != "not_observed" {
			snapshotError(w, 409, "writer_conflict")
			return
		}
	}
	// Close the pipes and signal only the direct child, never a process group.
	// piRPC.close returns an intentionally uncertain error even on a reaped child.
	_ = s.rpc.close()
	select {
	case <-s.rpc.exited:
	default:
		snapshotError(w, 503, "termination_unknown")
		return
	}
	select {
	case <-s.rpc.done:
	default:
		snapshotError(w, 503, "termination_unknown")
		return
	}
	// A detached native child may have inherited the owner lock even though
	// the direct Pi child was reaped. Only a newly acquired lock proves that
	// no inherited browser-writer descriptor remains. The proof permit
	// keeps competing browser admissions out while the lock changes hands.
	_ = s.owner.release()
	newOwner, err := acquirePiOwnership(c.home, id)
	if err != nil {
		snapshotError(w, 409, "writer_conflict")
		return
	}
	defer newOwner.release()
	// Rediscover after exit: Pi may have written its first file during shutdown.
	after, err := nativeSessions(c.nativeCfg())
	if err != nil {
		snapshotError(w, 503, "native_source_unavailable")
		return
	}
	var finalPath string
	for _, native := range after {
		if native.id != id {
			continue
		}
		if finalPath != "" || native.state != "readable" || native.cwd != s.cwd || (path != "" && native.path != path) {
			snapshotError(w, 409, "control_uncertain")
			return
		}
		finalPath = native.path
	}
	if path != "" && finalPath == "" {
		snapshotError(w, 409, "control_uncertain")
		return
	}
	path = finalPath
	if path != "" {
		info, err := emptyNativeFile(path, c.cfg.UID, id, s.cwd)
		if err != nil || c.piWriter(path, s.cwd) != "not_observed" {
			snapshotError(w, 409, "control_uncertain")
			return
		}
		c.mu.Lock()
		if c.closed || c.sessions[id] != s {
			c.mu.Unlock()
			snapshotError(w, 409, "control_uncertain")
			return
		}
		current, err := os.Lstat(path)
		if err != nil || !os.SameFile(info, current) {
			c.mu.Unlock()
			snapshotError(w, 409, "control_uncertain")
			return
		}
		if err := os.Remove(path); err != nil {
			c.mu.Unlock()
			snapshotError(w, 503, "native_source_unavailable")
			return
		}
	} else {
		c.mu.Lock()
		if c.closed || c.sessions[id] != s {
			c.mu.Unlock()
			snapshotError(w, 409, "control_uncertain")
			return
		}
	}
	// A closed conversation has no native history and must not be rediscovered.
	delete(c.sessions, id)
	if s.recapTimer != nil {
		s.recapTimer.Stop()
	}
	cursor := ""
	if c.journal != nil {
		c.journal.reset("pi:"+id, "unknown")
		cursor = c.journal.appendInvalidation("pi:" + id)
	}
	c.mu.Unlock()
	// Respond outside the controller lock, even if the browser has disconnected.
	// The cursor lets the browser keep the conversation removed over a snapshot
	// read that began before the close.
	reply := map[string]any{"schema_version": 1, "state": "closed"}
	if cursor != "" {
		reply["event_cursor"] = cursor
	}
	historyJSON(w, reply)
}
