//go:build linux

package cli

import (
	"errors"
	"testing"
)

// Malformed file offers are usage errors decided before the socket is
// touched; a well-formed one reaches the socket (absent here) and fails there.
func TestFileOfferArgumentsRefuseBeforeSocket(t *testing.T) {
	t.Setenv("OPEN_HABITAT_CONVERSATION_ID", "")
	id := "pi:11111111-1111-4111-8111-111111111111"
	key := "22222222-2222-4222-8222-222222222222"
	ws := "ws_example123"
	usageCode := usage("").code
	offer := func(extra ...string) []string {
		return append([]string{"offer", "--conversation", id, "--workspace", ws, "--idempotency-key", key}, extra...)
	}
	for _, args := range [][]string{
		{},
		{"show"},
		offer(),
		offer("--source", "/etc/passwd"),
		offer("--source", ""),
		offer("--source", "a.pdf", "--source", "b.pdf"), // several sources need a title
		offer("--source", "a.pdf", "--title", " "),
		offer("--source", "a.pdf", "--entry-file", "a.pdf"),
		offer("--source", "a.pdf", "--current"),
		{"offer", "--workspace", ws, "--source", "a.pdf", "--idempotency-key", key},
		{"offer", "--conversation", id, "--workspace", "home", "--source", "a.pdf", "--idempotency-key", key},
		{"offer", "--conversation", id, "--workspace", ws, "--source", "a.pdf", "--idempotency-key", "x"},
		{"list", "--dry-run"},
		{"list", "--output", "offers.txt"},
		{"remove", "--offer-id", "vabcdefghijklmnopqrstuvwxyz"},
		{"remove", "--offer-id", "fabcdefghijklmnopqrstuvwxyz", "--current"},
	} {
		_, err := agentFileCommand(args)
		var c *cliError
		if !errors.As(err, &c) || c.code != usageCode {
			t.Errorf("%q: %v", args, err)
		}
	}
	for _, args := range [][]string{offer("--source", "a.pdf"), offer("--source", "a.pdf", "--source", "out", "--title", "Paketti")} {
		_, err := agentFileCommand(args)
		var c *cliError
		if !errors.As(err, &c) || c.code == usageCode {
			t.Fatalf("well-formed offer %q refused as usage: %v", args, err)
		}
	}
}
