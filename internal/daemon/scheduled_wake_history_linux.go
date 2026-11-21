//go:build linux

package daemon

import "encoding/json"

// process-extension.mjs appends these when a scheduled wake fires
// (scheduledWakeMessage) and when a cancellation is told to the agent with
// the person's next message (wakeCancelMessage). Their text is the agent's,
// in English; the person reads Habitat's line built from the details.
const (
	scheduledWakeMessageType = "oh-scheduled-wake"
	wakeCancelMessageType    = "oh-scheduled-wake-cancel"
)

type wakeLineItem struct {
	At          string `json:"at"`
	Note        string `json:"note"`
	SetAt       string `json:"set_at,omitempty"`
	FiredAt     string `json:"fired_at,omitempty"`
	LateSeconds int64  `json:"late_seconds,omitempty"`
	MovedFrom   string `json:"moved_from,omitempty"`
	Reason      string `json:"reason,omitempty"`
	CancelledAt string `json:"cancelled_at,omitempty"`
}

// wakeLine is history.schema.json#/$defs/scheduledWake.
type wakeLine struct {
	Kind  string         `json:"kind"`
	Wakes []wakeLineItem `json:"wakes"`
}

func nativeWakeLine(e nativeEntry) (historyEntry, bool) {
	raw := e.Raw
	if e.Type == "message" {
		raw = e.Message
	} else if e.Type != "custom_message" {
		return historyEntry{}, false
	}
	var m struct {
		Role       string `json:"role"`
		CustomType string `json:"customType"`
		Display    bool   `json:"display"`
		Details    struct {
			wakeLineItem
			Cancelled []wakeLineItem `json:"cancelled"`
		} `json:"details"`
	}
	if json.Unmarshal(raw, &m) != nil || m.CustomType != scheduledWakeMessageType && m.CustomType != wakeCancelMessageType || e.Type == "message" && m.Role != "custom" {
		return historyEntry{}, false
	}
	out := historyEntry{Key: e.ID, Timestamp: nativeTimestamp(e.Timestamp)}
	if !m.Display {
		return out, true
	}
	line := wakeLine{Kind: "fired"}
	clean := func(w wakeLineItem) (wakeLineItem, bool) {
		if !validStamp(w.At) || !validWakeNote(w.Note) || w.LateSeconds < 0 {
			return wakeLineItem{}, false
		}
		for _, s := range []string{w.SetAt, w.FiredAt, w.MovedFrom, w.CancelledAt} {
			if s != "" && !validStamp(s) {
				return wakeLineItem{}, false
			}
		}
		if w.Reason != "" && w.Reason != "person" && w.Reason != "archived" {
			return wakeLineItem{}, false
		}
		return w, true
	}
	if m.CustomType == scheduledWakeMessageType {
		w, ok := clean(m.Details.wakeLineItem)
		if !ok || w.FiredAt == "" || w.Reason != "" || w.CancelledAt != "" {
			return out, true
		}
		line.Wakes = []wakeLineItem{w}
	} else {
		line.Kind = "cancelled"
		for _, c := range m.Details.Cancelled {
			if w, ok := clean(c); ok && w.Reason != "" && w.CancelledAt != "" && len(line.Wakes) < 100 {
				w.SetAt, w.FiredAt, w.LateSeconds, w.MovedFrom = "", "", 0, ""
				line.Wakes = append(line.Wakes, w)
			}
		}
		if len(line.Wakes) == 0 {
			return out, true
		}
	}
	out.Kind = "unknown"
	out.Content = historyContent{MediaType: "text/plain", Text: "", Complete: true}
	out.ScheduledWake = &line
	return out, true
}
