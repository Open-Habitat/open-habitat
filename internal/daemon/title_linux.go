//go:build linux

package daemon

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Open-Habitat/open-habitat/internal/diagnostic"
)

//go:embed title-helper.mjs
var titleHelper string

// Title failures carry only fixed codes. Neither provider errors nor excerpts
// may cross into daemon logs or browser responses.
type titleFailure string

const (
	titleModelUnavailable      titleFailure = "model_unavailable"
	titleModelTimeout          titleFailure = "model_timeout"
	titleModelInvalid          titleFailure = "model_invalid_response"
	titleNativeUnavailable     titleFailure = "native_name_unavailable"
	titleNativeChanged         titleFailure = "native_name_changed"
	titleControllerUnavailable titleFailure = "controller_unavailable"
	titleNameWriteFailed       titleFailure = "name_write_failed"
)

func (f titleFailure) Error() string { return string(f) }

func titleReason(err error) titleFailure {
	var reason titleFailure
	if errors.As(err, &reason) && (reason == titleModelTimeout || reason == titleModelInvalid) {
		return reason
	}
	return titleModelUnavailable // Never reflect fixture or provider error text.
}

func (c *ConversationController) generateTitle(text string) (string, error) {
	if c.runtime == nil || !utf8.ValidString(text) {
		return "", titleModelUnavailable
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
	cmd.Stderr = &storageDiagnostics{operation: "conversation_title"}
	// Provider diagnostics may contain credentials or user text; never echo them.
	if err := cmd.Run(); err != nil {
		if ctx.Err() != nil {
			return "", titleModelTimeout
		}
		return "", titleModelUnavailable
	}
	if output.Len() > 512 {
		return "", titleModelInvalid
	}
	var response struct {
		Title string `json:"title"`
		Model string `json:"model"`
	}
	if json.Unmarshal(output.Bytes(), &response) != nil || response.Model == "" || !validTitle(response.Title) {
		return "", titleModelInvalid
	}
	return boundGeneratedTitle(response.Title)
}

// Keep generated names comfortably below the header's approximate 40-character
// width. Native, user-chosen names still use validTitle's separate safety limit.
// Never cut a word (including an overlong first word); refuse if none fits.
func boundGeneratedTitle(title string) (string, error) {
	words := strings.Fields(title)
	end, characters := 0, 0
	for i, word := range words {
		length := utf8.RuneCountInString(word)
		if i > 0 {
			length++
		}
		if i == 5 || characters+length > 32 {
			break
		}
		characters += length
		end++
	}
	if end == 0 {
		return "", titleModelInvalid
	}
	return strings.Join(words[:end], " "), nil
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

// Keep the original topic for context, but let the latest user message set
// the language. A first-turn title has only one message to go on.
func titleExcerpt(first, latest string) string {
	if latest == "" || latest == first {
		return first
	}
	// Leave room under generateTitle's 4096-byte cap for the latest message.
	return "First user message:\n" + prefixBytes(first, 1024) + "\nLatest user message:\n" + prefixBytes(latest, 2048)
}

// A continued handle has no accepted-prompt memory. Use only the active native
// branch, and never treat an unreadable history as evidence of newer language.
func latestNativeUserPrompt(path string, uid int, id, cwd string) string {
	s := readNativeSettled(path, uid)
	if s.state != "readable" || s.id != id || s.cwd != cwd {
		return ""
	}
	for i := len(s.entries) - 1; i >= 0; i-- {
		if s.entries[i].Kind == "user" {
			return prefixBytes(s.entries[i].full, 2048)
		}
	}
	return ""
}

// The only source of truth is Pi's history. This is a precondition read, not a title store.
func (c *ConversationController) sessionName(s *conversation) (string, bool) {
	sessions, err := nativeSessions(c.nativeCfg())
	if err != nil {
		return "", false
	}
	for _, item := range sessions {
		if item.id == s.id && item.cwd == s.cwd && item.state == "readable" {
			return nativeNameExact(item, c.cfg.UID)
		}
	}
	return "", false
}

// Caller holds c.mu. Pi does not persist a fresh session until an assistant
// message exists, so the first attempt starts only after native settlement.
func (c *ConversationController) startAutomaticTitle(s *conversation) {
	if c.closed || s.dead || c.sessions[s.id] != s {
		return
	}
	// Latch the third settlement even while the first model call is running.
	// A fourth prompt must not consume the one scheduled refinement.
	if s.acceptedMessages == 3 && s.settled && s.thirdText != "" && !s.automaticRefined {
		s.refinementDue = true
	}
	if s.naming {
		return
	}
	if s.acceptedMessages == 1 && s.settled && !s.automaticFirst && s.firstText != "" {
		s.automaticFirst = true
		s.naming = true
		go c.nameConversation(s, s.firstText, false)
	} else if s.refinementDue && s.automaticName != "" && !s.automaticRefined {
		s.refinementDue = false
		s.automaticRefined = true
		s.naming = true
		go c.nameConversation(s, titleExcerpt(s.firstText, s.thirdText), false)
	}
}

// One worker per session. Native history is the precondition on either side
// of the model call. The controller lock never spans filesystem or RPC I/O.
func (c *ConversationController) nameConversation(s *conversation, text string, explicit bool) (failure titleFailure) {
	defer func() {
		if failure != "" {
			operation := "automatic"
			if explicit {
				operation = "manual"
			}
			diagnostic.New(os.Stderr, "daemon").Warn("conversation_title", "outcome", "failed", "operation", operation, "reason", string(failure))
		}
		c.mu.Lock()
		s.naming = false
		c.startAutomaticTitle(s)
		c.mu.Unlock()
	}()
	before, ok := c.sessionName(s)
	if !ok {
		return titleNativeUnavailable
	}
	if !explicit && before != "" && before != s.automaticName {
		return titleNativeChanged
	}
	generate := c.generateTitle
	if c.fixture && c.titleGenerator != nil {
		generate = c.titleGenerator
	}
	name, err := generate(text)
	if err != nil {
		return titleReason(err)
	}
	c.mu.Lock()
	live := !c.closed && c.sessions[s.id] == s && !s.dead && !s.rpc.overflow.Load()
	c.mu.Unlock()
	if !live {
		return titleControllerUnavailable
	}
	current, ok := c.sessionName(s)
	if !ok {
		return titleNativeUnavailable
	}
	if current != before {
		return titleNativeChanged
	}
	accepted, err := s.rpc.request("set_session_name", name, 4*time.Second)
	if err != nil || !accepted {
		return titleNameWriteFailed
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed || c.sessions[s.id] != s {
		return titleControllerUnavailable
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
	return ""
}
