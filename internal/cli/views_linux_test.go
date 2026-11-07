//go:build linux

package cli

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/daemon"
)

// Malformed offers are refused before transport; valid paths reach the
// injected exchange without contacting a person's installed daemon.
func TestViewArgumentsRefuseBeforeSocket(t *testing.T) {
	agentViewCommand := func(args []string) (any, error) { return runAgentViewCommand(args, refuseOfferTestExchange) }
	t.Setenv("OPEN_HABITAT_CONVERSATION_ID", "")
	id := "pi:11111111-1111-4111-8111-111111111111"
	key := "22222222-2222-4222-8222-222222222222"
	ws := "ws_example123"
	usageCode := usage("").code
	for _, args := range [][]string{
		{},
		{"show"},
		{"offer", "--conversation", id, "--workspace", ws, "--source", "r.html"},
		{"offer", "--conversation", id, "--workspace", ws, "--idempotency-key", key},
		{"offer", "--conversation", id, "--workspace", ws, "--source", "", "--idempotency-key", key},
		{"offer", "--conversation", id, "--workspace", "home", "--source", "r.html", "--idempotency-key", key},
		{"offer", "--workspace", ws, "--source", "r.html", "--idempotency-key", key, "--conversation", id, "--current"},
		{"offer", "--workspace", ws, "--source", "r.html", "--idempotency-key", key},
		{"offer", "--conversation", id, "--workspace", ws, "--source", "r.html", "--idempotency-key", key, "--title", " "},
		{"offer", "--conversation", id, "--workspace", ws, "--source", "r.html", "--idempotency-key", key, "--uid", "0"},
		{"offer", "--conversation", id, "--workspace", ws, "--source", "r.html", "--idempotency-key", key, "--source", "x.html"},
		{"offer", "--conversation", id, "--workspace", ws, "--source", "r.html", "--idempotency-key", key, "--output", "x.jsonl"},
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
	for _, source := range []string{"r.html", "/var/tmp/r.html", "/home/person/src/project/r.html"} {
		_, err := agentViewCommand([]string{"offer", "--conversation", id, "--workspace", ws, "--source", source, "--idempotency-key", key})
		var c *cliError
		if !errors.As(err, &c) || c.code == usageCode {
			t.Fatalf("well-formed offer refused as usage: %v", err)
		}
	}
}

func refuseOfferTestExchange(string, string, []byte) (json.RawMessage, error) {
	return nil, system("test_transport", "synthetic transport reached")
}

// --current names the conversation's workspace too: without --workspace it
// takes the launch context's, and outside one it says the context is missing.
func TestViewOfferCurrentResolvesWorkspace(t *testing.T) {
	agentViewCommand := func(args []string) (any, error) { return runAgentViewCommand(args, refuseOfferTestExchange) }
	key := "22222222-2222-4222-8222-222222222222"
	args := []string{"offer", "--current", "--source", "r.html", "--idempotency-key", key}
	for _, k := range []string{"OPEN_HABITAT_CONVERSATION_ID", "OPEN_HABITAT_WORKSPACE_ID", "OPEN_HABITAT_LAUNCH_GENERATION"} {
		t.Setenv(k, "")
	}
	var c *cliError
	if _, err := agentViewCommand(args); !errors.As(err, &c) || c.code != "current_context_unavailable" {
		t.Fatalf("outside a launch context: %v", err)
	}
	t.Setenv("OPEN_HABITAT_CONVERSATION_ID", "pi:11111111-1111-4111-8111-111111111111")
	t.Setenv("OPEN_HABITAT_WORKSPACE_ID", "ws_example123")
	t.Setenv("OPEN_HABITAT_LAUNCH_GENERATION", "33333333-3333-4333-8333-333333333333")
	if _, err := agentViewCommand(args); !errors.As(err, &c) || c.code == usage("").code {
		t.Fatalf("--current without --workspace refused as usage: %v", err)
	}
	if _, err := agentViewCommand(append(args, "--workspace", "home")); !errors.As(err, &c) || c.code != usage("").code {
		t.Fatalf("explicit malformed --workspace accepted: %v", err)
	}
}

// A site without views refuses the offer with its own code and a message the
// agent can relay, naming the file offer as the way to hand the page over.
func TestViewOfferViewsUnavailableIsRelayable(t *testing.T) {
	var c *cliError
	err := agentResponseError("POST", daemon.AgentViewsPath+"?id=pi:11111111-1111-4111-8111-111111111111", 409, "views_unavailable")
	if !errors.As(err, &c) || c.code != "views_unavailable" || c.exit != 1 || !strings.Contains(c.message, "nothing was published") || !strings.Contains(c.message, "agent file offer") {
		t.Fatalf("views_unavailable: %#v", err)
	}
}
