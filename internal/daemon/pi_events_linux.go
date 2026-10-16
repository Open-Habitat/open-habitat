//go:build linux

package daemon

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"
)

// Only validated, bounded native fields cross into the public journal.
func (c *ConversationController) publishDelta(agent string, raw json.RawMessage) {
	var e struct {
		Type                  string `json:"type"`
		AssistantMessageEvent struct {
			Type         string `json:"type"`
			Delta        string `json:"delta"`
			ContentIndex int    `json:"contentIndex"`

			ToolCall struct {
				ID        string          `json:"id"`
				Name      string          `json:"name"`
				Arguments json.RawMessage `json:"arguments"`
			} `json:"toolCall"`
		} `json:"assistantMessageEvent"`
		Message struct {
			Role       string `json:"role"`
			StopReason string `json:"stopReason"`
		} `json:"message"`
		WillRetry     bool            `json:"willRetry"`
		Reason        string          `json:"reason"`
		Attempt       int             `json:"attempt"`
		MaxAttempts   int             `json:"maxAttempts"`
		DelayMs       int             `json:"delayMs"`
		Success       bool            `json:"success"`
		Name          string          `json:"name"`
		Level         string          `json:"level"`
		ID            string          `json:"id"`
		Delta         string          `json:"delta"`
		Args          json.RawMessage `json:"args"`
		PartialResult json.RawMessage `json:"partialResult"`
		Result        json.RawMessage `json:"result"`
		ToolCallID    string          `json:"toolCallId"`
		ToolName      string          `json:"toolName"`
		IsError       bool            `json:"isError"`
	}
	if json.Unmarshal(raw, &e) != nil {
		return
	}
	switch e.Type {
	case "agent_start":
		c.journal.reset(agent, "running")
		c.journal.progress(agent, "pi.lifecycle", map[string]any{"signal": e.Type})
	case "turn_start":
		c.journal.activity(agent, "running")
		c.journal.progress(agent, "pi.lifecycle", map[string]any{"signal": e.Type})
	case "turn_end", "agent_end", "agent_settled":
		c.journal.progress(agent, "pi.lifecycle", map[string]any{"signal": e.Type, "will_retry": e.WillRetry})
	case "message_end":
		if e.Message.Role == "assistant" && (e.Message.StopReason == "error" || e.Message.StopReason == "aborted") {
			c.journal.progress(agent, "pi.lifecycle", map[string]any{"signal": "message_" + e.Message.StopReason})
		}
	case "bash_execution_update":
		// The local command output is a delta, not a fresh history entry.
		// Coalescing prevents a chatty command from exhausting the tail.
		c.journal.delta(agent, "bash.output", e.Delta, 0)
	case "session_info_changed", "thinking_level_changed", "entry_appended", "compaction_start", "compaction_end":
		payload := map[string]string{"marker": e.Type}
		if e.Type == "session_info_changed" {
			payload["text"] = liveText(e.Name)
		}
		if e.Type == "thinking_level_changed" {
			payload["text"] = liveText(e.Level)
		}
		if e.Type == "compaction_start" || e.Type == "compaction_end" {
			payload["text"] = liveText(e.Reason)
		}
		c.journal.progress(agent, "pi.marker", payload)
	case "auto_retry_start", "auto_retry_end", "summarization_retry_scheduled", "summarization_retry_attempt_start", "summarization_retry_finished":
		c.journal.progress(agent, "pi.retry", map[string]any{"signal": e.Type, "attempt": max(0, e.Attempt), "max_attempts": max(0, e.MaxAttempts), "delay_ms": max(0, e.DelayMs), "success": e.Success})
	case "message_update":
		if e.AssistantMessageEvent.ContentIndex < 0 {
			return
		}
		switch e.AssistantMessageEvent.Type {
		case "thinking_delta":
			// Pi 1.3 wire events are delta-only. Providers keep opaque
			// signatures/redacted payloads outside delta; only visible text
			// (or the literal redaction placeholder) reaches this field.
			c.journal.delta(agent, "assistant.thinking.delta", e.AssistantMessageEvent.Delta, e.AssistantMessageEvent.ContentIndex)
		case "text_delta":
			c.journal.delta(agent, "assistant.delta", e.AssistantMessageEvent.Delta, e.AssistantMessageEvent.ContentIndex)
		case "toolcall_delta":
			if text := liveText(e.AssistantMessageEvent.Delta); text != "" {
				c.journal.delta(agent, "assistant.toolcall.delta", text, e.AssistantMessageEvent.ContentIndex)
			}
		case "toolcall_end":
			call := e.AssistantMessageEvent.ToolCall
			if validLiveID(call.ID) && validLiveID(call.Name) {
				payload := map[string]any{"content_index": e.AssistantMessageEvent.ContentIndex, "tool_call_id": call.ID, "tool_name": call.Name}
				if text := liveJSON(call.Arguments); text != "" && call.Name != "process" {
					payload["text"] = text
				} else if call.Name == "process" {
					payload["text"] = processToolArguments(call.Arguments)
				}
				c.journal.progress(agent, "assistant.toolcall.end", payload)
			}
		}
	case "tool_execution_start", "tool_execution_update", "tool_execution_end":
		if len(e.ToolCallID) < 1 || len(e.ToolCallID) > 200 || len(e.ToolName) < 1 || len(e.ToolName) > 200 {
			return
		}
		kind, state := "tool.updated", "running"
		if e.Type == "tool_execution_start" {
			kind = "tool.started"
		}
		if e.Type == "tool_execution_end" {
			kind = "tool.finished"
			state = "succeeded"
			if e.IsError {
				state = "failed"
			}
		}
		payload := map[string]any{"tool_call_id": e.ToolCallID, "tool_name": e.ToolName, "state": state}
		if text := liveJSON(e.Args); text != "" && e.ToolName != "process" {
			payload["arguments"] = text
		} else if e.ToolName == "process" {
			if text := processToolArguments(e.Args); text != "" {
				payload["arguments"] = text
			}
		}
		result := e.PartialResult
		if e.Type == "tool_execution_end" {
			result = e.Result
		}
		if text := liveResult(result); text != "" && e.ToolName != "process" {
			payload["text"] = text
		} else if e.ToolName == "process" && e.Type == "tool_execution_end" {
			payload["text"] = processToolResult(result)
		}
		if e.Type == "tool_execution_end" {
			if cause := liveBashFailure(e.ToolName, e.IsError, result); cause != nil {
				payload["failure_cause"] = cause
			}
		}
		if e.Type == "tool_execution_update" {
			c.journal.toolUpdate(agent, e.ToolCallID, payload)
		} else {
			c.journal.progress(agent, kind, payload)
		}
	default:
		// Unknown Pi event payloads are unchecked. Only its bounded type name
		// crosses the journal; RPC acknowledgements are not conversation data.
		if safeNativeType(e.Type) && e.Type != "response" && e.Type != "extension_ui_request" && e.Type != "message_start" && e.Type != "queue_update" {
			c.journal.progress(agent, "unknown.native", map[string]any{"native_type": e.Type, "content": map[string]any{"media_type": "text/plain", "text": "Pi event not supported", "complete": true}})
		}
	}
}

