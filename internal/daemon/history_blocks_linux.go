//go:build linux

package daemon

import (
	"encoding/json"
	"strings"
)

// A bounded, explicitly selected projection of native message structure. Raw
// provider metadata and extension details never enter the browser contract.
// Image data and tool arguments are fetched only by explicit bounded block read.
func nativeBlocks(e nativeEntry) (out historyEntry) {
	if notification, ok := nativeProcessNotification(e); ok {
		return notification
	}
	out.Key = e.ID
	out.Timestamp = nativeTimestamp(e.Timestamp)
	if e.Type == "custom" {
		var custom struct {
			CustomType string `json:"customType"`
			Data       struct {
				Recap       string `json:"recap"`
				Next        string `json:"next"`
				Through     string `json:"through"`
				GeneratedAt int64  `json:"generatedAt"`
				Trigger     string `json:"trigger"`
			} `json:"data"`
		}
		if json.Unmarshal(e.Raw, &custom) == nil && custom.CustomType == "conversation-recap" &&
			custom.Data.Recap != "" && len(custom.Data.Recap) <= 1280 && len(custom.Data.Next) <= 640 &&
			custom.Data.GeneratedAt > 0 && custom.Data.GeneratedAt <= 8640000000000000 {
			if custom.Data.Through == "" && e.ParentID != nil {
				custom.Data.Through = *e.ParentID
			}
			if !entryIDPattern.MatchString(custom.Data.Through) {
				return
			}
			out.Kind = "recap"
			out.Content = historyContent{MediaType: "text/plain", Text: "", Complete: true}
			trigger := custom.Data.Trigger
			if trigger != "automatic" {
				trigger = "manual"
			}
			out.Recap = &recapData{Recap: custom.Data.Recap, Next: custom.Data.Next, Through: custom.Data.Through, GeneratedAt: custom.Data.GeneratedAt, Trigger: trigger}
			return
		}
		return
	}
	switch e.Type {
	case "model_change", "thinking_level_change", "session_info", "label", "compaction", "branch_summary":
		out.EntryType = e.Type
	}
	out.Kind, out.full = nativeText(e)
	if e.Type == "thinking_level_change" || e.Type == "session_info" || e.Type == "label" {
		var marker struct {
			ThinkingLevel string `json:"thinkingLevel"`
			Name          string `json:"name"`
			Label         string `json:"label"`
			TargetID      string `json:"targetId"`
		}
		if json.Unmarshal(e.Raw, &marker) != nil {
			return
		}
		var text string
		switch e.Type {
		case "thinking_level_change":
			text = marker.ThinkingLevel
		case "session_info":
			text = marker.Name
		case "label":
			text = marker.TargetID + " · " + marker.Label
		}
		out.Kind = "unknown"
		out.full = prefixBytes(text, 16384)
		out.Blocks = []historyBlock{{Type: "text", Text: out.full}}
		return
	}
	if e.Type == "custom_message" || e.Type == "compaction" || e.Type == "branch_summary" {
		var top struct {
			Display bool            `json:"display"`
			Content json.RawMessage `json:"content"`
			Summary string          `json:"summary"`
		}
		if json.Unmarshal(e.Raw, &top) != nil || e.Type == "custom_message" && !top.Display {
			out.Kind, out.full = "", ""
			return
		}
		content := top.Content
		if e.Type != "custom_message" {
			content, _ = json.Marshal(top.Summary)
		}
		projection, _ := json.Marshal(struct {
			Role    string          `json:"role"`
			Content json.RawMessage `json:"content"`
		}{"user", content})
		projected := nativeBlocks(nativeEntry{ID: e.ID, Type: "message", Message: projection})
		out.Blocks, out.TruncatedBlocks = projected.Blocks, projected.TruncatedBlocks
		out.Kind = "unknown" // labelled native entry, not an assistant utterance
		out.full = prefixBytes(top.Summary, 16384)
		if e.Type == "custom_message" {
			// display grants permission to show content, not a reason to draw
			// an empty card. details belong to the extension, never this view.
			visible := false
			for _, block := range out.Blocks {
				if block.Type != "text" || strings.TrimSpace(block.Text) != "" || block.Readable {
					visible = true
				}
			}
			if !visible {
				out.Kind, out.full = "", ""
				return
			}
			out.full = "Extension message"
		}
		if len(out.Blocks) == 0 {
			out.Blocks = []historyBlock{{Type: "unknown"}}
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
		ToolName   string          `json:"toolName"`
		IsError    bool            `json:"isError"`
		StopReason string          `json:"stopReason"`
		Model      string          `json:"model"`
	}
	if json.Unmarshal(e.Message, &m) != nil {
		return
	}
	if m.Role == "system" {
		// Pi 1.3.0 persists structured prompt sections as internal system
		// messages. Like Pi's interactive renderer, omit them entirely;
		// they are neither an utterance nor a custom extension message.
		out.Kind, out.full = "", ""
		return
	}
	if m.Role == "toolResult" && m.ToolName == "process" {
		text := processToolResult(e.Message)
		out.Kind = "tool"
		out.ToolCallID = m.ToolCallID
		out.IsError = &m.IsError
		out.full = text
		out.Content = historyContent{MediaType: "text/plain", Text: text, Complete: true}
		out.Blocks = []historyBlock{{Type: "text", Text: text}}
		return
	}
	if m.Role == "bashExecution" {
		var bash struct {
			Command            string `json:"command"`
			Output             string `json:"output"`
			ExitCode           *int   `json:"exitCode"`
			Cancelled          bool   `json:"cancelled"`
			Truncated          bool   `json:"truncated"`
			ExcludeFromContext bool   `json:"excludeFromContext"`
		}
		if json.Unmarshal(e.Message, &bash) != nil {
			out.Kind = "unknown"
			return
		}
		out.Kind = "bash"
		out.ExitCode = bash.ExitCode
		out.Cancelled = bash.Cancelled
		out.OutputTruncated = bash.Truncated
		out.ExcludeFromContext = bash.ExcludeFromContext
		out.Blocks = []historyBlock{
			{Type: "text", Text: prefixBytes(bash.Command, 8192), Readable: len(bash.Command) > 8192},
			{Type: "text", Text: prefixBytes(bash.Output, 8192), Readable: len(bash.Output) > 8192},
		}
		out.TruncatedBlocks = len(bash.Command) > 8192 || len(bash.Output) > 8192
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
		out.FailureCause = nativeBashFailure(m.ToolName, m.IsError, m.Content)
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
		out.Blocks = []historyBlock{{Type: "text", Text: prefixBytes(plain, 16384), Readable: len(plain) > 16384}}
		out.TruncatedBlocks = len(plain) > 16384
		return
	}
	var blocks []json.RawMessage
	if json.Unmarshal(m.Content, &blocks) != nil {
		return
	}
	budget := 16384
	for _, raw := range blocks {
		if len(out.Blocks) == 128 {
			out.TruncatedBlocks = true
			break
		}
		var b struct {
			Type      string          `json:"type"`
			Text      string          `json:"text"`
			Thinking  string          `json:"thinking"`
			Redacted  bool            `json:"redacted"`
			MimeType  string          `json:"mimeType"`
			ID        string          `json:"id"`
			Name      string          `json:"name"`
			Arguments json.RawMessage `json:"arguments"`
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
			block.Readable = !block.Redacted && len(block.Text) < len(text)
			budget -= len(block.Text)
			if len(block.Text) < len(text) {
				out.TruncatedBlocks = true
			}
		case "image":
			block.Type = "image"
			block.Readable = b.MimeType == "image/png" || b.MimeType == "image/jpeg" || b.MimeType == "image/gif" || b.MimeType == "image/webp"
			if len(b.MimeType) <= 100 {
				block.MimeType = b.MimeType
			}
		case "toolCall":
			block.Type = "toolCall"
			block.Readable = len(b.Arguments) > 0 && json.Valid(b.Arguments)
			if len(b.ID) <= 200 {
				block.ToolCallID = b.ID
			}
			if len(b.Name) <= 200 {
				block.ToolName = b.Name
			}
		}
		out.Blocks = append(out.Blocks, block)
	}
	if out.Kind == "tool" && len(out.Blocks) == 0 {
		out.Blocks = []historyBlock{{Type: "text", Text: prefixBytes(out.full, 16384), Readable: len(out.full) > 16384}}
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
