//go:build linux

package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// fakeBridge is the part of the daemon's Pi companion (process-extension.mjs)
// that the multiplayer journeys need (ADR 0038): it listens on the bridge
// socket the daemon names in OH_PROCESS_SOCKET and writes participant
// messages, release lines and membership lines as the companion does, as
// displayed custom messages with the companion's details. A participant's
// text-only run answers in text; a released run makes one synthetic call,
// asking the owner first when they approve each call. It also writes an
// offer's notice as the companion's native writer does. Every other op gets
// no reply, as an unavailable bridge, so cases that never use it are
// unchanged.
type fakeBridge struct {
	s       *fakeSession
	emit    func(any)
	start   func(func(run chan struct{})) bool
	idle    func() bool
	mu      sync.Mutex
	written map[string]bool
	// procs are the background processes the fake agent started, as the
	// companion's list, stop and output ops report them.
	procs []*fakeProc
}

type fakeProc struct {
	id, name, command string
	start             int64
	end               *int64
	status            string
	lastOutput        int64
}

// multiplayerOn reads the person's own experimental switches, as the daemon
// does. Only with multiplayer, or with reply-to-message (whose offer replies
// need native offer notices), does the stand-in listen: every other case
// keeps the unavailable bridge it had before, where a dial fails at once.
func multiplayerOn(home string) bool {
	b, err := os.ReadFile(filepath.Join(home, ".config", "open-habitat", "preferences.json"))
	if err != nil {
		return false
	}
	var p struct {
		Experimental map[string]bool `json:"experimental"`
	}
	return json.Unmarshal(b, &p) == nil && (p.Experimental["multiplayer"] || p.Experimental["reply-to-message"])
}

func (b *fakeBridge) serve(path string) {
	if path == "" || !multiplayerOn(os.Getenv("HOME")) {
		return
	}
	_ = os.Remove(path)
	ln, err := net.Listen("unix", path)
	if err != nil {
		return
	}
	_ = os.Chmod(path, 0600)
	for {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		go b.handle(conn)
	}
}

func (b *fakeBridge) handle(conn net.Conn) {
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(10 * time.Second))
	scanner := bufio.NewScanner(conn)
	scanner.Buffer(make([]byte, 4096), 256*1024)
	if !scanner.Scan() {
		return
	}
	var q struct {
		Op      string         `json:"op"`
		Message map[string]any `json:"message"`
		Line    map[string]any `json:"line"`
		ID      string         `json:"id"`
		Token   string         `json:"token"`
		Notice  map[string]any `json:"notice"`
	}
	if json.Unmarshal(scanner.Bytes(), &q) != nil {
		return
	}
	var data map[string]any
	switch q.Op {
	case "list":
		data = b.list()
	case "stop", "output":
		var ok bool
		if data, ok = b.control(q.Op, q.ID, q.Token); !ok {
			reply, _ := json.Marshal(map[string]any{"ok": false, "error": "stale_process"})
			_, _ = conn.Write(append(reply, '\n'))
			return
		}
	case "grant":
		data = map[string]any{"told": true}
	case "conversation_line":
		data = b.memberLine(q.Line)
	case "participant_message":
		data = b.participant(q.Message)
	case "release":
		data = b.release(q.Line)
	case "notice":
		// The companion's native notice writer: one custom entry on the
		// branch, outside the model's context.
		if q.Notice == nil {
			return
		}
		b.s.append(map[string]any{"type": "custom", "customType": "oh-agent-notice", "data": q.Notice})
		data = map[string]any{"written": true}
	default:
		return // as an unavailable bridge
	}
	reply, _ := json.Marshal(map[string]any{"ok": true, "data": data})
	_, _ = conn.Write(append(reply, '\n'))
}

// once reports whether id is new, so a retry after a lost reply is
// answered as already delivered, as the companion's branch check does.
func (b *fakeBridge) once(id string) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.written[id] {
		return false
	}
	b.written[id] = true
	return true
}

func bridgeText(v map[string]any, key string) string {
	s, _ := v[key].(string)
	return s
}

