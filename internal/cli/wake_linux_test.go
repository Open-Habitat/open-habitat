//go:build linux

package cli

import (
	"strings"
	"testing"
	"time"
)

// The wake commands refuse before reaching the socket anything the daemon
// would have to guess about: a time without an offset or in the past, a note
// out of bounds, another conversation, or a missing wake id.
func TestWakeArgumentsRefuseBeforeSocket(t *testing.T) {
	t.Setenv("OPEN_HABITAT_CONVERSATION_ID", "")
	soon := time.Now().Add(time.Hour).Format(time.RFC3339)
	id := "wk_0123456789abcdef"
	for _, args := range [][]string{
		{},
		{"snooze", "--current"},
		{"create", "--at", soon, "--note", "x"}, // no --current
		{"create", "--current", "--note", "x"},  // no --at
		{"create", "--current", "--at", soon},   // no --note
		{"create", "--current", "--at", "2026-11-19T09:00", "--note", "x"},    // no offset
		{"create", "--current", "--at", "2026-11-19T09:00:00", "--note", "x"}, // no offset
		{"create", "--current", "--at", time.Now().Add(-time.Minute).Format(time.RFC3339), "--note", "x"},
		{"create", "--current", "--at", soon, "--note", " "},
		{"create", "--current", "--at", soon, "--note", strings.Repeat("x", 1001)},
		{"create", "--current", "--at", soon, "--note", "x", "--idempotency-key", "key"},
		{"create", "--current", "--current", "--at", soon, "--note", "x"},
		{"create", "--current", "--at", soon, "--at", soon, "--note", "x"},
		{"create", "--conversation", "pi:11111111-1111-4111-8111-111111111111", "--at", soon, "--note", "x"},
		{"list"},
		{"list", "--current", "--all"},
		{"list", "--current", "--output", "wakes.json"},
		{"update", "--current", "--at", soon}, // no id
		{"update", id, "--current"},           // nothing to change
		{"update", "wk_nothex", "--current", "--at", soon},
		{"delete", "--current"},
		{"delete", id},
		{"due", "--current"},
	} {
		_, err := agentWakeCommand(args)
		if e, ok := err.(*cliError); !ok || e.code != "invalid_arguments" {
			t.Fatalf("%q: %v", args, err)
		}
	}
	if _, err := agentWakeCommand([]string{"create", "--current", "--at", soon, "--note", "x", "--dry-run"}); err == nil || err.(*cliError).code != "dry_run_unsupported" {
		t.Fatalf("dry run: %v", err)
	}
	// A valid request outside a daemon launch is no current context.
	for _, args := range [][]string{{"create", "--current", "--at", soon, "--note", "x"}, {"delete", id, "--current"}, {"list", "--current"}} {
		if _, err := agentWakeCommand(args); err == nil || err.(*cliError).code != "current_context_unavailable" {
			t.Fatalf("%q outside launch: %v", args, err)
		}
	}
}

// The daemon's refusals reach the agent with a reason it can act on; the
// limit in particular says nothing was set.
func TestWakeRefusalsExplainThemselves(t *testing.T) {
	for _, code := range []string{"wake_limit_reached", "wake_time_past", "idempotency_conflict"} {
		err := agentResponseError("POST", "/agent/v1/wakes?current=true", 409, code)
		e, ok := err.(*cliError)
		if !ok || e.code != code || e.exit != 1 {
			t.Fatalf("%s: %v", code, err)
		}
	}
}
