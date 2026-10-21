//go:build linux

package cli

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestAgentModelRequest(t *testing.T) {
	method, body, err := agentModelRequest([]string{"list"})
	if err != nil || method != "GET" || body != nil {
		t.Fatalf("%s %s %v", method, body, err)
	}
	for _, thinking := range []bool{false, true} {
		args := []string{"update", "--model", "gpt-5.5", "--provider", "openai-codex"}
		if thinking {
			args = append(args, "--thinking", "off")
		}
		method, body, err = agentModelRequest(args)
		var got map[string]string
		if err != nil || method != "POST" || json.Unmarshal(body, &got) != nil {
			t.Fatalf("%s %s %v", method, body, err)
		}
		_, hasThinking := got["thinking"]
		if hasThinking != thinking || got["provider"] != "openai-codex" || got["model"] != "gpt-5.5" {
			t.Fatal(got)
		}
	}
}

func TestAgentModelInvalidBeforeConnection(t *testing.T) {
	for _, args := range [][]string{
		{"list", "--uid", "0"}, {"show"},
		{"update"}, {"update", "--model", "gpt-5.5"},
		{"update", "--provider", "openai", "--model", " "},
		{"update", "--provider", "openai", "--model", " gpt-5.5"},
		{"update", "--provider", "other", "--model", "gpt-5.5"},
		{"update", "--provider", "openai", "--model", "gpt-5.5", "--thinking", ""},
		{"update", "--provider", "openai", "--model", "gpt-5.5", "--thinking", "automatic"},
		{"update", "--provider", "openai", "--model", "gpt-5.5", "--model", "other"},
		{"update", "--provider", "openai", "--model", "gpt-5.5", "--socket", "/other"},
		{"update", "--provider", "openai", "--model", "gpt-5.5", "--thinking"},
	} {
		argv := append([]string{"agent", "model"}, args...)
		argv = append(argv, "--json")
		code, _, message := call(t, argv...)
		if code != 1 || !strings.Contains(message, "invalid_arguments") {
			t.Fatalf("%v: %d %s", args, code, message)
		}
	}
	code, _, message := call(t, "agent", "model", "update", "--provider", "openai", "--model", "gpt-5.5", "--dry-run", "--json")
	if code != 1 || !strings.Contains(message, "dry_run_unsupported") {
		t.Fatalf("%d %s", code, message)
	}
}