func (b *fakeBridge) custom(content string, details map[string]any) {
	details["schema_version"] = 1
	b.s.append(map[string]any{"type": "custom_message", "customType": details["customType"], "display": true, "content": content, "details": stripType(details)})
}

func stripType(d map[string]any) map[string]any {
	out := map[string]any{}
	for k, v := range d {
		if k != "customType" {
			out[k] = v
		}
	}
	return out
}

func (b *fakeBridge) memberLine(l map[string]any) map[string]any {
	if !b.idle() {
		return map[string]any{"written": false, "reason": "busy"}
	}
	id := bridgeText(l, "line_id")
	if !b.once(id) {
		return map[string]any{"written": true}
	}
	details := map[string]any{
		"customType": "oh-conversation-line", "line_id": id, "kind": "membership", "event": l["event"],
		"subject": l["subject"], "display_name": l["display_name"], "at": l["at"],
	}
	if bridgeText(l, "kind") == "process_stopped" {
		delete(details, "event")
		details["kind"], details["command"] = "process_stopped", l["command"]
	}
	b.custom(fmt.Sprintf("[Open Habitat] %q: %s%s.", bridgeText(l, "display_name"), bridgeText(l, "event"), bridgeText(l, "command")), details)
	return map[string]any{"written": true}
}

// list answers the companion's list op from the processes started so far.
// The preview keeps printing; the watcher went quiet.
func (b *fakeBridge) list() map[string]any {
	b.mu.Lock()
	defer b.mu.Unlock()
	records := []map[string]any{}
	now := time.Now().UnixMilli()
	for _, p := range b.procs {
		last := p.lastOutput
		if p.status == "running" && p.name == "preview" {
			last = now - 2000
		}
		records = append(records, map[string]any{
			"id": p.id, "name": p.name, "command": p.command, "startTime": p.start, "endTime": p.end,
			"status": p.status, "exitCode": nil, "signal": nil, "endReason": nil, "wakes_agent": false,
			"run_ids": []string{}, "last_output_at": last,
		})
	}
	return map[string]any{"records": records, "protocol": 1, "foreground_run_ids": []string{}}
}

func (b *fakeBridge) control(op, id, token string) (map[string]any, bool) {
	b.mu.Lock()
	defer b.mu.Unlock()
	for _, p := range b.procs {
		if p.id != id || token != fmt.Sprintf("pt_%d", p.start) {
			continue
		}
		if op == "output" {
			return map[string]any{"lines": []map[string]any{{"stream": "stdout", "text": "ready on port 4173"}}, "omitted_before": nil, "retention_restarted": nil}, true
		}
		if p.status != "running" {
			return map[string]any{"result": "not_found"}, true
		}
		end := time.Now().UnixMilli()
		p.status, p.end = "killed", &end
		return map[string]any{"result": "killed"}, true
	}
	return nil, false
}

// startProcesses makes the agent start two background processes with the
// process tool, as a full-rights participant's "esikatselu" asks: a preview
// that keeps printing and a test watcher that has gone quiet.
func (b *fakeBridge) startProcesses(run chan struct{}) {
	for i, p := range []struct{ name, command string }{{"preview", "npm run preview"}, {"tests", "npm test -- --watch"}} {
		callID := fmt.Sprintf("call_mp_proc_%d_%d", i, time.Now().UnixNano())
		args := map[string]any{"action": "start", "name": p.name, "command": p.command}
		b.s.append(message("assistant", []map[string]any{{"type": "toolCall", "id": callID, "name": "process", "arguments": args}}, map[string]any{"provider": "synthetic", "model": "fake-pi", "stopReason": "toolUse"}))
		b.emit(map[string]any{"type": "message_end", "message": map[string]any{"role": "assistant", "stopReason": "toolUse"}})
		start := time.Now().UnixMilli()
		b.mu.Lock()
		proc := &fakeProc{id: fmt.Sprintf("proc_%04x", (start+int64(i))&0xffff), name: p.name, command: p.command, start: start, status: "running", lastOutput: start}
		b.procs = append(b.procs, proc)
		b.mu.Unlock()
		raw, _ := json.Marshal(map[string]any{"action": "start", "process": map[string]any{"id": proc.id, "name": p.name, "command": p.command, "startTime": start}})
		b.emit(map[string]any{"type": "tool_execution_start", "toolName": "process", "toolCallId": callID, "args": args})
		b.s.append(message("toolResult", []map[string]any{{"type": "text", "text": string(raw)}}, map[string]any{"toolCallId": callID, "toolName": "process", "isError": false}))
		b.emit(map[string]any{"type": "tool_execution_end", "toolName": "process", "toolCallId": callID, "isError": false, "result": map[string]any{"content": []map[string]any{{"type": "text", "text": string(raw)}}}})
		time.Sleep(5 * time.Millisecond)
	}
	b.s.reply(b.emit, "Käynnistin esikatselun ja testien vahtitilan.")
}

