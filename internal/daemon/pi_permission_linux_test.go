//go:build linux

package daemon

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/testpython"
)

func TestPermissionRequestDecodesOnlyTheTypedShape(t *testing.T) {
	good := `{"action":"Delete the folder","consequence":"It is removed.","account":{"provider":"Microsoft","address":"person@example.test"},"call":{"area":"ms-admin","tool":"delete-mail-folder","arguments":"{\"id\":\"x\"}"}}`
	is, view := permissionRequest("confirm", permissionPrefix+good)
	if !is || view == nil || view.Action != "Delete the folder" || view.Account == nil || view.Account.Provider != "Microsoft" || view.Call.Arguments != `{"id":"x"}` {
		t.Fatalf("good question: %v %+v", is, view)
	}
	if is, view := permissionRequest("confirm", permissionPrefix+`{"action":"a","consequence":"c","call":{"area":"x","tool":"y","arguments":""}}`); !is || view == nil || view.Account != nil {
		t.Fatalf("question without an account: %v %+v", is, view)
	}
	// Not a permission question: another method, or a confirm without the prefix.
	for _, c := range [][2]string{{"select", permissionPrefix + good}, {"confirm", "Delete the folder?"}, {"confirm", " " + permissionPrefix + good}} {
		if is, _ := permissionRequest(c[0], c[1]); is {
			t.Fatalf("%q %q read as a permission question", c[0], c[1])
		}
	}
	long := strings.Repeat("ä", 301)
	for _, bad := range []string{
		``,
		`not json`,
		good + `{}`,
		`{"action":"a","consequence":"c","call":{"area":"x","tool":"y","arguments":""},"html":"<b>"}`,
		`{"action":"","consequence":"c","call":{"area":"x","tool":"y","arguments":""}}`,
		`{"action":"   ","consequence":"c","call":{"area":"x","tool":"y","arguments":""}}`,
		`{"action":"a\nb","consequence":"c","call":{"area":"x","tool":"y","arguments":""}}`,
		`{"action":"a\u0085","consequence":"c","call":{"area":"x","tool":"y","arguments":""}}`,
		`{"action":"` + long + `","consequence":"c","call":{"area":"x","tool":"y","arguments":""}}`,
		`{"action":"a","call":{"area":"x","tool":"y","arguments":""}}`,
		`{"action":"a","consequence":"c"}`,
		`{"action":"a","consequence":"c","call":{"area":"x","tool":"y","arguments":{"id":1}}}`,
		`{"action":"a","consequence":"c","call":{"area":"x","tool":"y","arguments":"\u0007"}}`,
		`{"action":"a","consequence":"c","account":{"provider":"Microsoft"},"call":{"area":"x","tool":"y","arguments":""}}`,
		`{"action":"a","consequence":"c","account":null,"call":{"area":"x","tool":"","arguments":""}}`,
	} {
		if is, view := permissionRequest("confirm", permissionPrefix+bad); !is || view != nil {
			t.Fatalf("malformed question %q: %v %+v", bad, is, view)
		}
	}
	if _, view := permissionRequest("confirm", permissionPrefix+strings.Replace(good, `"arguments":"{\"id\":\"x\"}"`, `"arguments":"{\n\t\"id\": 1\n}"`, 1)); view == nil {
		t.Fatal("arguments may keep line breaks and tabs")
	}
	if _, view := permissionRequest("confirm", permissionPrefix+strings.Replace(good, "Delete the folder", strings.Repeat("ä", 300), 1)); view == nil {
		t.Fatal("the bound counts code points, not bytes")
	}
}

func validateEventFrames(t *testing.T, frames []json.RawMessage) {
	t.Helper()
	body, _ := json.Marshal(frames)
	cmd := exec.Command(testpython.Validator(t), "-c", `import sys,runpy,json; m=runpy.run_path('../../scripts/validate-contracts.py'); v=m['Draft202012Validator'](m['schemas']['event.schema.json'],registry=m['registry'],format_checker=m['format_checker'])
for e in json.load(sys.stdin): v.validate(e)`)
	cmd.Stdin = bytes.NewReader(body)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("event schema: %s: %v", out, err)
	}
}

func questionEvents(c *ConversationController) (out []map[string]any, raw []json.RawMessage) {
	c.journal.mu.Lock()
	defer c.journal.mu.Unlock()
	for _, frame := range c.journal.frames {
		var event struct {
			Kind    string         `json:"kind"`
			Payload map[string]any `json:"payload"`
		}
		if json.Unmarshal(frame, &event) == nil && event.Kind == "question.requested" {
			out = append(out, event.Payload)
			raw = append(raw, append(json.RawMessage(nil), frame...))
		}
	}
	return out, raw
}

