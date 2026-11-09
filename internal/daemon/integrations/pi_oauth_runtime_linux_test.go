//go:build linux

package integrations

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// Opt-in package qualification: the wrapper must come from the built sealed
// integrations profile, laid out beside a real core runtime as host apply does.
// No external request or real credential is needed: only OAuth discovery and
// registration run; the browser authorization URL is never followed.
func TestPiOAuthBuiltRuntime(t *testing.T) {
	pi := os.Getenv("OH_INTEGRATIONS_PI")
	if pi == "" {
		t.Skip("set OH_INTEGRATIONS_PI to the built profile's bin/pi")
	}
	var server *httptest.Server
	server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/metadata":
			json.NewEncoder(w).Encode(map[string]any{"issuer": server.URL, "authorization_endpoint": "https://auth.atlassian.com/authorize", "token_endpoint": server.URL + "/token", "registration_endpoint": server.URL + "/register", "response_types_supported": []string{"code"}, "code_challenge_methods_supported": []string{"S256"}})
		case "/register":
			w.WriteHeader(http.StatusCreated)
			json.NewEncoder(w).Encode(map[string]any{"client_id": "fixture-client", "redirect_uris": []string{"http://127.0.0.1/callback"}})
		default:
			w.WriteHeader(http.StatusUnauthorized)
			w.Write([]byte(`{"error":"unauthorized"}`))
		}
	}))
	defer server.Close()
	home := newHome(t)
	dir := filepath.Join(home, ".pi", "agent")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	config := map[string]any{"mcpServers": map[string]any{atlassianServer: map[string]any{"url": server.URL + "/mcp", "oauth": map[string]any{"authServerMetadataUrl": server.URL + "/metadata"}}}}
	data, _ := json.Marshal(config)
	if err := os.WriteFile(filepath.Join(dir, "mcp.json"), data, 0600); err != nil {
		t.Fatal(err)
	}
	env := Env{Home: home, FixtureTools: true, Config: Config{Tools: map[string]string{"pi": pi}}}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	login, err := startPiOAuth(ctx, env, atlassianServer, true)
	if err != nil {
		t.Fatal(err)
	}
	defer login.Cancel()
	prompt, err := login.Prompt(ctx)
	if err != nil || !validPrompt(PastedRedirect, prompt) {
		t.Fatalf("real Pi did not relay /mcp login: %+v %v", prompt, err)
	}
}
