//go:build linux

package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

func TestAgentAuxiliaryResources(t *testing.T) {
	home := t.TempDir()
	id := "11111111-1111-4111-8111-111111111111"
	command := "22222222-2222-4222-8222-222222222222"
	root := filepath.Join(home, historyRoot)
	if err := os.MkdirAll(root, 0700); err != nil {
		t.Fatal(err)
	}
	history := fmt.Sprintf("{\"type\":\"session\",\"version\":3,\"id\":%q,\"cwd\":%q}\n", id, home)
	history += fmt.Sprintf("{\"type\":\"message\",\"id\":\"entry1\",\"message\":{\"role\":\"user\",\"content\":%q}}\n", strings.Repeat("large text ", 20000))
	if err := os.WriteFile(filepath.Join(root, "native.jsonl"), []byte(history), 0600); err != nil {
		t.Fatal(err)
	}
	var nativeCalls atomic.Int32
	p := testProcessPeer(t, os.Getpid(), func(conn net.Conn) {
		var q map[string]any
		if json.NewDecoder(conn).Decode(&q) != nil {
			return
		}
		nativeCalls.Add(1)
		var data any
		switch q["op"] {
		case "list":
			data = map[string]any{"protocol": 1, "records": []any{map[string]any{"id": "proc_abcd", "name": "build", "command": "TOKEN=secret make", "startTime": 1000, "status": "running"}}}
		case "output":
			if q["token"] != "pt_1000" {
				json.NewEncoder(conn).Encode(map[string]any{"ok": false, "error": "stale_process"})
				return
			}
			data = map[string]any{"lines": []any{map[string]any{"stream": "stdout", "text": "native output"}}, "omitted_before": 0, "retention_restarted": false}
		case "stop":
			if q["token"] != "pt_1000" {
				json.NewEncoder(conn).Encode(map[string]any{"ok": false, "error": "stale_process"})
				return
			}
			data = map[string]any{"result": "killed"}
		case "clear":
			data = map[string]any{"result": "cleared"}
		default:
			t.Errorf("unexpected native call %v", q)
			return
		}
		json.NewEncoder(conn).Encode(map[string]any{"ok": true, "data": data})
	})
	p.done = make(chan struct{})
	defer close(p.done)
	cfg := transport.Config{UID: os.Geteuid(), Home: home, Socket: filepath.Join(home, "daemon.sock")}
	c := &ConversationController{home: home, cfg: cfg, trusted: func(*http.Request) bool { return false }, sessions: map[string]*conversation{id: {id: id, rpc: p, receipts: map[string]string{command: "uncertain"}}}, localFiles: &localFiles{pending: map[string]*localFileRequest{}}, journal: newEventJournal()}
	socket := filepath.Join(home, "agent.sock")
	ln, err := net.ListenUnix("unix", &net.UnixAddr{Name: socket, Net: "unix"})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- transport.ServeAgent(ctx, ln, cfg, agentHandler(cfg, c, "test", "", nil)) }()
	defer func() {
		cancel()
		if err := <-done; err != nil {
			t.Error(err)
		}
	}()
	tr := &http.Transport{DialContext: func(context.Context, string, string) (net.Conn, error) { return net.Dial("unix", socket) }}
	defer tr.CloseIdleConnections()
	client := &http.Client{Transport: tr, Timeout: 3 * time.Second}
	request := func(method, path string, body []byte, want int) []byte {
		t.Helper()
		r, _ := http.NewRequest(method, "http://unix"+path, bytes.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("X-UID", "0")
		res, e := client.Do(r)
		if e != nil {
			t.Fatal(e)
		}
		defer res.Body.Close()
		b, _ := io.ReadAll(res.Body)
		if res.StatusCode != want {
			t.Fatalf("%s %s: %d %s", method, path, res.StatusCode, b)
		}
		return b
	}
	var discovery map[string]any
	json.Unmarshal(request("GET", AgentHistoryPath, nil, 200), &discovery)
	if len(discovery["sessions"].([]any)) != 1 {
		t.Fatal(discovery)
	}
	base := AgentHistoryPath + "/pi:" + id
	var page map[string]any
	json.Unmarshal(request("GET", base, nil, 200), &page)
	revision := page["native_revision"].(string)
	block := base + "/entries/entry1/blocks/0?revision=" + revision + "&offset=0&limit_bytes=100"
	var chunk map[string]any
	json.Unmarshal(request("GET", block, nil, 200), &chunk)
	if chunk["chunk"].(map[string]any)["complete"] != false {
		t.Fatal(chunk)
	}
	request("GET", strings.Replace(block, revision, "stale", 1), nil, 404)
	request("GET", base+"?uid=0", nil, 400)
	request("GET", base+"/entries/entry1/blocks/128?revision="+revision+"&offset=0&limit_bytes=100", nil, 400)
	for _, path := range []string{base + "/spinoffs", base + "/recap", AgentLocalFilesPath + "/complete", "/api/v1/local-files", "/api/v1/attachments"} {
		request("GET", path, nil, 404)
	}
	conv := AgentConversationsPath + "/" + id
	receipt := request("GET", conv+"/receipt?command_id="+command, nil, 200)
	if !bytes.Contains(receipt, []byte("uncertain")) {
		t.Fatal(string(receipt))
	}
	request("GET", conv+"/receipt?command_id="+command+"&command_id="+command, nil, 400)
	request("GET", conv+"/receipt?command_id=33333333-3333-4333-8333-333333333333", nil, 404)
	inventory := request("GET", conv+"/processes", nil, 200)
	if bytes.Contains(inventory, []byte("secret")) || !bytes.Contains(inventory, []byte("pt_1000")) {
		t.Fatal(string(inventory))
	}
	n := nativeCalls.Load()
	request("GET", conv+"/processes/proc_abcd/output?owner_generation=old&process_token=pt_1000&tail_lines=10", nil, 409)
	request("POST", conv+"/processes/clear-finished", []byte(`{"owner_generation":"old"}`), 409)
	if nativeCalls.Load() != n {
		t.Fatal("stale owner reached native process socket")
	}
	query := "?owner_generation=" + p.processGeneration + "&process_token=pt_1000&tail_lines=10"
	request("GET", conv+"/processes/proc_abcd/output"+query, nil, 200)
	request("GET", conv+"/processes/proc_abcd/output"+strings.Replace(query, "pt_1000", "pt_old", 1), nil, 409)
	request("POST", conv+"/processes/proc_abcd/stop", []byte(fmt.Sprintf(`{"owner_generation":%q,"process_token":"pt_1000","force":false}`, p.processGeneration)), 200)
	request("POST", conv+"/processes/clear-finished", []byte(fmt.Sprintf(`{"owner_generation":%q}`, p.processGeneration)), 200)
	var upload map[string]any
	json.Unmarshal(request("POST", AgentAttachmentsPath, []byte("attachment contents"), 200), &upload)
	attachment := upload["id"].(string)
	if got := request("GET", AgentAttachmentsPath+"/"+attachment, nil, 200); string(got) != "attachment contents" {
		t.Fatal(string(got))
	}
	if err := os.Remove(filepath.Join(home, "attachments", attachment)); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(filepath.Join(root, "native.jsonl"), filepath.Join(home, "attachments", attachment)); err != nil {
		t.Fatal(err)
	}
	request("GET", AgentAttachmentsPath+"/"+attachment, nil, 404)
	// A kernel-authorized agent can ask, but cannot claim or complete its request.
	request("POST", AgentLocalFilesPath, []byte(fmt.Sprintf(`{"conversation_id":"pi:%s","action":"fetch","name":"../secret"}`, id)), 400)
	request("POST", AgentLocalFilesPath, []byte(fmt.Sprintf(`{"conversation_id":"pi:%s","action":"list","claim":"%s"}`, id, command)), 400)
	answer := make(chan []byte, 1)
	go func() {
		answer <- request("POST", AgentLocalFilesPath, []byte(fmt.Sprintf(`{"conversation_id":"pi:%s","action":"list"}`, id)), 200)
	}()
	var pending string
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		c.localFiles.mu.Lock()
		for k := range c.localFiles.pending {
			pending = k
		}
		c.localFiles.mu.Unlock()
		if pending != "" {
			break
		}
		time.Sleep(time.Millisecond)
	}
	if pending == "" {
		t.Fatal("request not published")
	}
	request("POST", AgentLocalFilesPath, []byte(fmt.Sprintf(`{"id":%q,"claim":%q,"complete":true,"names":["injected"]}`, pending, command)), 400)
	c.trusted = func(*http.Request) bool { return true } // only for this synthetic browser reply
	browser := func(body string) {
		t.Helper()
		r := httptest.NewRequest("POST", "http://unix"+LocalFilesPath, strings.NewReader(body))
		w := httptest.NewRecorder()
		c.LocalFilesHandler().ServeHTTP(w, r)
		if w.Code != 200 {
			t.Fatalf("browser reply %d %s", w.Code, w.Body.String())
		}
	}
	browser(fmt.Sprintf(`{"id":%q,"claim":%q}`, pending, command))
	browser(fmt.Sprintf(`{"id":%q,"claim":%q,"complete":true,"names":["notes.txt"]}`, pending, command))
	if b := <-answer; !bytes.Contains(b, []byte("notes.txt")) || !bytes.Contains(b, []byte(`"schema_version":1`)) {
		t.Fatal(string(b))
	}
}