func (b *fakeBridge) participant(m map[string]any) map[string]any {
	id := bridgeText(m, "message_id")
	if !b.idle() {
		return map[string]any{"delivered": false, "reason": "busy"}
	}
	if !b.once(id) {
		return map[string]any{"delivered": true, "reason": "already_delivered"}
	}
	role := bridgeText(m, "role")
	words := bridgeText(m, "text")
	started := b.start(func(run chan struct{}) {
		rule := "You have no tools on this turn."
		if role == "full_rights" {
			rule = "The owner gave this person full rights."
		}
		b.emit(map[string]any{"type": "agent_start"})
		b.custom(fmt.Sprintf("[Open Habitat] %q, a participant in the owner's conversation, writes (message %s).\n%s\n\n%s", bridgeText(m, "display_name"), id, rule, words), map[string]any{
			"customType": "oh-participant-message", "message_id": id, "subject": m["subject"], "display_name": m["display_name"],
			"role": role, "generation": m["generation"], "at": m["at"],
		})
		if role == "full_rights" && strings.Contains(words, "esikatselu") {
			b.startProcesses(run)
			return
		}
		if role == "full_rights" {
			b.s.toolCall(run, b.emit, "", "", "Ajoin komennon ls osallistujan pyynnöstä.")
			return
		}
		if b.s.pause(run, 300*time.Millisecond) {
			b.s.stopReply(b.emit, "Vastaan vain")
			return
		}
		b.s.reply(b.emit, "Vastaan vain tekstillä, koska tällä vuorolla minulla ei ole työkaluja. Ajaisin komennon `ls` ja kertoisin, mitä hakemistossa on. Omistaja voi antaa minun jatkaa.")
	})
	if !started {
		return map[string]any{"delivered": false, "reason": "busy"}
	}
	return map[string]any{"delivered": true}
}

func (b *fakeBridge) release(l map[string]any) map[string]any {
	id := bridgeText(l, "line_id")
	if !b.idle() {
		return map[string]any{"delivered": false, "reason": "busy"}
	}
	if !b.once(id) {
		return map[string]any{"delivered": true, "reason": "already_delivered"}
	}
	kind, mode, request := bridgeText(l, "kind"), bridgeText(l, "mode"), bridgeText(l, "request")
	details := map[string]any{"customType": "oh-conversation-line", "line_id": id, "kind": kind, "request": request, "subject": l["subject"], "display_name": l["display_name"], "at": l["at"]}
	if mode != "" {
		details["mode"] = mode
	}
	content := fmt.Sprintf("[Open Habitat] The owner let you continue %q's request (message %s).", bridgeText(l, "display_name"), request)
	if kind == "declined" {
		b.custom(fmt.Sprintf("[Open Habitat] The owner declined %q's request (message %s). Do not act on it.", bridgeText(l, "display_name"), request), details)
		return map[string]any{"delivered": true}
	}
	started := b.start(func(run chan struct{}) {
		b.emit(map[string]any{"type": "agent_start"})
		b.custom(content, details)
		ask := ""
		if mode == "approve_each" {
			ask = request
		}
		b.s.toolCall(run, b.emit, ask, "", "Jatkoin pyyntöä.")
	})
	if !started {
		return map[string]any{"delivered": false, "reason": "busy"}
	}
	return map[string]any{"delivered": true}
}

