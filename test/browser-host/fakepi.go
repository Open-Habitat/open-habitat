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
// "kaadu" exits mid-turn, "pitkä" answers at length.
func runFakePi(args []string) {
	id := ""
	for i := 0; i+1 < len(args); i++ {
		if args[i] == "--session-id" {
			id = args[i+1]
		}
	}
	cwd, err := os.Getwd()
	if err != nil || id == "" {
		os.Exit(2)
	}
	home := os.Getenv("HOME")
	dir := filepath.Join(home, ".pi", "agent", "sessions", "--"+strings.ReplaceAll(strings.Trim(cwd, "/"), "/", "-")+"--")
	path := filepath.Join(dir, time.Now().UTC().Format("2006-01-02T15-04-05-000Z")+"_"+id+".jsonl")
	var out sync.Mutex
	emit := func(v any) {
		b, _ := json.Marshal(v)
		out.Lock()
		defer out.Unlock()
		os.Stdout.Write(append(b, '\n'))
	}
	s := &fakeSession{id: id, cwd: cwd, dir: dir, path: path}
	busy := false
	var mu sync.Mutex
	in := bufio.NewScanner(os.Stdin)
	in.Buffer(make([]byte, 4096), 1<<20)
	for in.Scan() {
		var req struct{ ID, Type, Message string }
		if json.Unmarshal(in.Bytes(), &req) != nil {
			continue
		}
		switch req.Type {
		case "get_state":
			emit(map[string]any{"type": "response", "id": req.ID, "command": "get_state", "success": true})
		case "prompt":
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
				mu.Lock()
				busy = false
				mu.Unlock()
			}(req.Message)
		}
	}
}

type fakeSession struct {
	id, cwd, dir, path string
	parent             string
	started            bool
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
	step := 400 * time.Millisecond
	if strings.Contains(prompt, "hidas") {
		step = 4 * time.Second
	}
	emit(map[string]any{"type": "agent_start"})
	s.append(message("user", []map[string]any{{"type": "text", "text": prompt}}, nil))
	emit(map[string]any{"type": "message_end", "message": map[string]any{"role": "user"}})
	time.Sleep(step)
	emit(map[string]any{"type": "tool_execution_start", "toolName": "bash"})
	s.append(message("assistant", []map[string]any{
		{"type": "text", "text": "Katson ensin, mitä työtilassa on."},
		{"type": "toolCall", "id": "call_1", "name": "bash", "arguments": map[string]any{"command": "ls"}},
	}, map[string]any{"provider": "synthetic", "model": "fake-pi", "stopReason": "toolUse"}))
	time.Sleep(step)
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
	s.append(message("toolResult", []map[string]any{{"type": "text", "text": listing}}, map[string]any{"toolCallId": "call_1", "toolName": "bash", "isError": false}))
	emit(map[string]any{"type": "tool_execution_end", "toolName": "bash"})
	time.Sleep(step)
	answer := fmt.Sprintf("Selvä. Kysyit: %q.\n\nTyötilassa on %d kohdetta. Tämä vastaus on synteettisen Pi-korvikkeen tuottama, eikä mitään mallia kutsuttu.", prompt, strings.Count(listing, "\n")+1)
	if strings.Contains(prompt, "pitkä") {
		answer += "\n\n## Yhteenveto\n\n- Ensimmäinen kohta\n- Toinen kohta\n\n```go\nfunc main() {\n\tfmt.Println(\"hei\")\n}\n```\n\n" + strings.Repeat("Pitkä kappale synteettistä tekstiä. ", 80)
	}
	s.append(message("assistant", []map[string]any{{"type": "text", "text": answer}}, map[string]any{"provider": "synthetic", "model": "fake-pi", "stopReason": "stop"}))
	emit(map[string]any{"type": "message_end", "message": map[string]any{"role": "assistant"}})
	emit(map[string]any{"type": "agent_end"})
	emit(map[string]any{"type": "agent_settled"})
}