// TestPermissionQuestionThroughController feeds the daemon's event reader the
// frames the companion writes: a malformed permission question is cancelled
// without being shown, a well-formed one becomes the typed question and is
// answered as a confirmation, and a generic confirm stays a confirm whatever
// it says.
func TestPermissionQuestionThroughController(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("requires nonroot")
	}
	home := t.TempDir()
	script := filepath.Join(home, "pi")
	question := func(action string) string {
		b, _ := json.Marshal(map[string]any{"action": action, "consequence": "It is removed.", "account": map[string]string{"provider": "Microsoft", "address": "person@example.test"}, "call": map[string]string{"area": "ms-admin", "tool": "delete-mail-folder", "arguments": `{"id":"x"}`}})
		return permissionPrefix + string(b)
	}
	frames := []map[string]any{
		{"type": "extension_ui_request", "id": "perm-bad", "method": "confirm", "title": permissionPrefix + `{"action":"<b>no</b>"}`, "message": "fallback"},
		{"type": "extension_ui_request", "id": "perm-1", "method": "confirm", "title": question("Delete the folder ‘Invoices 2024’"), "message": "Delete the folder ‘Invoices 2024’"},
		{"type": "extension_ui_request", "id": "perm-2", "method": "confirm", "title": question("Share the calendar ‘Family’"), "message": "Share the calendar ‘Family’"},
		{"type": "extension_ui_request", "id": "plain", "method": "confirm", "title": "Agentti pyytää lupaa", "message": "Poista kansio?"},
	}
	var lines []string
	for _, f := range frames {
		b, _ := json.Marshal(f)
		lines = append(lines, string(b))
	}
	code := fmt.Sprintf(`#!/usr/bin/env python3
import json,sys
frames=%q.split("\n")
for line in sys.stdin:
 r=json.loads(line)
 open(sys.argv[0]+".log","a").write(line)
 if r["type"] == "prompt":
  print(json.dumps(dict(type="response",id=r["id"],command="prompt",success=True)),flush=True)
  for f in frames: print(f,flush=True)
`, strings.Join(lines, "\n"))
	if err := os.WriteFile(script, []byte(code), 0700); err != nil {
		t.Fatal(err)
	}
	p, err := launchPiRPC(script, home, home, "", []string{"PATH=/usr/bin:/bin"})
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	id := ownershipTestID
	s := &conversation{id: id, rpc: p, state: "idle", commands: map[string]bool{}}
	c := &ConversationController{sessions: map[string]*conversation{id: s}, journal: newEventJournal()}
	go c.drain(s)
	if accepted, err := p.request("prompt", "start", time.Second); err != nil || !accepted {
		t.Fatalf("prompt: %v %v", accepted, err)
	}
	wait := func(want string) {
		t.Helper()
		end := time.Now().Add(2 * time.Second)
		for time.Now().Before(end) {
			c.mu.Lock()
			got := s.questionID
			c.mu.Unlock()
			if got == want {
				return
			}
			time.Sleep(time.Millisecond)
		}
		t.Fatalf("question %q not pending", want)
	}
	call := func(request, action, value string) int {
		t.Helper()
		body := fmt.Sprintf(`{"request_id":%q,"action":%q%s}`, request, action, value)
		req := httptest.NewRequest("POST", AgentConversationsPath+"/"+id+"/question", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		c.agentConversations(w, req)
		return w.Code
	}
	wait("perm-1")
	if code := call("perm-1", "answer", `,"value":"Salli"`); code != 400 {
		t.Fatalf("a permission answer is a boolean: %d", code)
	}
	if code := call("perm-1", "answer", `,"value":true`); code != 200 {
		t.Fatalf("allow: %d", code)
	}
	wait("perm-2")
	if code := call("perm-2", "answer", `,"value":false`); code != 200 {
		t.Fatalf("deny: %d", code)
	}
	wait("plain")
	if code := call("perm-bad", "answer", `,"value":true`); code != 409 {
		t.Fatalf("the malformed question was answerable: %d", code)
	}
	c.mu.Lock()
	plainKind := s.questionKind
	c.mu.Unlock()
	if plainKind != "confirm" {
		t.Fatalf("a generic confirm became %q", plainKind)
	}
	if code := call("plain", "answer", `,"value":true`); code != 200 {
		t.Fatalf("plain confirm: %d", code)
	}
	events, raw := questionEvents(c)
	if len(events) != 3 {
		t.Fatalf("shown questions: %+v", events)
	}
	for i, want := range []string{"perm-1", "perm-2", "plain"} {
		if events[i]["request_id"] != want {
			t.Fatalf("question %d is %v, want %s", i, events[i]["request_id"], want)
		}
	}
	perm, _ := events[0]["permission"].(map[string]any)
	if events[0]["question_kind"] != "permission" || events[0]["prompt"] != "Delete the folder ‘Invoices 2024’" || perm == nil || perm["action"] != "Delete the folder ‘Invoices 2024’" {
		t.Fatalf("typed question: %+v", events[0])
	}
	if events[2]["question_kind"] != "confirm" || events[2]["permission"] != nil {
		t.Fatalf("generic confirm: %+v", events[2])
	}
	validateEventFrames(t, raw)
	end := time.Now().Add(2 * time.Second)
	var log string
	for time.Now().Before(end) {
		b, _ := os.ReadFile(script + ".log")
		log = string(b)
		if strings.Count(log, "extension_ui_response") == 4 {
			break
		}
		time.Sleep(5 * time.Millisecond)
	}
	for _, want := range []string{
		`{"cancelled":true,"id":"perm-bad","type":"extension_ui_response"}`,
		`{"confirmed":true,"id":"perm-1","type":"extension_ui_response"}`,
		`{"confirmed":false,"id":"perm-2","type":"extension_ui_response"}`,
		`{"confirmed":true,"id":"plain","type":"extension_ui_response"}`,
	} {
		if !strings.Contains(log, want) {
			t.Fatalf("Pi did not receive %s:\n%s", want, log)
		}
	}
}

