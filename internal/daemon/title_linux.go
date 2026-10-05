//go:build linux

package daemon

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"
)

//go:embed title-helper.mjs
var titleHelper string

func (c *ConversationController) generateTitle(text string) (string, error) {
	if c.runtime == nil || !utf8.ValidString(text) {
		return "", errors.New("title unavailable")
	}
	text = prefixBytes(text, 4096)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, c.runtime.Node, "--input-type=module", "-e", titleHelper, c.runtime.Entry)
	cmd.Env = []string{"HOME=" + c.home, "PATH=/usr/bin:/bin", "USER=" + c.cfg.Username}
	cmd.Dir = filepath.Dir(c.runtime.Entry)
	cmd.Stdin = strings.NewReader(text)
	var output bytes.Buffer
	cmd.Stdout = &output
	// Provider diagnostics may contain credentials or user text; never echo them.
	if cmd.Run() != nil || output.Len() > 512 {
		return "", errors.New("title unavailable")
	}
	var response struct {
		Title string `json:"title"`
		Model string `json:"model"`
	}
	if json.Unmarshal(output.Bytes(), &response) != nil || response.Model == "" || !validTitle(response.Title) {
		return "", errors.New("title unavailable")
	}
	return response.Title, nil
}

func validTitle(title string) bool {
	if title == "" || len(title) > 160 || strings.TrimSpace(title) != title || !utf8.ValidString(title) {
		return false
	}
	for _, ch := range title {
		if ch < 32 || ch == 127 {
			return false
		}
	}
	return true
}

// The only source of truth is Pi's history. This is a precondition read, not a title store.
func (c *ConversationController) sessionName(s *conversation) (string, bool) {
	sessions, err := nativeSessions(c.nativeCfg())
	if err != nil {
		return "", false
	}
	for _, item := range sessions {
		if item.id == s.id && item.cwd == s.cwd && item.state == "readable" {
			return nativeName(item, c.cfg.UID), true
		}
	}
	return "", false
}

// Caller holds c.mu. The third accepted turn must have actually settled.
func (c *ConversationController) startRefinement(s *conversation) {
	if c.closed || s.dead || s.naming || s.automaticRefined || s.acceptedMessages != 3 || !s.settled || s.thirdText == "" || c.sessions[s.id] != s {
		return
	}
	s.automaticRefined = true
	s.naming = true
	go c.nameConversation(s, s.firstText+"\n"+s.thirdText, s.turnGeneration, false)
}

// One worker per session. The mutex fences admission and name writes against
// another browser request; native history is rechecked immediately before write.
func (c *ConversationController) nameConversation(s *conversation, text string, turn uint64, explicit bool) {
	defer func() { c.mu.Lock(); s.naming = false; c.startRefinement(s); c.mu.Unlock() }()
	before, ok := c.sessionName(s)
	// Pi can acknowledge a prompt before flushing its first JSONL header.
	if !ok && !explicit {
		for attempt := 0; attempt < 8 && !ok; attempt++ {
			time.Sleep(125 * time.Millisecond)
			before, ok = c.sessionName(s)
		}
	}
	if !ok || (!explicit && before != "" && before != s.automaticName) {
		return
	}
	generate := c.generateTitle
	if c.fixture && c.titleGenerator != nil {
		generate = c.titleGenerator
	}
	name, err := generate(text)
	if err != nil {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed || c.sessions[s.id] != s || s.dead || s.rpc.overflow.Load() || (!explicit && s.turnGeneration != turn) {
		return
	}
	current, ok := c.sessionName(s)
	if !ok || current != before {
		return
	}
	accepted, err := s.rpc.request("set_session_name", name, 4*time.Second)
	if err != nil || !accepted {
		return
	}
	if explicit {
		// Even an identical regenerated string is now a user-chosen name.
		s.automaticName = ""
	} else {
		s.automaticName = name
	}
	if c.journal != nil {
		c.journal.appendInvalidation("pi:" + s.id)
	}
}
