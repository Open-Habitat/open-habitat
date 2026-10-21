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

	"github.com/Open-Habitat/open-habitat/internal/daemon/integrations"
	"github.com/Open-Habitat/open-habitat/internal/transport"
)

func TestAgentCredentialsAndIntegrationRoutes(t *testing.T) {
	p, home := piFixture(t)
	catalog := integrations.New(integrations.Env{Home: home}, nil, nil)
	dir, err := os.MkdirTemp("/var/tmp", "agent-credentials-")
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
	h := agentHandlerWithIntegrations(cfg, nil, "test", "", p, catalog)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- transport.ServeAgent(ctx, ln, cfg, h) }()
	defer func() {
		cancel()
		if err := <-done; err != nil {
			t.Error(err)
		}
	}()
	tr := &http.Transport{DialContext: func(context.Context, string, string) (net.Conn, error) { return net.Dial("unix", socket) }}
	defer tr.CloseIdleConnections()
	client := &http.Client{Transport: tr, Timeout: 16 * time.Second}
	secret := "sk-" + strings.Repeat("z", 24) + "abcd"
	call := func(method, path, body string, want int) []byte {
		t.Helper()
		req, _ := http.NewRequest(method, "http://unix"+path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Agent-Host-Session", strings.Repeat("A", 43))
		res, err := client.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		raw, _ := io.ReadAll(res.Body)
		if res.StatusCode != want || strings.Contains(string(raw), secret) {
			t.Fatalf("%s %s: %d %s", method, path, res.StatusCode, raw)
		}
		return raw
	}
	for _, path := range []string{AgentIntegrationLoginPath, AgentPiLoginPath, AgentClaudeLoginPath, AgentIntegrationsPath, AgentIntegrationAccountsPath, AgentCredentialsPath, AgentOpenAICredentialPath} {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Code != 403 {
			t.Fatal("unguarded", path)
		}
	}
	call("GET", AgentIntegrationsPath, "", 200)
	call("POST", AgentIntegrationAccountsPath, `{"action":"password","provider":"unknown","address":"a@example.test","password":"secret"}`, 400)
	call("GET", AgentIntegrationsPath+"?uid=0", "", 400)
	call("GET", AgentIntegrationsPath, `{}`, 400)
	call("GET", AgentIntegrationLoginPath, "", 200)
	call("GET", AgentPiLoginPath+"?attempt_id="+strings.Repeat("0", 32), "", 404)
	call("GET", AgentClaudeLoginPath, "", 200)
	for _, path := range []string{"/api/v1/integrations/accounts", "/api/v1/pi/credentials", "/internal/v1/provision"} {
		call("POST", path, `{}`, 404)
	}
	call("POST", AgentCredentialsPath, `{"provider":"openai","key":"`+secret+`","uid":0}`, 400)
	call("POST", AgentCredentialsPath, `{"provider":"openai","key":"`+secret+`"}`, 200)
	raw, err := os.ReadFile(filepath.Join(home, ".pi/agent/auth.json"))
	if err != nil || !strings.Contains(string(raw), secret) {
		t.Fatal("native key missing", err)
	}
	call("GET", AgentCredentialsPath+"?uid=0", "", 400)
	call("GET", AgentCredentialsPath, `{}`, 400)
	var view piCredentials
	if json.Unmarshal(call("GET", AgentCredentialsPath, "", 200), &view) != nil || !view.OpenAI.Present {
		t.Fatal("missing presence")
	}
	call("DELETE", AgentOpenAICredentialPath, "", 200)
	if json.Unmarshal(call("GET", AgentCredentialsPath, "", 200), &view) != nil || view.OpenAI.Present {
		t.Fatal("key not removed")
	}
}
