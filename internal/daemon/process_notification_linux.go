//go:build linux

package daemon

import (
	"encoding/json"
	"strconv"
)

type processEvent struct {
	Summary         string           `json:"summary,omitempty"`
	Spinoff         []processSpinoff `json:"spinoff,omitempty"`
	NotificationKey string           `json:"notification_key,omitempty"`
	Kind            string           `json:"kind"`
	ID              string           `json:"process_id"`
	Name            string           `json:"process_name"`
	Preview         string           `json:"command_preview"`
	ExitCode        *int             `json:"exit_code"`
	Signal          *string          `json:"signal"`
	EndReason       *string          `json:"end_reason"`
	Delivery        *string          `json:"delivery"`
	RunIDs          []string         `json:"run_ids"`
}

// Recognise before reading content. XML content repeats raw commands and is
// never a fallback for malformed process details, nor exposed as a block read.
func projectProcessNotification(raw json.RawMessage, delivery *string) (*processEvent, bool) {
	var m struct {
		CustomType string `json:"customType"`
		Details    struct {
			Summary   string  `json:"summary"`
			Timestamp int64   `json:"timestamp"`
			Kind      string  `json:"kind"`
			ID        string  `json:"processId"`
			Name      string  `json:"processName"`
			Command   string  `json:"command"`
			ExitCode  *int    `json:"exitCode"`
			EndReason *string `json:"endReason"`
			Signal    *struct {
				Name string `json:"name"`
			} `json:"signal"`
		} `json:"details"`
	}
	if json.Unmarshal(raw, &m) != nil || m.CustomType != "ad-process:notification" {
		return nil, false
	}
	d := m.Details
	if !(processIDPattern.MatchString(d.ID) || d.Kind == "log_match_suppressed" && d.ID == "*") || len(d.Name) > 200 {
		return nil, true
	}
	switch d.Kind {
	case "success", "failure", "crash", "killed", "log_match", "log_match_suppressed":
	default:
		return nil, true
	}
	var signal *string
	if d.Signal != nil {
		v := prefixBytes(d.Signal.Name, 80)
		signal = &v
	}
	reason := d.EndReason
	if reason != nil {
		v := prefixBytes(*reason, 80)
		reason = &v
	}
	ids := taskfleetWait(d.Command)
	if ids == nil {
		ids = []string{}
	}
	key := ""
	if d.Timestamp > 0 {
		key = d.ID + ":" + strconv.FormatInt(d.Timestamp, 10) + ":" + d.Kind
	}
	summary := ""
	if d.Kind == "log_match_suppressed" {
		summary = "Log-match notifications were suppressed because output was too fast."
	}
	return &processEvent{summary, nil, key, d.Kind, d.ID, d.Name, commandPreview(d.Command), d.ExitCode, signal, reason, delivery, ids}, true
}

func nativeProcessNotification(e nativeEntry) (historyEntry, bool) {
	raw := e.Raw
	if e.Type == "message" {
		raw = e.Message
	} else if e.Type != "custom_message" {
		return historyEntry{}, false
	}
	notification, recognised := projectProcessNotification(raw, nil)
	if !recognised {
		return historyEntry{}, false
	}
	out := historyEntry{Key: e.ID, Timestamp: nativeTimestamp(e.Timestamp)}
	var visibility struct {
		Display bool `json:"display"`
	}
	_ = json.Unmarshal(raw, &visibility)
	if notification != nil && visibility.Display {
		out.Kind = "unknown"
		out.Content = historyContent{MediaType: "text/plain", Text: "", Complete: true}
		out.Blocks = []historyBlock{{Type: "process_event", ProcessEvent: notification}}
	}
	return out, true
}

func frameContainsProcessCall(raw json.RawMessage) bool {
	var frame struct {
		Message struct {
			Content []struct {
				Name string `json:"name"`
			} `json:"content"`
		} `json:"message"`
		Update struct {
			Partial struct {
				Content []struct {
					Name string `json:"name"`
				} `json:"content"`
			} `json:"partial"`
		} `json:"assistantMessageEvent"`
	}
	if json.Unmarshal(raw, &frame) != nil {
		return false
	}
	for _, block := range frame.Message.Content {
		if block.Name == "process" {
			return true
		}
	}
	for _, block := range frame.Update.Partial.Content {
		if block.Name == "process" {
			return true
		}
	}
	return false
}