func (c *ConversationController) drain(s *conversation) {
	// Pi RPC deltas omit cumulative partials. Identity comes from toolcall_start
	// and is scoped to one assistant message, not inferred from argument text.
	toolNames := map[int]string{}
	for e := range s.rpc.events {
		c.mu.Lock()
		if s.dead || (c.sessions[s.id] != nil && c.sessions[s.id] != s) {
			c.mu.Unlock()
			break
		}
		s.cursor++
		if len(s.events) == 64 {
			s.events = s.events[1:]
			s.lost = true
		}
		var frame struct {
			Type string `json:"type"`
		}
		_ = json.Unmarshal(e, &frame)
		switch frame.Type {
		case "message_start", "message_update", "message_end", "tool_execution_start", "tool_execution_update", "tool_execution_end", "bash_execution_update", "queue_update", "turn_start", "agent_start":
			c.noteRecapActivity(s)
		}
		raw := e
		var callFrame struct {
			Message struct {
				Role string `json:"role"`
			} `json:"message"`
			Assistant struct {
				Type  string `json:"type"`
				Name  string `json:"toolName"`
				Index int    `json:"contentIndex"`
			} `json:"assistantMessageEvent"`
		}
		_ = json.Unmarshal(raw, &callFrame)
		if frame.Type == "agent_start" || frame.Type == "message_start" && callFrame.Message.Role == "assistant" {
			toolNames = map[int]string{}
		}
		if frame.Type == "message_start" && callFrame.Message.Role == "assistant" {
			s.runInitial = false
		}
		if frame.Type == "message_update" && callFrame.Assistant.Type == "toolcall_start" && callFrame.Assistant.Index >= 0 && callFrame.Assistant.Index < 128 {
			toolNames[callFrame.Assistant.Index] = callFrame.Assistant.Name
		}
		hideArguments := frame.Type == "message_update" && callFrame.Assistant.Type == "toolcall_delta" && (toolNames[callFrame.Assistant.Index] == "" || toolNames[callFrame.Assistant.Index] == "process")
		if len(e) > 8192 {
			e, _ = json.Marshal(map[string]any{"type": frame.Type, "truncated": true})
			s.lost = true
		}
		// Model errors may contain provider text or secrets. Never retain
		// the raw native failure in a browser-visible status frame.
		if frame.Type == "message_end" {
			var result struct {
				Message struct {
					Role         string `json:"role"`
					StopReason   string `json:"stopReason"`
					ErrorMessage string `json:"errorMessage"`
				} `json:"message"`
			}
			if json.Unmarshal(raw, &result) == nil && result.Message.Role == "assistant" && result.Message.StopReason == "error" {
				if modelAuthFailure(result.Message.ErrorMessage) {
					s.authError = "pi_auth_failed"
					// A provider may have emitted provisional text before the
					// failure. Do not preserve it in the private status tail.
					s.events = []json.RawMessage{}
					if c.journal != nil {
						c.journal.reset("pi:"+s.id, "unknown")
					}
				} else if modelUnsupported(result.Message.ErrorMessage) {
					s.authError = "pi_model_unsupported"
				}
				e = []byte(`{"type":"message_end","message":{"role":"assistant","stopReason":"error"}}`)
			}
		}
		// Status tail never carries process XML or registry/log paths.
		var processFrame struct {
			Message  json.RawMessage `json:"message"`
			ToolName string          `json:"toolName"`
		}
		_ = json.Unmarshal(raw, &processFrame)
		// Diagnostic status is an allowlisted signal tail, never a second raw RPC
		// transport. Aggregate agent_end/turn_end messages can contain full tool
		// results, and nested message_start/end can contain raw registry details.
		e = diagnosticPiFrame(raw)
		s.events = append(s.events, e)
		if c.journal != nil {
			if piEventChangesNative(frame.Type) {
				c.journal.invalidateNative()
			}
		}
		if c.journal != nil && !hideArguments {
			c.publishDelta("pi:"+s.id, raw)
		}
		if frame.Type == "queue_update" {
			var q struct {
				Steering []string `json:"steering"`
				FollowUp []string `json:"followUp"`
			}
			if json.Unmarshal(raw, &q) == nil && q.Steering != nil && q.FollowUp != nil && len(q.Steering)+len(q.FollowUp) <= 128 {
				valid := true
				for _, text := range append(append([]string{}, q.Steering...), q.FollowUp...) {
					if len(text) > 65536 {
						valid = false
					}
				}
				if valid {
					s.queueSteering, s.queueFollowUp = q.Steering, q.FollowUp
					s.queueRevision++
					if c.journal != nil {
						c.journal.appendEvent("queue.changed", "pi:"+s.id, map[string]any{"revision": fmt.Sprintf("queue_%08d", s.queueRevision), "steering": q.Steering, "follow_up": q.FollowUp})
					}
				} else {
					s.rpc.overflow.Store(true)
				}
			} else {
				s.rpc.overflow.Store(true)
			}
		}
		if frame.Type == "extension_ui_request" {
			var q struct {
				ID          string   `json:"id"`
				Method      string   `json:"method"`
				Title       string   `json:"title"`
				Message     string   `json:"message"`
				StatusText  string   `json:"statusText"`
				StatusKey   string   `json:"statusKey"`
				WidgetKey   string   `json:"widgetKey"`
				Text        string   `json:"text"`
				Prefill     string   `json:"prefill"`
				WidgetLines []string `json:"widgetLines"`
				Options     []string `json:"options"`
			}
			if json.Unmarshal(raw, &q) == nil && len(q.ID) > 0 && len(q.ID) <= 200 && utf8.ValidString(q.ID) {
				prompt := q.Title
				for _, candidate := range []string{q.Message, q.StatusText, q.Text, q.Prefill, strings.Join(q.WidgetLines, "\n")} {
					if prompt == "" && candidate != "" {
						prompt = candidate
					}
				}
				if len(prompt) > 1000 {
					prompt = string([]rune(prompt)[:min(len([]rune(prompt)), 250)])
				}
				if prompt == "" {
					prompt = "Pi UI request (no text available)"
				}
				if utf8.ValidString(prompt) && len(prompt) <= 1000 {
					kind := q.Method
					if kind != "input" && kind != "confirm" && kind != "select" {
						kind = "unknown"
					}
					switch q.Method {
					case "notify", "setStatus", "setWidget", "setTitle", "set_editor_text":
						// These Pi RPC UI updates need no response. Preserve
						// their content as safe text, never replace a dialog.
						if c.journal != nil {
							if q.Method == "notify" || q.Method == "setStatus" || q.Method == "setWidget" {
								key := q.ID
								if q.Method == "setStatus" {
									key = q.StatusKey
								}
								if q.Method == "setWidget" {
									key = q.WidgetKey
								}
								if validLiveID(key) {
									text := q.Message
									if q.Method == "setStatus" {
										text = q.StatusText
									}
									if q.Method == "setWidget" {
										text = strings.Join(q.WidgetLines, "\n")
									}
									c.journal.progress("pi:"+s.id, "extension.visible", map[string]any{"method": q.Method, "key": key, "text": liveText(text), "clear": text == ""})
								}
							}
						}
					default:
						if len(q.Options) > 100 {
							q.Options = q.Options[:100]
						}
						choices := make([]string, 0, len(q.Options))
						for _, option := range q.Options {
							if len(option) <= 500 && utf8.ValidString(option) {
								choices = append(choices, option)
							}
						}
						if s.spentQuestions == nil {
							s.spentQuestions = make(map[string]bool)
						}
						if !s.spentQuestions[q.ID] && len(s.spentQuestions) < maxConversationCommands {
							duplicate := s.questionID == q.ID
							for _, queued := range s.queuedQuestions {
								if queued.id == q.ID {
									duplicate = true
								}
							}
							if !duplicate {
								next := pendingQuestion{q.ID, kind, choices, map[string]any{"request_id": q.ID, "question_kind": kind, "prompt": prompt, "choices": choices}}
								if s.questionID == "" {
									c.showQuestion(s, next)
								} else if len(s.queuedQuestions) < 16 {
									s.queuedQuestions = append(s.queuedQuestions, next)
								} else {
									s.rpc.overflow.Store(true)
									if c.journal != nil {
										c.journal.appendInvalidation("pi:" + s.id)
									}
								}
							}
						}
					}
				}
			}
		}

		if frame.Type == "agent_start" {
			s.runActive = true
			s.runInitial = s.state != "pending" && s.state != "accepted"
			s.settled = false
			// Native wake-ups have no browser receipt. They still own an active run
			// and sends must steer instead of prompting a streaming Pi.
			if s.state == "idle" || s.state == "rejected" {
				s.state = "accepted"
				s.turnGeneration++
			}
		}
		if frame.Type == "message_end" {
			delivery := "context"
			if s.runActive {
				delivery = "steer"
				if s.runInitial {
					delivery = "wake"
				}
			}
			if notification, recognised := projectProcessNotification(processFrame.Message, &delivery); recognised && notification != nil && c.journal != nil {
				c.journal.appendEvent("process.notification", "pi:"+s.id, notification)
			}
			var role struct {
				Role string `json:"role"`
			}
			_ = json.Unmarshal(processFrame.Message, &role)
			if role.Role == "assistant" || role.Role == "toolResult" {
				s.runInitial = false
			}
		}
		if frame.Type == "tool_execution_end" {
			s.runInitial = false
		}
		settled := frame.Type == "agent_settled"
		turn := s.turnGeneration
		if settled {
			s.runActive = false
			s.question = nil // any unanswered UI request is no longer pending after Pi settled
			s.questionID = ""
			s.queuedQuestions = nil
			s.settled = true
			c.startAutomaticTitle(s)
			if c.journal != nil {
				c.journal.activity("pi:"+s.id, "settling")
			}
			if s.state == "accepted" {
				s.state = "idle"
			}
		}
		// Messages held while a native run was active go out once it settles.
		drain := settled && len(s.held) > 0 && s.state == "idle"
		c.mu.Unlock()
		if drain {
			go c.deliverHeld(s) // never block the event reader on a native write
		}
		if settled {
			key := c.publishNativeHistoryForTurn(s, turn)
			c.mu.Lock()
			if c.sessions[s.id] == s && !c.closed && s.turnGeneration == turn {
				state := "unknown"
				if key != "" {
					state = "settled"
				}
				s.settlement = map[string]string{"state": state, "observed_at": time.Now().UTC().Format(time.RFC3339Nano), "native_key": key}
				if c.journal != nil {
					c.journal.appendEvent("turn.settled", "pi:"+s.id, s.settlement)
				}
			}
			if c.sessions[s.id] == s && !c.closed && s.turnGeneration == turn {
				if c.journal != nil {
					c.journal.activity("pi:"+s.id, "idle")
				}
				if key != "" && s.state == "idle" {
					s.recapLastActivity = time.Now()
					c.scheduleAutomaticRecap(s)
				}
			}
			c.mu.Unlock()
		}
	}
	c.mu.Lock()
	if c.sessions[s.id] == s {
		// The stream ended. Before readiness that is a failed start whose held
		// messages stay; after the child is reaped it is plain stopped.
		switch {
		case s.state == "starting":
			s.state = "start_failed"
			if s.startProblem == "" {
				s.startProblem = "pi_start_failed"
			}
			c.heldFailed(s)
		case s.state == "start_failed" || s.state == "stopped":
		case s.dead:
			s.state = "stopped"
		default:
			s.state = "uncertain"
		}
		if s.ack == "pending" {
			s.ack = "uncertain"
		}
		c.uncertainPrompt(s)
		if c.journal != nil {
			c.journal.reset("pi:"+s.id, "unknown")
			c.journal.appendInvalidation("pi:" + s.id)
		}
	}
	c.mu.Unlock()
}

