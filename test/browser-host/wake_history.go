//go:build linux

package main

import "time"

// seedWakeFiredHistory writes a native session in which a scheduled wake the
// agent set has fired: the person's question and the agent's reply, then the
// scheduled-wake message the companion appends when the daemon fires the wake
// (process-extension.mjs scheduledWakeMessage), and the reply of the turn it
// started. The person reads Habitat's line built from the message's details.
func seedWakeFiredHistory(path, cwd string) error {
	start := time.Date(2026, 11, 24, 15, 0, 0, 0, time.UTC)
	stamp := func(minutes int) string { return start.Add(time.Duration(minutes) * time.Minute).Format(time.RFC3339) }
	rows := []map[string]any{{"type": "session", "version": 3, "id": "11111111-1111-4111-8111-111111111111", "cwd": cwd, "timestamp": stamp(0)}}
	var parent any
	add := func(row map[string]any, minutes int) {
		row["parentId"], row["timestamp"] = parent, stamp(minutes)
		rows = append(rows, row)
		parent = row["id"]
	}
	message := func(id string, minutes int, role, text string) {
		m := map[string]any{"role": role, "timestamp": start.Add(time.Duration(minutes) * time.Minute).UnixMilli()}
		if role == "assistant" {
			m["stopReason"] = "stop"
			m["content"] = []any{map[string]any{"type": "text", "text": text}}
		} else {
			m["content"] = text
		}
		add(map[string]any{"type": "message", "id": id, "message": m}, minutes)
	}
	message("wf-user", 0, "user", "Katso illalla, valmistuiko ajo.")
	message("wf-reply", 1, "assistant", "Asetin herätyksen illaksi.")
	add(map[string]any{
		"type": "custom_message", "id": "wf-wake", "customType": "oh-scheduled-wake", "display": true,
		"content": "[Open Habitat] Scheduled wake: synthetic.",
		"details": map[string]any{"schema_version": 1, "id": "wk_0123456789abcdef", "at": stamp(260), "set_at": stamp(1), "fired_at": stamp(260), "note": "Tarkista, valmistuiko ajo"},
	}, 260)
	message("wf-woken", 261, "assistant", "Ajo valmistui virheittä.")
	return writeRows(path, rows)
}
