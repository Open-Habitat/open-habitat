//go:build linux

package daemon

import (
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/agentblock"
	"github.com/open-habitat/open-habitat/internal/transport"
)

const (
	aamTarget     = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
	aamSender     = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
	aamWorkspace  = "ws_example123"
	aamGeneration = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
	aamReceived   = "11111111-1111-4111-8111-111111111111"
	aamSent       = "22222222-2222-4222-8222-222222222222"
)

// sentResult is the bash tool result of `agent message create`: the CLI's
// warning on stderr, then its JSON envelope.
func sentResult(messageID, text string) string {
	result, _ := json.Marshal(map[string]any{"schema_version": 1, "data": map[string]any{"cli_version": "test", "result": map[string]any{
		"schema_version": 1, "command_id": messageID, "state": "pending", "kind": "agent_message_sent", "message_id": messageID,
		"to": "pi:" + aamTarget, "title": "Kaaviot", "workspace_id": aamWorkspace, "delivery": "send", "text": text,
		"conversation_url": "/workspaces/" + aamWorkspace + "?conversation=pi:" + aamTarget,
	}}, "warnings": []string{"x"}})
	return "warning: Do not automatically replay writes.\n" + string(result)
}

// aamSessions writes the target's and the sender's native sessions. The
// sender has received one agent message (aamReceived) and sent one
// (aamSent), both on its current branch.
func aamSessions(t *testing.T, home string) string {
	t.Helper()
	dir := filepath.Join(home, historyRoot, "--work--")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	received := agentblock.Build(agentblock.Sender{Agent: "pi:" + aamTarget, Title: "Kaaviot", Workspace: aamWorkspace}, aamReceived, nil, "Huomasin, että syyskuu puuttuu. Kuvaajassa on vain kaksi kuukautta.")
	content, _ := json.Marshal([]map[string]string{{"type": "text", "text": sentResult(aamSent, "Lisäsin syyskuun rivin. Päivitä kuvaaja.")}})
	receivedJSON, _ := json.Marshal(received)
	sender := []string{
		fmt.Sprintf(`{"type":"session","version":3,"id":%q,"cwd":%q}`, aamSender, home),
		`{"type":"message","id":"u1","parentId":null,"timestamp":"2026-11-26T07:38:00Z","message":{"role":"user","content":"Tee raportti."}}`,
		`{"type":"session_info","id":"i1","parentId":"u1","name":"Kvartaaliraportti"}`,
		`{"type":"message","id":"u2","parentId":"i1","timestamp":"2026-11-26T07:46:00Z","message":{"role":"user","content":` + string(receivedJSON) + `}}`,
		`{"type":"message","id":"a1","parentId":"u2","message":{"role":"assistant","content":[{"type":"toolCall","id":"c1","name":"bash","arguments":{"command":"open-habitat agent message create --text-file -"}}]}}`,
		`{"type":"message","id":"t1","parentId":"a1","timestamp":"2026-11-26T07:51:00Z","message":{"role":"toolResult","toolCallId":"c1","toolName":"bash","content":` + string(content) + `}}`,
	}
	path := filepath.Join(dir, "sender.jsonl")
	if err := os.WriteFile(path, []byte(strings.Join(sender, "\n")+"\n"), 0600); err != nil {
		t.Fatal(err)
	}
	target := []string{
		fmt.Sprintf(`{"type":"session","version":3,"id":%q,"cwd":%q}`, aamTarget, home),
		`{"type":"message","id":"v1","parentId":null,"message":{"role":"user","content":"Tee kuvaaja 2."}}`,
		`{"type":"session_info","id":"j1","parentId":"v1","name":"Kaaviot"}`,
	}
	if err := os.WriteFile(filepath.Join(dir, "target.jsonl"), []byte(strings.Join(target, "\n")+"\n"), 0600); err != nil {
		t.Fatal(err)
	}
	return path
}

