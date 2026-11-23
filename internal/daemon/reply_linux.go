//go:build linux

package daemon

import (
	"encoding/json"
	"io"
	"os"
	"strings"

	"github.com/open-habitat/open-habitat/internal/replyblock"
)

// ReplyFeature is the experimental switch for replying to one agent message
// (reply-to-message). The browser sends only the message's native entry key;
// this daemon reads the excerpt from the native session and writes it as a
// `<reply-to>` block at the start of the person's text (internal/replyblock),
// so the browser can never put words in the agent's mouth.
const ReplyFeature = "reply-to-message"

func replyEnabled(home string) bool {
	p, err := readPreferences(home)
	return err == nil && p.Experimental[ReplyFeature]
}

// replyRef is the projection of a person's message that answers one agent
// message: the entry and the excerpt the agent received.
type replyRef struct {
	EntryKey string `json:"entry_key"`
	Excerpt  string `json:"excerpt"`
}

// replyExcerpt reads the excerpt of the agent message key on the
// conversation's current branch (the compacted part included). It refuses a
// key that is not there, not an assistant message or has no text.
func (c *ConversationController) replyExcerpt(id, key string) (string, bool) {
	if !replyblock.ValidKey(key) {
		return "", false
	}
	s, ok := c.rewindSource(id)
	if !ok {
		return "", false
	}
	path, ok := s.branch(s.leaf)
	if !ok {
		return "", false
	}
	for _, line := range path {
		if line.id != key {
			continue
		}
		if line.kind != "assistant" || !line.text {
			return "", false
		}
		text, ok := readAssistantText(s.path, s.uid, line.offset)
		if !ok {
			return "", false
		}
		excerpt := replyblock.Excerpt(text)
		return excerpt, excerpt != ""
	}
	return "", false
}

// readAssistantText reads one native record at offset and returns its text
// blocks (never thinking or tool calls), with the same owner check as the
// session read that found it.
func readAssistantText(path string, uid int, offset int64) (string, bool) {
	info, err := os.Lstat(path)
	if err != nil || !info.Mode().IsRegular() {
		return "", false
	}
	if uid >= 0 {
		if owner, ok := fileOwner(info); !ok || owner != uid {
			return "", false
		}
	}
	f, err := os.Open(path)
	if err != nil {
		return "", false
	}
	defer f.Close()
	if opened, err := f.Stat(); err != nil || !os.SameFile(info, opened) {
		return "", false
	}
	if _, err := f.Seek(offset, io.SeekStart); err != nil {
		return "", false
	}
	var record []byte
	if _, err := eachNativeLine(io.LimitReader(f, info.Size()-offset), func(line []byte) bool {
		record = append([]byte(nil), line...)
		return false
	}); err != nil || record == nil {
		return "", false
	}
	var e struct {
		Message struct {
			Role    string          `json:"role"`
			Content json.RawMessage `json:"content"`
		} `json:"message"`
	}
	if json.Unmarshal(record, &e) != nil || e.Message.Role != "assistant" {
		return "", false
	}
	var plain string
	if json.Unmarshal(e.Message.Content, &plain) == nil {
		return plain, true
	}
	var blocks []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}
	if json.Unmarshal(e.Message.Content, &blocks) != nil {
		return "", false
	}
	parts := []string{}
	for _, b := range blocks {
		if b.Type == "text" && strings.TrimSpace(b.Text) != "" {
			parts = append(parts, b.Text)
		}
	}
	return strings.Join(parts, "\n\n"), true
}

// projectUserReply reads the block from a person's native message: a plain
// string content or a first text block.
func projectUserReply(message json.RawMessage) (*replyRef, bool) {
	var m struct {
		Role    string          `json:"role"`
		Content json.RawMessage `json:"content"`
	}
	if json.Unmarshal(message, &m) != nil || m.Role != "user" {
		return nil, false
	}
	var text string
	if json.Unmarshal(m.Content, &text) != nil {
		var blocks []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		}
		if json.Unmarshal(m.Content, &blocks) != nil || len(blocks) == 0 || blocks[0].Type != "text" {
			return nil, false
		}
		text = blocks[0].Text
	}
	key, excerpt, _, ok := replyblock.Parse(text)
	if !ok {
		return nil, false
	}
	return &replyRef{EntryKey: key, Excerpt: excerpt}, true
}

// userText is a person's message text as the view shows it: without a
// leading reply block or skill wrapper.
func userText(text string) string {
	return skillInstruction(replyblock.Strip(text))
}
