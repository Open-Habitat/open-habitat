//go:build linux

package cli

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/open-habitat/open-habitat/internal/daemon"
)

func TestAgentExperimentalRequest(t *testing.T) {
	method, body, err := agentExperimentalRequest([]string{"list"})
	if err != nil || method != "GET" || body != nil {
		t.Fatalf("%s %s %v", method, body, err)
	}
	for _, flag := range []string{"--on", "--off"} {
		method, body, err = agentExperimentalRequest([]string{"update", "rewind-conversation", flag})
		var got struct {
			ID      string `json:"id"`
			Enabled bool   `json:"enabled"`
		}
		if err != nil || method != "PUT" || json.Unmarshal(body, &got) != nil || got.ID != "rewind-conversation" || got.Enabled != (flag == "--on") {
			t.Fatalf("%s %s %v", method, body, err)
		}
	}
}
func TestAgentExperimentalRefusal(t *testing.T) {
	err := agentResponseError("PUT", daemon.AgentExperimentalPath, 400, "unknown_experimental_feature").(*cliError)
	if err.exit != 1 || err.code != "unknown_experimental_feature" {
		t.Fatal(err)
	}
}

func TestAgentExperimentalInvalidBeforeConnection(t *testing.T) {
	for _, args := range [][]string{
		{}, {"list", "--uid", "99"}, {"update"}, {"update", "unknown-feature", "--on"},
		{"update", "explain-mode"}, {"update", "explain-mode", "--on", "--off"},
		{"update", "explain-mode", "--on", "--on"}, {"update", "explain-mode", "--on=true"},
		{"update", " explain-mode", "--on"}, {"update", "explain-mode", "--uid", "99"},
		{"update", "explain-mode", "--dry-run"},
		// A risky feature is the person's to allow in the browser, never an
		// experiment the agent can switch on.
		{"update", "conversation-links", "--on"},
	} {
		argv := append([]string{"agent", "experimental"}, args...)
		argv = append(argv, "--json")
		code, _, message := call(t, argv...)
		if code != 1 || !strings.Contains(message, "invalid_arguments") {
			t.Fatalf("%v: %d %s", args, code, message)
		}
	}
	code, _, message := call(t, "agent", "experimental", "update", "rewind-conversation", "--on", "--dry-run", "--json")
	if code != 1 || !strings.Contains(message, "dry_run_unsupported") {
		t.Fatalf("%d %s", code, message)
	}
	for _, verb := range []string{"list", "update"} {
		code, out, err := call(t, "agent", "experimental", verb, "--help", "--json")
		raw, _ := json.Marshal(out)
		if code != 0 || !strings.Contains(string(raw), "experimental") || err != "" {
			t.Fatalf("%d %s %s", code, raw, err)
		}
	}
}