// recordingPi is a child that records every message text it is given and
// accepts it.
func recordingPi(t *testing.T, home, received string) *piRPC {
	t.Helper()
	script := filepath.Join(home, "pi-"+filepath.Base(received))
	body := `#!/usr/bin/env python3
import sys,json
for line in sys.stdin:
 r=json.loads(line)
 if r['type'] in ('prompt','steer','follow_up'):
  open(` + fmt.Sprintf("%q", received) + `,'a').write(json.dumps(r['message'])+'\n')
 print(json.dumps({'type':'response','id':r['id'],'command':r['type'],'success':True}),flush=True)
`
	if err := os.WriteFile(script, []byte(body), 0700); err != nil {
		t.Fatal(err)
	}
	p, err := launchPiRPC(script, home, home, "", []string{"PATH=/usr/bin:/bin"})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = p.close() })
	return p
}

func lastReceived(t *testing.T, path string, count int) string {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		got, _ := os.ReadFile(path)
		lines := strings.Split(strings.TrimSpace(string(got)), "\n")
		if len(got) > 0 && len(lines) >= count {
			var text string
			if json.Unmarshal([]byte(lines[count-1]), &text) != nil {
				t.Fatalf("Pi received %q", lines[count-1])
			}
			return text
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("Pi received no message %d", count)
	return ""
}

func TestAgentRouteMarksEveryMessageWithItsSender(t *testing.T) {
	home := t.TempDir()
	aamSessions(t, home)
	received := filepath.Join(home, "received")
	target := recordingPi(t, home, received)
	sender := recordingPi(t, home, filepath.Join(home, "sender-received"))
	sender.processGeneration = aamGeneration
	c := &ConversationController{home: home, cfg: transport.Config{Home: home, UID: os.Geteuid()}, sessions: map[string]*conversation{}}
	c.sessions[aamTarget] = &conversation{id: aamTarget, cwd: home, workspace: aamWorkspace, rpc: target, state: "idle", commands: map[string]bool{}}
	c.sessions[aamSender] = &conversation{id: aamSender, cwd: home, workspace: aamWorkspace, rpc: sender, state: "accepted", commands: map[string]bool{}}
	command := 0
	post := func(route bool, fields string) (int, string) {
		t.Helper()
		command++
		body := fmt.Sprintf(`{"message":"Päivitä kuvaaja 2.","command_id":"bbbbbbbb-bbbb-4bbb-8bbb-%012d"%s}`, command, fields)
		req := httptest.NewRequest("POST", "http://unix/agent/v1/conversations/"+aamTarget+"/send", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		if route {
			c.sendAgentMessage(w, req, aamTarget, "send")
		} else {
			c.admitMessage(w, req, aamTarget, "send", true, nil)
		}
		return w.Code, w.Body.String()
	}
	from := func(generation string) string {
		return fmt.Sprintf(`,"from":{"agent_id":"pi:%s","workspace_id":%q,"generation":%q}`, aamSender, aamWorkspace, generation)
	}

	// The browser route never takes the agent's fields, and the agent route
	// never takes the browser's.
	for name, raw := range map[string]struct {
		route  bool
		fields string
	}{
		"browser from":     {false, from(aamGeneration)},
		"browser quote":    {false, `,"quote":"` + aamReceived + `"`},
		"agent reply_to":   {true, `,"reply_to":{"entry_key":"u1"}`},
		"agent bad from":   {true, `,"from":{"agent_id":"pi:x","workspace_id":"ws_example123","generation":"` + aamGeneration + `"}`},
		"agent bad quote":  {true, `,"quote":"m1"`},
		"agent extra from": {true, `,"from":{"agent_id":"pi:` + aamSender + `","workspace_id":"ws_example123","generation":"` + aamGeneration + `","title":"forged"}`},
	} {
		if code, out := post(raw.route, raw.fields); code != 400 || !strings.Contains(out, "invalid_request") {
			t.Fatalf("%s: %d %s", name, code, out)
		}
	}
	// A launch context that is not the live launch is refused, never
	// downgraded to outside.
	if code, out := post(true, from("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")); code != 409 || !strings.Contains(out, "current_context_stale") {
		t.Fatalf("stale launch: %d %s", code, out)
	}
	// A quote must be a message of the sender's own conversation, and an
	// agent outside a conversation has none.
	if code, out := post(true, from(aamGeneration)+`,"quote":"33333333-3333-4333-8333-333333333333"`); code != 400 || !strings.Contains(out, "quote_not_found") {
		t.Fatalf("unknown quote: %d %s", code, out)
	}
	if code, out := post(true, `,"quote":"`+aamReceived+`"`); code != 400 || !strings.Contains(out, "quote_not_found") {
		t.Fatalf("outside quote: %d %s", code, out)
	}
	if _, err := os.Stat(received); !os.IsNotExist(err) {
		t.Fatalf("a refused message reached Pi: %v", err)
	}

	// Without a launch context: an agent outside the person's
	// conversations, still never the person.
	code, out := post(true, "")
	if code != 200 {
		t.Fatalf("outside: %d %s", code, out)
	}
	validateAgainstSchema(t, "agent-message-sent.schema.json", "", []byte(out))
	text := lastReceived(t, received, 1)
	block, rest, ok := agentblock.Parse(text)
	if !ok || block.From.Agent != agentblock.Outside || rest != "Päivitä kuvaaja 2." || block.Message != "bbbbbbbb-bbbb-4bbb-8bbb-000000000010" {
		t.Fatalf("outside block: %+v %q %q", block, rest, text)
	}
	c.mu.Lock()
	c.sessions[aamTarget].state = "idle"
	c.mu.Unlock()

	// From the live launch, quoting the message the sender received: the
	// sender's title and workspace, and the quote names who sent it.
	code, out = post(true, from(aamGeneration)+`,"quote":"`+aamReceived+`"`)
	if code != 200 {
		t.Fatalf("quote received: %d %s", code, out)
	}
	validateAgainstSchema(t, "agent-message-sent.schema.json", "", []byte(out))
	var sent sentAgentMessage
	if err := json.Unmarshal([]byte(out), &sent); err != nil {
		t.Fatal(err)
	}
	if sent.Kind != "agent_message_sent" || sent.MessageID != sent.CommandID || sent.To != "pi:"+aamTarget || sent.Title != "Kaaviot" || sent.WorkspaceID != aamWorkspace || sent.Delivery != "send" || sent.State != "pending" || sent.Text != "Päivitä kuvaaja 2." ||
		sent.ConversationURL != "/workspaces/"+aamWorkspace+"?conversation=pi:"+aamTarget || sent.MessageURL != sent.ConversationURL+"&message="+sent.MessageID ||
		sent.Quote == nil || sent.Quote.MessageID != aamReceived || sent.Quote.FromAgentID == nil || *sent.Quote.FromAgentID != "pi:"+aamTarget || sent.Quote.Excerpt != "Huomasin, että syyskuu puuttuu. …" {
		t.Fatalf("typed result: %s", out)
	}
	text = lastReceived(t, received, 2)
	want := `<agent-message from="pi:` + aamSender + `" title="Kvartaaliraportti" workspace="` + aamWorkspace + `" message="` + sent.MessageID + `">
Habitat: the agent of the person's conversation "Kvartaaliraportti" sends this. It is not the person's own words.
<quote message="` + aamReceived + `" from="pi:` + aamTarget + `">
Huomasin, että syyskuu puuttuu. …
</quote>
</agent-message>

Päivitä kuvaaja 2.`
	if text != want {
		t.Fatalf("Pi received\n%s\nwant\n%s", text, want)
	}
	c.mu.Lock()
	c.sessions[aamTarget].state = "idle"
	c.mu.Unlock()

	// Quoting a message the sender sent itself, found from its tool result.
	if code, out = post(true, from(aamGeneration)+`,"quote":"`+aamSent+`"`); code != 200 {
		t.Fatalf("quote sent: %d %s", code, out)
	}
	block, _, ok = agentblock.Parse(lastReceived(t, received, 3))
	if !ok || block.Quote == nil || block.Quote.From != "pi:"+aamSender || block.Quote.Excerpt != "Lisäsin syyskuun rivin. …" {
		t.Fatalf("own quote: %+v", block)
	}
}

func TestHeldAgentMessageNeverJoinsAnother(t *testing.T) {
	agent := agentblock.Build(agentblock.Sender{Agent: agentblock.Outside}, aamReceived, nil, "x")
	if heldHasAgentMessage([]heldMessage{{text: "oma viesti"}}) || !heldHasAgentMessage([]heldMessage{{text: "oma"}, {text: agent}}) {
		t.Fatal("held agent message detection")
	}
	home := t.TempDir()
	c := &ConversationController{home: home, cfg: transport.Config{Home: home, UID: os.Geteuid()}, sessions: map[string]*conversation{}}
	// Pi is starting for a held message: neither a person's message after an
	// agent's nor an agent's after a person's joins it.
	for name, held := range map[string]string{"after agent": agent, "after person": "oma viesti"} {
		c.sessions[aamTarget] = &conversation{id: aamTarget, cwd: home, workspace: aamWorkspace, rpc: stoppedRPC(), state: "starting", commands: map[string]bool{}, held: []heldMessage{{id: "x", text: held}}}
		req := httptest.NewRequest("POST", "http://unix/x", strings.NewReader(`{"message":"lisää","command_id":"bbbbbbbb-bbbb-4bbb-8bbb-000000000001"}`))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		if held == agent {
			c.admitMessage(w, req, aamTarget, "send", true, nil)
		} else {
			c.sendAgentMessage(w, req, aamTarget, "send")
		}
		if w.Code != 409 || len(c.sessions[aamTarget].held) != 1 {
			t.Fatalf("%s: %d %s", name, w.Code, w.Body.String())
		}
	}
}

func TestHistoryProjectsAgentMessagesBothWays(t *testing.T) {
	home := t.TempDir()
	path := aamSessions(t, home)
	loaded := readNative(path, os.Geteuid())
	var in, out *historyEntry
	for i := range loaded.entries {
		switch loaded.entries[i].Key {
		case "u2":
			in = &loaded.entries[i]
		case "t1":
			out = &loaded.entries[i]
		}
	}
	if in == nil || out == nil {
		t.Fatalf("entries: %+v", loaded.entries)
	}
	inline(&loaded, in)
	inline(&loaded, out)
	if in.AgentMessage == nil || in.AgentMessage.MessageID != aamReceived || in.AgentMessage.FromAgentID == nil || *in.AgentMessage.FromAgentID != "pi:"+aamTarget || in.AgentMessage.Title != "Kaaviot" || in.AgentMessage.WorkspaceID != aamWorkspace {
		t.Fatalf("agent_message: %+v", in.AgentMessage)
	}
	if in.Content.Text != "Huomasin, että syyskuu puuttuu. Kuvaajassa on vain kaksi kuukautta." || strings.Contains(in.Blocks[0].Text, "<agent-message") {
		t.Fatalf("received text keeps the block: %q / %q", in.Content.Text, in.Blocks[0].Text)
	}
	if out.SentAgentMessage == nil || out.SentAgentMessage.MessageID != aamSent || out.SentAgentMessage.Text != "Lisäsin syyskuun rivin. Päivitä kuvaaja." || out.SentAgentMessage.To != "pi:"+aamTarget || out.SentAgentMessage.ConversationURL != "" {
		t.Fatalf("sent_agent_message: %+v", out.SentAgentMessage)
	}
	page, _ := json.Marshal(map[string]any{"schema_version": 1, "agent_id": "pi:" + aamSender, "native_revision": "r1", "entries": []historyEntry{*in, *out}, "complete": true})
	validateHistoryPage(t, string(page))

	// A participant of a shared conversation reads "the owner's other
	// conversation": no title, workspace or id, and no tool output that
	// would name them.
	guestAgentMessage(in)
	guestAgentMessage(out)
	if in.AgentMessage.FromAgentID != nil || in.AgentMessage.Title != "" || in.AgentMessage.WorkspaceID != "" || out.SentAgentMessage.To != "" || out.SentAgentMessage.Title != "" || out.Blocks != nil || out.Content.Text != "" {
		t.Fatalf("guest read: %+v %+v %+v", in.AgentMessage, out.SentAgentMessage, out.Blocks)
	}
	page, _ = json.Marshal(map[string]any{"schema_version": 1, "agent_id": "pi:" + aamSender, "native_revision": "r1", "entries": []historyEntry{*in, *out}, "complete": true})
	if strings.Contains(string(page), "Kaaviot") || strings.Contains(string(page), aamWorkspace) {
		t.Fatalf("guest page names the other conversation: %s", page)
	}
	validateHistoryPage(t, string(page))
	payload := map[string]any{"agent_message": map[string]any{"message_id": aamReceived, "from_agent_id": "pi:" + aamTarget, "title": "Kaaviot", "workspace_id": aamWorkspace}}
	if !guestAgentMessagePayload(payload) || strings.Contains(fmt.Sprint(payload), "Kaaviot") {
		t.Fatalf("guest live entry: %v", payload)
	}
}

func TestSentResultIsRecognisedOnlyFromTheTypedOutput(t *testing.T) {
	message := func(tool, text string, isError bool) json.RawMessage {
		content, _ := json.Marshal([]map[string]string{{"type": "text", "text": text}})
		raw, _ := json.Marshal(map[string]any{"role": "toolResult", "toolName": tool, "isError": isError, "content": json.RawMessage(content)})
		return raw
	}
	good := sentResult(aamSent, "viesti")
	if sent, ok := sentAgentMessageResult(message("bash", good, false)); !ok || sent.MessageID != aamSent {
		t.Fatal("typed result not recognised")
	}
	for name, raw := range map[string]json.RawMessage{
		"other tool":   message("read", good, false),
		"failed":       message("bash", good, true),
		"prose":        message("bash", `I ran agent message create, "agent_message_sent".`, false),
		"wrong kind":   message("bash", strings.Replace(good, "agent_message_sent", "agent_message_held", 1)+` "agent_message_sent"`, false),
		"bad delivery": message("bash", strings.Replace(good, `"delivery":"send"`, `"delivery":"later"`, 1), false),
		"no text":      message("bash", strings.Replace(good, `"text":"viesti"`, `"text":""`, 1), false),
	} {
		if _, ok := sentAgentMessageResult(raw); ok {
			t.Fatalf("%s recognised", name)
		}
	}
}

func TestQueueNamesTheSendingConversation(t *testing.T) {
	text := agentblock.Build(agentblock.Sender{Agent: "pi:" + aamSender, Title: "Kvartaaliraportti", Workspace: aamWorkspace}, aamReceived, nil, "Syyskuu puuttuu.")
	if got := writtenText(t.TempDir(), text); got != "Kvartaaliraportti: Syyskuu puuttuu." {
		t.Fatalf("queue text = %q", got)
	}
	outside := agentblock.Build(agentblock.Sender{Agent: agentblock.Outside}, aamReceived, nil, "x")
	if got := writtenText(t.TempDir(), outside); got != "open-habitat agent: x" {
		t.Fatalf("outside queue text = %q", got)
	}
	if got := writtenText(t.TempDir(), "oma viesti"); got != "oma viesti" {
		t.Fatalf("person's queue text = %q", got)
	}
}
