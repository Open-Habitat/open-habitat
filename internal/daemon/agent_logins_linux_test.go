//go:build linux

package daemon

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

func loginCall(h http.Handler, method, path, session, body string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, "http://unix"+path, strings.NewReader(body))
	r.RequestURI = path
	if body != "" {
		r.Header.Set("Content-Type", "application/json")
	}
	if session != "" {
		r.Header.Set("X-Agent-Host-Session", session)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func TestAgentPiLoginExactAttemptAndSeparateLease(t *testing.T) {
	home := t.TempDir()
	os.Chmod(home, 0700)
	node := filepath.Join(home, "node")
	script := `#!/bin/sh
case "$6" in
login) printf '%s\n' '{"type":"device_code","verificationUri":"https://auth.openai.com/codex/device","userCode":"ABCD-1234"}'; sleep 30 ;;
status) printf '%s\n' '{"type":"status","state":"missing"}' ;;
esac
`
	if err := os.WriteFile(node, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	p := &PiDevice{Home: home, Node: node, Entry: "/synthetic/entry", Manifest: "/synthetic/manifest"}
	a := &piAttempt{device: p}
	cfg := transport.Config{}
	agent := a.handlerAt(cfg, func(*http.Request) bool { return true }, nil, AgentPiLoginPath, true)
	browser := a.handler(cfg, func(*http.Request) bool { return true }, nil)
	w := loginCall(agent, "POST", AgentPiLoginPath, strings.Repeat("A", 43), "")
	var out struct {
		AttemptID string `json:"attempt_id"`
	}
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &out) != nil || !piAgentAttemptID.MatchString(out.AttemptID) {
		t.Fatal(w.Code, w.Body)
	}
	defer p.Cancel(out.AttemptID)
	path := AgentPiLoginPath + "?attempt_id=" + out.AttemptID
	deadline := time.Now().Add(2 * time.Second)
	for {
		// Header changes do not create browser identity or change own-UID ownership.
		w = loginCall(agent, "GET", path, strings.Repeat("B", 43), "")
		if w.Code != 200 {
			t.Fatal(w.Code, w.Body)
		}
		if strings.Contains(w.Body.String(), `"user_code":"ABCD-1234"`) {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("no device code", w.Body)
		}
		time.Sleep(time.Millisecond)
	}
	if w = loginCall(browser, "GET", "/api/v1/onboarding/pi/attempt", strings.Repeat("A", 43), ""); w.Code != 404 {
		t.Fatal("browser borrowed agent lease", w.Code, w.Body)
	}
	// Production has separate ephemeral adapter leases over one PiDevice.
	otherBrowser := (&piAttempt{device: p}).handler(cfg, func(*http.Request) bool { return true }, nil)
	if w = loginCall(otherBrowser, "POST", "/api/v1/onboarding/pi/attempt", strings.Repeat("B", 43), ""); w.Code != 409 || !strings.Contains(w.Body.String(), `"attempt_active"`) {
		t.Fatal("shared native login conflict misreported", w.Code, w.Body)
	}
	if w = loginCall(agent, "DELETE", AgentPiLoginPath+"?attempt_id="+strings.Repeat("0", 32), "", ""); w.Code != 404 {
		t.Fatal("stale ID", w.Code)
	}
	if w = loginCall(agent, "POST", AgentPiLoginPath, "", ""); w.Code != 409 {
		t.Fatal("active attempt overwritten", w.Code)
	}
	if w = loginCall(agent, "DELETE", path, "", ""); w.Code != 200 || !strings.Contains(w.Body.String(), `"state":"unknown"`) {
		t.Fatal("cancel", w.Code, w.Body)
	}
	restarted := (&piAttempt{device: p}).handlerAt(cfg, func(*http.Request) bool { return true }, nil, AgentPiLoginPath, true)
	if w = loginCall(restarted, "GET", path, "", ""); w.Code != 404 {
		t.Fatal("restart invented attempt", w.Code)
	}
	// Reverse direction, with the production shape (two leases, one device).
	deadline = time.Now().Add(3 * time.Second)
	for {
		w = loginCall(otherBrowser, "POST", "/api/v1/onboarding/pi/attempt", strings.Repeat("B", 43), "")
		if w.Code == 200 {
			break
		}
		if w.Code != 409 || time.Now().After(deadline) {
			t.Fatal("browser successor", w.Code, w.Body)
		}
		time.Sleep(time.Millisecond)
	}
	p.mu.Lock()
	browserID := p.active
	p.mu.Unlock()
	defer p.Cancel(browserID)
	if w = loginCall(restarted, "POST", AgentPiLoginPath, "", ""); w.Code != 409 || !strings.Contains(w.Body.String(), `"attempt_active"`) {
		t.Fatal("reverse native conflict", w.Code, w.Body)
	}
	for _, method := range []string{"GET", "DELETE"} {
		w = loginCall(restarted, method, AgentPiLoginPath+"?attempt_id="+browserID, "", "")
		if w.Code != 404 || strings.Contains(w.Body.String(), browserID) {
			t.Fatal("agent borrowed browser attempt", w.Code, w.Body)
		}
	}

}

func TestAgentClaudeLoginCannotBorrowBrowserLease(t *testing.T) {
	p, home := piFixture(t)
	p.FixtureHome = true
	binary := filepath.Join(home, "claude")
	script := `#!/bin/sh
case "$2" in
status) printf '%s\n' '{"loggedIn":false,"authMethod":"none"}'; exit 1 ;;
login) printf '%s\n' 'https://claude.com/cai/oauth/authorize?code=true&response_type=code&redirect_uri=https%3A%2F%2Fplatform.claude.com%2Foauth%2Fcode%2Fcallback&code_challenge_method=S256&state=synthetic&code_challenge=synthetic'
read -r code
[ "$code" = 'SYNTHETIC-ONE-TIME-CODE' ] || exit 9
exit 1 ;;
esac
`
	if err := os.WriteFile(binary, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	a := &claudeLogin{device: p, executable: binary}
	cfg := transport.Config{}
	allow := func(*http.Request) bool { return true }
	agent := a.handlerAt(cfg, allow, AgentClaudeLoginPath, true)
	browser := a.handler(cfg, allow)
	w := loginCall(browser, "POST", claudeLoginPath, strings.Repeat("A", 43), "")
	var out claudeLoginResponse
	json.Unmarshal(w.Body.Bytes(), &out)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body)
	}
	defer func() { a.mu.Lock(); a.stop(); a.mu.Unlock() }()
	if w = loginCall(agent, "GET", AgentClaudeLoginPath, strings.Repeat("A", 43), ""); w.Code != 200 || strings.Contains(w.Body.String(), "attempt_id") || strings.Contains(w.Body.String(), "verification_uri") {
		t.Fatal("browser lease exposed", w.Code, w.Body)
	}
	if w = loginCall(agent, "DELETE", AgentClaudeLoginPath, "", `{"attempt_id":"`+out.AttemptID+`"}`); w.Code != 404 {
		t.Fatal("browser cancellation", w.Code)
	}
	if w = loginCall(agent, "POST", AgentClaudeLoginPath, "", ""); w.Code != 409 {
		t.Fatal("parallel native login", w.Code)
	}
	// Release browser lease using expiry, after cancellation, exactly as the
	// native controller does; the agent must start its own generation.
	a.mu.Lock()
	a.stop()
	a.until = time.Now().Add(-time.Second)
	a.mu.Unlock()
	deadline := time.Now().Add(3 * time.Second)
	for {
		w = loginCall(agent, "POST", AgentClaudeLoginPath, "", "")
		if w.Code == 200 {
			break
		}
		if w.Code != 409 || time.Now().After(deadline) {
			t.Fatal(w.Code, w.Body)
		}
		time.Sleep(time.Millisecond)
	}
	json.Unmarshal(w.Body.Bytes(), &out)
	deadline = time.Now().Add(2 * time.Second)
	for {
		w = loginCall(agent, "GET", AgentClaudeLoginPath, strings.Repeat("B", 43), "")
		if strings.Contains(w.Body.String(), `"state":"code"`) {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("no browser URL", w.Code, w.Body)
		}
		time.Sleep(time.Millisecond)
	}
	if w = loginCall(agent, "PUT", AgentClaudeLoginPath, "", `{"attempt_id":"stale","code":"SYNTHETIC-ONE-TIME-CODE"}`); w.Code != 404 {
		t.Fatal("stale submission", w.Code)
	}
	w = loginCall(agent, "PUT", AgentClaudeLoginPath, "", `{"attempt_id":"`+out.AttemptID+`","code":"SYNTHETIC-ONE-TIME-CODE"}`)
	if w.Code != 200 || strings.Contains(w.Body.String(), "SYNTHETIC-ONE-TIME-CODE") {
		t.Fatal(w.Code, w.Body)
	}
	if w = loginCall(agent, "PUT", AgentClaudeLoginPath, "", `{"attempt_id":"`+out.AttemptID+`","code":"SYNTHETIC-ONE-TIME-CODE"}`); w.Code != 409 {
		t.Fatal("code replay", w.Code, w.Body)
	}
}
