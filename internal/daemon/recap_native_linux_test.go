//go:build linux

package daemon

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

func TestRecapPinnedPiNativePersistence(t *testing.T) {
	cli, err := filepath.Abs(filepath.Join("pi-device-test", "node_modules", "@earendil-works", "pi-coding-agent", "dist", "bundle", "cli.js"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(cli); err != nil {
		t.Skip("pinned Pi test dependency not installed")
	}
	ext, err := filepath.Abs("recap-extension.mjs")
	if err != nil {
		t.Fatal(err)
	}
	var calls atomic.Int32
	entered, release := make(chan struct{}, 1), make(chan struct{})
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		count := calls.Add(1)
		if r.URL.Path != "/v1/chat/completions" || r.Header.Get("Authorization") != "Bearer synthetic" {
			t.Errorf("unexpected provider request: %s", r.URL.Path)
			w.WriteHeader(400)
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		answer := "First response"
		if count > 1 {
			entered <- struct{}{}
			<-release
			answer = `{"recap":"Synthetic task done.","next":"Check result"}`
		}
		b, _ := json.Marshal(answer)
		fmt.Fprintf(w, "data: {\"id\":\"synthetic\",\"object\":\"chat.completion.chunk\",\"created\":0,\"model\":\"fake\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"content\":%s},\"finish_reason\":null}]}\n\n", b)
		fmt.Fprint(w, "data: {\"id\":\"synthetic\",\"object\":\"chat.completion.chunk\",\"created\":0,\"model\":\"fake\",\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}]}\n\ndata: [DONE]\n\n")
	}))
	defer provider.Close()
	defer func() {
		select {
		case <-release:
		default:
			close(release)
		}
	}()
	home := t.TempDir()
	cwd := filepath.Join(home, "src", "fixture")
	if err := os.MkdirAll(filepath.Join(home, ".pi", "agent"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(cwd, 0700); err != nil {
		t.Fatal(err)
	}
	models := map[string]any{"providers": map[string]any{"fixture": map[string]any{"baseUrl": provider.URL + "/v1", "api": "openai-completions", "apiKey": "synthetic", "authHeader": true, "models": []any{map[string]any{"id": "fake", "name": "Fake"}}}}}
	data, _ := json.Marshal(models)
	if err := os.WriteFile(filepath.Join(home, ".pi", "agent", "models.json"), data, 0600); err != nil {
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
	p, err := launchPiRPCCommand(nativeNodePath(t), []string{cli, "--provider", "fixture", "--model", "fake", "--extension", ext, "--extension", filepath.Join(filepath.Dir(ext), "process-extension.mjs")}, home, cwd, []string{"PATH=/usr/bin:/bin"}, owner, ws, "ws_example123")
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	if accepted, err := p.request("prompt", "Do the synthetic task", 15*time.Second); !accepted || err != nil {
		t.Fatalf("prompt %v %v", accepted, err)
	}
	timeout := time.After(15 * time.Second)
	for {
		select {
		case event := <-p.events:
			if strings.Contains(string(event), `"type":"agent_settled"`) {
				goto settled
			}
		case <-timeout:
			t.Fatal("native Pi did not settle")
		}
	}
settled:
	commands, err := p.requestQueue("get_commands", "", 4*time.Second)
	if err != nil || !commands.RecapCommand {
		t.Fatalf("Pi recap command not registered: %+v %v", commands, err)
	}
	// A continued session starts with settled=false but can still recap its
	// already-persisted native turns without starting another agent turn.
	controller := &ConversationController{home: home, cfg: transport.Config{Home: home, UID: os.Geteuid()}, sessions: map[string]*conversation{}}
	controller.sessions[id] = &conversation{id: id, cwd: cwd, rpc: p, state: "idle"}
	first := httptest.NewRecorder()
	finished := make(chan struct{})
	go func() {
		controller.requestRecap(first, httptest.NewRequest(http.MethodPost, "http://unix/recap", nil), id)
		close(finished)
	}()
	select {
	case <-entered:
	case <-time.After(8 * time.Second):
		t.Fatal("recap model did not start")
	}
	// A notice during the native extension's pending work must use Pi's writer,
	// not another prompt/model turn, and survive a fresh disk read.
	noticeRequest := httptest.NewRecorder()
	controller.agentNotices(noticeRequest, httptest.NewRequest("POST", AgentNoticesPath+"?id=pi:"+id, strings.NewReader(`{"idempotency_key":"22222222-2222-4222-8222-222222222222","text":"Synthetic blocker <script>not markup</script>"}`)))
	if noticeRequest.Code != 200 || !strings.Contains(noticeRequest.Body.String(), `"persistence":"persisted"`) {
		t.Fatalf("native notice: %d %s", noticeRequest.Code, noticeRequest.Body.String())
	}
	concurrent := httptest.NewRecorder()
	controller.requestRecap(concurrent, httptest.NewRequest(http.MethodPost, "http://unix/recap", nil), id)
	if concurrent.Code != 409 {
		t.Fatalf("concurrent request: %d %s", concurrent.Code, concurrent.Body.String())
	}
	close(release)
	select {
	case <-finished:
	case <-time.After(8 * time.Second):
		t.Fatal("recap did not finish")
	}
	if first.Code != 200 || !strings.Contains(first.Body.String(), `"done"`) {
		t.Fatalf("recap request: %d %s", first.Code, first.Body.String())
	}
	retry := httptest.NewRecorder()
	controller.requestRecap(retry, httptest.NewRequest(http.MethodPost, "http://unix/recap", nil), id)
	if retry.Code != 200 || !strings.Contains(retry.Body.String(), `"done"`) {
		t.Fatalf("idempotent retry: %d %s", retry.Code, retry.Body.String())
	}
	sessions, err := nativeSessions(transport.Config{Home: home, UID: os.Geteuid()})
	if err != nil || len(sessions) != 1 {
		t.Fatalf("native sessions: %+v %v", sessions, err)
	}
	// The TUI extension uses this field to avoid automatic duplicate generation.
	raw, err := os.ReadFile(sessions[0].path)
	if err != nil || !strings.Contains(string(raw), `"completedTurnCount":1`) {
		t.Fatalf("native recap missing TUI turn count: %v %s", err, raw)
	}
	saved := readNativeSettled(sessions[0].path, os.Geteuid())
	found := 0
	for _, e := range saved.entries {
		if e.Recap != nil {
			found++
			if e.Recap.Recap != "Synthetic task done." || e.Recap.Next != "Check result" {
				t.Fatal(e.Recap)
			}
		}
	}
	if found != 1 || calls.Load() != 2 {
		t.Fatalf("native recaps %d, model calls %d: %+v", found, calls.Load(), saved.entries)
	}
}

// A subscription provider declares every model free, the Fable class first
// (pi-claude-bridge). The recap asks the Sonnet model and never Fable. That
// model can fail while the conversation's own model answers (a quota spent);
// the recap must then come from
// the conversation's model, and when no model answers, the person's request
// and the card must say why instead of ending in silence.
func TestRecapFallsBackAndReportsFailureThroughPinnedPi(t *testing.T) {
	cli, err := filepath.Abs(filepath.Join("pi-device-test", "node_modules", "@earendil-works", "pi-coding-agent", "dist", "bundle", "cli.js"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(cli); err != nil {
		t.Skip("pinned Pi test dependency not installed")
	}
	ext, err := filepath.Abs("recap-extension.mjs")
	if err != nil {
		t.Fatal(err)
	}
	var conversationDown atomic.Bool
	var mu sync.Mutex
	asked := []string{}
	provider := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Model    string `json:"model"`
			Messages []struct {
				Content any `json:"content"`
			} `json:"messages"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)
		recap := strings.Contains(fmt.Sprint(body.Messages), "Write a brief catch-up")
		if recap {
			mu.Lock()
			asked = append(asked, body.Model)
			mu.Unlock()
		}
		if recap && (body.Model == "claude-sonnet-5-5" || conversationDown.Load()) {
			w.WriteHeader(429)
			fmt.Fprint(w, `{"error":{"message":"synthetic quota spent"}}`)
			return
		}
		answer := "First response"
		if recap {
			answer = `{"recap":"Synthetic task done.","next":"Check result"}`
		}
		b, _ := json.Marshal(answer)
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprintf(w, "data: {\"id\":\"synthetic\",\"object\":\"chat.completion.chunk\",\"created\":0,\"model\":\"fake\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"content\":%s},\"finish_reason\":null}]}\n\n", b)
		fmt.Fprint(w, "data: {\"id\":\"synthetic\",\"object\":\"chat.completion.chunk\",\"created\":0,\"model\":\"fake\",\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}]}\n\ndata: [DONE]\n\n")
	}))
	defer provider.Close()
	home := t.TempDir()
	cwd := filepath.Join(home, "src", "fixture")
	if err := os.MkdirAll(filepath.Join(home, ".pi", "agent"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(cwd, 0700); err != nil {
		t.Fatal(err)
	}
	free := map[string]any{"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0}
	paid := map[string]any{"input": 3, "output": 15, "cacheRead": 0, "cacheWrite": 0}
	models := map[string]any{"providers": map[string]any{"fixture": map[string]any{"baseUrl": provider.URL + "/v1", "api": "openai-completions", "apiKey": "synthetic", "authHeader": true, "models": []any{
		map[string]any{"id": "claude-fable-5-1", "name": "Fable", "cost": free},
		map[string]any{"id": "claude-sonnet-5-5", "name": "Sonnet", "cost": free},
		map[string]any{"id": "fake", "name": "Fake", "cost": paid},
	}}}}
	data, _ := json.Marshal(models)
	if err := os.WriteFile(filepath.Join(home, ".pi", "agent", "models.json"), data, 0600); err != nil {
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
	p, err := launchPiRPCCommand(nativeNodePath(t), []string{cli, "--provider", "fixture", "--model", "fake", "--extension", ext, "--extension", filepath.Join(filepath.Dir(ext), "process-extension.mjs")}, home, cwd, []string{"PATH=/usr/bin:/bin"}, owner, ws, "ws_example123")
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	controller := &ConversationController{home: home, cfg: transport.Config{Home: home, UID: os.Geteuid()}, sessions: map[string]*conversation{}}
	controller.sessions[id] = &conversation{id: id, cwd: cwd, rpc: p, state: "idle"}
	turn := func(text string) {
		t.Helper()
		if accepted, err := p.request("prompt", text, 15*time.Second); !accepted || err != nil {
			t.Fatalf("prompt %v %v", accepted, err)
		}
		timeout := time.After(15 * time.Second)
		for {
			select {
			case event := <-p.events:
				if strings.Contains(string(event), `"type":"agent_settled"`) {
					return
				}
			case <-timeout:
				t.Fatal("native Pi did not settle")
			}
		}
	}
	request := func() map[string]any {
		t.Helper()
		w := httptest.NewRecorder()
		controller.requestRecap(w, httptest.NewRequest(http.MethodPost, "http://unix/recap", nil), id)
		var reply map[string]any
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &reply) != nil {
			t.Fatalf("recap request: %d %s", w.Code, w.Body.String())
		}
		return reply
	}

	turn("Do the synthetic task")
	if reply := request(); reply["state"] != "done" {
		t.Fatalf("fallback recap: %v", reply)
	}
	mu.Lock()
	if fmt.Sprint(asked) != "[claude-sonnet-5-5 fake]" {
		t.Fatalf("recap models asked: %v", asked)
	}
	asked = nil
	mu.Unlock()
	if s := controller.sessions[id]; s.recapFailure != nil {
		t.Fatalf("success left a failure: %+v", s.recapFailure)
	}

	turn("Do another synthetic task")
	conversationDown.Store(true)
	reply := request()
	if reply["state"] != "failed" || reply["reason"] != "model_error" {
		t.Fatalf("failed recap must say why: %v", reply)
	}
	_, latest, _ := controller.nativeRecap(controller.sessions[id])
	if f := controller.sessions[id].recapFailure; f == nil || f.Reason != "model_error" || f.Through != latest.ID || f.Trigger != "manual" {
		t.Fatalf("card failure: %+v latest %s", f, latest.ID)
	}
	// The status the browser polls carries it.
	status := httptest.NewRecorder()
	controller.observe(status, httptest.NewRequest(http.MethodGet, "http://unix/status", nil), id)
	if !strings.Contains(status.Body.String(), `"recap_failure":{"reason":"model_error"`) {
		t.Fatalf("status: %s", status.Body.String())
	}
}
