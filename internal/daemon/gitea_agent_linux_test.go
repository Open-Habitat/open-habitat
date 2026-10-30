//go:build linux

package daemon

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/daemon/integrations"
)

// The agent's code-host commands are the browser's connection writes on the
// same catalog: one tea file, one helper registration, one write lock. The
// token reaches tea's file and nothing the agent reads back.
func TestAgentGiteaConnectionIsTheBrowsers(t *testing.T) {
	w := newGiteaWalk(t)
	agent := func(method, body string) (int, map[string]any, string) {
		t.Helper()
		status, out, raw := w.requestAt(w.agent, method, AgentGiteaPath, body)
		if strings.Contains(raw, "tok-") {
			t.Fatalf("token in agent reply: %s", raw)
		}
		return status, out, raw
	}
	if status, out, _ := agent("POST", `{"action":"connect","base_url":"`+w.srv.URL+`","token":"wrong-token"}`); status != 422 || code(out) != "token_rejected" {
		t.Fatalf("rejected token: %d %v", status, out)
	}
	tea := filepath.Join(w.home, ".config", "tea", "config.yml")
	if _, err := os.Stat(tea); !os.IsNotExist(err) {
		t.Fatalf("a refused connect wrote tea's file: %v", err)
	}
	status, out, raw := agent("POST", `{"action":"connect","base_url":"`+w.srv.URL+`","token":"tok-ada-0001"}`)
	conn, _ := out["connection"].(map[string]any)
	if status != 200 || out["api"] != "ok" || conn["git"] != "registered" || conn["user"] != "ada" {
		t.Fatalf("connect: %d %s", status, raw)
	}
	id := conn["id"].(string)
	_, list, _ := w.request("GET", integrations.ListPath, "")
	if c := list["gitea"].(map[string]any)["connections"].([]any); len(c) != 1 || c[0].(map[string]any)["id"] != id {
		t.Fatalf("the browser does not see the agent's connection: %v", list["gitea"])
	}
	// A browser repeat of the same grant is observed, not a second entry.
	if status, out, _ := w.gitea("POST", `{"action":"connect","base_url":"`+w.srv.URL+`","token":"tok-ada-0001"}`); status != 200 || out["outcome"] != "unchanged" {
		t.Fatalf("browser repeat: %d %v", status, out)
	}

	w.srv.SetToken(7, "tok-ada-0003")
	if status, out, _ := agent("POST", `{"action":"check","connection_id":"`+id+`"}`); status != 200 || out["api"] != "token_rejected" {
		t.Fatalf("check of a revoked token: %d %v", status, out)
	}
	if status, out, raw := agent("POST", `{"action":"replace","connection_id":"`+id+`","token":"tok-ada-0003"}`); status != 200 || out["api"] != "ok" {
		t.Fatalf("replace: %d %s", status, raw)
	}
	if b, _ := os.ReadFile(tea); !strings.Contains(string(b), "tok-ada-0003") || strings.Contains(string(b), "tok-ada-0001") {
		t.Fatal("replacement is not in tea's own file")
	}
	if status, out, _ := agent("POST", `{"action":"repair","connection_id":"`+id+`"}`); status != 200 || out["outcome"] != "unchanged" {
		t.Fatalf("repair of a registered helper: %d %v", status, out)
	}
	if status, out, raw := agent("DELETE", `{"action":"disconnect","connection_id":"`+id+`"}`); status != 200 || out["removed"].(map[string]any)["id"] != id {
		t.Fatalf("disconnect: %d %s", status, raw)
	}
	if b, _ := os.ReadFile(tea); strings.Contains(string(b), "tok-") {
		t.Fatal("disconnect left the token in tea's file")
	}
	gitconfig, _ := os.ReadFile(filepath.Join(w.home, ".gitconfig"))
	if strings.Contains(string(gitconfig), "gitea git-credential") {
		t.Fatalf("helper still registered: %s", gitconfig)
	}
	// No GitLab adapter here: the route says so instead of a shape error.
	if status, out, _ := w.requestAt(w.agent, "POST", AgentGitLabPath, `{"action":"check","connection_id":"gitlab_0123456789abcdef01234567"}`); status != 409 || code(out) != "provider_unavailable" {
		t.Fatalf("absent adapter: %d %v", status, out)
	}
}
