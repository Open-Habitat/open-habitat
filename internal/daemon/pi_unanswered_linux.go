package daemon

import "encoding/json"

// Pi takes a queued message off its queue when the message starts in the
// conversation (a queue_update without it, then, after Pi's extension hooks,
// the user message_start). A Stop that lands just after that point finds Pi's
// queue empty although the model never answered the message: the abort cuts
// the response before any output. The person did not see it reach the agent,
// so a Stop gives it back with the still-queued ones (Jari, 2026-10-25). Only
// the order of Pi's own events is used here, never timing.
//
// Texts are matched by value, as Pi matches them against its queue. Two queued
// messages with the same text can therefore come back as one. The records last
// one Pi run; the bound is far above any real queue and only caps memory.
const maxUnansweredQueue = 1024

// noteQueueTaken records the texts a queue_update removed from Pi's queue.
// Caller holds c.mu and has not yet replaced the old queue.
func noteQueueTaken(s *conversation, steering, followUp []string) {
	old := append(append([]string{}, s.queueSteering...), s.queueFollowUp...)
	next := append(append([]string{}, steering...), followUp...)
	s.queueTaken = bounded(append(s.queueTaken, multisetMinus(old, next)...))
	// Queued again after a clear gave it back: a new message, tracked anew.
	s.queueCleared = multisetMinus(s.queueCleared, multisetMinus(next, old))
}

func bounded(texts []string) []string {
	if over := len(texts) - maxUnansweredQueue; over > 0 {
		return texts[over:]
	}
	return texts
}

// noteQueueDelivery follows one Pi event: a user message whose text left the
// queue was delivered and is unanswered until the model produces output.
// Caller holds c.mu.
func noteQueueDelivery(s *conversation, frameType string, raw json.RawMessage) {
	var e struct {
		Message struct {
			Role    string          `json:"role"`
			Content json.RawMessage `json:"content"`
		} `json:"message"`
		Assistant struct {
			Type string `json:"type"`
		} `json:"assistantMessageEvent"`
	}
	_ = json.Unmarshal(raw, &e)
	switch {
	case frameType == "agent_settled":
		// Pi's whole run is over, follow-up runs included; a later run
		// starts from its own prompt.
		s.queueTaken, s.queueCleared, s.unanswered = nil, nil, nil
	case frameType == "message_start" && e.Message.Role == "user":
		text, ok := piUserText(e.Message.Content)
		if !ok {
			return
		}
		taken := multisetMinus(s.queueTaken, []string{text})
		if len(taken) == len(s.queueTaken) {
			return // the turn's own prompt, not a queued message
		}
		s.queueTaken = taken
		if cleared := multisetMinus(s.queueCleared, []string{text}); len(cleared) < len(s.queueCleared) {
			// A clear already gave it back.
			s.queueCleared = cleared
		} else {
			s.unanswered = bounded(append(s.unanswered, text))
		}
	case frameType == "message_update" && e.Assistant.Type != "" && e.Assistant.Type != "start" && e.Assistant.Type != "done" && e.Assistant.Type != "error",
		frameType == "message_end" && e.Message.Role == "assistant" && hasBlocks(e.Message.Content),
		frameType == "tool_execution_start":
		// Any thinking, text or tool call answers what was delivered before
		// it. An aborted response ends with an error event and no content.
		s.unanswered = nil
	}
}

func hasBlocks(content json.RawMessage) bool {
	var blocks []json.RawMessage
	return json.Unmarshal(content, &blocks) == nil && len(blocks) > 0
}

// piUserText is the text Pi matches against its queue: the message's text
// blocks joined without a separator.
func piUserText(content json.RawMessage) (string, bool) {
	var text string
	if json.Unmarshal(content, &text) == nil {
		return text, true
	}
	var blocks []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}
	if json.Unmarshal(content, &blocks) != nil {
		return "", false
	}
	for _, b := range blocks {
		if b.Type == "text" {
			text += b.Text
		}
	}
	return text, true
}

// isClearReply tells Pi's clear_queue response, which the reader routes
// through the event drain so that it is reconciled at its place among Pi's
// queue events: after every removal and delivery Pi wrote before it, and
// before any written after it, such as the run settling.
func isClearReply(frame json.RawMessage) bool {
	var head struct {
		Type    string `json:"type"`
		Command string `json:"command"`
	}
	return json.Unmarshal(frame, &head) == nil && head.Type == "response" && head.Command == "clear_queue"
}

// reconcileClear records a successful clear at its place in Pi's event order,
// then hands the response on to the waiting request.
func (c *ConversationController) reconcileClear(s *conversation, frame json.RawMessage) {
	var reply struct {
		Success bool `json:"success"`
		Data    struct {
			Steering []string `json:"steering"`
			FollowUp []string `json:"followUp"`
		} `json:"data"`
	}
	if json.Unmarshal(frame, &reply) == nil && reply.Success && len(reply.Data.Steering)+len(reply.Data.FollowUp) <= 128 {
		c.mu.Lock()
		s.clearReturn = noteClear(s, append(append([]string{}, reply.Data.Steering...), reply.Data.FollowUp...), s.clearStop)
		c.mu.Unlock()
	}
	select {
	case s.rpc.frames <- frame:
	default:
		// As the reader does: a dropped response must not read as success.
		s.rpc.overflow.Store(true)
		_ = s.rpc.in.Close()
	}
}

// noteClear records what a clear gave back and, for a Stop, also hands back
// once what Pi took off its queue and the model has not answered: delivered
// messages, and taken ones whose delivery Pi has not written yet (it runs its
// extension hooks in between). A text
// the clear itself returned is never handed back a second time, whether its
// removal or its late delivery (Pi had pulled it for its next turn) comes
// before or after. Caller holds c.mu; the drain calls it at the clear reply's
// place among Pi's events.
func noteClear(s *conversation, cleared []string, stop bool) []string {
	// Delivered already but still listed by Pi: back through the clear.
	early := multisetMinus(s.unanswered, multisetMinus(s.unanswered, cleared))
	s.unanswered = multisetMinus(s.unanswered, early)
	s.queueCleared = bounded(append(s.queueCleared, multisetMinus(cleared, early)...))
	if !stop {
		return nil
	}
	pending := multisetMinus(s.queueTaken, s.queueCleared)
	out := append(s.unanswered, pending...)
	// Their deliveries are still to come; they are the person's now.
	s.queueCleared = bounded(append(s.queueCleared, pending...))
	s.unanswered = nil
	return out
}

// multisetMinus keeps a's order and removes one occurrence per element of b.
func multisetMinus(a, b []string) []string {
	remove := make(map[string]int, len(b))
	for _, t := range b {
		remove[t]++
	}
	out := []string{}
	for _, t := range a {
		if remove[t] > 0 {
			remove[t]--
			continue
		}
		out = append(out, t)
	}
	return out
}
