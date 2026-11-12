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

	"github.com/open-habitat/open-habitat/internal/core"
	"github.com/open-habitat/open-habitat/internal/testpython"
	"github.com/open-habitat/open-habitat/internal/transport"
)

// TestCompactThroughPinnedPi asks the pinned Pi to compact through the
// daemon's route against a synthetic model: Pi's refusal of a conversation
// too small, the compaction with the person's instructions recorded in the
// native session, and Pi's refusal right after it.
func TestCompactThroughPinnedPi(t *testing.T) {
	cli, err := filepath.Abs(filepath.Join("pi-device-test", "node_modules", "@earendil-works", "pi-coding-agent", "dist", "bundle", "cli.js"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(cli); err != nil {
		t.Skip("pinned Pi test dependency not installed")
	}
	var mu sync.Mutex
	var asked []string
	var hold chan struct{} // while set, a summary request waits for it
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Messages []struct {
				Content json.RawMessage `json:"content"`
			} `json:"messages"`
		}
		if r.URL.Path != "/v1/chat/completions" || json.NewDecoder(r.Body).Decode(&body) != nil || len(body.Messages) == 0 {
			w.WriteHeader(400)
			return
		}
		last := string(body.Messages[len(body.Messages)-1].Content)
		mu.Lock()
		asked = append(asked, last)
		mu.Unlock()
		answer := "Selvä, " + strings.Repeat("vastaus ", 200)
		if strings.Contains(last, "summary") || strings.Contains(last, "Summary") {
			answer = "## Goal\\nSynthetic summary."
			mu.Lock()
			wait := hold
			mu.Unlock()
			if wait != nil {
				<-wait
			}
		}
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprintf(w, "data: {\"id\":\"s\",\"object\":\"chat.completion.chunk\",\"created\":0,\"model\":\"fake\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"content\":\"%s\"},\"finish_reason\":null}]}\n\n", answer)
		fmt.Fprint(w, "data: {\"id\":\"s\",\"object\":\"chat.completion.chunk\",\"created\":0,\"model\":\"fake\",\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}]}\n\ndata: [DONE]\n\n")
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
	// The person keeps little: Pi has something to compact after two turns.
	if err := os.WriteFile(filepath.Join(home, ".pi", "agent", "settings.json"), []byte(`{"compaction":{"keepRecentTokens":100}}`), 0600); err != nil {
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
	p, err := launchPiRPCCommand(nativeNodePath(t), []string{cli, "--provider", "fixture", "--model", "fake"}, home, cwd, []string{"PATH=/usr/bin:/bin"}, owner, ws, "ws_example123")
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	settled := make(chan struct{}, 8)
	// Pi's own compaction_end frames, as the journal publishes them: the
	// conversation shows how each compaction ended from these.
	ended := make(chan string, 8)
	journal := newEventJournal()
	published := &ConversationController{journal: journal}
	go func() {
		for event := range p.events {
			if strings.Contains(string(event), `"type":"agent_settled"`) {
				settled <- struct{}{}
			}
			if strings.Contains(string(event), `"type":"compaction_end"`) {
				published.publishDelta("pi:"+id, event)
				_, _, _, tails := journal.turnView()
				frames := tails["pi:"+id].frames
				ended <- string(frames[len(frames)-1])
			}
		}
	}()
	endedWith := func(outcome string) {
		t.Helper()
		select {
		case frame := <-ended:
			if !strings.Contains(frame, `"outcome":"`+outcome+`"`) || strings.Contains(frame, "Synthetic summary") {
				t.Fatalf("compaction_end, want %s: %s", outcome, frame)
			}
		case <-time.After(10 * time.Second):
			t.Fatalf("Pi sent no compaction_end (want %s)", outcome)
		}
	}
	turn := func(text string) {
		t.Helper()
		if accepted, err := p.request("prompt", text, 15*time.Second); !accepted || err != nil {
			t.Fatalf("prompt %q: %v %v", text, accepted, err)
		}
		select {
		case <-settled:
		case <-time.After(20 * time.Second):
			t.Fatalf("native Pi did not settle after %q", text)
		}
	}
	controller := &ConversationController{home: home, cfg: transport.Config{Home: home, UID: os.Geteuid()}, sessions: map[string]*conversation{}}
	s := &conversation{id: id, cwd: cwd, rpc: p, state: "idle"}
	controller.sessions[id] = s
	post := func(body string) *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodPost, "http://unix/api/v1/conversations/"+id+"/compact", strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		controller.compact(w, r, id)
		return w
	}

	// Nothing said yet: Pi's own refusal, and nothing is left compacting.
	if w := post(`{}`); w.Code != 409 || !strings.Contains(w.Body.String(), "nothing_to_compact") || s.compacting {
		t.Fatalf("empty conversation: %d %s", w.Code, w.Body.String())
	}
	endedWith("nothing_to_compact")
	turn("Ensimmäinen kysymys " + strings.Repeat("sana ", 300))
	turn("Toinen kysymys " + strings.Repeat("sana ", 300))
	turn("Kolmas kysymys")

	// A running turn is never cut off.
	s.state = "accepted"
	if w := post(`{}`); w.Code != 409 || !strings.Contains(w.Body.String(), "turn_running") {
		t.Fatalf("running turn: %d %s", w.Code, w.Body.String())
	}
	s.state = "idle"
	if w := post(`{"instructions":"x","keep":1}`); w.Code != 400 {
		t.Fatalf("unknown field: %d", w.Code)
	}
	if w := post(`{"instructions":"` + strings.Repeat("x", 2001) + `"}`); w.Code != 400 {
		t.Fatalf("long instructions: %d", w.Code)
	}

	w := post(`{"instructions":"Säilytä luvut tarkkoina"}`)
	var result struct {
		AgentID      string `json:"agent_id"`
		State        string `json:"state"`
		TokensBefore int64  `json:"tokens_before"`
	}
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &result) != nil || result.State != "done" || result.AgentID != "pi:"+id || result.TokensBefore == 0 || s.compacting {
		t.Fatalf("compaction: %d %s", w.Code, w.Body.String())
	}
	validateCompaction(t, w.Body.Bytes())
	endedWith("done")
	mu.Lock()
	instructed := false
	for _, text := range asked {
		instructed = instructed || strings.Contains(text, "Säilytä luvut tarkkoina")
	}
	mu.Unlock()
	if !instructed {
		t.Fatalf("the person's instructions did not reach Pi's summary request")
	}
	sessions, err := nativeSessions(controller.nativeCfg())
	if err != nil || len(sessions) != 1 {
		t.Fatalf("native sessions: %v", err)
	}
	raw, _ := os.ReadFile(sessions[0].path)
	if !strings.Contains(string(raw), `"type":"compaction"`) || !strings.Contains(string(raw), "Synthetic summary") {
		t.Fatalf("Pi recorded no compaction:\n%s", raw)
	}

	// Right after it, Pi refuses until the conversation continues.
	if w := post(`{}`); w.Code != 409 || !strings.Contains(w.Body.String(), "already_compacted") {
		t.Fatalf("again: %d %s", w.Code, w.Body.String())
	}
	endedWith("already_compacted")
	// The channel stays usable for ordinary requests.
	turn("Jatketaan " + strings.Repeat("sana ", 300))
	turn("Ja vielä")

	// A summary slower than the request's wait: the answer is uncertain,
	// but Pi still compacts, so a send is held and another compaction
	// refused until Pi answers.
	release := make(chan struct{})
	mu.Lock()
	hold = release
	mu.Unlock()
	defer func(old time.Duration) { compactWait = old }(compactWait)
	compactWait = 300 * time.Millisecond
	if w := post(`{}`); w.Code != 503 || !strings.Contains(w.Body.String(), "control_uncertain") {
		t.Fatalf("slow summary: %d %s", w.Code, w.Body.String())
	}
	controller.mu.Lock()
	still := s.compacting
	controller.mu.Unlock()
	if !still {
		t.Fatal("the compacting fence ended before Pi answered")
	}
	if w := post(`{}`); w.Code != 409 || !strings.Contains(w.Body.String(), `"compacting"`) {
		t.Fatalf("second compaction while Pi compacts: %d %s", w.Code, w.Body.String())
	}
	close(release)
	deadline := time.Now().Add(10 * time.Second)
	for {
		controller.mu.Lock()
		still = s.compacting
		controller.mu.Unlock()
		if !still {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("Pi's late answer did not end the compacting fence")
		}
		time.Sleep(50 * time.Millisecond)
	}
}