func (s *fakeSession) reply(emit func(any), text string) {
	emit(map[string]any{"type": "message_update", "message": map[string]any{"role": "assistant"}, "assistantMessageEvent": map[string]any{"type": "text_delta", "contentIndex": 0, "delta": text}})
	s.append(message("assistant", []map[string]any{{"type": "text", "text": text}}, map[string]any{"provider": "synthetic", "model": "fake-pi", "stopReason": "stop"}))
	emit(map[string]any{"type": "message_end", "message": map[string]any{"role": "assistant", "stopReason": "stop"}})
	emit(map[string]any{"type": "agent_end"})
}

func (s *fakeSession) stopReply(emit func(any), text string) {
	s.append(message("assistant", []map[string]any{{"type": "text", "text": text}}, map[string]any{"provider": "synthetic", "model": "fake-pi", "stopReason": "aborted", "errorMessage": "Request was aborted"}))
	emit(map[string]any{"type": "message_end", "message": map[string]any{"role": "assistant", "stopReason": "aborted"}})
	emit(map[string]any{"type": "agent_end"})
}

// toolCall makes one synthetic `ls` call and answers. With request set the
// owner approves it first, as the companion's approveCall asks: one select
// whose title carries the call's complete arguments, answered allow, deny or
// allow_all, recorded as an oh-approval entry.
func (s *fakeSession) toolCall(run chan struct{}, emit func(any), request, _ string, done string) {
	callID := fmt.Sprintf("call_mp_%d", time.Now().UnixNano())
	command := "ls -la\nwc -l README.md"
	args := map[string]any{"command": command}
	s.append(message("assistant", []map[string]any{{"type": "toolCall", "id": callID, "name": "bash", "arguments": args}}, map[string]any{"provider": "synthetic", "model": "fake-pi", "stopReason": "toolUse"}))
	emit(map[string]any{"type": "message_end", "message": map[string]any{"role": "assistant", "stopReason": "toolUse"}})
	allowed := true
	if request != "" {
		raw, _ := json.Marshal(args)
		title, _ := json.Marshal(map[string]any{"call_id": callID, "tool": "bash", "arguments": string(raw), "request": request})
		ui := fmt.Sprintf("ui-approval-%d", time.Now().UnixNano())
		emit(map[string]any{"type": "extension_ui_request", "id": ui, "method": "select", "title": "oh-approval:" + string(title), "options": []string{"allow", "deny", "allow_all"}})
		answer := ""
	wait:
		for {
			select {
			case a := <-fakeUIAnswers:
				if a.ID == ui {
					answer = a.Value
					if a.Cancelled {
						answer = ""
					}
					break wait
				}
			case <-run:
				break wait
			}
		}
		recorded := map[string]string{"allow": "allowed", "deny": "denied", "allow_all": "allow_all", "": "cancelled"}[answer]
		if recorded == "" {
			recorded = "cancelled"
		}
		s.append(map[string]any{"type": "custom", "customType": "oh-approval", "data": map[string]any{"call_id": callID, "tool": "bash", "answer": recorded, "request": request}})
		allowed = answer == "allow" || answer == "allow_all"
	}
	result, isError := "README.md\nsrc\n12 README.md", false
	if !allowed {
		result, isError = "The owner did not allow this call, so it was not made.", true
	}
	emit(map[string]any{"type": "tool_execution_start", "toolName": "bash", "toolCallId": callID, "args": args})
	s.append(message("toolResult", []map[string]any{{"type": "text", "text": result}}, map[string]any{"toolCallId": callID, "toolName": "bash", "isError": isError}))
	emit(map[string]any{"type": "tool_execution_end", "toolName": "bash", "toolCallId": callID, "isError": isError, "result": map[string]any{"content": []map[string]any{{"type": "text", "text": result}}}})
	if s.aborted() {
		s.stopReply(emit, "")
		return
	}
	if !allowed {
		done = "En ajanut komentoa, koska omistaja ei sallinut sitä."
	}
	s.reply(emit, strings.TrimSpace(done))
}
