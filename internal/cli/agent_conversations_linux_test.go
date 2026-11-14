//go:build linux

package cli

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestConversationListTitleJSON(t *testing.T) {
	wire := json.RawMessage(`{"schema_version":1,"sessions":[{"agent_id":"pi:00000000-0000-4000-8000-000000000001","title":"Planning"}]}`)
	exchange := func(method, path string, body []byte) (json.RawMessage, error) {
		if method != "GET" || path != "/agent/v1/conversations" || len(body) != 0 {
			t.Fatalf("unexpected request: %s %s %s", method, path, body)
		}
		return wire, nil
	}
	for _, output := range []string{"", filepath.Join(t.TempDir(), "conversations.jsonl")} {
		args := []string{"conversation", "list"}
		if output != "" {
			args = append(args, "--output", output)
		}
		req, err := parseConversationRequest(args)
		if err != nil {
			t.Fatal(err)
		}
		result, err := runConversationRequest(req, exchange)
		if err != nil {
			t.Fatal(err)
		}
		var row map[string]any
		if output == "" {
			encoded, err := json.Marshal(result)
			if err != nil {
				t.Fatal(err)
			}
			var envelope struct {
				Data struct {
					Result struct {
						Sessions []map[string]any `json:"sessions"`
					} `json:"result"`
				} `json:"data"`
			}
			if err := json.Unmarshal(encoded, &envelope); err != nil {
				t.Fatal(err)
			}
			if len(envelope.Data.Result.Sessions) != 1 {
				t.Fatalf("unexpected envelope: %s", encoded)
			}
			row = envelope.Data.Result.Sessions[0]
		} else {
			encoded, err := os.ReadFile(output)
			if err != nil {
				t.Fatal(err)
			}
			if err := json.Unmarshal(encoded, &row); err != nil {
				t.Fatal(err)
			}
		}
		if row["title"] != "Planning" {
			t.Fatalf("title lost: %#v", row)
		}
	}
}

func TestAgentConversationRequest(t *testing.T) {
	id := "pi:00000000-0000-4000-8000-000000000001"
	key := "00000000-0000-4000-8000-000000000002"
	file := filepath.Join(t.TempDir(), "message")
	if err := os.WriteFile(file, []byte("message\n"), 0600); err != nil {
		t.Fatal(err)
	}
	for _, delivery := range []string{"send", "steer", "follow-up"} {
		req, err := parseConversationRequest([]string{"message", "create", "--conversation", id, "--idempotency-key", key, "--text-file", file, "--delivery", delivery})
		if err != nil {
			t.Fatal(err)
		}
		var body map[string]any
		json.Unmarshal(req.body, &body)
		if body["command_id"] != key || body["message"] != "message\n" || req.method != "POST" || !strings.HasSuffix(req.path, "/"+strings.ReplaceAll(delivery, "-", "_")) {
			t.Fatalf("%+v %s", req, req.body)
		}
	}
	for _, args := range [][]string{
		{"conversation", "resume", "--current"},
		{"message", "create", "--text-file", file, "--idempotency-key", key},
		{"message", "create", "--conversation", id, "--text-file", file},
		{"conversation", "delete", "--conversation", id},
		{"conversation", "stop", "--conversation", id, "--conversation", id},
		{"queue", "delete", "--conversation", id, "--idempotency-key", key, "--held", "--held"},
		{"conversation", "update", "--conversation", id, "--workspace", "ws_example123", "--archived", "yes"},
		{"conversation", "create", "--workspace", "ws_example123", "--thinking", "medium"},
		{"conversation", "create", "--workspace", "ws_example123", "--provider", "openai"},
		{"conversation", "create", "--workspace", "ws_example123", "--worktree", "../escape"},
		{"conversation", "list", "--output", "x.json"},
	} {
		if _, err := parseConversationRequest(args); err == nil {
			t.Fatalf("accepted %q", args)
		}
	}
	for _, args := range [][]string{
		{"conversation", "create", "--workspace", "ws_example123"},
		{"conversation", "stop", "--conversation", id},
		{"conversation", "resume", "--conversation", id},
		{"conversation", "delete", "--conversation", id, "--empty-only"},
		{"recap", "create", "--conversation", id},
		{"title", "create", "--conversation", id, "--workspace", "ws_example123"},
		{"queue", "delete", "--conversation", id, "--idempotency-key", key, "--held"},
	} {
		req, err := parseConversationRequest(args)
		if err != nil {
			t.Fatal(err)
		}
		if req.method != "POST" {
			t.Fatal(req)
		}
		_, err = parseConversationRequest(append(args, "--dry-run"))
		ce, ok := err.(*cliError)
		if !ok || ce.code != "dry_run_unsupported" {
			t.Fatalf("%q: %v", args, err)
		}
	}
}

func TestAgentConversationGenerationFailure(t *testing.T) {
	for _, action := range []string{"recap", "regenerate_title", "history_title"} {
		path := "/agent/v1/conversations/00000000-0000-4000-8000-000000000001/" + action
		err := conversationOperationError(path, json.RawMessage(`{"schema_version":1,"state":"failed","reason":"model_unavailable"}`))
		ce, ok := err.(*cliError)
		if !ok || ce.exit != 2 || ce.code != "native_operation_failed" || !strings.Contains(ce.message, "model_unavailable") {
			t.Fatalf("%s: %v", action, err)
		}
		// Only a fixed reason code is repeated, never reply text.
		err = conversationOperationError(path, json.RawMessage(`{"schema_version":1,"state":"failed","reason":"Bearer secret"}`))
		if ce, ok := err.(*cliError); !ok || ce.code != "native_operation_failed" || strings.Contains(ce.message, "secret") {
			t.Fatalf("%s: %v", action, err)
		}
		if conversationOperationError(path, json.RawMessage(`{"schema_version":1,"state":"done"}`)) != nil {
			t.Fatal("completion refused")
		}
	}
}

func TestAgentMessageEncodedLimit(t *testing.T) {
	file := filepath.Join(t.TempDir(), "message")
	args := []string{"message", "create", "--conversation", "pi:00000000-0000-4000-8000-000000000001", "--idempotency-key", "00000000-0000-4000-8000-000000000002", "--text-file", file}
	for _, tc := range []struct {
		text  string
		valid bool
	}{
		{strings.Repeat("<>&", 20000), true},
		{"prefix" + strings.Repeat("\n", 40000), false},
		{strings.Repeat("a", 65536), true},
		{strings.Repeat("a", 65537), false},
	} {
		if err := os.WriteFile(file, []byte(tc.text), 0600); err != nil {
			t.Fatal(err)
		}
		req, err := parseConversationRequest(args)
		if (err == nil) != tc.valid {
			t.Fatalf("raw=%d encoded=%d valid=%v err=%v", len(tc.text), len(req.body), tc.valid, err)
		}
		if tc.valid {
			var input map[string]string
			if json.Unmarshal(req.body, &input) != nil || input["message"] != tc.text {
				t.Fatal("input changed during encoding")
			}
		}
	}
}
