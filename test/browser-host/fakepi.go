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
	"os/signal"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"syscall"
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

// rejected: a prompt that starts with "hylkää". Only the start, so a worker
// request offering "mergeä, jatka tai hylkää" is an ordinary message.
func rejected(message string) bool {
	return strings.HasPrefix(strings.TrimSpace(message), "hylkää")
}

// runFakePi speaks enough of Pi's RPC protocol for the controller and writes
// a native v3 session file the way Pi does. It never contacts a model.
// Prompts steer it: "hidas" slows every step, one starting "hylkää" is rejected,
// "ei pysähdy" refuses an abort,
// "kaadu" exits mid-turn, "pitkä" answers at length, "commitoi" commits a
// file in its working directory and "yhdistä" merges its branch into the
// recorded base the way an agent asked to merge would. The lab's pi-deltas
// scenario adds a delayed native RPC text/tool stream without a model.
// slowIntake is fake Pi's stdin. pi-slow-intake takes it in at about
// 800 KB/s, as Pi's own reader takes in a frame of a hundred megabytes, so a
// prompt with a few megabytes of images outlasts a shortened budget for
// handing it over (FixtureSetPromptTimeout).
type slowIntake struct{ home string }

func (r slowIntake) Read(p []byte) (int, error) {
	if mode, _ := os.ReadFile(filepath.Join(filepath.Dir(r.home), "fakepi-scenario")); strings.TrimSpace(string(mode)) == "pi-slow-intake" {
		time.Sleep(20 * time.Millisecond)
		p = p[:min(len(p), 16<<10)]
	}
	return os.Stdin.Read(p)
}

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
	// /fixture/pi-start-fail does the same within another scenario, such as
	// a recap case whose restart recovery cannot start Pi.
	if _, err := os.Stat(filepath.Join(filepath.Dir(home), "fakepi-start-fail")); err == nil {
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
				ID         string `json:"id"`
				Type       string `json:"type"`
				CustomType string `json:"customType"`
				Message    struct {
					Role string `json:"role"`
				} `json:"message"`
			}
			if json.Unmarshal([]byte(line), &entry) == nil && entry.ID != "" {
				s.parent = entry.ID
				// A resumed Pi recaps the same latest message as before.
				if entry.Type == "message" && (entry.Message.Role == "user" || entry.Message.Role == "assistant") {
					s.lastMessage = entry.ID
				}
				if entry.Type == "custom" && entry.CustomType == "conversation-recap" {
					s.lastRecap = s.lastMessage
				}
				s.track(entry.Type, entry.Message.Role, entry.ID)
			}
		}
	}
	busy := false
	var bashes fakeBashes
	steering, followUp := []string{}, []string{}
	var mu sync.Mutex
	queueUpdate := func() { emit(map[string]any{"type": "queue_update", "steering": steering, "followUp": followUp}) }
	// As Pi's RPC mode: stdin's end or SIGTERM disposes the runtime, which
	// aborts a running turn and saves it as aborted before Pi exits. The
	// companion has marked the turn first when the daemon stopped Pi for its
	// own restart (process-extension.mjs restart shutdown); this fake has no
	// companion socket, so /fixture/daemon-restart says so with a file.
	var shutdown sync.Once
	stop := func() {
		shutdown.Do(func() {
			mu.Lock()
			if busy && s.run != nil {
				if _, err := os.Stat(filepath.Join(filepath.Dir(home), "fakepi-restarting")); err == nil {
					s.append(map[string]any{"type": "custom", "customType": "oh-restart-stop", "data": map[string]any{"schema_version": 1}})
				}
			}
			idle := s.abortRun()
			mu.Unlock()
			select {
			case <-idle:
			case <-time.After(3 * time.Second):
			}
			os.Exit(0)
		})
	}
	terminated := make(chan os.Signal, 1)
	signal.Notify(terminated, syscall.SIGTERM)
	go func() { <-terminated; stop() }()
	// A frame carries a prompt's images, as large as Pi's own frames.
	in := bufio.NewReaderSize(slowIntake{home}, 64<<10)
	for {
		line, err := in.ReadBytes('\n')
		if err != nil {
			stop()
			break
		}
		var req struct {
			ID, Type, Message, Name, Provider, ModelId, Level, Command string
			CustomInstructions                                         string
			ExcludeFromContext                                         bool
		}
		if json.Unmarshal(line, &req) != nil {
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
			if m := strings.TrimSpace(string(mode)); m == "pi-recap" || m == "pi-recap-unsupported" || m == "pi-recap-failing" {
				commands = append(commands, map[string]any{"name": "oh-conversation-recap", "source": "extension"})
			}
			if rewindScenario(home) {
				commands = append(commands, map[string]any{"name": "oh-rewind", "source": "extension"})
			}
			emit(map[string]any{"type": "response", "id": req.ID, "command": "get_commands", "success": true, "data": map[string]any{"commands": commands}})
		case "bash":
			// As Pi's RPC: output streams as bash_execution_update, the reply
			// comes when the command ends, and the result is a bashExecution
			// entry, deferred to the end of a running turn.
			go s.bash(req.ID, req.Command, req.ExcludeFromContext, emit, &bashes, func() bool { mu.Lock(); defer mu.Unlock(); return busy })
		case "abort":
			// As Pi's: the active run is signalled, and the reply waits until it
			// has settled (agent_end, then agent_settled with aborted). The
			// queue survives an abort, as Pi keeps its queue.
			// A run whose prompt says "ei pysähdy" refuses, as a Pi whose
			// abort fails reports success: false and keeps working.
			mu.Lock()
			if s.refuseAbort && s.run != nil {
				mu.Unlock()
				emit(map[string]any{"type": "response", "id": req.ID, "command": "abort", "success": false, "error": "synthetic refusal"})
				continue
			}
			idle := s.abortRun()
			mu.Unlock()
			go func(id string) {
				<-idle
				emit(map[string]any{"type": "response", "id": id, "command": "abort", "success": true})
			}(req.ID)
		case "compact":
			// Pi answers when its summary is written, after other commands.
			go func(id, instructions string) {
				result, refused := s.compact(instructions, emit)
				if refused != "" {
					emit(map[string]any{"type": "response", "id": id, "command": "compact", "success": false, "error": refused})
					return
				}
				emit(map[string]any{"type": "response", "id": id, "command": "compact", "success": true, "data": result})
			}(req.ID, req.CustomInstructions)
		case "abort_bash":
			bashes.abort()
			emit(map[string]any{"type": "response", "id": req.ID, "command": "abort_bash", "success": true})
		case "steer", "follow_up":
			mu.Lock()
			reject := req.Message == "" || rejected(req.Message)
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
			if strings.HasPrefix(req.Message, "/oh-rewind ") && rewindScenario(home) {
				mu.Lock()
				running := busy
				mu.Unlock()
				outcome := `{"outcome":"turn_running"}`
				if !running {
					outcome = s.rewind(strings.TrimPrefix(req.Message, "/oh-rewind "))
				}
				emit(map[string]any{"type": "extension_ui_request", "id": "rewind-outcome", "method": "notify", "notifyType": "info", "message": "oh-rewind:" + outcome})
				emit(map[string]any{"type": "response", "id": req.ID, "command": "prompt", "success": true})
				continue
			}
			if req.Message == "/oh-conversation-recap" || req.Message == "/oh-conversation-recap automatic" {
				if os.Remove(filepath.Join(filepath.Dir(home), "fakepi-recap-hold")) == nil {
					_ = os.WriteFile(filepath.Join(filepath.Dir(home), "fakepi-recap-started"), nil, 0600)
					// The daemon restart kills this child before it writes a recap.
					time.Sleep(time.Hour)
				}
				mode, _ := os.ReadFile(filepath.Join(filepath.Dir(home), "fakepi-scenario"))
				if strings.TrimSpace(string(mode)) == "pi-recap-failing" {
					// As the recap extension reports a model whose quota is spent.
					emit(map[string]any{"type": "extension_ui_request", "id": "recap-outcome", "method": "notify", "notifyType": "error", "message": `oh-conversation-recap:{"outcome":"model_error","model":"fixture/fake","detail":"synthetic quota spent"}`})
				}
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
			reject := busy || rejected(req.Message)
			if !reject {
				busy = true
				s.beginRun()
				s.refuseAbort = strings.Contains(req.Message, "ei pysähdy")
			}
			run, idle := s.run, s.idle
			mu.Unlock()
			emit(map[string]any{"type": "response", "id": req.ID, "command": "prompt", "success": !reject})
			if reject {
				continue
			}
			go func(message string) {
				s.turn(message, run, emit)
				// Deliver steering at a turn boundary, then follow-ups after completion.
				// Keep the synthetic work slow enough to exercise queue clear races.
				for {
					mu.Lock()
					var next string
					if s.aborted() {
						busy = false
						s.endRun()
						mu.Unlock()
						emit(map[string]any{"type": "agent_settled", "aborted": true})
						close(idle)
						break
					}
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
						s.endRun()
					}
					mu.Unlock()
					if next == "" {
						emit(map[string]any{"type": "agent_settled", "aborted": false})
						close(idle)
						break
					}
					s.turn(next, run, emit)
				}
			}(req.Message)
		}
	}
}

