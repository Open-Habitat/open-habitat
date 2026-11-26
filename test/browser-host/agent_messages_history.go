//go:build linux

package main

import (
	"encoding/json"
	"path/filepath"
	"time"

	"github.com/open-habitat/open-habitat/internal/agentblock"
)

// Two synthetic conversations of alice that exchange agent messages
// (agent-agent-messages), as round 4's story: the report conversation tells
// the charts conversation about new figures (m1), charts answers (m2) and
// later reports a gap (m3, queued behind a busy turn as a follow-up), the
// report quotes it with the fix (m4), charts quotes that when done (m5),
// and the report's agent at once sends a thank-you quoting m5 (m6). A quote
// of the message directly above is not repeated: m5 in the charts
// conversation and m6 in the report. Each side holds the messages it received as
// the daemon's <agent-message> block and the ones it sent as the CLI's
// typed tool result.
const (
	agentMessagesReport = "11111111-1111-4111-8111-111111111111"
	agentMessagesCharts = "44444444-4444-4444-8444-444444444444"
	// The block's fallback workspace; the view prefers the rail's.
	agentMessagesWorkspace = "ws_fixturework"
)

func agentMessageID(n int) string {
	return "5c1e8f20-7b3a-4d9e-a6f2-00000000000" + string(rune('0'+n))
}

type agentStoryMessage struct {
	from, text, delivery, state string
	quote                       int
}

var agentStory = []agentStoryMessage{
	{from: agentMessagesReport, delivery: "send", state: "pending", text: "Synthetic Q3 figures are ready in `data/q3.csv`. Update chart 2 with them and tell me when it is done."},
	{from: agentMessagesCharts, delivery: "send", state: "pending", text: "Synthetic chart 2 is updated with the Q3 figures: `charts/q3.svg`."},
	{from: agentMessagesCharts, delivery: "follow-up", state: "pending", text: "Synthetic gap: September is missing from `data/q3.csv`. The chart shows only July and August."},
	{from: agentMessagesReport, delivery: "send", state: "pending", text: "Synthetic fix: I added the September row to `data/q3.csv`. Update chart 2 once more.", quote: 3},
	{from: agentMessagesCharts, delivery: "send", state: "pending", text: "Synthetic chart 2 now covers July to September.", quote: 4},
	{from: agentMessagesReport, delivery: "send", state: "pending", text: "Synthetic thanks, the report has the final chart.", quote: 5},
}

