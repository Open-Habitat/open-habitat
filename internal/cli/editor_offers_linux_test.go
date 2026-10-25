//go:build linux

package cli

import (
	"errors"
	"testing"
)

// Malformed editor offers are usage errors decided before the socket is
// touched; a well-formed one reaches the socket (absent here) instead.
func TestEditorOfferArgumentsRefuseBeforeSocket(t *testing.T) {
	t.Setenv("OPEN_HABITAT_CONVERSATION_ID", "")
	t.Setenv("OPEN_HABITAT_WORKSPACE_ID", "")
	id := "pi:11111111-1111-4111-8111-111111111111"
	key := "22222222-2222-4222-8222-222222222222"
	ws := "ws_example123"
	usageCode := usage("").code
	for _, args := range [][]string{
		{},
		{"open", "--workspace", ws, "--path", "a.go", "--idempotency-key", key},
		{"offer", "--workspace", ws, "--path", "a.go"},
		{"offer", "--workspace", ws, "--idempotency-key", key},
		{"offer", "--path", "a.go", "--idempotency-key", key},
		{"offer", "--workspace", ws, "--path", "/etc/passwd", "--idempotency-key", key},
		{"offer", "--workspace", ws, "--path", "a.go", "--line", "0", "--idempotency-key", key},
		{"offer", "--workspace", ws, "--path", "a.go", "--line", "+3", "--idempotency-key", key},
		{"offer", "--workspace", ws, "--path", "a.go", "--line", "03", "--idempotency-key", key},
		{"offer", "--workspace", ws, "--path", "a.go", "--idempotency-key", key, "--conversation", id, "--current"},
		{"offer", "--workspace", ws, "--path", "a.go", "--idempotency-key", key, "--path", "b.go"},
		{"offer", "--workspace", ws, "--path", "a.go", "--idempotency-key", key, "--uid", "0"},
	} {
		_, err := agentEditorCommand(args)
		var c *cliError
		if !errors.As(err, &c) || c.code != usageCode {
			t.Errorf("%q: %v", args, err)
		}
	}
	// --current without a launch context is the context's own refusal.
	_, err := agentEditorCommand([]string{"offer", "--current", "--path", "a.go", "--idempotency-key", key})
	var c *cliError
	if !errors.As(err, &c) || c.code != "current_context_unavailable" {
		t.Fatalf("--current outside a launch: %v", err)
	}
	_, err = agentEditorCommand([]string{"offer", "--workspace", ws, "--path", "a.go", "--line", "3", "--idempotency-key", key})
	if !errors.As(err, &c) || c.code == usageCode {
		t.Fatalf("well-formed offer refused as usage: %v", err)
	}
}
