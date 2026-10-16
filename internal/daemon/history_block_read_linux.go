//go:build linux

package daemon

import (
	"encoding/json"
	"unicode/utf8"
)

// Only explicitly displayable native fields are selectable. Never serialize a
// native block or extension metadata directly into a browser response.
func nativeBlockChunk(raw json.RawMessage, index, offset, limit int) (map[string]any, bool) {
	var probe struct {
		Type    string          `json:"type"`
		Message json.RawMessage `json:"message"`
	}
	_ = json.Unmarshal(raw, &probe)
	candidate := raw
	if probe.Type == "message" {
		candidate = probe.Message
	}
	if _, recognised := projectProcessNotification(candidate, nil); recognised {
		return nil, false
	}
	var entry struct {
		Type    string `json:"type"`
		Message struct {
			Role    string          `json:"role"`
			Command string          `json:"command"`
			Output  string          `json:"output"`
			Content json.RawMessage `json:"content"`
			Display bool            `json:"display"`
		} `json:"message"`
		Display bool            `json:"display"`
		Content json.RawMessage `json:"content"`
		Summary string          `json:"summary"`
	}
	if json.Unmarshal(raw, &entry) != nil {
		return nil, false
	}
	if entry.Type == "custom_message" && !entry.Display {
		return nil, false
	}
	if entry.Type == "message" && entry.Message.Role == "custom" && !entry.Message.Display {
		return nil, false
	}
	var content json.RawMessage
	switch entry.Type {
	case "message":
		if entry.Message.Role == "bashExecution" {
			if index == 0 {
				return textChunk(entry.Message.Command, offset, limit)
			}
			if index == 1 {
				return textChunk(entry.Message.Output, offset, limit)
			}
			return nil, false
		}
		content = entry.Message.Content
	case "custom_message":
		content = entry.Content
	case "compaction", "branch_summary":
		content, _ = json.Marshal(entry.Summary)
	default:
		return nil, false
	}
	var plain string
	if json.Unmarshal(content, &plain) == nil {
		if index != 0 {
			return nil, false
		}
		return textChunk(plain, offset, limit)
	}
	var blocks []json.RawMessage
	if json.Unmarshal(content, &blocks) != nil || index >= len(blocks) || index >= 128 {
		return nil, false
	}
	var block struct {
		Type      string          `json:"type"`
		Text      string          `json:"text"`
		Thinking  string          `json:"thinking"`
		Redacted  bool            `json:"redacted"`
		MimeType  string          `json:"mimeType"`
		Data      string          `json:"data"`
		Arguments json.RawMessage `json:"arguments"`
	}
	if json.Unmarshal(blocks[index], &block) != nil {
		return nil, false
	}
	switch block.Type {
	case "text":
		return textChunk(block.Text, offset, limit)
	case "thinking":
		if block.Redacted {
			return nil, false
		}
		return textChunk(block.Thinking, offset, limit)
	case "toolCall":
		// Pi tool arguments are an explicit user-visible part of a tool call. They
		// may contain credentials, so they are never bundled with history/events.
		// Read only when requested, as inert text; do not return other tool metadata.
		if len(block.Arguments) == 0 || !json.Valid(block.Arguments) {
			return nil, false
		}
		return textChunk(string(block.Arguments), offset, limit)
	case "image":
		// Data is Pi's base64 payload, never a URL or browser-executable markup.
		if block.MimeType != "image/png" && block.MimeType != "image/jpeg" && block.MimeType != "image/gif" && block.MimeType != "image/webp" {
			return nil, false
		}
		if len(block.Data)%4 != 0 {
			return nil, false
		}
		for _, c := range block.Data {
			if !((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '+' || c == '/' || c == '=') {
				return nil, false
			}
		}
		if offset%4 != 0 {
			return nil, false
		}
		if offset > len(block.Data) {
			return nil, false
		}
		end := offset + limit/4*4
		if end <= offset {
			return nil, false
		}
		if end > len(block.Data) {
			end = len(block.Data)
		}
		chunk := map[string]any{"media_type": block.MimeType, "data": block.Data[offset:end], "complete": end == len(block.Data)}
		if end < len(block.Data) {
			chunk["next_offset"] = end
		}
		return chunk, true
	}
	return nil, false
}

func textChunk(text string, offset, limit int) (map[string]any, bool) {
	if limit > 65536 {
		return nil, false
	}
	b := []byte(text)
	if offset > len(b) || !utf8.Valid(b[:offset]) {
		return nil, false
	}
	end := offset + limit
	if end > len(b) {
		end = len(b)
	}
	for end > offset && !utf8.Valid(b[offset:end]) {
		end--
	}
	if end == offset && offset < len(b) {
		return nil, false
	}
	chunk := map[string]any{"media_type": "text/plain", "text": string(b[offset:end]), "complete": end == len(b)}
	if end < len(b) {
		chunk["next_offset"] = end
	}
	return chunk, true
}
