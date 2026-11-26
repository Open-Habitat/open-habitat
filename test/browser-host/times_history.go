//go:build linux

package main

import "time"

// seedTimesHistory writes a native session that spans several days, for
// times in a conversation (conversation-times): a short turn on Friday
// 20.11.2026, a four-stage 48-minute turn, a two-stage turn the person
// stopped after 8 minutes and a single-stage 23-minute turn on Monday 23.11.,
// and a short turn on Tuesday 24.11. Every entry carries the timestamp Pi
// writes when it appends the entry.
func seedTimesHistory(path, cwd string) error {
	at := func(s string) time.Time {
		t, err := time.Parse(time.RFC3339, s)
		if err != nil {
			panic(err)
		}
		return t
	}
	rows := []map[string]any{{"type": "session", "version": 3, "id": "11111111-1111-4111-8111-111111111111", "cwd": cwd, "timestamp": "2026-11-20T12:00:00Z"}}
	var parent any
	add := func(id, stamp string, message map[string]any) {
		message["timestamp"] = at(stamp).UnixMilli()
		rows = append(rows, map[string]any{"type": "message", "id": id, "parentId": parent, "timestamp": stamp, "message": message})
		parent = id
	}
	user := func(id, stamp, text string) { add(id, stamp, map[string]any{"role": "user", "content": text}) }
	// A tool call, optionally after an interim reply in the same message, as
	// Pi writes a message that says something and then goes on working.
	tool := func(id, stamp, interim, command string) {
		content := []any{}
		if interim != "" {
			content = append(content, map[string]any{"type": "text", "text": interim})
		}
		content = append(content, map[string]any{"type": "toolCall", "id": id, "name": "bash", "arguments": map[string]any{"command": command}})
		add(id, stamp, map[string]any{"role": "assistant", "stopReason": "toolUse", "content": content})
		add(id+"-result", stamp, map[string]any{"role": "toolResult", "toolCallId": id, "toolName": "bash", "content": []any{map[string]any{"type": "text", "text": "ok"}}})
	}
	say := func(id, stamp, text string) {
		add(id, stamp, map[string]any{"role": "assistant", "stopReason": "stop", "content": []any{map[string]any{"type": "text", "text": text}}})
	}
	// Friday: 41 s, one stage.
	user("tm-u1", "2026-11-20T12:02:10Z", "Synthetic outline request")
	tool("tm-c1", "2026-11-20T12:02:30Z", "", "ls docs")
	say("tm-r1", "2026-11-20T12:02:51Z", "Synthetic outline ready.")
	// Monday: 48 min 40 s in four stages; each interim reply closes one.
	user("tm-u2", "2026-11-23T07:30:00Z", "Synthetic language pass")
	tool("tm-c2a", "2026-11-23T07:41:10Z", "", "vale chapter-1.md")
	tool("tm-c2b", "2026-11-23T07:55:30Z", "Synthetic chapters 1 and 2 done.", "vale chapter-3.md")
	tool("tm-c2c", "2026-11-23T08:06:00Z", "Synthetic chapters 3 and 4 done.", "vale chapter-5.md")
	tool("tm-c2d", "2026-11-23T08:17:50Z", "Synthetic chapter 5 done.", "vale report.md")
	say("tm-r2", "2026-11-23T08:18:40Z", "Synthetic language pass done.")
	// Monday: stopped by the person after 8 min 20 s, in two stages.
	user("tm-u3", "2026-11-23T11:10:00Z", "Synthetic translation")
	tool("tm-c3a", "2026-11-23T11:13:40Z", "", "translate chapter-1.md")
	tool("tm-c3b", "2026-11-23T11:17:10Z", "Synthetic chapters 1–3 translated.", "translate chapter-4.md")
	add("tm-x3", "2026-11-23T11:18:20Z", map[string]any{"role": "assistant", "stopReason": "aborted", "content": []any{}})
	// Monday: 23 min 05 s, one stage.
	user("tm-u4", "2026-11-23T14:40:00Z", "Synthetic layout to PDF")
	tool("tm-c4", "2026-11-23T15:02:50Z", "", "typst compile report.typ")
	say("tm-r4", "2026-11-23T15:03:05Z", "Synthetic PDF ready.")
	// Tuesday: 12 s, no work.
	user("tm-u5", "2026-11-24T07:52:00Z", "Synthetic page count")
	say("tm-r5", "2026-11-24T07:52:12Z", "Synthetic 18 pages.")
	return writeRows(path, rows)
}