type fakeSession struct {
	// run is the active run's abort signal and idle is closed once it has
	// settled; both are replaced by beginRun under the RPC loop's lock.
	run, idle                      chan struct{}
	stopped, refuseAbort           bool
	appendMu                       sync.Mutex
	id, cwd, dir, path             string
	parent, lastMessage, lastRecap string
	started                        bool
	// unnamed holds a name set before the first entry: Pi keeps it in
	// memory and writes it with the session's first message.
	unnamed                   []map[string]any
	model, thinking, provider string
	// context is the context size the next reply records, as a model's
	// usage would; compacted says the history was just summarized.
	context   int
	compacted bool
	// What Pi's own compact checks: the last entry's type and the person's
	// messages since the last compaction (track).
	lastType, lastUser string
	usersSince         int
	// system is Pi 1.3's recorded prompt state: sections and tools.
	system map[string]any
}

var contextPrompt = regexp.MustCompile(`konteksti (\d{1,9})`)

// replyUsage is the synthetic usage of a reply: it grows each turn, a prompt
// "konteksti N" sets it, and the first reply after a compaction starts low.
func (s *fakeSession) replyUsage(prompt string) map[string]any {
	switch {
	case contextPrompt.MatchString(prompt):
		s.context, _ = strconv.Atoi(contextPrompt.FindStringSubmatch(prompt)[1])
	case s.compacted:
		s.context = 31600
	case s.context == 0:
		s.context = 11800
	default:
		s.context += 6400
	}
	s.compacted = false
	output := min(400, s.context)
	return map[string]any{"input": s.context - output, "output": output, "cacheRead": 0, "cacheWrite": 0, "totalTokens": s.context}
}

