//go:build linux

package daemon

import "encoding/json"

// A bounded, explicitly selected projection of native message structure. Raw
// provider metadata and extension details never enter the browser contract.
// The existing content endpoint remains the way to read long text. Image data
// and arbitrary tool arguments are not copied into history pages.
func nativeBlocks(e nativeEntry) (out historyEntry) {
	out.Key = e.ID
	out.Kind, out.full = nativeText(e)
	if e.Type == "custom_message" {
		var visibility struct { Display bool `json:"display"` }
		if json.Unmarshal(e.Raw, &visibility) != nil || !visibility.Display {
			out.Kind, out.full = "", ""
		}
		return
	}
	if e.Type != "message" {
		return
	}
	var m struct {
		Role       string          `json:"role"`
		Content    json.RawMessage `json:"content"`
		ToolCallID string          `json:"toolCallId"`
		IsError    bool            `json:"isError"`
		StopReason string          `json:"stopReason"`
		Model      string          `json:"model"`
	}
	if json.Unmarshal(e.Message, &m) != nil {
		return
	}
	if m.Role == "custom" {
		var visibility struct {
			Display bool `json:"display"`
		}
		if json.Unmarshal(e.Message, &visibility) != nil || !visibility.Display {
			out.Kind, out.full = "", ""
			return
		}
	}
	if m.Role == "toolResult" && len(m.ToolCallID) <= 200 {
		out.ToolCallID = m.ToolCallID
		out.IsError = &m.IsError
	}
	if m.Role == "assistant" {
		if len(m.StopReason) <= 40 {
			out.StopReason = m.StopReason
		}
		if len(m.Model) <= 200 {
			out.Model = m.Model
		}
	}
	var plain string
	if json.Unmarshal(m.Content, &plain) == nil {
		out.Blocks = []historyBlock{{Type: "text", Text: prefixBytes(plain, 16384)}}
		out.TruncatedBlocks = len(plain) > 16384
		return
	}
	var blocks []json.RawMessage
	if json.Unmarshal(m.Content, &blocks) != nil {
		return
	}
	budget := 16384
	for _, raw := range blocks {
		if len(out.Blocks) == 128 || budget == 0 {
			out.TruncatedBlocks = true
			break
		}
		var b struct {
			Type     string `json:"type"`
			Text     string `json:"text"`
			Thinking string `json:"thinking"`
			Redacted bool   `json:"redacted"`
			MimeType string `json:"mimeType"`
			ID       string `json:"id"`
			Name     string `json:"name"`
		}
		if json.Unmarshal(raw, &b) != nil {
			out.Blocks = append(out.Blocks, historyBlock{Type: "unknown"})
			continue
		}
		block := historyBlock{Type: "unknown"}
		switch b.Type {
		case "text", "thinking":
			block.Type = b.Type
			text := b.Text
			if b.Type == "thinking" {
				text = b.Thinking
				block.Redacted = b.Redacted
				if b.Redacted {
					text = ""
				}
			}
			block.Text = prefixBytes(text, budget)
			budget -= len(block.Text)
			if len(block.Text) < len(text) {
				out.TruncatedBlocks = true
			}
		case "image":
			block.Type = "image"
			if len(b.MimeType) <= 100 {
				block.MimeType = b.MimeType
			}
		case "toolCall":
			block.Type = "toolCall"
			if len(b.ID) <= 200 {
				block.ToolCallID = b.ID
			}
			if len(b.Name) <= 200 {
				block.ToolName = b.Name
			}
		}
		out.Blocks = append(out.Blocks, block)
	}
	return
}

func prefixBytes(text string, max int) string {
	if len(text) <= max {
		return text
	}
	for max > 0 && (text[max]&0xc0) == 0x80 {
		max--
	}
	return text[:max]
}
