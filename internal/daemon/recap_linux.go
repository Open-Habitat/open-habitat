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
	// Optional during rollout: the product works with either guest runtime.
	bridge := filepath.Join(filepath.Dir(filepath.Dir(c.runtime.Node)), "node_modules/pi-claude-bridge/src/index.ts")
	if info, err := os.Stat(bridge); err == nil && info.Mode().IsRegular() {
		args = append(args, "--extension", bridge)
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

// The daemon, not browser focus, observes native work. Called with c.mu held.
func recapIdle(s *conversation) bool {
	return s.state == "idle" || (s.state == "rejected" && s.settled)
}

func (c *ConversationController) pauseRecap(s *conversation) {
	s.recapActivity++
	if s.recapTimer != nil {
		s.recapTimer.Stop()
		s.recapTimer = nil
	}
}

func (c *ConversationController) noteRecapActivity(s *conversation) {
	c.pauseRecap(s)
	s.recapLastActivity = time.Now()
	if s.recapping {
		s.recapReschedule = true
	} else if s.settled && recapIdle(s) {
		c.scheduleAutomaticRecap(s)
	}
}

// Called after a verified native settlement, with c.mu held. One timer per
// controlled session survives tab disconnects; its epoch fences later work.
func (c *ConversationController) scheduleAutomaticRecap(s *conversation) {
	if c.closed || s.dead || s.recapping || !recapIdle(s) {
		return
	}
	s.recapReschedule = false
	delay := c.recapIdleDelay
	if delay == 0 {
		delay = 3*time.Minute + time.Millisecond
	}
	// A rejected browser command did not produce a native message. Continue
	// counting from the last real activity rather than restarting the interval.
	if !s.recapLastActivity.IsZero() {
		delay = max(0, delay-time.Since(s.recapLastActivity))
	}
	epoch := s.recapActivity
	if s.recapTimer != nil {
		s.recapTimer.Stop()
	}
	s.recapTimer = time.AfterFunc(delay, func() {
		c.mu.Lock()
		if s.recapping && s.recapActivity == epoch {
			s.recapReschedule = true
		}
		if c.closed || c.sessions[s.id] != s || s.dead || !recapIdle(s) || !s.settled || s.recapping || s.rpc.overflow.Load() || s.recapActivity != epoch {
			c.mu.Unlock()
			return
		}
		s.recapping = true
		c.mu.Unlock()
		_ = c.runRecap(s, "automatic", epoch)
		c.mu.Lock()
		s.recapping = false
		if s.recapReschedule && recapIdle(s) && s.settled {
			s.recapReschedule = false
			c.scheduleAutomaticRecap(s)
		}
		c.mu.Unlock()
	})
}

func (c *ConversationController) runRecap(s *conversation, trigger string, epoch uint64) bool {
	if c.recapGenerator != nil {
		return c.recapGenerator(s, trigger, epoch)
	}
	return c.generateRecap(s, trigger, epoch)
}

// The native branch and latest message are authoritative. The RPC child and
// extension both decline duplicates; this gate prevents parallel model calls.
func (c *ConversationController) generateRecap(s *conversation, trigger string, epoch uint64) bool {
	before, latest, ok := c.nativeRecap(s)
	if !ok || latest == "" {
		return false
	}
	if before.Through == latest {
		return true
	}
	c.mu.Lock()
	valid := !c.closed && c.sessions[s.id] == s && !s.dead && recapIdle(s) && s.recapActivity == epoch && (trigger != "automatic" || s.recapAttemptedThrough != latest)
	if valid && trigger == "automatic" {
		s.recapAttemptedThrough = latest
	}
	c.mu.Unlock()
	if !valid {
		return false
	}
	commands, err := s.rpc.requestQueue("get_commands", "", 4*time.Second)
	if err != nil || !commands.Accepted || !commands.RecapCommand {
		return false
	}
	c.mu.Lock()
	valid = !c.closed && c.sessions[s.id] == s && !s.dead && recapIdle(s) && s.recapActivity == epoch
	c.mu.Unlock()
	if !valid {
		return false
	}
	command := "/oh-conversation-recap"
	if trigger == "automatic" {
		command += " automatic"
	}
	accepted, err := s.rpc.request("prompt", command, 25*time.Second)
	if err != nil || !accepted {
		return false
	}
	after, _, ok := c.nativeRecap(s)
	return ok && after.Through == latest && after.GeneratedAt > 0
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
	if c.closed || s.dead || s.recapping || !recapIdle(s) || s.rpc.overflow.Load() {
		c.mu.Unlock()
		snapshotError(w, 409, "control_uncertain")
		return
	}
	s.recapping = true
	epoch := s.recapActivity
	c.mu.Unlock()
	// A disconnected tab cannot cancel this native model call. Other tabs see
	// the in-flight guard and can read the persisted entry after it completes.
	done := make(chan bool, 1)
	go func() {
		success := c.runRecap(s, "manual", epoch)
		c.mu.Lock()
		s.recapping = false
		if s.recapReschedule && recapIdle(s) && s.settled {
			s.recapReschedule = false
			c.scheduleAutomaticRecap(s)
		}
		c.mu.Unlock()
		done <- success
	}()
	if <-done {
		historyJSON(w, map[string]any{"schema_version": 1, "state": "done"})
	} else {
		historyJSON(w, map[string]any{"schema_version": 1, "state": "failed"})
	}
}