func seedAgentMessagesHistory(path, cwd string) error {
	titles := map[string]string{agentMessagesReport: "Synthetic report", agentMessagesCharts: "Synthetic charts"}
	other := map[string]string{agentMessagesReport: agentMessagesCharts, agentMessagesCharts: agentMessagesReport}
	excerpt := func(n int) *agentblock.Quote {
		if n == 0 {
			return nil
		}
		m := agentStory[n-1]
		return &agentblock.Quote{Message: agentMessageID(n), From: "pi:" + m.from, Excerpt: agentblock.Excerpt(m.text)}
	}
	sessions := map[string]*storyWriter{}
	for id, title := range titles {
		sessions[id] = newStoryWriter(id, cwd, title)
	}
	report, charts := sessions[agentMessagesReport], sessions[agentMessagesCharts]
	clock := time.Date(2026, 11, 25, 7, 38, 0, 0, time.UTC)
	tick := func() string { clock = clock.Add(time.Minute); return clock.Format(time.RFC3339) }
	// send writes message n into both conversations: a tool call and its
	// typed result in the sender's turn, the block in the receiver's.
	send := func(n int, receiverSays string) {
		m := agentStory[n-1]
		sender, receiver := sessions[m.from], sessions[other[m.from]]
		id := agentMessageID(n)
		result := map[string]any{"schema_version": 1, "command_id": id, "state": m.state, "kind": "agent_message_sent", "message_id": id, "to": "pi:" + other[m.from], "title": titles[other[m.from]], "workspace_id": agentMessagesWorkspace, "delivery": m.delivery, "text": m.text}
		if q := excerpt(m.quote); q != nil {
			result["quote"] = map[string]any{"message_id": q.Message, "from_agent_id": q.From, "excerpt": q.Excerpt}
		}
		out, _ := json.Marshal(map[string]any{"schema_version": 1, "data": map[string]any{"cli_version": "fixture", "result": result}, "warnings": []string{"Do not automatically replay writes after a missing reply or 503; inspect conversation state. A missing receipt is not rejection."}})
		sender.tool(tick(), "open-habitat agent message create --conversation pi:"+other[m.from]+" --idempotency-key "+id+" --text-file - --json", string(out))
		block := agentblock.Build(agentblock.Sender{Agent: "pi:" + m.from, Title: titles[m.from], Workspace: agentMessagesWorkspace}, id, excerpt(m.quote), m.text)
		receiver.user(tick(), block)
		if receiverSays != "" {
			receiver.say(tick(), receiverSays)
		}
	}
	report.user(tick(), "Synthetic Q3 figures are done. Tell the charts conversation and ask it to update chart 2.")
	send(1, "")
	report.say(tick(), "Synthetic tables meanwhile.")
	send(2, "")
	report.say(tick(), "Synthetic chart placed.")
	send(3, "Synthetic: shall I merge September?")
	charts.say(tick(), "Synthetic chart told.")
	report.user(tick(), "Synthetic yes, merge it and tell it.")
	send(4, "")
	report.say(tick(), "Synthetic merged and told.")
	send(5, "")
	charts.say(tick(), "Synthetic chart done and told.")
	send(6, "")
	report.say(tick(), "Synthetic report done.")
	if err := writeRows(path, report.rows); err != nil {
		return err
	}
	return writeRows(filepath.Join(filepath.Dir(path), "agent-messages-charts.jsonl"), charts.rows)
}

// storyWriter appends native entries of one conversation in order.
type storyWriter struct {
	rows   []map[string]any
	parent any
	serial int
}

func newStoryWriter(id, cwd, title string) *storyWriter {
	w := &storyWriter{rows: []map[string]any{{"type": "session", "version": 3, "id": id, "cwd": cwd, "timestamp": "2026-11-25T07:00:00Z"}}}
	w.add("2026-11-25T07:00:01Z", map[string]any{"type": "session_info", "name": title})
	return w
}

func (w *storyWriter) add(stamp string, row map[string]any) {
	w.serial++
	id := "am-" + string(rune('a'+w.serial/26)) + string(rune('a'+w.serial%26))
	row["id"], row["parentId"], row["timestamp"] = id, w.parent, stamp
	w.rows = append(w.rows, row)
	w.parent = id
}

func (w *storyWriter) message(stamp string, message map[string]any) {
	t, _ := time.Parse(time.RFC3339, stamp)
	message["timestamp"] = t.UnixMilli()
	w.add(stamp, map[string]any{"type": "message", "message": message})
}

func (w *storyWriter) user(stamp, text string) {
	w.message(stamp, map[string]any{"role": "user", "content": text})
}

func (w *storyWriter) say(stamp, text string) {
	w.message(stamp, map[string]any{"role": "assistant", "stopReason": "stop", "content": []any{map[string]any{"type": "text", "text": text}}})
}

func (w *storyWriter) tool(stamp, command, output string) {
	call := "call-" + string(rune('a'+w.serial/26)) + string(rune('a'+w.serial%26))
	w.message(stamp, map[string]any{"role": "assistant", "stopReason": "toolUse", "content": []any{map[string]any{"type": "toolCall", "id": call, "name": "bash", "arguments": map[string]any{"command": command}}}})
	w.message(stamp, map[string]any{"role": "toolResult", "toolCallId": call, "toolName": "bash", "content": []any{map[string]any{"type": "text", "text": output}}})
}
