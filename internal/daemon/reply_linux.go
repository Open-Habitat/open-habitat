//go:build linux

package daemon

import (
	"encoding/json"
	"io"
	"os"
	"strings"

	"github.com/open-habitat/open-habitat/internal/agentblock"
	"github.com/open-habitat/open-habitat/internal/replyblock"
)

// ReplyFeature is the experimental switch for replying to one agent message
// or one view or file offer card (reply-to-message). The browser sends only
// the entry's native key (and for an offer, optionally one file's path in
// it); this daemon reads the excerpt or the offer's facts from the native
// session and the person's own offer store and writes them as a `<reply-to>`
// block at the start of the person's text (internal/replyblock), so a block
// this daemon builds never carries text from the browser.
// (A person can still type such a block into their own message, as they can
// Pi's <skill> wrapper; it is projected the same way and misleads only them.)
const ReplyFeature = "reply-to-message"

func replyEnabled(home string) bool {
	p, err := readPreferences(home)
	return err == nil && p.Experimental[ReplyFeature]
}

// replyRef is the projection of a person's message that answers one agent
// message or one offer card: the entry and the block's body the agent
// received. Offer is set when the body names an offer the daemon wrote, so
// the view can draw the card's title instead of the English body.
type replyRef struct {
	EntryKey string      `json:"entry_key"`
	Excerpt  string      `json:"excerpt"`
	Offer    *replyOffer `json:"offer,omitempty"`
}

type replyOffer struct {
	Kind  string `json:"kind"`
	Title string `json:"title"`
	Path  string `json:"path,omitempty"`
}

// replyBody reads what the block says about entry key on the conversation's
// current branch (the compacted part included): an agent message's excerpt,
// or the facts of a view or file offer whose notice is there (path: one
// file of a several-file offer). It refuses a key that is not on this
// branch, an entry of another kind, a message without text, an offer that
// was removed and a path the offer does not hold.
func (c *ConversationController) replyBody(id, key, path string) (string, bool) {
	if !replyblock.ValidKey(key) || path != "" && !validViewPath(path) {
		return "", false
	}
	s, ok := c.rewindSource(id)
	if !ok {
		return "", false
	}
	branch, ok := s.branch(s.leaf)
	if !ok {
		return "", false
	}
	for _, line := range branch {
		if line.id != key {
			continue
		}
		switch {
		case line.kind == "assistant" && line.text && path == "":
			record, ok := readNativeRecord(s.path, s.uid, line.offset)
			if !ok {
				return "", false
			}
			text, ok := assistantText(record)
			if !ok {
				return "", false
			}
			excerpt := replyblock.Excerpt(text)
			return excerpt, excerpt != ""
		case line.kind == "custom" && line.customType == noticeType:
			record, ok := readNativeRecord(s.path, s.uid, line.offset)
			if !ok {
				return "", false
			}
			var e nativeEntry
			if json.Unmarshal(record, &e) != nil || e.ID != key {
				return "", false
			}
			e.Raw = record
			notice, ok := nativeNotice(e)
			if !ok {
				return "", false
			}
			return c.offerReplyBody(notice, path, s.cwd)
		}
		return "", false
	}
	return "", false
}

// readNativeRecord reads one native record at offset, with the same owner
// check as the session read that found it.
func readNativeRecord(path string, uid int, offset int64) ([]byte, bool) {
	info, err := os.Lstat(path)
	if err != nil || !info.Mode().IsRegular() || offset < 0 || offset >= info.Size() {
		return nil, false
	}
	if uid >= 0 {
		if owner, ok := fileOwner(info); !ok || owner != uid {
			return nil, false
		}
	}
	f, err := os.Open(path)
	if err != nil {
		return nil, false
	}
	defer f.Close()
	if opened, err := f.Stat(); err != nil || !os.SameFile(info, opened) {
		return nil, false
	}
	if _, err := f.Seek(offset, io.SeekStart); err != nil {
		return nil, false
	}
	var record []byte
	if _, err := eachNativeLine(io.LimitReader(f, info.Size()-offset), func(line []byte) bool {
		record = append([]byte(nil), line...)
		return false
	}); err != nil || record == nil {
		return nil, false
	}
	return record, true
}

// assistantText returns an assistant record's text blocks (never thinking
// or tool calls).
func assistantText(record []byte) (string, bool) {
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
	ref := &replyRef{EntryKey: key, Excerpt: excerpt}
	if o, ok := replyblock.ParseOffer(excerpt); ok {
		ref.Offer = &replyOffer{Kind: o.Kind, Title: o.Title, Path: o.Path}
	}
	return ref, true
}

// userText is a person's message text as the view shows it: without a
// leading reply block or, failing that, a skill wrapper. The two are
// exclusive, as in the history projection, so block reads and the preview
// read the same text.
func userText(text string) string {
	if _, _, rest, ok := replyblock.Parse(text); ok {
		return rest
	}
	if _, rest, ok := agentblock.Parse(text); ok {
		return rest
	}
	return skillInstruction(text)
}
