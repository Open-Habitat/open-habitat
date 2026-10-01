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
		} `json:"assistantMessageEvent"`
		ToolCallID string `json:"toolCallId"`
		ToolName   string `json:"toolName"`
		IsError    bool   `json:"isError"`
	}
	if json.Unmarshal(raw, &e) != nil {
		return
	}
	switch e.Type {
	case "agent_start":
		c.journal.reset(agent, "running")
	case "turn_start":
		c.journal.activity(agent, "running")
	case "message_update":
		if e.AssistantMessageEvent.Type == "text_delta" && e.AssistantMessageEvent.ContentIndex >= 0 && e.AssistantMessageEvent.Delta != "" {
			c.journal.delta(agent, e.AssistantMessageEvent.Delta, e.AssistantMessageEvent.ContentIndex)
		}
	case "tool_execution_start", "tool_execution_end":
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
		c.journal.progress(agent, kind, map[string]string{"tool_call_id": e.ToolCallID, "tool_name": e.ToolName, "state": state})
	}
}

func (c *ConversationController) drain(s *conversation) {
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
		raw := e
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
				}
				e = []byte(`{"type":"message_end","message":{"role":"assistant","stopReason":"error"}}`)
			}
		}
		s.events = append(s.events, e)
		if c.journal != nil {
			if frame.Type != "message_update" && !strings.HasPrefix(frame.Type, "tool_execution_") {
				c.journal.invalidateNative()
			}
		}
		if c.journal != nil {
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
							c.journal.appendEvent("unknown.native", "pi:"+s.id, map[string]any{"native_type": "extension_ui_request", "content": map[string]any{"media_type": "text/plain", "text": prompt, "complete": true}})
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

		settled := frame.Type == "agent_settled"
		turn := s.turnGeneration
		if settled {
			s.question = nil // any unanswered UI request is no longer pending after Pi settled
			s.questionID = ""
			s.queuedQuestions = nil
			s.settled = true
			if c.journal != nil {
				c.journal.activity("pi:"+s.id, "settling")
			}
			if s.state == "accepted" {
				s.state = "idle"
			}
		}
		c.mu.Unlock()
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
			if c.sessions[s.id] == s && !c.closed && s.turnGeneration == turn && c.journal != nil {
				c.journal.activity("pi:"+s.id, "idle")
			}
			c.mu.Unlock()
		}
	}
	c.mu.Lock()
	if c.sessions[s.id] == s {
		s.state = "uncertain"
		if s.ack == "pending" {
			s.ack = "uncertain"
		}
		if s.receipts != nil && s.receipts[s.command] == "pending" {
			c.receipt(s, s.command, "uncertain")
		}
		if c.journal != nil {
			c.journal.reset("pi:"+s.id, "unknown")
			c.journal.appendInvalidation("pi:" + s.id)
		}
	}
	c.mu.Unlock()
}
