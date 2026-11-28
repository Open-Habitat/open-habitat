//go:build linux

package cli

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

// Malformed file offers are usage errors decided before the socket is
// touched; a well-formed one reaches the socket (absent here) and fails there.
func TestFileOfferArgumentsRefuseBeforeSocket(t *testing.T) {
	agentFileCommand := func(args []string) (any, error) { return runAgentFileCommand(args, refuseOfferTestExchange) }
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
	for _, args := range [][]string{offer("--source", "a.pdf"), offer("--source", "/var/tmp/a.pdf"), offer("--source", "a.pdf", "--source", "/var/tmp/out", "--title", "Paketti")} {
		_, err := agentFileCommand(args)
		var c *cliError
		if !errors.As(err, &c) || c.code == usageCode {
			t.Fatalf("well-formed offer %q refused as usage: %v", args, err)
		}
	}
}

// Both offer commands read the card's persistence from data.result.offer, the
// one path an agent is told to check; a file offer's deprecated notice alias
// does not decide the warning.
func TestOfferPersistenceIsReadFromOffer(t *testing.T) {
	t.Setenv("OPEN_HABITAT_CONVERSATION_ID", "")
	id := "pi:11111111-1111-4111-8111-111111111111"
	key := "22222222-2222-4222-8222-222222222222"
	base := []string{"offer", "--conversation", id, "--workspace", "ws_example123", "--idempotency-key", key, "--source", "/var/tmp/a.html"}
	replies := map[string]func(string) string{
		"view": func(p string) string {
			return `{"schema_version":1,"dry_run":false,"reused":false,"view":{"view_id":"vabcdefghijklmnopqrstuvwxyz"},"skipped_hidden":0,"offer":{"agent_id":"` + id + `","persistence":"` + p + `"}}`
		},
		"file": func(p string) string {
			return `{"schema_version":1,"dry_run":false,"reused":false,"offer":{"offer_id":"fabcdefghijklmnopqrstuvwxyz","agent_id":"` + id + `","persistence":"` + p + `"},"skipped_hidden":0,"notice":{"agent_id":"` + id + `","persistence":"unknown"}}`
		},
	}
	run := map[string]func([]string, func(string, string, []byte) (json.RawMessage, error)) (any, error){"view": runAgentViewCommand, "file": runAgentFileCommand}
	for kind, reply := range replies {
		for _, p := range []string{"persisted", "not_persisted"} {
			exchange := func(string, string, []byte) (json.RawMessage, error) { return json.RawMessage(reply(p)), nil }
			got, err := run[kind](base, exchange)
			if err != nil {
				t.Fatalf("%s %s: %v", kind, p, err)
			}
			warnings := strings.Join(got.(map[string]any)["warnings"].([]string), "\n")
			if warned := strings.Contains(warnings, "persistence is"); warned != (p != "persisted") {
				t.Errorf("%s offer with offer.persistence %s: warnings %q", kind, p, warnings)
			}
		}
	}
}
