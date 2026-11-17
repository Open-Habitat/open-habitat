//go:build linux

package cli

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestNoticeArgumentsRefuseAmbiguityBeforeSocket(t *testing.T) {
	t.Setenv("OPEN_HABITAT_CONVERSATION_ID", "")
	id := "pi:11111111-1111-4111-8111-111111111111"
	key := "22222222-2222-4222-8222-222222222222"
	for _, args := range [][]string{
		{"create", "--conversation", id, "--current"},
		{"create", "--conversation", id, "--text", "x"},
		{"create", "--conversation", id, "--idempotency-key", key, "--text", "x", "--text-file", "-"},
		{"create", "--conversation", id, "--idempotency-key", key, "--text", "x", "--uid", "0"},
		{"create", "--conversation", id, "--idempotency-key", key, "--text", "x", "--conversation", id},
		{"list", "--conversation", id, "--dry-run"},
		{"list", "--current"},
		{"list", "--conversation", id, "--output", "bad.txt"},
	} {
		if _, err := agentNoticeCommand(args); err == nil {
			t.Fatalf("accepted %q", args)
		}
	}
}
func TestNoticeExportDoesNotOverwrite(t *testing.T) {
	path := filepath.Join(t.TempDir(), "notices.jsonl")
	data := json.RawMessage(`{"schema_version":1,"notices":[{"notice_id":"22222222-2222-4222-8222-222222222222","text":"private synthetic text","persistence":"persisted"}]}`)
	if _, err := writeNoticeOutput(path, data); err != nil {
		t.Fatal(err)
	}
	before, _ := os.ReadFile(path)
	if _, err := writeNoticeOutput(path, data); err == nil {
		t.Fatal("clobbered export")
	}
	after, _ := os.ReadFile(path)
	if string(before) != string(after) {
		t.Fatal("changed export")
	}
	var row map[string]any
	if json.Unmarshal(after, &row) != nil || row["schema_version"] != float64(1) || row["text"] != "private synthetic text" {
		t.Fatal(string(after))
	}
}

// The section command refuses before reaching the socket anything but the
// current conversation and exactly one of the three sections.
func TestSectionArgumentsRefuseBeforeSocket(t *testing.T) {
	t.Setenv("OPEN_HABITAT_CONVERSATION_ID", "")
	for _, args := range [][]string{
		{},
		{"show", "--current"},
		{"update", "--section", "quiet"},
		{"update", "--current"},
		{"update", "--current", "--section", "hidden"},
		{"update", "--current", "--section", "Quiet"},
		{"update", "--current", "--section"},
		{"update", "--current", "--current", "--section", "quiet"},
		{"update", "--current", "--section", "quiet", "--section", "yours"},
		{"update", "--conversation", "pi:11111111-1111-4111-8111-111111111111", "--section", "quiet"},
	} {
		_, err := agentSectionCommand(args)
		if e, ok := err.(*cliError); !ok || e.code != "invalid_arguments" {
			t.Fatalf("%q: %v", args, err)
		}
	}
	if _, err := agentSectionCommand([]string{"update", "--current", "--section", "quiet", "--dry-run"}); err == nil || err.(*cliError).code != "dry_run_unsupported" {
		t.Fatalf("dry run: %v", err)
	}
	// A valid request outside a daemon launch is no current context.
	_, err := agentSectionCommand([]string{"update", "--current", "--section", "quiet"})
	if e, ok := err.(*cliError); !ok || e.code != "current_context_unavailable" {
		t.Fatalf("outside launch: %v", err)
	}
}