func validateCompaction(t *testing.T, body []byte) {
	t.Helper()
	python := testpython.Validator(t)
	cmd := exec.Command(python, "-c", `import sys,runpy,json; m=runpy.run_path('../../scripts/validate-contracts.py'); m['Draft202012Validator'](m['schemas']['compaction.schema.json'],registry=m['registry'],format_checker=m['format_checker']).validate(json.load(sys.stdin))`)
	cmd.Stdin = bytes.NewReader(body)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("compaction schema: %s: %v", out, err)
	}
}

// The route's own refusals, before Pi is asked anything.
func TestCompactRefusals(t *testing.T) {
	controller := &ConversationController{sessions: map[string]*conversation{}}
	const id = "99999999-9999-4999-8999-999999999999"
	post := func() *httptest.ResponseRecorder {
		w := httptest.NewRecorder()
		r := httptest.NewRequest(http.MethodPost, "http://unix/api/v1/conversations/"+id+"/compact", strings.NewReader(`{}`))
		r.Header.Set("Content-Type", "application/json")
		controller.compact(w, r, id)
		return w
	}
	if w := post(); w.Code != 404 {
		t.Fatalf("no handle: %d", w.Code)
	}
	s := &conversation{id: id, rpc: stoppedRPC(), state: "stopped", dead: true}
	controller.sessions[id] = s
	if w := post(); w.Code != 404 {
		t.Fatalf("Pi not running: %d", w.Code)
	}
	s.dead, s.state, s.rpc = false, "idle", &piRPC{}
	s.compacting = true
	if w := post(); w.Code != 409 || !strings.Contains(w.Body.String(), `"compacting"`) {
		t.Fatalf("already compacting: %d %s", w.Code, w.Body.String())
	}
	// A message sent while Pi compacts is held for Pi, not refused by it,
	// and nothing starts a second Pi.
	controller.runtime = &core.PiRuntimeConfig{Node: "/bin/sh", Entry: "/bin/fake", Manifest: "/bin/fake"}
	s.commands = map[string]bool{}
	w := httptest.NewRecorder()
	r := httptest.NewRequest(http.MethodPost, "http://unix/api/v1/conversations/"+id+"/send", strings.NewReader(`{"message":"hei","command_id":"11111111-1111-4111-8111-111111111111"}`))
	r.Header.Set("Content-Type", "application/json")
	controller.admitMessage(w, r, id, "send", true)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"held"`) || len(s.held) != 1 || s.state != "idle" {
		t.Fatalf("send while compacting: %d %s %+v %s", w.Code, w.Body.String(), s.held, s.state)
	}
	// The held message is still to be delivered: no compaction before it.
	s.compacting = false
	if w := post(); w.Code != 409 || !strings.Contains(w.Body.String(), "turn_running") {
		t.Fatalf("held message: %d %s", w.Code, w.Body.String())
	}
}

func TestParseCompactReply(t *testing.T) {
	for frame, want := range map[string]string{
		`{"type":"response","id":"1","command":"compact","success":true,"data":{"tokensBefore":120,"estimatedTokensAfter":30}}`: "done",
		`{"type":"response","id":"1","command":"compact","success":false,"error":"Already compacted"}`:                          "already_compacted",
		`{"type":"response","id":"1","command":"compact","success":false,"error":"Nothing to compact (session too small)"}`:     "nothing_to_compact",
		`{"type":"response","id":"1","command":"compact","success":false,"error":"Compaction cancelled"}`:                       "cancelled",
		`{"type":"response","id":"1","command":"compact","success":false,"error":"401 from the provider: your text"}`:           "failed",
		`{"type":"response","id":"1","command":"prompt","success":true}`:                                                        "uncertain",
	} {
		if got := parseCompactReply(json.RawMessage(frame)); got.Outcome != want {
			t.Fatalf("%s: %s, want %s", frame, got.Outcome, want)
		}
	}
	if got := parseCompactReply(json.RawMessage(`{"type":"response","command":"compact","success":true,"data":{"tokensBefore":120,"estimatedTokensAfter":30}}`)); got.TokensBefore != 120 || got.TokensAfter != 30 {
		t.Fatalf("numbers: %+v", got)
	}
}
