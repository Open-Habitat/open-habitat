//go:build linux

package cli

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/daemon"
)

func TestAgentLoginProtectedInputs(t *testing.T) {
	id := "20261021T120000.000000001"
	for _, tc := range []struct{ args, body, method, action string }{
		{"integration-login create --input-file -", `{"provider":"google"}`, "POST", "start"},
		{"integration-login update --input-file -", `{"attempt_id":"` + id + `","redirect_url":"http://127.0.0.1/?code=secret"}`, "PUT", "redirect"},
		{"integration-login update --input-file -", `{"attempt_id":"` + id + `","folders":["drive"]}`, "PUT", "folders"},
		{"integration-login delete --input-file -", `{"attempt_id":"` + id + `"}`, "DELETE", "cancel"},
		{"claude-login update --input-file -", `{"attempt_id":"` + id + `","code":"secret-code"}`, "PUT", ""},
		{"question answer --conversation pi:00000000-0000-4000-8000-000000000001 --input-file -", `{"request_id":"q1","value":false}`, "POST", "answer"},
		{"question cancel --conversation pi:00000000-0000-4000-8000-000000000001 --input-file -", `{"request_id":"q1"}`, "POST", "cancel"},
	} {
		r, err := parseAgentLoginRequest(strings.Fields(tc.args), strings.NewReader(tc.body))
		if err != nil {
			t.Fatal(tc.args, err)
		}
		var b map[string]any
		json.Unmarshal(r.body, &b)
		if r.method != tc.method || (tc.action != "" && b["action"] != tc.action) {
			t.Fatalf("%s: %+v %s", tc.args, r, r.body)
		}
	}
	for _, tc := range []struct{ args, body string }{
		{"claude-login update --code SENTINEL", ``},
		{"claude-login update --input-file -", `{"attempt_id":"` + id + `","code":"SENTINEL","uid":0}`},
		{"integration-login update --input-file -", `{"attempt_id":"` + id + `","redirect_url":"SENTINEL","folders":["a"]}`},
		{"integration-login create --input-file -", `{"provider":"google","provider":"SENTINEL"}`},
		{"question cancel --conversation pi:00000000-0000-4000-8000-000000000001 --input-file -", `{"request_id":"q","value":"SENTINEL"}`},
		{"pi-login show --attempt SENTINEL", ``},
		{"pi-login create --attempt SENTINEL", ``},
		{"pi-login delete", ``},
		{"integration-login show --input-file SENTINEL", ``},
	} {
		_, err := parseAgentLoginRequest(strings.Fields(tc.args), strings.NewReader(tc.body))
		if err == nil || strings.Contains(err.Error(), "SENTINEL") {
			t.Fatalf("%s: %v", tc.args, err)
		}
	}
	for _, noun := range []string{"question", "integration-login", "pi-login", "claude-login"} {
		if !protectedAgentArgs([]string{"--json", "agent", noun, "update", "--json=SENTINEL"}) {
			t.Fatal("unprotected argv", noun)
		}
	}
	for _, args := range []string{"claude-login create --dry-run", "integration-login create --input-file - --dry-run", "pi-login delete --attempt 00000000000000000000000000000001 --dry-run"} {
		_, err := parseAgentLoginRequest(strings.Fields(args), panicReader{})
		if e, ok := err.(*cliError); !ok || e.code != "dry_run_unsupported" {
			t.Fatal(args, err)
		}
	}
}

type panicReader struct{}

func (panicReader) Read([]byte) (int, error) { panic("preview consumed protected input") }

func TestAgentLoginTransportBudgetsAndRefusals(t *testing.T) {
	// These lower bounds come from native login replacement cleanup (15s),
	// the redirect HTTP budget (45s), and Pi refresh+Claude fallback (15s+5s).
	// Claude alone retains its existing 8s budget for a 5s status helper.
	for _, path := range []string{daemon.AgentIntegrationLoginPath, daemon.AgentPiLoginPath + "?attempt_id=" + strings.Repeat("0", 32), daemon.AgentClaudeLoginPath} {
		budget := agentRequestTimeout(path)
		if (path != daemon.AgentClaudeLoginPath && budget <= 20*time.Second) || budget > time.Minute {
			t.Fatalf("native login budget %s: %s", path, budget)
		}
		if path == daemon.AgentIntegrationLoginPath && budget <= 45*time.Second {
			t.Fatalf("redirect deadline exceeds client budget: %s", budget)
		}
		for _, tc := range []struct {
			status int
			code   string
		}{{404, "attempt_not_found"}, {409, "attempt_active"}, {422, "redirect_invalid"}, {422, "quota_insufficient"}, {409, "provider_unavailable"}} {
			err := agentResponseError("PUT", path, tc.status, tc.code)
			if ce, ok := err.(*cliError); !ok || ce.code != tc.code || ce.exit != 1 {
				t.Fatalf("refusal lost: %v", err)
			}
		}
		err := agentResponseError("PUT", path, 503, "native_source_unavailable")
		if ce, ok := err.(*cliError); !ok || ce.code != "agent_unavailable" || ce.exit != 2 || !strings.Contains(ce.message, "uncertain") {
			t.Fatal("native failure lost uncertainty", err)
		}
	}
}

func TestAgentLoginFailureRetainsRedactedConsentGuidance(t *testing.T) {
	data := json.RawMessage(`{"schema_version":1,"state":"failed","failure":"consent_required","consent_url":"https://login.example.test/admin-consent"}`)
	err := agentLoginOperationError(data)
	ce, ok := err.(*cliError)
	if !ok || ce.exit == 0 || ce.code != "native_login_failed" || !strings.Contains(string(ce.result), "https://login.example.test/admin-consent") {
		t.Fatal("lost required human consent guidance", err)
	}
	if err = agentLoginOperationError(json.RawMessage(`{"schema_version":1,"state":"unknown"}`)); err != nil {
		t.Fatal("unknown observation claimed failure", err)
	}
}

func TestAgentMaintenanceRefusalIsNotUncertainMutation(t *testing.T) {
	err := agentResponseError("POST", daemon.AgentNoticesPath, 503, "host_maintenance")
	ce, ok := err.(*cliError)
	if !ok || ce.code != "host_maintenance" || ce.exit != 2 || strings.Contains(ce.message, "uncertain") {
		t.Fatalf("maintenance refusal: %v", err)
	}
}
