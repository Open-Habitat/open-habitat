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

	"github.com/open-habitat/open-habitat/internal/replyblock"
	"github.com/open-habitat/open-habitat/internal/transport"
)

// replySession writes a native session whose current branch is u1 → a1 → u2
// and whose a2 answered u1 on a branch Palaa tähän set aside.
func replySession(t *testing.T, home, id string) string {
	t.Helper()
	dir := filepath.Join(home, historyRoot, "--work--")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	lines := []string{
		fmt.Sprintf(`{"type":"session","version":3,"id":%q,"cwd":%q}`, id, home),
		`{"type":"message","id":"u1","parentId":null,"message":{"role":"user","content":"Miten korjataan kesäaika?"}}`,
		`{"type":"message","id":"a1","parentId":"u1","message":{"role":"assistant","content":[{"type":"thinking","thinking":"Pohdin ensin salaisesti."},{"type":"text","text":"Kaksi tapaa: zoneinfo tai kiinteä siirtymä. Valitse jompikumpi."},{"type":"toolCall","id":"c1","name":"bash","arguments":{"command":"ls"}}]}}`,
		`{"type":"message","id":"t1","parentId":"a1","message":{"role":"assistant","content":[{"type":"toolCall","id":"c2","name":"bash","arguments":{"command":"ls"}}]}}`,
		`{"type":"message","id":"a2","parentId":"u1","message":{"role":"assistant","content":"Sivuhaaran vastaus."}}`,
		`{"type":"message","id":"u2","parentId":"t1","message":{"role":"user","content":"Jatka."}}`,
	}
	path := filepath.Join(dir, "session.jsonl")
	if err := os.WriteFile(path, []byte(strings.Join(lines, "\n")+"\n"), 0600); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestReplyAdmissionBuildsBlockFromNativeSession(t *testing.T) {
	home := t.TempDir()
	id := "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
	replySession(t, home, id)
	received := filepath.Join(home, "received")
	script := filepath.Join(home, "pi")
	// The child records every message text it is given and accepts it.
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
	defer p.close()
	c := &ConversationController{home: home, cfg: transport.Config{Home: home, UID: os.Geteuid()}, sessions: map[string]*conversation{}}
	c.sessions[id] = &conversation{id: id, cwd: home, rpc: p, state: "idle", commands: map[string]bool{}}
	command := 0
	send := func(raw string) (int, string) {
		t.Helper()
		command++
		body := strings.Replace(raw, "CMD", fmt.Sprintf("bbbbbbbb-bbbb-4bbb-8bbb-%012d", command), 1)
		req := httptest.NewRequest("POST", "http://unix/api/v1/conversations/"+id+"/send", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		c.send(w, req, id)
		return w.Code, w.Body.String()
	}
	reply := func(key, message string) string {
		return fmt.Sprintf(`{"message":%q,"command_id":"CMD","reply_to":{"entry_key":%q}}`, message, key)
	}
	// Off by default: the field is not accepted at all.
	if code, out := send(reply("a1", "Ensimmäinen.")); code != 400 || !strings.Contains(out, "invalid_request") {
		t.Fatalf("switch off: %d %s", code, out)
	}
	if err := os.MkdirAll(filepath.Join(home, ".config", "open-habitat"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(home, ".config", "open-habitat", "preferences.json"), []byte(`{"engine":"codemirror6","experimental":{"reply-to-message":true}}`), 0600); err != nil {
		t.Fatal(err)
	}
	for name, raw := range map[string]string{
		"unknown field":  `{"message":"x","command_id":"CMD","reply_to":{"entry_key":"a1","excerpt":"forged words"}}`,
		"bad key":        reply("a 1", "x"),
		"slash command":  reply("a1", "/compact"),
		"missing key":    `{"message":"x","command_id":"CMD","reply_to":{}}`,
		"excerpt inline": `{"message":"x","command_id":"CMD","reply_to":"a1"}`,
	} {
		if code, out := send(raw); code != 400 {
			t.Fatalf("%s: %d %s", name, code, out)
		}
	}
	for name, key := range map[string]string{
		"a person's message":        "u1",
		"an assistant without text": "t1",
		"a set-aside branch":        "a2",
		"an unknown entry":          "zz",
	} {
		if code, out := send(reply(key, "x")); code != 409 || !strings.Contains(out, "reply_target_gone") {
			t.Fatalf("%s: %d %s", name, code, out)
		}
	}
	if _, err := os.Stat(received); !os.IsNotExist(err) {
		t.Fatalf("a refused reply reached Pi: %v", err)
	}
	if code, out := send(reply("a1", "Mennään ensimmäisellä.")); code != 200 {
		t.Fatalf("reply: %d %s", code, out)
	}
	deadline := time.Now().Add(5 * time.Second)
	var got []byte
	for time.Now().Before(deadline) {
		if got, _ = os.ReadFile(received); len(got) > 0 {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	var text string
	if json.Unmarshal(got, &text) != nil {
		t.Fatalf("Pi received %q", got)
	}
	want := "<reply-to entry=\"a1\">\nKaksi tapaa: zoneinfo tai kiinteä siirtymä. …\n</reply-to>\n\nMennään ensimmäisellä."
	if text != want {
		t.Fatalf("Pi received\n%q\nwant\n%q", text, want)
	}
	// The same POST again, after the switch went off in another tab: a
	// repeat is answered as the message it is, never refused.
	if err := os.WriteFile(filepath.Join(home, ".config", "open-habitat", "preferences.json"), []byte(`{"engine":"codemirror6","experimental":{}}`), 0600); err != nil {
		t.Fatal(err)
	}
	command--
	if code, out := send(reply("a1", "Mennään ensimmäisellä.")); code != 200 {
		t.Fatalf("repeat after the switch went off: %d %s", code, out)
	}
}

func TestReplyNeverJoinsHeldMessages(t *testing.T) {
	home := t.TempDir()
	id := "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
	replySession(t, home, id)
	if err := os.MkdirAll(filepath.Join(home, ".config", "open-habitat"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(home, ".config", "open-habitat", "preferences.json"), []byte(`{"engine":"codemirror6","experimental":{"reply-to-message":true}}`), 0600); err != nil {
		t.Fatal(err)
	}
	c := &ConversationController{home: home, cfg: transport.Config{Home: home, UID: os.Geteuid()}, sessions: map[string]*conversation{}}
	s := &conversation{id: id, cwd: home, rpc: stoppedRPC(), state: "starting", waking: true, commands: map[string]bool{}, held: []heldMessage{{id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", text: "Aiempi viesti."}}}
	c.sessions[id] = s
	req := httptest.NewRequest("POST", "http://unix/api/v1/conversations/"+id+"/send", strings.NewReader(`{"message":"Vastaus.","command_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","reply_to":{"entry_key":"a1"}}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	c.send(w, req, id)
	if w.Code != 409 || !strings.Contains(w.Body.String(), "control_uncertain") || len(s.held) != 1 {
		t.Fatalf("reply behind a held message: %d %s held=%d", w.Code, w.Body.String(), len(s.held))
	}
}

func TestReplyProjection(t *testing.T) {
	native := replyblock.Build("a1", "Kaksi tapaa: zoneinfo. …", "Mennään ensimmäisellä.")
	for name, content := range map[string]string{
		"string": mustJSON(native),
		"blocks": mustJSON([]map[string]string{{"type": "text", "text": native}}),
	} {
		t.Run(name, func(t *testing.T) {
			raw := `{"type":"message","id":"u3","parentId":"a1","message":{"role":"user","content":` + content + `}}`
			var e nativeEntry
			if err := json.Unmarshal([]byte(raw), &e); err != nil {
				t.Fatal(err)
			}
			e.Raw = json.RawMessage(raw)
			out := nativeBlocks(e)
			inline(nil, &out)
			if out.ReplyTo == nil || out.ReplyTo.EntryKey != "a1" || out.ReplyTo.Excerpt != "Kaksi tapaa: zoneinfo. …" {
				t.Fatalf("reply_to %+v", out.ReplyTo)
			}
			if out.Content.Text != "Mennään ensimmäisellä." || len(out.Blocks) != 1 || out.Blocks[0].Text != "Mennään ensimmäisellä." {
				t.Fatalf("content %q blocks %+v", out.Content.Text, out.Blocks)
			}
			payload := nativeEntryPayload(out)
			if payload["reply_to"] != out.ReplyTo {
				t.Fatalf("event payload lacks reply_to: %v", payload)
			}
		})
	}
	// Only the person's own messages carry a reply; an agent quoting the
	// block is ordinary text.
	raw := `{"type":"message","id":"a9","message":{"role":"assistant","content":` + mustJSON(native) + `}}`
	var e nativeEntry
	_ = json.Unmarshal([]byte(raw), &e)
	e.Raw = json.RawMessage(raw)
	if out := nativeBlocks(e); out.ReplyTo != nil {
		t.Fatalf("assistant text projected as a reply")
	}
	// A reply whose own text is a pasted skill record keeps it as text: the
	// two wrappers are exclusive, so block reads match the preview.
	skill := "<skill name=\"x\" location=\"/s/SKILL.md\">\nbody\n</skill>"
	if got := userText(replyblock.Build("a1", "e", skill)); got != skill {
		t.Fatalf("reply body read as a skill: %q", got)
	}
	// Pi's queue and held messages give back what the person wrote.
	if got := writtenText("/home/x", native); got != "Mennään ensimmäisellä." {
		t.Fatalf("queue text %q", got)
	}
	if got := heldView([]heldMessage{{id: "c", text: native}}); got[0]["text"] != "Mennään ensimmäisellä." {
		t.Fatalf("held text %q", got[0]["text"])
	}
}
