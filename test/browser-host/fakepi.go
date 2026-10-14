//go:build linux

package main

import (
	"bufio"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// isFakePi reports whether this process was started by the real conversation
// controller as its Pi child. The controller runs <node> <cli.js> --mode rpc
// --session-id <id>; the lab host names its own binary as node.
func isFakePi(args []string) bool {
	return len(args) >= 4 && args[2] == "--mode" && args[3] == "rpc"
}

// runFakePi speaks enough of Pi's RPC protocol for the controller and writes
// a native v3 session file the way Pi does. It never contacts a model.
// Prompts steer it: "hidas" slows every step, "hylkää" is rejected,
// "kaadu" exits mid-turn, "pitkä" answers at length. The lab's pi-deltas
// scenario adds a delayed native RPC text/tool stream without a model.
func runFakePi(args []string) {
	id, existing := "", ""
	for i := 0; i+1 < len(args); i++ {
		if args[i] == "--session-id" {
			id = args[i+1]
		}
		if args[i] == "--session" {
			existing = args[i+1]
			id = strings.TrimSuffix(filepath.Base(existing), ".jsonl")
			if cut := strings.LastIndex(id, "_"); cut >= 0 {
				id = id[cut+1:]
			}
		}
	}
	cwd, err := os.Getwd()
	if err != nil || id == "" {
		os.Exit(2)
	}
	home := os.Getenv("HOME")
	dir := filepath.Join(home, ".pi", "agent", "sessions", "--"+strings.ReplaceAll(strings.Trim(cwd, "/"), "/", "-")+"--")
	path := filepath.Join(dir, time.Now().UTC().Format("2006-01-02T15-04-05-000Z")+"_"+id+".jsonl")
	if existing != "" {
		path = existing
	}
	var out sync.Mutex
	emit := func(v any) {
		b, _ := json.Marshal(v)
		out.Lock()
		defer out.Unlock()
		os.Stdout.Write(append(b, '\n'))
	}
	s := &fakeSession{id: id, cwd: cwd, dir: dir, path: path, started: existing != ""}
	if existing != "" {
		// Continue the same native chain; never overwrite an existing session.
		data, err := os.ReadFile(existing)
		if err != nil {
			os.Exit(2)
		}
		for _, line := range strings.Split(string(data), "\n") {
			var entry struct {
				ID string `json:"id"`
			}
			if json.Unmarshal([]byte(line), &entry) == nil && entry.ID != "" {
				s.parent = entry.ID
			}
		}
	}
	busy := false
	steering, followUp := []string{}, []string{}
	var mu sync.Mutex
	queueUpdate := func() { emit(map[string]any{"type": "queue_update", "steering": steering, "followUp": followUp}) }
	in := bufio.NewScanner(os.Stdin)
	in.Buffer(make([]byte, 4096), 1<<20)
	for in.Scan() {
		var req struct{ ID, Type, Message, Name string }
		if json.Unmarshal(in.Bytes(), &req) != nil {
			continue
		}
		switch req.Type {
		case "get_state":
			emit(map[string]any{"type": "response", "id": req.ID, "command": "get_state", "success": true})
		case "set_session_name":
			if req.Name != "" {
				s.append(map[string]any{"type": "session_info", "name": req.Name})
			}
			emit(map[string]any{"type": "response", "id": req.ID, "command": req.Type, "success": req.Name != ""})
		case "get_commands":
			mode, _ := os.ReadFile(filepath.Join(filepath.Dir(home), "fakepi-scenario"))
			commands := []any{}
			if strings.TrimSpace(string(mode)) == "pi-recap" {
				commands = append(commands, map[string]any{"name": "oh-conversation-recap", "source": "extension"})
			}
			emit(map[string]any{"type": "response", "id": req.ID, "command": "get_commands", "success": true, "data": map[string]any{"commands": commands}})
		case "steer", "follow_up":
			mu.Lock()
			reject := req.Message == "" || strings.Contains(req.Message, "hylkää")
			if !reject {
				if req.Type == "steer" {
					steering = append(steering, req.Message)
				} else {
					followUp = append(followUp, req.Message)
				}
				queueUpdate()
			}
			mu.Unlock()
			emit(map[string]any{"type": "response", "id": req.ID, "command": req.Type, "success": !reject})
		case "clear_queue":
			mu.Lock()
			removedSteering, removedFollowUp := steering, followUp
			steering, followUp = []string{}, []string{}
			queueUpdate()
			mu.Unlock()
			emit(map[string]any{"type": "response", "id": req.ID, "command": "clear_queue", "success": true, "data": map[string]any{"steering": removedSteering, "followUp": removedFollowUp}})
		case "prompt":
			if req.Message == "/oh-conversation-recap" || req.Message == "/oh-conversation-recap automatic" {
				mode, _ := os.ReadFile(filepath.Join(filepath.Dir(home), "fakepi-scenario"))
				if strings.TrimSpace(string(mode)) == "pi-recap" && s.lastMessage != "" && s.lastRecap != s.lastMessage {
					trigger := "manual"
					if strings.HasSuffix(req.Message, " automatic") {
						trigger = "automatic"
					}
					s.append(map[string]any{"type": "custom", "customType": "conversation-recap", "data": map[string]any{"recap": "Synteettinen työtila tutkittiin ja vastaus valmistui.", "next": "Tarkista seuraava kysymys", "through": s.lastMessage, "generatedAt": time.Now().UnixMilli(), "trigger": trigger}})
				}
				emit(map[string]any{"type": "response", "id": req.ID, "command": "prompt", "success": true})
				continue
			}
			mu.Lock()
			reject := busy || strings.Contains(req.Message, "hylkää")
			if !reject {
				busy = true
			}
			mu.Unlock()
			emit(map[string]any{"type": "response", "id": req.ID, "command": "prompt", "success": !reject})
			if reject {
				continue
			}
			go func(message string) {
				s.turn(message, emit)
				// Deliver steering at a turn boundary, then follow-ups after completion.
				// Keep the synthetic work slow enough to exercise queue clear races.
				for {
					mu.Lock()
					var next string
					if len(steering) > 0 {
						next = steering[0]
						steering = steering[1:]
					} else if len(followUp) > 0 {
						next = followUp[0]
						followUp = followUp[1:]
					}
					if next != "" {
						queueUpdate()
					} else {
						busy = false
					}
					mu.Unlock()
					if next == "" {
						emit(map[string]any{"type": "agent_settled"})
						break
					}
					s.turn(next, emit)
				}
			}(req.Message)
		}
	}
}

type fakeSession struct {
	id, cwd, dir, path             string
	parent, lastMessage, lastRecap string
	started                        bool
}

func (s *fakeSession) append(v map[string]any) {
	if !s.started {
		_ = os.MkdirAll(s.dir, 0700)
		header := map[string]any{"type": "session", "version": 3, "id": s.id, "timestamp": time.Now().UTC().Format(time.RFC3339Nano), "cwd": s.cwd}
		b, _ := json.Marshal(header)
		_ = os.WriteFile(s.path, append(b, '\n'), 0600)
		s.started = true
	}
	var raw [4]byte
	_, _ = rand.Read(raw[:])
	entry := hex.EncodeToString(raw[:])
	v["id"] = entry
	if s.parent == "" {
		v["parentId"] = nil
	} else {
		v["parentId"] = s.parent
	}
	v["timestamp"] = time.Now().UTC().Format(time.RFC3339Nano)
	s.parent = entry
	if v["type"] == "message" {
		if m, ok := v["message"].(map[string]any); ok && (m["role"] == "user" || m["role"] == "assistant") {
			s.lastMessage = entry
		}
	}
	if v["type"] == "custom" && v["customType"] == "conversation-recap" {
		s.lastRecap = s.lastMessage
	}
	b, _ := json.Marshal(v)
	f, err := os.OpenFile(s.path, os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		return
	}
	defer f.Close()
	_, _ = f.Write(append(b, '\n'))
}

func message(role string, content any, extra map[string]any) map[string]any {
	m := map[string]any{"role": role, "content": content, "timestamp": time.Now().UnixMilli()}
	for k, v := range extra {
		m[k] = v
	}
	return map[string]any{"type": "message", "message": m}
}

func (s *fakeSession) turn(prompt string, emit func(any)) {
	// This child is only used by the synthetic browser host. Keep distinct
	// native phases observable without making every UI journey wait for a model.
	step := 200 * time.Millisecond
	if strings.Contains(prompt, "hidas") {
		step = 2 * time.Second
	}
	emit(map[string]any{"type": "agent_start"})
	// The controller passes a deliberately minimal environment to Pi. The lab
	// host writes this switch in its disposable root, not the real user's home.
	mode, _ := os.ReadFile(filepath.Join(filepath.Dir(os.Getenv("HOME")), "fakepi-scenario"))
	visualHold := strings.TrimSpace(string(mode)) == "pi-visual-hold"
	typed := strings.TrimSpace(string(mode)) == "pi-typed"
	stream := strings.TrimSpace(string(mode)) == "pi-deltas" || typed || visualHold
	command := "ls"
	if strings.Contains(prompt, "monirivinen komento") {
		command = "cat <<'EOF'\nensimmäinen\ntoinen\nEOF"
	}
	callID := "call_1"
	if stream {
		var raw [4]byte
		_, _ = rand.Read(raw[:])
		callID = "call_" + hex.EncodeToString(raw[:])
	}
	delta := func(text string) {
		emit(map[string]any{"type": "message_update", "message": map[string]any{"role": "assistant"}, "assistantMessageEvent": map[string]any{"type": "text_delta", "contentIndex": 0, "delta": text}})
	}
	s.append(message("user", []map[string]any{{"type": "text", "text": prompt}}, nil))
	emit(map[string]any{"type": "message_end", "message": map[string]any{"role": "user"}})
	time.Sleep(step)
	if typed {
		emit(map[string]any{"type": "message_update", "assistantMessageEvent": map[string]any{"type": "thinking_delta", "contentIndex": 1, "delta": "Synteettinen pohdinta", "partial": map[string]any{"content": []map[string]any{{"type": "text"}, {"type": "thinking", "redacted": false}}}}})
		emit(map[string]any{"type": "message_update", "assistantMessageEvent": map[string]any{"type": "toolcall_delta", "contentIndex": 2, "delta": "{\"command\":\"ls\""}})
	}
	if stream {
		delta("Katson ensin, ")
		time.Sleep(step)
		delta("mitä työtilassa on.")
		time.Sleep(step)
	}
	if strings.TrimSpace(string(mode)) == "pi-auth-failure" {
		// Deliberately include a secret-shaped suffix: only the fixed daemon code
		// may reach the private browser status protocol.
		emit(map[string]any{"type": "message_end", "message": map[string]any{"role": "assistant", "stopReason": "error", "errorMessage": "401 Unauthorized token=synthetic-secret"}})
		emit(map[string]any{"type": "agent_end"})
		return
	}
	start := map[string]any{"type": "tool_execution_start", "toolName": "bash", "toolCallId": callID}
	if stream {
		start["args"] = map[string]any{"command": command}
	}
	emit(start)
	content := []map[string]any{{"type": "text", "text": "Katson ensin, mitä työtilassa on."}}
	if typed {
		content = append(content, map[string]any{"type": "thinking", "thinking": "Synteettinen pohdinta"})
	}
	content = append(content, map[string]any{"type": "toolCall", "id": callID, "name": "bash", "arguments": map[string]any{"command": command}})
	s.append(message("assistant", content, map[string]any{"provider": "synthetic", "model": "fake-pi", "stopReason": "toolUse"}))
	if visualHold {
		// Hold before the tool result so the lab can capture the live row.
		_ = os.WriteFile(filepath.Join(filepath.Dir(os.Getenv("HOME")), "fakepi-visual-phase"), []byte("tool-start"), 0600)
		deadline := time.Now().Add(90 * time.Second)
		for time.Now().Before(deadline) {
			current, _ := os.ReadFile(filepath.Join(filepath.Dir(os.Getenv("HOME")), "fakepi-scenario"))
			if strings.TrimSpace(string(current)) != "pi-visual-hold" {
				break
			}
			time.Sleep(50 * time.Millisecond)
		}
	} else {
		time.Sleep(step)
	}
	if strings.Contains(prompt, "kaadu") {
		os.Exit(3)
	}
	listing := "README.md\nsrc\n"
	if entries, err := os.ReadDir("."); err == nil {
		names := []string{}
		for _, e := range entries {
			names = append(names, e.Name())
		}
		listing = strings.Join(names, "\n")
	}
	if strings.Contains(prompt, "pitkä tuloste") {
		lines := make([]string, 53)
		for i := range lines {
			lines[i] = fmt.Sprintf("rivi %d", i+1)
		}
		listing = strings.Join(lines, "\n")
	}
	failed := strings.Contains(prompt, "epäonnistu")
	if failed {
		listing = "synteettinen komento epäonnistui"
	}
	if stream {
		emit(map[string]any{"type": "tool_execution_update", "toolCallId": callID, "toolName": "bash", "args": map[string]any{"command": command}, "partialResult": map[string]any{"content": []map[string]any{{"type": "text", "text": listing}}}})
		time.Sleep(step)
	}
	s.append(message("toolResult", []map[string]any{{"type": "text", "text": listing}}, map[string]any{"toolCallId": callID, "toolName": "bash", "isError": failed}))
	end := map[string]any{"type": "tool_execution_end", "toolName": "bash", "toolCallId": callID}
	if stream {
		end["result"] = map[string]any{"content": []map[string]any{{"type": "text", "text": listing}}}
		end["isError"] = failed
	}
	emit(end)
	if strings.Contains(prompt, "näytä kortit") {
		for _, call := range []struct {
			name, id string
			args     map[string]any
			result   string
		}{
			{"read", "file-read", map[string]any{"path": "example.ts"}, "const greeting = 'hei';\nconst count = 2;"},
			{"write", "file-write", map[string]any{"path": "new.ts", "content": "export const count = 3;\n"}, "Wrote 1 line"},
			{"edit", "file-edit", map[string]any{"path": "example.ts", "edits": []map[string]any{{"oldText": "const count = 2;", "newText": "const count = 3;"}}}, "Successfully replaced 1 block(s) in example.ts."},
		} {
			s.append(message("assistant", []map[string]any{{"type": "toolCall", "name": call.name, "id": call.id, "arguments": call.args}}, nil))
			s.append(message("toolResult", []map[string]any{{"type": "text", "text": call.result}}, map[string]any{"toolCallId": call.id, "toolName": call.name}))
		}
	}
	if strings.Contains(prompt, "virhekortti") {
		s.append(message("assistant", []map[string]any{{"type": "toolCall", "name": "read", "id": "failed-read", "arguments": map[string]any{"path": "missing.ts"}}}, nil))
		s.append(message("toolResult", []map[string]any{{"type": "text", "text": "ENOENT: missing.ts"}}, map[string]any{"toolCallId": "failed-read", "toolName": "read", "isError": true}))
	}
	if strings.Contains(prompt, "työkalut") {
		s.append(message("assistant", []map[string]any{{"type": "toolCall", "name": "edit", "id": "call_2"}}, nil))
		s.append(message("toolResult", []map[string]any{{"type": "text", "text": "--- a/example.txt\n+++ b/example.txt\n@@ -1 +1 @@\n-old\n+new"}}, map[string]any{"toolCallId": "call_2", "toolName": "edit"}))
		s.append(message("toolResult", []map[string]any{{"type": "text", "text": strings.Repeat("synthetic output\n", 5000)}}, map[string]any{"toolName": "future_tool"}))
		s.append(message("assistant", []map[string]any{{"type": "futureQuestion", "prompt": "Mitä seuraavaksi?"}}, nil))
		s.append(map[string]any{"type": "futureEntry", "payload": "synthetic unknown event"})
	}
	time.Sleep(step)
	answer := fmt.Sprintf("Selvä. Kysyit: %q.\n\nTyötilassa on %d kohdetta. Tämä vastaus on synteettisen Pi-korvikkeen tuottama, eikä mitään mallia kutsuttu.", prompt, strings.Count(listing, "\n")+1)
	if strings.Contains(prompt, "pitkä") {
		answer += "\n\n## Yhteenveto\n\n- Ensimmäinen kohta\n- Toinen kohta\n\n```go\nfunc main() {\n\tfmt.Println(\"hei\")\n}\n```\n\n" + strings.Repeat("Pitkä kappale synteettistä tekstiä. ", 80)
	}
	if stream {
		middle := len(answer) / 2
		delta(answer[:middle])
		time.Sleep(step)
		delta(answer[middle:])
		time.Sleep(step)
	}
	s.append(message("assistant", []map[string]any{{"type": "text", "text": answer}}, map[string]any{"provider": "synthetic", "model": "fake-pi", "stopReason": "stop"}))
	emit(map[string]any{"type": "message_end", "message": map[string]any{"role": "assistant"}})
	emit(map[string]any{"type": "agent_end"})
}