func (s *fakeSession) beginRun() {
	s.run, s.idle, s.stopped = make(chan struct{}), make(chan struct{}), false
}

// abortRun signals the active run and returns a channel closed once it has
// settled; with no active run it is already closed.
func (s *fakeSession) abortRun() chan struct{} {
	if s.run == nil {
		idle := make(chan struct{})
		close(idle)
		return idle
	}
	if !s.stopped {
		s.stopped = true
		close(s.run)
	}
	return s.idle
}

func (s *fakeSession) aborted() bool { return s.stopped }

func (s *fakeSession) endRun() { s.run = nil }

// pause waits like a model or tool step and reports whether the run was
// aborted meanwhile.
func (s *fakeSession) pause(run chan struct{}, d time.Duration) bool {
	select {
	case <-run:
		return true
	case <-time.After(d):
		return false
	}
}

func (s *fakeSession) append(v map[string]any) {
	s.appendMu.Lock()
	defer s.appendMu.Unlock()
	if !s.started && v["type"] == "session_info" {
		s.unnamed = append(s.unnamed, v)
		return
	}
	if !s.started {
		_ = os.MkdirAll(s.dir, 0700)
		header := map[string]any{"type": "session", "version": 3, "id": s.id, "timestamp": time.Now().UTC().Format(time.RFC3339Nano), "cwd": s.cwd}
		b, _ := json.Marshal(header)
		_ = os.WriteFile(s.path, append(b, '\n'), 0600)
		s.started = true
		for _, held := range s.unnamed {
			s.write(held)
		}
		s.unnamed = nil
	}
	s.write(v)
}

