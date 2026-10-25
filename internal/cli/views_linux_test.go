//go:build linux

package cli

import (
	"errors"
	"testing"
)

// Malformed offers are usage errors decided before the socket is touched;
// a well-formed one reaches the socket (absent here) and fails there instead.
func TestViewArgumentsRefuseBeforeSocket(t *testing.T) {
	t.Setenv("OPEN_HABITAT_CONVERSATION_ID", "")
	id := "pi:11111111-1111-4111-8111-111111111111"
	key := "22222222-2222-4222-8222-222222222222"
	ws := "ws_example123"
	usageCode := usage("").code
	for _, args := range [][]string{
		{},
		{"show"},
		{"offer", "--workspace", ws, "--source", "r.html"},
		{"offer", "--workspace", ws, "--idempotency-key", key},
		{"offer", "--workspace", ws, "--source", "/etc/passwd", "--idempotency-key", key},
		{"offer", "--workspace", "home", "--source", "r.html", "--idempotency-key", key},
		{"offer", "--workspace", ws, "--source", "r.html", "--idempotency-key", key, "--conversation", id, "--current"},
		{"offer", "--workspace", ws, "--source", "r.html", "--idempotency-key", key, "--title", " "},
		{"offer", "--workspace", ws, "--source", "r.html", "--idempotency-key", key, "--uid", "0"},
		{"offer", "--workspace", ws, "--source", "r.html", "--idempotency-key", key, "--source", "x.html"},
		{"offer", "--workspace", ws, "--source", "r.html", "--idempotency-key", key, "--output", "x.jsonl"},
		{"list", "--dry-run"},
		{"list", "--output", "views.txt"},
		{"remove", "--view", "../x"},
		{"remove", "--view", "vabcdefghijklmnopqrstuvwxyz", "--current"},
	} {
		_, err := agentViewCommand(args)
		var c *cliError
		if !errors.As(err, &c) || c.code != usageCode {
			t.Errorf("%q: %v", args, err)
		}
	}
	_, err := agentViewCommand([]string{"offer", "--workspace", ws, "--source", "r.html", "--idempotency-key", key})
	var c *cliError
	if !errors.As(err, &c) || c.code == usageCode {
		t.Fatalf("well-formed offer refused as usage: %v", err)
	}
}
