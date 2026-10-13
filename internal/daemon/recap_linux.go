//go:build linux

package daemon

import (
	_ "embed"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

//go:embed recap-extension.mjs
var recapExtension []byte

// piArgs installs the shipped bridge for the daemon-owned Pi child, not for
// terminal sessions. The extension writes through Pi's own SessionManager.
func (c *ConversationController) piArgs() ([]string, error) {
	args := []string{filepath.Join(filepath.Dir(c.runtime.Entry), "bundle", "cli.js")}
	if c.fixture {
		return args, nil
	}
	// The tmpfiles service can remove a stale /var/tmp directory during a
	// long-lived daemon. Recreate the bridge before launching the next child.
	if c.recapPath != "" {
		if info, err := os.Lstat(c.recapPath); err == nil && info.Mode().IsRegular() {
			return append(args, "--extension", c.recapPath), nil
		}
	}
	dir, err := os.MkdirTemp("/var/tmp", "oh-recap-")
	if err != nil {
		return nil, err
	}
	path := filepath.Join(dir, "recap-extension.mjs")
	if err := os.WriteFile(path, recapExtension, 0600); err != nil {
		_ = os.RemoveAll(dir)
		return nil, err
	}
	c.recapPath = path
	return append(args, "--extension", path), nil
}

// nativeRecap reads the current branch of the user's own native history.
// It does not infer ownership from browser input or store a browser copy.
func (c *ConversationController) nativeRecap(s *conversation) (recapData, string, bool) {
	sessions, err := nativeSessions(c.nativeCfg())
	if err != nil {
		return recapData{}, "", false
	}
	var selected *nativeSession
	for i := range sessions {
		if sessions[i].id != s.id {
			continue
		}
		if selected != nil || sessions[i].cwd != s.cwd || sessions[i].state != "readable" {
			return recapData{}, "", false
		}
		selected = &sessions[i]
	}
	if selected == nil {
		return recapData{}, "", false
	}
	return latestNativeRecap(selected.path, c.cfg.UID, s.id, s.cwd)
}

// Scan the active Pi branch backwards once. History windows are deliberately
// small, but a recap remains discoverable after hundreds of later messages.
func latestNativeRecap(path string, uid int, id, cwd string) (recapData, string, bool) {
	header := readNativeHeader(path, uid)
	if header.id != id || header.cwd != cwd || header.state != "readable" {
		return recapData{}, "", false
	}
	before, err := os.Lstat(path)
	if err != nil || !before.Mode().IsRegular() || before.Size() > maxHistoryFile {
		return recapData{}, "", false
	}
	if uid >= 0 {
		owner, owned := fileOwner(before)
		if !owned || owner != uid {
			return recapData{}, "", false
		}
	}
	file, err := os.Open(path)
	if err != nil {
		return recapData{}, "", false
	}
	defer file.Close()
	opened, err := file.Stat()
	if err != nil || !os.SameFile(before, opened) {
		return recapData{}, "", false
	}
	var recap recapData
	var latest string
	var target string
	var leaf, broken bool
	err = reverseLines(file, before.Size(), func(line []byte) bool {
		var entry nativeEntry
		if json.Unmarshal(line, &entry) != nil {
			broken = true
			return false
		}
		if entry.Type == "session" {
			return false
		}
		if !entryIDPattern.MatchString(entry.ID) {
			broken = true
			return false
		}
		if !leaf {
			leaf = true
			target = entry.ID
		}
		if entry.ID != target {
			return true
		}
		root := entry.ParentID == nil
		if !root {
			target = *entry.ParentID
		}
		entry.Raw = line
		projected := nativeBlocks(entry)
		if latest == "" && (projected.Kind == "user" || projected.Kind == "assistant") {
			latest = entry.ID
		}
		if recap.Through == "" && projected.Recap != nil {
			recap = *projected.Recap
		}
		return !root && (recap.Through == "" || latest == "")
	})
	after, statErr := os.Lstat(path)
	if err != nil || statErr != nil || broken || !os.SameFile(before, after) || before.Size() != after.Size() || !before.ModTime().Equal(after.ModTime()) {
		return recapData{}, "", false
	}
	return recap, latest, true
}

func (c *ConversationController) requestRecap(w http.ResponseWriter, r *http.Request, id string) {
	if r.ContentLength != 0 || len(r.TransferEncoding) != 0 {
		snapshotError(w, 400, "invalid_request")
		return
	}
	c.mu.Lock()
	s := c.sessions[id]
	if s == nil {
		c.mu.Unlock()
		snapshotError(w, 404, "resource_not_found")
		return
	}
	if c.closed || s.dead || s.recapping || s.state != "idle" || s.rpc.overflow.Load() {
		c.mu.Unlock()
		snapshotError(w, 409, "control_uncertain")
		return
	}
	s.recapping = true
	c.mu.Unlock()
	// A disconnected tab cannot cancel the native model call. A concurrent tab
	// gets a conflict; subsequent calls observe the persisted entry and are free.
	done := make(chan bool, 1)
	go func() {
		success := func() bool {
			before, latest, ok := c.nativeRecap(s)
			if !ok || latest == "" {
				return false
			}
			if before.Through == latest {
				return true
			}
			commands, err := s.rpc.requestQueue("get_commands", "", 4*time.Second)
			if err != nil || !commands.Accepted || !commands.RecapCommand {
				return false
			}
			accepted, err := s.rpc.request("prompt", "/oh-conversation-recap", 25*time.Second)
			if err != nil || !accepted {
				return false
			}
			after, _, ok := c.nativeRecap(s)
			return ok && after.Through == latest && after.GeneratedAt > 0
		}()
		// Completion is not observable until the in-flight guard is cleared.
		// Otherwise an immediate retry can spuriously conflict after HTTP 200.
		c.mu.Lock()
		s.recapping = false
		c.mu.Unlock()
		done <- success
	}()
	if <-done {
		historyJSON(w, map[string]any{"schema_version": 1, "state": "done"})
	} else {
		historyJSON(w, map[string]any{"schema_version": 1, "state": "failed"})
	}
}