// write appends one entry after the session header; the caller holds appendMu.
func (s *fakeSession) write(v map[string]any) {
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
	role := ""
	if v["type"] == "message" {
		if m, ok := v["message"].(map[string]any); ok && (m["role"] == "user" || m["role"] == "assistant") {
			s.lastMessage = entry
			role, _ = m["role"].(string)
		}
	}
	kind, _ := v["type"].(string)
	s.track(kind, role, entry)
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

func (s *fakeSession) track(kind, role, id string) {
	s.lastType = kind
	if kind == "compaction" {
		s.usersSince = 0
	}
	if kind == "message" && role == "user" {
		s.lastUser = id
		s.usersSince++
	}
}

// compact is Pi's RPC compact as far as the page can tell: it refuses right
// after a compaction and in a conversation too small to cut, and otherwise
// summarizes everything before the latest message of the person.
func (s *fakeSession) compact(instructions string, emit func(any)) (map[string]any, string) {
	s.appendMu.Lock()
	lastType, users, kept, before := s.lastType, s.usersSince, s.lastUser, s.context
	s.appendMu.Unlock()
	emit(map[string]any{"type": "compaction_start", "reason": "manual"})
	refuse := ""
	if lastType == "compaction" {
		refuse = "Already compacted"
	} else if users < 2 {
		refuse = "Nothing to compact (session too small)"
	} else if strings.Contains(instructions, "epäonnistu") {
		// The summary request fails, as when the provider refuses it.
		time.Sleep(1200 * time.Millisecond)
		refuse = "Summarization failed: synthetic provider error"
	}
	if refuse != "" {
		emit(map[string]any{"type": "compaction_end", "reason": "manual", "aborted": false, "willRetry": false, "errorMessage": "Compaction failed: " + refuse})
		return nil, refuse
	}
	time.Sleep(1200 * time.Millisecond)
	summary := "Synteettinen tiivistelmä aiemmasta keskustelusta."
	if instructions != "" {
		summary += "\n\nOhje: " + instructions
	}
	s.append(map[string]any{"type": "compaction", "summary": summary, "firstKeptEntryId": kept, "tokensBefore": before, "systemMessage": s.system})
	s.compacted = true
	result := map[string]any{"summary": summary, "firstKeptEntryId": kept, "tokensBefore": before, "estimatedTokensAfter": 4200}
	emit(map[string]any{"type": "compaction_end", "reason": "manual", "result": result, "aborted": false, "willRetry": false})
	return result, ""
}

func message(role string, content any, extra map[string]any) map[string]any {
	m := map[string]any{"role": role, "content": content, "timestamp": time.Now().UnixMilli()}
	for k, v := range extra {
		m[k] = v
	}
	return map[string]any{"type": "message", "message": m}
}

func (s *fakeSession) turn(prompt string, run chan struct{}, emit func(any)) {
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
	// The person's own machine (Omat koneet): the fake runs nothing there.
	if strings.Contains(prompt, "omalla koneellani") {
		command = "ssh alice-macbook -- sw_vers -productVersion"
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
	} else if command, arguments, _ := strings.Cut(prompt, " "); strings.HasPrefix(command, "/skill:") {
		// Pi's _expandSkillCommand for a project skill in the workspace: the
		// name runs to the first space, the body loses its frontmatter and
		// the arguments are trimmed.
		name := strings.TrimPrefix(command, "/skill:")
		for _, dir := range []string{".pi", ".agents"} {
			base := filepath.Join(s.cwd, dir, "skills", name)
			data, err := os.ReadFile(filepath.Join(base, "SKILL.md"))
			if err != nil || !filepath.IsLocal(name) {
				continue
			}
			body := string(data)
			if strings.HasPrefix(body, "---\n") {
				if end := strings.Index(body[4:], "\n---"); end >= 0 {
					body = body[4+end+4:]
				}
			}
			recordedPrompt = fmt.Sprintf("<skill name=\"%s\" location=\"%s/SKILL.md\">\nReferences are relative to %s.\n\n%s\n</skill>", name, base, base, strings.TrimSpace(body))
			if arguments = strings.TrimSpace(arguments); arguments != "" {
				recordedPrompt += "\n\n" + arguments
			}
			break
		}
	}
	if s.system == nil {
		// Pi 1.3 records its prompt sections and tool declarations as a
		// system message before the first prompt.
		s.system = map[string]any{"role": "system", "content": "", "timestamp": time.Now().UnixMilli(),
			"sections":   map[string]any{"preamble": "You are a synthetic coding assistant.", "project_context": "<project_context>\n" + strings.Repeat("Synteettinen projektin ohje. ", 120) + "\n</project_context>", "skills": "<skills>\n" + strings.Repeat("Synteettinen skill. ", 200) + "\n</skills>", "cwd": "<cwd>\n" + s.cwd + "\n</cwd>"},
			"toolsAdded": []map[string]any{{"name": "bash", "description": "Run a command.", "parameters": map[string]any{"type": "object"}}, {"name": "read", "description": "Read a file.", "parameters": map[string]any{"type": "object"}}}}
		s.append(map[string]any{"type": "message", "message": s.system})
	}
	// As Pi's, the user message starts in the conversation with its text:
	// the daemon tells a delivered queued message from it.
	emit(map[string]any{"type": "message_start", "message": map[string]any{"role": "user", "content": []map[string]any{{"type": "text", "text": prompt}}}})
	s.append(message("user", []map[string]any{{"type": "text", "text": recordedPrompt}}, nil))
	emit(map[string]any{"type": "message_end", "message": map[string]any{"role": "user"}})
	if rewindScenario(os.Getenv("HOME")) {
		s.rewindCheckpoint(prompt)
	}
	if strings.Contains(prompt, "pitkä ajo") {
		s.longRun(run, emit)
		return
	}
	// Recorded with Pi 1.3.0 / bridge 0.9.3 and disposable invalid credentials:
	// the bridge keeps the provider text, but marks the message as an error.
	// /fixture/ai-refused: Claude refuses every prompt until a sign-in.
	refused, _ := os.ReadFile(filepath.Join(filepath.Dir(os.Getenv("HOME")), "fakepi-ai-refused"))
	if strings.Contains(prompt, "auth-failure-oauth") || strings.Contains(prompt, "auth-failure-key") || strings.TrimSpace(string(refused)) == "claude" {
		text := "Failed to authenticate: OAuth session expired and could not be refreshed"
		if strings.Contains(prompt, "auth-failure-key") {
			text = "Invalid API key · Fix external API key"
		}
		entry := message("assistant", []map[string]any{{"type": "text", "text": text}}, map[string]any{"provider": "claude-bridge", "api": "claude-bridge", "model": "claude-sonnet-4-6", "stopReason": "error", "errorMessage": text})
		s.append(entry)
		emit(map[string]any{"type": "message_start", "message": entry["message"]})
		emit(map[string]any{"type": "message_end", "message": entry["message"]})
		emit(map[string]any{"type": "turn_end", "message": entry["message"], "toolResults": []any{}})
		emit(map[string]any{"type": "agent_end", "willRetry": false})
		emit(map[string]any{"type": "agent_settled", "aborted": false})
		return
	}
	// A provider that fails the turn: Pi saves the empty reply with
	// stopReason "error" and the provider's message.
	if strings.Contains(prompt, "virhevuoro") {
		s.append(message("assistant", []map[string]any{}, map[string]any{"provider": "synthetic", "model": "fake-pi", "stopReason": "error", "errorMessage": "529 overloaded"}))
		emit(map[string]any{"type": "message_end", "message": map[string]any{"role": "assistant", "stopReason": "error", "errorMessage": "529 overloaded"}})
		emit(map[string]any{"type": "agent_end"})
		return
	}
	// An abort ends the run as Pi's does: a streaming reply is saved with
	// stopReason "aborted"; a running tool returns an error result, and the
	// model request that follows it is saved empty as the pinned Pi saves it,
	// stopReason "error" with the AbortError text.
	stopStreaming := func(text string) {
		s.append(message("assistant", []map[string]any{{"type": "text", "text": text}}, map[string]any{"provider": "synthetic", "model": "fake-pi", "stopReason": "aborted", "errorMessage": "Request was aborted"}))
		emit(map[string]any{"type": "message_end", "message": map[string]any{"role": "assistant", "stopReason": "aborted"}})
		emit(map[string]any{"type": "agent_end"})
	}
	if s.pause(run, step) {
		stopStreaming("")
		return
	}
	if typed {
		emit(map[string]any{"type": "message_update", "assistantMessageEvent": map[string]any{"type": "thinking_delta", "contentIndex": 1, "delta": "Synteettinen pohdinta", "partial": map[string]any{"content": []map[string]any{{"type": "text"}, {"type": "thinking", "redacted": false}}}}})
		emit(map[string]any{"type": "message_update", "assistantMessageEvent": map[string]any{"type": "toolcall_start", "contentIndex": 2, "toolName": "bash", "id": callID}})
		emit(map[string]any{"type": "message_update", "assistantMessageEvent": map[string]any{"type": "toolcall_delta", "contentIndex": 2, "delta": "{\"command\":\"ls\""}})
	}
	if stream {
		delta("Katson ensin, ")
		if s.pause(run, step) {
			stopStreaming("Katson ensin, ")
			return
		}
		delta("mitä työtilassa on.")
		if s.pause(run, step) {
			stopStreaming("Katson ensin, mitä työtilassa on.")
			return
		}
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
	aborted := false
	if visualHold {
		// Hold before the tool result so the lab can capture the live row.
		_ = os.WriteFile(filepath.Join(filepath.Dir(os.Getenv("HOME")), "fakepi-visual-phase"), []byte("tool-start"), 0600)
		deadline := time.Now().Add(90 * time.Second)
		for time.Now().Before(deadline) && !aborted {
			current, _ := os.ReadFile(filepath.Join(filepath.Dir(os.Getenv("HOME")), "fakepi-scenario"))
			if strings.TrimSpace(string(current)) != "pi-visual-hold" {
				break
			}
			aborted = s.pause(run, 50*time.Millisecond)
		}
	} else {
		aborted = s.pause(run, step)
	}
	if aborted {
		s.append(message("toolResult", []map[string]any{{"type": "text", "text": "Command aborted"}}, map[string]any{"toolCallId": callID, "toolName": "bash", "isError": true}))
		emit(map[string]any{"type": "tool_execution_end", "toolName": "bash", "toolCallId": callID, "isError": true, "result": map[string]any{"content": []map[string]any{{"type": "text", "text": "Command aborted"}}}})
		s.append(message("assistant", []map[string]any{}, map[string]any{"provider": "synthetic", "model": "fake-pi", "stopReason": "error", "errorMessage": "This operation was aborted"}))
		emit(map[string]any{"type": "message_end", "message": map[string]any{"role": "assistant", "stopReason": "error"}})
		emit(map[string]any{"type": "agent_end"})
		return
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
	if change := fakeFileChange(prompt); change != nil {
		// The agent changes cmd/main.go while the person may be editing it in
		// the browser: a real write in the workspace, announced the way Pi
		// announces its tool calls (start with arguments, then end).
		path := filepath.Join(s.cwd, "cmd", "main.go")
		emit(map[string]any{"type": "tool_execution_start", "toolName": change.tool, "toolCallId": change.id, "args": change.args})
		time.Sleep(step)
		result := change.result
		if data, err := os.ReadFile(path); err != nil || !strings.Contains(string(data), change.oldText) {
			result = "Could not find the text to replace."
		} else {
			_ = os.WriteFile(path, []byte(strings.Replace(string(data), change.oldText, change.newText, 1)), 0600)
		}
		s.append(message("assistant", []map[string]any{{"type": "toolCall", "name": change.tool, "id": change.id, "arguments": change.args}}, nil))
		s.append(message("toolResult", []map[string]any{{"type": "text", "text": result}}, map[string]any{"toolCallId": change.id, "toolName": change.tool}))
		emit(map[string]any{"type": "tool_execution_end", "toolName": change.tool, "toolCallId": change.id, "result": map[string]any{"content": []map[string]any{{"type": "text", "text": result}}}, "isError": false})
	}
	if strings.Contains(prompt, "taustaprosessi") {
		// A native pi-processes start result; the process itself does not exist,
		// so a daemon restart leaves exactly the branch evidence a real one would.
		process := map[string]any{"id": "proc_c0de", "name": "kehityspalvelin", "command": "npm run dev", "startTime": time.Now().UnixMilli(), "status": "running"}
		s.append(message("assistant", []map[string]any{{"type": "toolCall", "name": "process", "id": "process-start", "arguments": map[string]any{"action": "start", "name": "kehityspalvelin", "command": "npm run dev"}}}, nil))
		s.append(message("toolResult", []map[string]any{{"type": "text", "text": "Started process kehityspalvelin (proc_c0de)."}}, map[string]any{"toolCallId": "process-start", "toolName": "process", "details": map[string]any{"action": "start", "process": process, "notify": map[string]any{"onSuccess": "turn", "onFailure": "turn", "onKilled": "context"}}}))
	}
	if strings.Contains(prompt, "lue loki") {
		// A large read the context view lists by its file name; Pi's own
		// compaction cut needs this much to have something to summarize.
		id := fmt.Sprintf("read-log-%d", time.Now().UnixNano())
		s.append(message("assistant", []map[string]any{{"type": "toolCall", "name": "read", "id": id, "arguments": map[string]any{"path": "cmd/main.go"}}}, nil))
		s.append(message("toolResult", []map[string]any{{"type": "text", "text": strings.Repeat("synteettinen lokirivi\n", 4000)}}, map[string]any{"toolCallId": id, "toolName": "read"}))
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
	if strings.Contains(prompt, "kaavio") {
		answer += "\n\n```mermaid\nflowchart LR\n  Selain --> Yhdyskäytävä --> Daemon\n```"
	}
	if strings.Contains(prompt, "kansiolinkki") {
		answer += "\n\n[Directory](./cmd/) and `cmd/`."
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
	s.append(message("assistant", []map[string]any{{"type": "text", "text": answer}}, map[string]any{"provider": provider, "model": model, "stopReason": "stop", "usage": s.replyUsage(prompt)}))
	emit(map[string]any{"type": "message_end", "message": map[string]any{"role": "assistant"}})
	emit(map[string]any{"type": "agent_end"})
	if strings.Contains(prompt, "tiivistä") {
		// Pi's threshold compaction runs after the turn: the old history
		// becomes a summary entry, and Pi's context usage is unknown until
		// the next reply records new usage.
		emit(map[string]any{"type": "compaction_start", "reason": "threshold"})
		time.Sleep(6 * step)
		s.append(map[string]any{"type": "compaction", "summary": "Synteettinen tiivistelmä aiemmasta keskustelusta.", "firstKeptEntryId": s.lastMessage, "tokensBefore": s.context, "systemMessage": s.system})
		s.compacted = true
		emit(map[string]any{"type": "compaction_end", "reason": "threshold", "aborted": false, "willRetry": false})
	}
}

// longRun is one native agent run of many model turns, each calling a tool,
// as a long task with git and issue calls is: Pi starts the agent once, saves
// each message as it ends, and settles only after the last answer. Its 130
// turns, eight live frames each, outgrow the daemon's 1000-frame live tail once.
func (s *fakeSession) longRun(run chan struct{}, emit func(any)) {
	for n := 0; n < 130; n++ {
		if s.pause(run, 60*time.Millisecond) {
			emit(map[string]any{"type": "agent_end"})
			return
		}
		callID := fmt.Sprintf("call_run_%03d", n)
		args := map[string]any{"command": fmt.Sprintf("echo vaihe %d", n)}
		emit(map[string]any{"type": "turn_start"})
		emit(map[string]any{"type": "message_update", "assistantMessageEvent": map[string]any{"type": "thinking_delta", "contentIndex": 0, "delta": fmt.Sprintf("Vaihe %d", n)}})
		emit(map[string]any{"type": "message_update", "assistantMessageEvent": map[string]any{"type": "toolcall_start", "contentIndex": 1, "toolName": "bash", "id": callID}})
		emit(map[string]any{"type": "message_update", "assistantMessageEvent": map[string]any{"type": "toolcall_delta", "contentIndex": 1, "delta": `{"command":`}})
		emit(map[string]any{"type": "message_update", "assistantMessageEvent": map[string]any{"type": "toolcall_end", "contentIndex": 1, "toolCall": map[string]any{"id": callID, "name": "bash", "arguments": args}}})
		s.append(message("assistant", []map[string]any{{"type": "thinking", "thinking": fmt.Sprintf("Vaihe %d", n)}, {"type": "toolCall", "id": callID, "name": "bash", "arguments": args}}, map[string]any{"provider": "synthetic", "model": "fake-pi", "stopReason": "toolUse"}))
		emit(map[string]any{"type": "message_end", "message": map[string]any{"role": "assistant", "stopReason": "toolUse"}})
		emit(map[string]any{"type": "tool_execution_start", "toolName": "bash", "toolCallId": callID, "args": args})
		result := map[string]any{"content": []map[string]any{{"type": "text", "text": fmt.Sprintf("vaihe %d", n)}}}
		emit(map[string]any{"type": "tool_execution_update", "toolName": "bash", "toolCallId": callID, "args": args, "partialResult": result})
		s.append(message("toolResult", []map[string]any{{"type": "text", "text": fmt.Sprintf("vaihe %d", n)}}, map[string]any{"toolCallId": callID, "toolName": "bash", "isError": false}))
		emit(map[string]any{"type": "tool_execution_end", "toolName": "bash", "toolCallId": callID, "isError": false, "result": result})
		emit(map[string]any{"type": "message_end", "message": map[string]any{"role": "toolResult"}})
		emit(map[string]any{"type": "turn_end"})
	}
	emit(map[string]any{"type": "turn_start"})
	answer := "Pitkä ajo valmis."
	emit(map[string]any{"type": "message_update", "assistantMessageEvent": map[string]any{"type": "text_delta", "contentIndex": 0, "delta": answer}})
	s.append(message("assistant", []map[string]any{{"type": "text", "text": answer}}, map[string]any{"provider": "synthetic", "model": "fake-pi", "stopReason": "stop", "usage": s.replyUsage("pitkä ajo")}))
	emit(map[string]any{"type": "message_end", "message": map[string]any{"role": "assistant"}})
	emit(map[string]any{"type": "turn_end"})
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
		command("skill:korjaa-ongelma", "Korjaa havaittu ongelma", "skill", "auto", "project"),
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

type fakeChange struct {
	tool, id, result, oldText, newText string
	args                               map[string]any
}

// fakeFileChange is the agent's change to the editor fixture's cmd/main.go a
// prompt asks for: on separate lines from the person's (the first lines), on
// the same line (println), or the separate change made with bash.
func fakeFileChange(prompt string) *fakeChange {
	edit := func(oldText, newText string) *fakeChange {
		return &fakeChange{tool: "edit", id: "file-change-edit", result: "Successfully replaced 1 block(s) in cmd/main.go.", oldText: oldText, newText: newText,
			args: map[string]any{"path": "cmd/main.go", "edits": []map[string]any{{"oldText": oldText, "newText": newText}}}}
	}
	switch {
	case strings.Contains(prompt, "muokkaa samaa riviä"):
		return edit("println(\"hei\")", "println(\"agentti\")")
	case strings.Contains(prompt, "muokkaa bashilla"):
		return &fakeChange{tool: "bash", id: "file-change-bash", result: "", oldText: "package main\n", newText: "// Agentin kommentti\npackage main\n",
			args: map[string]any{"command": "sed -i '1i // Agentin kommentti' cmd/main.go"}}
	case strings.Contains(prompt, "muokkaa tiedostoa"):
		return edit("package main\n", "// Agentin kommentti\npackage main\n")
	}
	return nil
}
