//go:build linux

package main

import (
	"bufio"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// isFakePi reports whether this process was started by the real conversation
// controller as its Pi child. The controller runs <node> <cli.js> --mode rpc
// --session-id <id>; the lab host names its own binary as node.
func isFakePi(args []string) bool {
	for i := 0; i+1 < len(args); i++ {
		if args[i] == "--mode" && args[i+1] == "rpc" {
			return true
		}
	}
	return false
}

// runFakePi speaks enough of Pi's RPC protocol for the controller and writes
// a native v3 session file the way Pi does. It never contacts a model.
// Prompts steer it: "hidas" slows every step, "hylkää" is rejected,
// "kaadu" exits mid-turn, "pitkä" answers at length, "commitoi" commits a
// file in its working directory and "yhdistä" merges its branch into the
// recorded base the way an agent asked to merge would. The lab's pi-deltas
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
	for _, arg := range args {
		if arg == "--no-session" && err == nil {
			runFakeCommandList()
			return
		}
	}
	if err != nil || id == "" {
		os.Exit(2)
	}
	home := os.Getenv("HOME")
	// pi-start-fail: Pi exits before it is ready, as a broken install or
	// extension would. The test switches the scenario off to retry.
	if mode, _ := os.ReadFile(filepath.Join(filepath.Dir(home), "fakepi-scenario")); strings.TrimSpace(string(mode)) == "pi-start-fail" {
		os.Exit(3)
	}
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
	s := &fakeSession{id: id, cwd: cwd, dir: dir, path: path, started: existing != "", provider: "openai-codex"}
	if b, err := os.ReadFile(filepath.Join(home, ".pi", "agent", "settings.json")); err == nil {
		var settings struct {
			DefaultProvider string `json:"defaultProvider"`
			DefaultModel    string `json:"defaultModel"`
			DefaultThinking string `json:"defaultThinkingLevel"`
		}
		if json.Unmarshal(b, &settings) == nil && (settings.DefaultProvider == "openai-codex" || settings.DefaultProvider == "openai" || settings.DefaultProvider == "claude-bridge") && settings.DefaultModel != "" {
			s.model = settings.DefaultModel
			s.provider = settings.DefaultProvider
			s.thinking = settings.DefaultThinking
		}
	}
	for i := 0; i+1 < len(args); i++ {
		if args[i] == "--provider" {
			s.provider = args[i+1]
		}
		if args[i] == "--model" {
			s.model = args[i+1]
		}
		if args[i] == "--thinking" {
			s.thinking = args[i+1]
		}
	}
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
	var bashes fakeBashes
	steering, followUp := []string{}, []string{}
	var mu sync.Mutex
	queueUpdate := func() { emit(map[string]any{"type": "queue_update", "steering": steering, "followUp": followUp}) }
	in := bufio.NewScanner(os.Stdin)
	in.Buffer(make([]byte, 4096), 1<<20)
	for in.Scan() {
		var req struct {
			ID, Type, Message, Name, Provider, ModelId, Level, Command string
			ExcludeFromContext                                         bool
		}
		if json.Unmarshal(in.Bytes(), &req) != nil {
			continue
		}
		switch req.Type {
		case "set_model":
			s.provider = req.Provider
			s.model = req.ModelId
			emit(map[string]any{"type": "response", "id": req.ID, "command": req.Type, "success": true})
		case "set_thinking_level":
			s.thinking = req.Level
			emit(map[string]any{"type": "response", "id": req.ID, "command": req.Type, "success": true})
		case "get_state":
			mode, _ := os.ReadFile(filepath.Join(filepath.Dir(home), "fakepi-scenario"))
			if strings.TrimSpace(string(mode)) == "pi-slow-start" {
				// Native extension initialization can outlast the socket server's
				// five-second default deadline. Delay the RPC, not the HTTP client.
				time.Sleep(6 * time.Second)
			}
			level := s.thinking
			if level == "" {
				level = "off"
			}
			emit(map[string]any{"type": "response", "id": req.ID, "command": "get_state", "success": true, "data": map[string]any{"model": map[string]string{"provider": s.provider, "id": s.model}, "thinkingLevel": level}})
		case "set_session_name":
			if req.Name != "" {
				s.append(map[string]any{"type": "session_info", "name": req.Name})
			}
			emit(map[string]any{"type": "response", "id": req.ID, "command": req.Type, "success": req.Name != ""})
		case "get_commands":
			mode, _ := os.ReadFile(filepath.Join(filepath.Dir(home), "fakepi-scenario"))
			commands := fakeCommands()
			if strings.TrimSpace(string(mode)) == "pi-recap" || strings.TrimSpace(string(mode)) == "pi-recap-unsupported" {
				commands = append(commands, map[string]any{"name": "oh-conversation-recap", "source": "extension"})
			}
			emit(map[string]any{"type": "response", "id": req.ID, "command": "get_commands", "success": true, "data": map[string]any{"commands": commands}})
		case "bash":
			// As Pi's RPC: output streams as bash_execution_update, the reply
			// comes when the command ends, and the result is a bashExecution
			// entry, deferred to the end of a running turn.
			go s.bash(req.ID, req.Command, req.ExcludeFromContext, emit, &bashes, func() bool { mu.Lock(); defer mu.Unlock(); return busy })
		case "abort_bash":
			bashes.abort()
			emit(map[string]any{"type": "response", "id": req.ID, "command": "abort_bash", "success": true})
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
				if (strings.TrimSpace(string(mode)) == "pi-recap" || strings.TrimSpace(string(mode)) == "pi-recap-unsupported") && s.lastMessage != "" && s.lastRecap != s.lastMessage {
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
	appendMu                       sync.Mutex
	id, cwd, dir, path             string
	parent, lastMessage, lastRecap string
	started                        bool
	model, thinking, provider      string
}

func (s *fakeSession) append(v map[string]any) {
	s.appendMu.Lock()
	defer s.appendMu.Unlock()
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
	if !s.started && s.thinking != "" {
		s.append(map[string]any{"type": "thinking_level_change", "thinkingLevel": s.thinking})
	}
	// Source-grounded synthetic expansion for the invocation reader journey.
	// This is Pi's recorded wrapper shape, not a daemon-owned invocation record.
	recordedPrompt := prompt
	if strings.HasPrefix(prompt, "/skill:synthetic-review") {
		command, arguments, _ := strings.Cut(prompt, " ")
		name := strings.TrimPrefix(command, "/skill:")
		body := "# Review interface\n\nArguments: `$ARGUMENTS`\n\nTarkista käyttöliittymän toimivuus ja saavutettavuus.\n\n## Näin etenet\n\n1. Lue muutos.\n2. Kokeile näppäimistöllä.\n3. Kirjaa havainnot.\n\n" + strings.Repeat("Recorded instruction paragraph.\n\n", 2200) + "END OF RECORDED INSTRUCTION"
		if strings.Contains(name, "no-description") {
			body = "# Review\n\n- Read the diff.\n- Test the interface."
		}
		base := filepath.Join(s.cwd, ".pi", "skills", name)
		if len(name) < 200 && !strings.Contains(name, "no-description") {
			os.MkdirAll(base, 0700)
			os.WriteFile(filepath.Join(base, "SKILL.md"), []byte("---\nname: "+name+"\ndescription: Tarkista käyttöliittymän toimivuus ja saavutettavuus.\n---\n\n"+body), 0600)
		}
		recordedPrompt = fmt.Sprintf("<skill name=\"%s\" location=\"%s/SKILL.md\">\nReferences are relative to %s.\n\n%s\n</skill>", name, base, base, body)
		if arguments != "" {
			recordedPrompt += "\n\n" + arguments
		}
	}
	s.append(message("user", []map[string]any{{"type": "text", "text": recordedPrompt}}, nil))
	emit(map[string]any{"type": "message_end", "message": map[string]any{"role": "user"}})
	time.Sleep(step)
	if typed {
		emit(map[string]any{"type": "message_update", "assistantMessageEvent": map[string]any{"type": "thinking_delta", "contentIndex": 1, "delta": "Synteettinen pohdinta", "partial": map[string]any{"content": []map[string]any{{"type": "text"}, {"type": "thinking", "redacted": false}}}}})
		emit(map[string]any{"type": "message_update", "assistantMessageEvent": map[string]any{"type": "toolcall_start", "contentIndex": 2, "toolName": "bash", "id": callID}})
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
	if strings.TrimSpace(string(mode)) == "pi-model-unsupported" || strings.TrimSpace(string(mode)) == "pi-recap-unsupported" {
		emit(map[string]any{"type": "message_end", "message": map[string]any{"role": "assistant", "stopReason": "error", "errorMessage": "The model gpt-example is not supported with this ChatGPT account secret=synthetic-secret"}})
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
	if strings.Contains(prompt, "agent path probe") {
		// The fake Pi crosses the same child-exec boundary as a native tool call.
		// Its answer is visible through the real browser conversation route.
		out, err := exec.Command("agent-probe").Output()
		if err != nil {
			listing = "agent-probe unavailable"
		} else {
			listing = "agent-probe: " + strings.TrimSpace(string(out))
		}
	} else if entries, err := os.ReadDir("."); err == nil {
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
		listing = "synteettinen komento epäonnistui\n\nCommand exited with code 2"
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
	if strings.Contains(prompt, "taustaprosessi") {
		// A native pi-processes start result; the process itself does not exist,
		// so a daemon restart leaves exactly the branch evidence a real one would.
		process := map[string]any{"id": "proc_c0de", "name": "kehityspalvelin", "command": "npm run dev", "startTime": time.Now().UnixMilli(), "status": "running"}
		s.append(message("assistant", []map[string]any{{"type": "toolCall", "name": "process", "id": "process-start", "arguments": map[string]any{"action": "start", "name": "kehityspalvelin", "command": "npm run dev"}}}, nil))
		s.append(message("toolResult", []map[string]any{{"type": "text", "text": "Started process kehityspalvelin (proc_c0de)."}}, map[string]any{"toolCallId": "process-start", "toolName": "process", "details": map[string]any{"action": "start", "process": process, "notify": map[string]any{"onSuccess": "turn", "onFailure": "turn", "onKilled": "context"}}}))
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
	if note := fakeGitAction(prompt, s.cwd); note != "" {
		answer += "\n\n" + note
	}
	if strings.Contains(prompt, "tiedosto") {
		// A workspace file link for the editor (cmd/main.go exists in the
		// editor fixture's git-project); the second name does not exist.
		answer += "\n\nMuutos on kohdassa `cmd/main.go:3-4`. Vanha nimi oli `cmd/old.go`."
	}
	if strings.Contains(prompt, "pitkä") {
		answer += "\n\n## Yhteenveto\n\n- Ensimmäinen kohta\n- Toinen kohta\n\n```go\nfunc main() {\n\tfmt.Println(\"hei\")\n}\n```\n\n" + strings.Repeat("Pitkä kappale synteettistä tekstiä. ", 80)
	}
	if stream && strings.Contains(prompt, "pitkä virta") {
		// A model streams small deltas for many seconds (a long answer or a
		// spinoff brief), well beyond the daemon's 50 ms coalescing window.
		delta(answer)
		for n := 0; n < 200; n++ {
			word := fmt.Sprintf("sana%d ", n)
			answer += word
			delta(word)
			time.Sleep(60 * time.Millisecond)
		}
	} else if stream {
		middle := len(answer) / 2
		delta(answer[:middle])
		time.Sleep(step)
		delta(answer[middle:])
		time.Sleep(step)
	}
	model, provider := "fake-pi", "synthetic"
	if s.model != "" {
		model, provider = s.model, s.provider
	}
	s.append(message("assistant", []map[string]any{{"type": "text", "text": answer}}, map[string]any{"provider": provider, "model": model, "stopReason": "stop"}))
	emit(map[string]any{"type": "message_end", "message": map[string]any{"role": "assistant"}})
	emit(map[string]any{"type": "agent_end"})
}

// fakeGitAction runs the native Git an agent would run when asked to commit
// or to merge a worktree's branch into its base, so the browser can show
// what Git then says. It reports what happened in one line.
func fakeGitAction(prompt, cwd string) string {
	git := func(dir string, args ...string) (string, error) {
		cmd := exec.Command("/usr/bin/git", append([]string{"-c", "user.name=Synthetic Pi", "-c", "user.email=pi@example.invalid"}, args...)...)
		cmd.Dir = dir
		cmd.Env = []string{"PATH=/usr/bin:/bin", "HOME=" + os.Getenv("HOME"), "GIT_CONFIG_NOSYSTEM=1"}
		out, err := cmd.CombinedOutput()
		return strings.TrimSpace(string(out)), err
	}
	notes := []string{}
	if strings.Contains(prompt, "commitoi") {
		file := filepath.Join(cwd, "worktree-agentti.md")
		_ = os.WriteFile(file, []byte("Synteettisen agentin muutos.\n"), 0600)
		if _, err := git(cwd, "add", "worktree-agentti.md"); err != nil {
			return "Commit epäonnistui."
		}
		if _, err := git(cwd, "commit", "-qm", "Synteettinen agentin muutos"); err != nil {
			return "Commit epäonnistui."
		}
		notes = append(notes, "Commitoin muutoksen.")
	}
	if strings.Contains(prompt, "yhdistä") {
		branch, err := git(cwd, "symbolic-ref", "--short", "HEAD")
		if err != nil {
			return "Haaraa ei löytynyt."
		}
		base, err := git(cwd, "config", "branch."+branch+".workmux-base")
		if err != nil {
			return "Pohjahaaraa ei ole tallennettu."
		}
		common, err := git(cwd, "rev-parse", "--path-format=absolute", "--git-common-dir")
		if err != nil {
			return "Pääkopiota ei löytynyt."
		}
		main := filepath.Dir(common)
		if current, _ := git(main, "symbolic-ref", "--short", "HEAD"); current != base {
			return "Pääkopiossa ei ole pohjahaaraa auki."
		}
		if _, err := git(main, "merge", "--ff-only", "-q", branch); err != nil {
			return "Yhdistäminen epäonnistui."
		}
		notes = append(notes, fmt.Sprintf("Yhdistin haaran %s haaraan %s.", branch, base))
	}
	return strings.Join(notes, " ")
}

// fakeCommands is a synthetic `get_commands` list in Pi 1.3's shape: two
// skills, two prompt templates and Pi's two built-in extension commands that
// open terminal dialogs.
func fakeCommands() []any {
	command := func(name, description, source, origin, scope string) map[string]any {
		path := "/synthetic/" + name
		if name == "skill:pytest-debug" {
			cwd, _ := os.Getwd()
			path = filepath.Join(cwd, ".pi", "skills", "pytest-debug", "SKILL.md")
		}
		return map[string]any{"name": name, "description": description, "source": source, "sourceInfo": map[string]any{"path": path, "source": origin, "scope": scope, "origin": "top-level"}}
	}
	return []any{
		command("skill:git-commit", "Stage and commit working-tree changes as one or more well-formed commits.", "skill", "auto", "user"),
		command("skill:pytest-debug", "Find why a pytest test fails and fix the smallest cause first.", "skill", "auto", "project"),
		command("review", "Review the working-tree diff before committing", "prompt", "auto", "user"),
		command("fix-tests", "Fix failing tests", "prompt", "auto", "project"),
		command("mcp", "Manage MCP servers", "extension", "builtin", "user"),
		command("llama", "Manage llama.cpp router models", "extension", "builtin", "user"),
	}
}

// runFakeCommandList is `pi --mode rpc --no-session`: it answers
// get_commands and writes no session. The lab's "pi-slow-list" scenario
// delays the answer so the composer's loading row can be seen.
func runFakeCommandList() {
	mode, _ := os.ReadFile(filepath.Join(filepath.Dir(os.Getenv("HOME")), "fakepi-scenario"))
	in := bufio.NewScanner(os.Stdin)
	for in.Scan() {
		var req struct{ ID, Type string }
		if json.Unmarshal(in.Bytes(), &req) != nil || req.Type != "get_commands" {
			continue
		}
		if strings.TrimSpace(string(mode)) == "pi-slow-list" {
			time.Sleep(1500 * time.Millisecond)
		}
		b, _ := json.Marshal(map[string]any{"type": "response", "id": req.ID, "command": "get_commands", "success": true, "data": map[string]any{"commands": fakeCommands()}})
		os.Stdout.Write(append(b, '\n'))
	}
}

// fakeBashes holds the cancel functions of running synthetic commands;
// abort_bash cancels all of them, as Pi's does.
type fakeBashes struct {
	mu      sync.Mutex
	cancels []chan struct{}
}

func (b *fakeBashes) add() chan struct{} {
	b.mu.Lock()
	defer b.mu.Unlock()
	c := make(chan struct{})
	b.cancels = append(b.cancels, c)
	return c
}

func (b *fakeBashes) abort() {
	b.mu.Lock()
	defer b.mu.Unlock()
	for _, c := range b.cancels {
		close(c)
	}
	b.cancels = nil
}

func (b *fakeBashes) done(c chan struct{}) {
	b.mu.Lock()
	defer b.mu.Unlock()
	for i, x := range b.cancels {
		if x == c {
			b.cancels = append(b.cancels[:i], b.cancels[i+1:]...)
			return
		}
	}
}

// bash plays canned output. "make serve" runs until abort_bash; any command
// containing "false" exits 1; others print one line naming the command.
func (s *fakeSession) bash(id, command string, exclude bool, emit func(any), bashes *fakeBashes, working func() bool) {
	cancel := bashes.add()
	defer bashes.done(cancel)
	lines := []string{"$ " + command, "synteettinen tuloste"}
	exit, forever := 0, false
	switch {
	case strings.Contains(command, "make serve"):
		lines, forever = []string{"python3 -m http.server 8000 --directory docs", "Serving HTTP on 0.0.0.0 port 8000 ..."}, true
	case strings.Contains(command, "false"):
		lines, exit = []string{"virhe: synteettinen epäonnistuminen"}, 1
	}
	output, cancelled := "", false
	for _, line := range lines {
		select {
		case <-cancel:
			cancelled = true
		case <-time.After(150 * time.Millisecond):
			output += line + "\n"
			emit(map[string]any{"type": "bash_execution_update", "id": id, "delta": line + "\n"})
		}
		if cancelled {
			break
		}
	}
	if forever && !cancelled {
		<-cancel
		cancelled = true
	}
	data := map[string]any{"output": output, "cancelled": cancelled, "truncated": false}
	if !cancelled {
		data["exitCode"] = exit
	}
	entry := map[string]any{"role": "bashExecution", "command": command, "output": output, "cancelled": cancelled, "truncated": false, "excludeFromContext": exclude, "timestamp": time.Now().UnixMilli()}
	if !cancelled {
		entry["exitCode"] = exit
	}
	// Idle Pi persists bashExecution before the RPC reply; while a turn
	// streams it defers the entry until agent_end instead.
	if !working() {
		s.append(map[string]any{"type": "message", "message": entry})
		emit(map[string]any{"type": "response", "id": id, "command": "bash", "success": true, "data": data})
		return
	}
	emit(map[string]any{"type": "response", "id": id, "command": "bash", "success": true, "data": data})
	for working() {
		time.Sleep(100 * time.Millisecond)
	}
	s.append(map[string]any{"type": "message", "message": entry})
}
