//go:build linux

package daemon

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"os/user"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

func TestClaudeNativeLoginLeaseAndStore(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("mapped nonroot UID required")
	}
	p, home := piFixture(t)
	binary := filepath.Join(home, "native-claude")
	// The fake native CLI alone writes synthetic credentials; neither handler nor
	// test sees a real login. Any inherited token variable would fail the fixture.
	script := `#!/bin/sh
[ -z "$ANTHROPIC_API_KEY$ANTHROPIC_AUTH_TOKEN$NODE_OPTIONS" ] || exit 7
case "$2" in
status) if [ -f "$HOME/.claude/.credentials.json" ]; then printf '%s\n' '{"loggedIn":true,"authMethod":"claude.ai"}'; else printf '%s\n' '{"loggedIn":false,"authMethod":"none"}'; exit 1; fi ;;
login) printf '%s\n' 'If the browser did not open, visit: https://claude.com/cai/oauth/authorize?code=true&response_type=code&redirect_uri=https%3A%2F%2Fplatform.claude.com%2Foauth%2Fcode%2Fcallback&code_challenge_method=S256&state=synthetic&code_challenge=synthetic'
read -r code
[ "$code" = 'synthetic-code#state' ] || exit 9
mkdir -m 700 -p "$HOME/.claude"
umask 077
printf '%s' '{"claudeAiOauth":{"accessToken":"SYNTHETIC-ONLY"}}' > "$HOME/.claude/.credentials.json"
;;
esac
`
	if err := os.WriteFile(binary, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	t.Setenv("ANTHROPIC_API_KEY", "must-not-inherit")
	p.FixtureHome = true
	a := &claudeLogin{device: p, executable: binary}
	u, _ := user.Current()
	cfg := transport.Config{GatewayUID: os.Geteuid(), UID: os.Geteuid(), Username: u.Username, Home: u.HomeDir, Provider: "github", Subject: "123", Socket: "/run/open-habitat/users/" + u.Username + "/daemon.sock"}
	h := a.handler(cfg, func(*http.Request) bool { return true })
	request := func(handler http.Handler, method, token, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "http://unix"+claudeLoginPath, strings.NewReader(body))
		r.RequestURI = claudeLoginPath
		r.Header.Set("X-Agent-Host-Identity", opaque("wid_", "github:123"))
		r.Header.Set("X-Agent-Host-Display-Name", "GitHub user 123")
		r.Header.Set("X-Agent-Host-Session", token)
		if body != "" {
			r.Header.Set("Content-Type", "application/json")
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	token, other := strings.Repeat("A", 43), strings.Repeat("B", 43)
	if w := request(h, "GET", token, ""); w.Code != 200 || !strings.Contains(w.Body.String(), `"missing"`) {
		t.Fatal(w.Code, w.Body)
	}
	w := request(h, "POST", token, "")
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body)
	}
	var started claudeLoginResponse
	_ = json.Unmarshal(w.Body.Bytes(), &started)
	defer func() { a.mu.Lock(); a.stop(); a.mu.Unlock() }()
	deadline := time.Now().Add(3 * time.Second)
	for {
		w = request(h, "GET", token, "")
		var out claudeLoginResponse
		_ = json.Unmarshal(w.Body.Bytes(), &out)
		if out.State == "code" {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("no native URL", w.Body)
		}
		time.Sleep(time.Millisecond)
	}
	if w = request(h, "GET", other, ""); strings.Contains(w.Body.String(), "verification_uri") || strings.Contains(w.Body.String(), started.AttemptID) {
		t.Fatal("foreign lease leaked", w.Body)
	}
	oldID := started.AttemptID
	if w = request(h, "DELETE", token, `{"attempt_id":"`+oldID+`"}`); w.Code != 200 || !strings.Contains(w.Body.String(), `"state":"unknown"`) {
		t.Fatal("cancel", w.Code, w.Body)
	}
	deadline = time.Now().Add(3 * time.Second)
	for {
		w = request(h, "POST", token, "")
		if w.Code == 200 {
			break
		}
		if w.Code != 409 || time.Now().After(deadline) {
			t.Fatal("replacement", w.Code, w.Body)
		}
		time.Sleep(time.Millisecond)
	}
	_ = json.Unmarshal(w.Body.Bytes(), &started)
	if started.AttemptID == oldID {
		t.Fatal("attempt generation reused")
	}
	deadline = time.Now().Add(3 * time.Second)
	for {
		w = request(h, "GET", token, "")
		if strings.Contains(w.Body.String(), `"state":"code"`) {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("no replacement URL", w.Body)
		}
		time.Sleep(time.Millisecond)
	}
	if w = request(h, "PUT", token, `{"attempt_id":"`+oldID+`","code":"synthetic-code#state"}`); w.Code != 404 {
		t.Fatal("cancelled generation accepted", w.Code)
	}
	body := `{"attempt_id":"` + started.AttemptID + `","code":"synthetic-code#state"}`
	if w = request(h, "PUT", other, body); w.Code != 404 {
		t.Fatal("foreign submission", w.Code)
	}
	if w = request(h, "PUT", token, strings.Replace(body, started.AttemptID, "stale", 1)); w.Code != 404 {
		t.Fatal("stale submission", w.Code)
	}
	if w = request(h, "PUT", token, strings.Replace(body, "synthetic-code#state", "synthetic-code\\nsecond", 1)); w.Code != 400 {
		t.Fatal("newline accepted", w.Code)
	}
	if w = request(h, "PUT", token, body); w.Code != 200 {
		t.Fatal(w.Code, w.Body)
	}
	if strings.Contains(w.Body.String(), "synthetic-code") {
		t.Fatal("code returned")
	}
	deadline = time.Now().Add(15 * time.Second)
	for {
		w = request(h, "GET", token, "")
		if strings.Contains(w.Body.String(), `"state":"completed"`) {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("native login incomplete", w.Body)
		}
		time.Sleep(time.Millisecond)
	}
	if strings.Contains(w.Body.String(), "SYNTHETIC-ONLY") {
		t.Fatal("credential exposed")
	}
	settings, err := p.catalog(t.Context(), "")
	if err != nil || settings.DefaultProvider == nil || *settings.DefaultProvider != "claude-bridge" || settings.DefaultModel == nil || *settings.DefaultModel != "claude-opus-5-5" || settings.DefaultThinking != "medium" {
		t.Fatalf("first Claude login default: %+v %v", settings, err)
	}
	// ModelRuntime may create an empty Pi auth store, never a Claude token copy.
	if raw, err := os.ReadFile(filepath.Join(home, ".pi", "agent", "auth.json")); err == nil {
		var credentials map[string]any
		if json.Unmarshal(raw, &credentials) != nil || len(credentials) != 0 {
			t.Fatal("host/Pi credential copy")
		}
	} else if !os.IsNotExist(err) {
		t.Fatal(err)
	}
	credential := filepath.Join(home, ".claude", ".credentials.json")
	if err := os.Rename(credential, credential+".logout"); err != nil {
		t.Fatal(err)
	}
	if w = request(h, "GET", token, ""); !strings.Contains(w.Body.String(), `"state":"missing"`) {
		t.Fatal("cached a completed login after native logout", w.Body)
	}
	if err := os.Rename(credential+".logout", credential); err != nil {
		t.Fatal(err)
	}
	restarted := (&claudeLogin{device: p, executable: binary}).handler(cfg, func(*http.Request) bool { return true })
	if w = request(restarted, "GET", token, ""); !strings.Contains(w.Body.String(), `"state":"completed"`) {
		t.Fatal("native login lost on restart", w.Body)
	}
	if err := os.Rename(filepath.Join(home, ".claude"), filepath.Join(home, "elsewhere")); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(filepath.Join(home, "elsewhere"), filepath.Join(home, ".claude")); err != nil {
		t.Fatal(err)
	}
	if w = request(restarted, "POST", token, ""); w.Code != 503 {
		t.Fatal("symlink accepted", w.Code)
	}
}
func TestClaudeAuthorizationURLRejectsRedirects(t *testing.T) {
	good := "https://claude.com/cai/oauth/authorize?code=true&response_type=code&redirect_uri=https%3A%2F%2Fplatform.claude.com%2Foauth%2Fcode%2Fcallback&code_challenge_method=S256&state=synthetic&code_challenge=synthetic"
	if !claudeAuthorizationURI(good) {
		t.Fatal("native URL rejected")
	}
	for _, bad := range []string{strings.Replace(good, "https://claude.com", "https://claude.com.evil.invalid", 1), strings.Replace(good, "https://claude.com", "http://claude.com", 1), strings.Replace(good, "platform.claude.com", "evil.invalid", 1), good + "#fragment", strings.Replace(good, "S256", "plain", 1)} {
		if claudeAuthorizationURI(bad) {
			t.Fatal("unsafe URL", bad)
		}
	}
}
func TestClaudeModelFamilyGrouping(t *testing.T) {
	models := []piModel{{Provider: "claude-bridge", ID: "claude-fable-5"}, {Provider: "claude-bridge", ID: "claude-fable-5-1"}, {Provider: "claude-bridge", ID: "claude-opus-5-5"}, {Provider: "claude-bridge", ID: "claude-haiku-4-5"}}
	groupModels(models)
	if !models[0].Older || models[1].Older || models[2].Older || models[3].Older {
		t.Fatal(models)
	}
}
