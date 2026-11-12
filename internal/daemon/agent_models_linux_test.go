//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/transport"
)

func TestAgentModelsNativeDefaults(t *testing.T) {
	p, home := piFixture(t)
	_, events, err := p.Start()
	if err != nil {
		t.Fatal(err)
	}
	for range events {
	}
	auth, err := os.ReadFile(filepath.Join(home, ".pi", "agent", "auth.json"))
	if err != nil {
		t.Fatal(err)
	}
	var credentials map[string]map[string]any
	if json.Unmarshal(auth, &credentials) != nil {
		t.Fatal("invalid fixture credentials")
	}
	secrets := []string{}
	for _, entry := range credentials {
		for _, key := range []string{"access", "refresh", "key"} {
			if value, ok := entry[key].(string); ok && value != "" {
				secrets = append(secrets, value)
			}
		}
	}
	if len(secrets) == 0 {
		t.Fatal("no credential sentinel to check")
	}
	settings := filepath.Join(home, ".pi", "agent", "settings.json")
	if err := os.WriteFile(settings, []byte(`{"theme":"dark","defaultProvider":"openai-codex","defaultModel":"gpt-5.5","defaultThinkingLevel":"medium"}`), 0600); err != nil {
		t.Fatal(err)
	}
	// Use the real agent listener, including its transport-installed own-UID proof.
	dir, err := os.MkdirTemp("/var/tmp", "oh-agent-models-")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(dir)
	socket := filepath.Join(dir, "agent.sock")
	ln, err := net.ListenUnix("unix", &net.UnixAddr{Name: socket, Net: "unix"})
	if err != nil {
		t.Fatal(err)
	}
	cfg := transport.Config{UID: os.Geteuid(), Home: home, Socket: filepath.Join(dir, "daemon.sock"), Provider: "github", Subject: "42"}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- transport.ServeAgent(ctx, ln, cfg, agentHandler(cfg, nil, "test", "", p)) }()
	defer func() {
		cancel()
		if err := <-done; err != nil {
			t.Error(err)
		}
	}()
	tr := &http.Transport{DialContext: func(context.Context, string, string) (net.Conn, error) { return net.Dial("unix", socket) }}
	defer tr.CloseIdleConnections()
	client := &http.Client{Transport: tr, Timeout: 16 * time.Second}
	request := func(method, target, body string, want int) []byte {
		t.Helper()
		req, _ := http.NewRequest(method, "http://unix"+target, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-UID", "0")
		res, err := client.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		data, _ := io.ReadAll(res.Body)
		if res.StatusCode != want {
			t.Fatalf("%s %s: %d %s", method, target, res.StatusCode, data)
		}
		for _, secret := range secrets {
			if strings.Contains(string(data), secret) {
				t.Fatal("credential leak")
			}
		}
		return data
	}
	before, _ := os.ReadFile(settings)
	request("GET", AgentModelsPath, "", 200)
	after, _ := os.ReadFile(settings)
	if string(before) != string(after) {
		t.Fatal("catalog read changed defaults")
	}
	for _, body := range []string{
		`{"model":"gpt-5.5","uid":0}`, `{"model":"gpt-5.5","model":"other"}`,
		`{"model":"gpt-5.5"} {}`, `{"model":" gpt-5.5"}`, `{"model":"gpt-5.5","thinking":"automatic"}`,
		`{"model":"gpt-5.5","provider":"other"}`, `{"model":"gpt-5.5","dry_run":true}`,
	} {
		request("POST", AgentModelsPath, body, 400)
	}
	request("GET", AgentModelsPath+"?uid=0", "", 400)
	request("POST", AgentModelsPath+"?uid=0", `{"model":"gpt-5.5"}`, 400)
	request("GET", AgentModelsPath, `{}`, 400)
	request("DELETE", AgentModelsPath, "", 404)
	request("POST", "/api/v1/pi/models", `{"model":"gpt-5.5"}`, 404)
	for i := 0; i < 2; i++ {
		result := request("POST", AgentModelsPath, `{"provider":"openai-codex","model":"gpt-6.1-terra","thinking":"high"}`, 200)
		var reply piModelsResponse
		if json.Unmarshal(result, &reply) != nil || reply.DefaultModel == nil || *reply.DefaultModel != "gpt-6.1-terra" || reply.DefaultThinking != "high" {
			t.Fatalf("not read back: %s", result)
		}
	}
	request("POST", AgentModelsPath, `{"provider":"openai-codex","model":"gpt-6.1-terra"}`, 200)
	data, _ := os.ReadFile(settings)
	var stored map[string]any
	if json.Unmarshal(data, &stored) != nil || stored["theme"] != "dark" || stored["defaultThinkingLevel"] != "high" {
		t.Fatalf("unrelated or omitted settings overwritten: %s", data)
	}
	// Native model validation must not change settings on a rejected selection.
	before, _ = os.ReadFile(settings)
	request("POST", AgentModelsPath, `{"model":"not-a-model"}`, 409)
	request("POST", AgentModelsPath, `{"model":"gpt-6.1-sol","thinking":"off"}`, 400)
	after, _ = os.ReadFile(settings)
	if string(before) != string(after) {
		t.Fatal("rejected selection changed defaults")
	}
}

func TestAgentModelsNoPeerDoesNotRead(t *testing.T) {
	h := agentHandler(transport.Config{Home: "/should-not-be-read"}, nil, "test", "", nil)
	for _, method := range []string{"GET", "POST"} {
		req := httptest.NewRequest(method, AgentModelsPath, strings.NewReader(`{"model":"gpt-5.5"}`))
		req.Header.Set("X-UID", "0")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)
		if w.Code != 403 {
			t.Fatal(w.Code)
		}
	}
}
