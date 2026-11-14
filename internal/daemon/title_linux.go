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
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/open-habitat/open-habitat/internal/diagnostic"
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

// model is the conversation's own model, nil when unknown: the background
// policy (background-model.mjs) prefers its provider's small model and falls
// back to it.
func (c *ConversationController) generateTitle(text string, model *piStartupChoice) (string, error) {
	if c.runtime == nil || !utf8.ValidString(text) {
		return "", titleModelUnavailable
	}
	text = prefixBytes(text, 4096)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	bridge := filepath.Join(filepath.Dir(filepath.Dir(c.runtime.Node)), "node_modules/pi-claude-bridge/src/index.ts")
	if info, err := os.Stat(bridge); err != nil || !info.Mode().IsRegular() {
		bridge = ""
	}
	args := []string{"--input-type=module", "-e", titleHelper, c.runtime.Entry, backgroundModelURL}
	if model != nil {
		args = append(args, model.Provider, model.Model)
	} else {
		args = append(args, "", "")
	}
	args = append(args, bridge)
	cmd := exec.CommandContext(ctx, c.runtime.Node, args...)
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
		Title   string `json:"title"`
		Model   string `json:"model"`
		Failure string `json:"failure"`
	}
	if json.Unmarshal(output.Bytes(), &response) != nil {
		return "", titleModelInvalid
	}
	switch titleFailure(response.Failure) {
	case titleModelUnavailable, titleModelTimeout:
		return "", titleFailure(response.Failure)
	}
	if response.Model == "" || !validTitle(response.Title) {
		return "", titleModelInvalid
	}
	return boundGeneratedTitle(response.Title)
}

// The helper normalizes model formatting and caps generated names. Keep the
// native write boundary strict; user-chosen names have a separate safety limit.
func boundGeneratedTitle(title string) (string, error) {
	words := strings.Fields(title)
	name := strings.Join(words, " ")
	if !validTitle(title) || len(words) == 0 || utf8.RuneCountInString(name) > 32 {
		return "", titleModelInvalid
	}
	return name, nil
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

// Match messageText in web/src/components/AttachmentChips.tsx: only whole
// reference lines and paths paired with those references are attachment metadata.
var titleAttachmentReference = regexp.MustCompile(`^!?\[[^\]\n]*\]\(/api/v1/attachments/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)$`)
var titleAttachmentPath = regexp.MustCompile(`^Attachment path: /.*/attachments/([0-9a-f-]{36})$`)

func fallbackTitle(text string) string {
	lines := strings.Split(text, "\n")
	ids := make(map[string]bool)
	kept := lines[:0]
	for _, line := range lines {
		if match := titleAttachmentReference.FindStringSubmatch(line); match != nil {
			ids[match[1]] = true
		} else {
			kept = append(kept, line)
		}
	}
	lines = kept
	kept = lines[:0]
	for _, line := range lines {
		if match := titleAttachmentPath.FindStringSubmatch(line); match == nil || !ids[match[1]] {
			kept = append(kept, line)
		}
	}
	runes := []rune(strings.TrimSpace(strings.Join(kept, "\n")))
	if len(runes) > 80 {
		runes = runes[:80]
	}
	return prefixBytes(string(runes), 160)
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
	if e, ok := latestNativeEntry(path, uid, id, cwd, "user"); ok {
		return prefixBytes(e.full, 2048)
	}
	return ""
}

// latestNativeEntry is the active branch's newest entry of kind. It reads
// back from the tail one page at a time and stops at the first match, so a
// long history is read only as far back as the answer.
func latestNativeEntry(path string, uid int, id, cwd, kind string) (historyEntry, bool) {
	for limit := 16; ; limit *= 8 {
		s := readNativeTail(path, uid, limit)
		if s.state != "readable" || s.id != id || s.cwd != cwd {
			return historyEntry{}, false
		}
		for i := len(s.entries) - 1; i >= 0; i-- {
			if s.entries[i].Kind == kind {
				return s.entries[i], true
			}
		}
		if s.olderComplete {
			return historyEntry{}, false
		}
	}
}

// The conversation's model as its active native branch last recorded it, for a
// history without a running Pi. Nil when the branch records none.
func latestNativeModel(path string, uid int, id, cwd string) *piStartupChoice {
	e, ok := latestNativeEntry(path, uid, id, cwd, "model_change")
	if !ok {
		return nil
	}
	if provider, model, ok := strings.Cut(e.full, "/"); ok && provider != "" && model != "" {
		return &piStartupChoice{Provider: provider, Model: model}
	}
	return nil
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
		c.beginNaming(s)
		go c.nameConversation(s, s.firstText, false)
	} else if s.titleRetryAfter > 0 && s.acceptedMessages > s.titleRetryAfter && s.settled && !s.automaticRetried {
		s.automaticRetried = true
		if s.acceptedMessages >= 3 {
			// This retry already includes the context a refinement would use.
			s.refinementDue, s.automaticRefined = false, true
		}
		c.beginNaming(s)
		go c.nameConversation(s, titleExcerpt(s.firstText, s.latestText), false)
	} else if s.refinementDue && s.automaticName != "" && !s.automaticRefined {
		s.refinementDue = false
		s.automaticRefined = true
		c.beginNaming(s)
		go c.nameConversation(s, titleExcerpt(s.firstText, s.thirdText), false)
	}
}

// Caller holds c.mu. Reuse the controller reservation, not a title store.
func (c *ConversationController) beginNaming(s *conversation) {
	s.naming = true
	if c.journal != nil {
		c.journal.appendInvalidation("pi:" + s.id)
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
		if c.journal != nil {
			c.journal.appendInvalidation("pi:" + s.id)
		}
		c.startAutomaticTitle(s)
		c.mu.Unlock()
	}()
	before, ok := c.sessionName(s)
	if !ok {
		return titleNativeUnavailable
	}
	c.mu.Lock()
	ours := s.automaticName
	attemptTurn := s.acceptedMessages
	c.mu.Unlock()
	if !explicit && before != "" && before != ours {
		// A name this handle did not generate, such as one the person gave
		// or a goal's, always wins over an automatic title.
		return ""
	}
	c.mu.Lock()
	model := s.startupChoice
	c.mu.Unlock()
	generate := func(text string) (string, error) { return c.generateTitle(text, model) }
	if c.fixture && c.titleGenerator != nil {
		generate = c.titleGenerator
	}
	name, err := generate(text)
	if err != nil {
		// A later settled turn gets one new chance, not an immediate retry
		// loop. Existing and explicitly chosen names are left alone.
		if !explicit && before == "" {
			c.mu.Lock()
			s.titleRetryAfter = attemptTurn
			c.mu.Unlock()
		}
		return titleReason(err)
	}
	c.mu.Lock()
	live := !c.closed && c.sessions[s.id] == s && !s.dead && !s.rpc.overflow.Load()
	c.mu.Unlock()
	if !live {
		return titleControllerUnavailable
	}
	// A name given meanwhile is written under the same lock, so the check
	// below sees it before this write could replace it.
	c.nameMu.Lock()
	defer c.nameMu.Unlock()
	c.mu.Lock()
	given := !explicit && s.automaticName != ours
	c.mu.Unlock()
	if given {
		return "" // a name given meanwhile wins, even one equal to ours
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
	s.givenName = ""
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