// TestPermissionThroughPinnedPi is the path end to end: a synthetic model
// asks for a bash call, a test hook (testdata/permission-hook.mjs) asks
// permission through the companion's API in the pinned Pi, the daemon shows
// the typed question, and the person's answer decides whether the call runs.
func TestPermissionThroughPinnedPi(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("requires nonroot")
	}
	cli, err := filepath.Abs(filepath.Join("pi-device-test", "node_modules", "@earendil-works", "pi-coding-agent", "dist", "bundle", "cli.js"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(cli); err != nil {
		t.Skip("pinned Pi test dependency not installed")
	}
	hook, err := filepath.Abs(filepath.Join("testdata", "permission-hook.mjs"))
	if err != nil {
		t.Fatal(err)
	}
	var mu sync.Mutex
	var toolResults []string
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Messages []struct {
				Role    string          `json:"role"`
				Content json.RawMessage `json:"content"`
			} `json:"messages"`
		}
		if json.NewDecoder(r.Body).Decode(&body) != nil || len(body.Messages) == 0 {
			w.WriteHeader(400)
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		chunk := func(delta string, finish string) {
			f := "null"
			if finish != "" {
				f = `"` + finish + `"`
			}
			fmt.Fprintf(w, "data: {\"id\":\"synthetic\",\"object\":\"chat.completion.chunk\",\"created\":0,\"model\":\"fake\",\"choices\":[{\"index\":0,\"delta\":%s,\"finish_reason\":%s}]}\n\n", delta, f)
		}
		last := body.Messages[len(body.Messages)-1]
		if last.Role == "tool" {
			mu.Lock()
			toolResults = append(toolResults, string(last.Content))
			mu.Unlock()
			chunk(`{"role":"assistant","content":"Valmis."}`, "")
			chunk(`{}`, "stop")
			fmt.Fprint(w, "data: [DONE]\n\n")
			return
		}
		file := "allowed.txt"
		if strings.Contains(string(last.Content), "toinen") {
			file = "denied.txt"
		}
		args, _ := json.Marshal(map[string]string{"command": "echo guarded > " + file})
		quoted, _ := json.Marshal(string(args))
		chunk(`{"role":"assistant","tool_calls":[{"index":0,"id":"call_guarded","type":"function","function":{"name":"bash","arguments":`+string(quoted)+`}}]}`, "")
		chunk(`{}`, "tool_calls")
		fmt.Fprint(w, "data: [DONE]\n\n")
	}))
	defer provider.Close()
	home := t.TempDir()
	cwd := filepath.Join(home, "src", "fixture")
	for _, dir := range []string{filepath.Join(home, ".pi", "agent"), cwd} {
		if err := os.MkdirAll(dir, 0700); err != nil {
			t.Fatal(err)
		}
	}
	models := map[string]any{"providers": map[string]any{"fixture": map[string]any{"baseUrl": provider.URL + "/v1", "api": "openai-completions", "apiKey": "synthetic", "authHeader": true, "models": []any{map[string]any{"id": "fake", "name": "Fake"}}}}}
	data, _ := json.Marshal(models)
	if err := os.WriteFile(filepath.Join(home, ".pi", "agent", "models.json"), data, 0600); err != nil {
		t.Fatal(err)
	}
	companion, err := installProcessExtension(home)
	if err != nil {
		t.Fatal(err)
	}
	id, _ := uuid()
	owner, err := acquirePiOwnership(home, id)
	if err != nil {
		t.Fatal(err)
	}
	defer owner.release()
	if err := owner.markBrowser("ws_example123", cwd); err != nil {
		t.Fatal(err)
	}
	ws, err := os.Open(cwd)
	if err != nil {
		t.Fatal(err)
	}
	defer ws.Close()
	// The hook loads before the companion: the API is looked up at call time.
	p, err := launchPiRPCCommand(nativeNodePath(t), []string{cli, "--provider", "fixture", "--model", "fake", "--thinking", "off", "--extension", hook, "--extension", companion}, home, cwd, []string{"PATH=/usr/bin:/bin"}, owner, ws, "ws_example123")
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	s := &conversation{id: id, cwd: cwd, rpc: p, state: "idle", commands: map[string]bool{}}
	c := &ConversationController{home: home, sessions: map[string]*conversation{id: s}, journal: newEventJournal()}
	go c.drain(s)
	pending := func() (string, map[string]any) {
		t.Helper()
		end := time.Now().Add(20 * time.Second)
		for time.Now().Before(end) {
			c.mu.Lock()
			qid, view := s.questionID, s.question
			c.mu.Unlock()
			if qid != "" {
				return qid, view
			}
			time.Sleep(10 * time.Millisecond)
		}
		t.Fatal("no permission question came")
		return "", nil
	}
	settled := func() {
		t.Helper()
		end := time.Now().Add(20 * time.Second)
		for time.Now().Before(end) {
			c.mu.Lock()
			done := s.settled
			c.mu.Unlock()
			if done {
				return
			}
			time.Sleep(10 * time.Millisecond)
		}
		t.Fatal("Pi did not settle")
	}
	answer := func(request string, allow bool) {
		t.Helper()
		body := fmt.Sprintf(`{"request_id":%q,"action":"answer","value":%v}`, request, allow)
		req := httptest.NewRequest("POST", AgentConversationsPath+"/"+id+"/question", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		c.agentConversations(w, req)
		if w.Code != 200 {
			t.Fatalf("answer %d %s", w.Code, w.Body.String())
		}
	}
	for i, allow := range []bool{true, false} {
		c.mu.Lock()
		s.settled = false
		c.mu.Unlock()
		text := "ensimmäinen"
		if !allow {
			text = "toinen"
		}
		if accepted, err := p.request("prompt", text, 15*time.Second); err != nil || !accepted {
			t.Fatalf("prompt %d: %v %v", i, accepted, err)
		}
		qid, view := pending()
		perm, _ := view["permission"].(map[string]any)
		call, _ := perm["call"].(map[string]any)
		account, _ := perm["account"].(map[string]any)
		if view["question_kind"] != "permission" || perm["action"] != "Delete the mail folder ‘Invoices 2024’" || account["address"] != "person@example.test" || call["tool"] != "bash" || !strings.Contains(fmt.Sprint(call["arguments"]), "echo guarded") {
			t.Fatalf("typed question %d: %+v", i, view)
		}
		answer(qid, allow)
		settled()
	}
	if b, err := os.ReadFile(filepath.Join(cwd, "allowed.txt")); err != nil || string(b) != "guarded\n" {
		t.Fatalf("the allowed call did not run: %q %v", b, err)
	}
	if _, err := os.Stat(filepath.Join(cwd, "denied.txt")); !os.IsNotExist(err) {
		t.Fatalf("the refused call ran: %v", err)
	}
	mu.Lock()
	results := strings.Join(toolResults, "\n")
	mu.Unlock()
	if !strings.Contains(results, "did not allow this call") {
		t.Fatalf("the agent was not told the call was refused: %s", results)
	}
	_, raw := questionEvents(c)
	validateEventFrames(t, raw)
}