// Streaming deltas do not change native JSONL. Invalidate when Pi may have
// appended or changed persisted entries, not on every local-command chunk.
func piEventChangesNative(kind string) bool {
	return kind != "message_update" && kind != "bash_execution_update" && !strings.HasPrefix(kind, "tool_execution_")
}

// Live display is deliberately restricted to bounded, valid text. Native details,
// error strings, provider payloads and arbitrary extension metadata never cross.
func validLiveID(s string) bool { return len(s) > 0 && len(s) <= 200 && utf8.ValidString(s) }
func safeNativeType(s string) bool {
	if len(s) == 0 || len(s) > 80 {
		return false
	}
	for _, ch := range s {
		if !(ch >= 'a' && ch <= 'z' || ch == '_') {
			return false
		}
	}
	return true
}
func liveText(s string) string {
	if !utf8.ValidString(s) {
		return ""
	}
	if len(s) > 4096 {
		prefix := s[:4093]
		for !utf8.ValidString(prefix) {
			prefix = prefix[:len(prefix)-1]
		}
		return prefix + "..."
	}
	return s
}
func liveJSON(raw json.RawMessage) string {
	if len(raw) == 0 || !json.Valid(raw) {
		return ""
	}
	return liveText(string(raw))
}
func liveResult(raw json.RawMessage) string {
	var r struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}
	if json.Unmarshal(raw, &r) != nil {
		return ""
	}
	var parts []string
	for _, b := range r.Content {
		if b.Type == "text" {
			parts = append(parts, b.Text)
		}
	}
	return liveText(strings.Join(parts, "\n"))
}

// Status consumers need lifecycle and a known tool label for progress. Native
// text uses the journal/history projections; unknown RPC fields never escape.
func diagnosticPiFrame(raw json.RawMessage) json.RawMessage {
	var frame struct {
		Type     string `json:"type"`
		ToolName string `json:"toolName"`
	}
	_ = json.Unmarshal(raw, &frame)
	if !safeNativeType(frame.Type) {
		frame.Type = "unknown_native"
	}
	projected := map[string]string{"type": frame.Type}
	switch frame.Type {
	case "tool_execution_start", "tool_execution_update", "tool_execution_end":
		switch frame.ToolName {
		case "process", "bash", "read", "write", "edit", "grep", "find", "ls":
			projected["toolName"] = frame.ToolName
		}
	}
	wire, _ := json.Marshal(projected)
	return wire
}
