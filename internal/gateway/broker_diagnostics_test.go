package gateway

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
)

type diagnosticBroker struct {
	operation        string
	err              error
	invalid, changed bool
}

func (b diagnosticBroker) Exchange(_ context.Context, r BrokerRequest) (BrokerReply, error) {
	if r.Operation == b.operation {
		if b.err != nil {
			return BrokerReply{}, b.err
		}
		if b.invalid {
			return BrokerReply{}, nil
		}
		if b.changed {
			return BrokerReply{Route: &BrokerRoute{UID: 1001, Username: "alice", Socket: "/run/native-agent-host/users/alice/daemon.sock"}, Epoch: 2, Generation: 1}, nil
		}
	}
	return BrokerReply{Route: &BrokerRoute{UID: 1001, Username: "alice", Socket: "/run/native-agent-host/users/alice/daemon.sock"}, Epoch: 1, Generation: 1}, nil
}
func TestBrokerCallbackClassification(t *testing.T) {
	cases := []struct {
		name             string
		err              error
		invalid, changed bool
		reason           BrokerFailure
	}{
		{name: "transport", err: fmt.Errorf("secret raw error %w", BrokerTransport), reason: BrokerTransport},
		{name: "unavailable", err: BrokerStateUnavailable, reason: BrokerStateUnavailable},
		{name: "denied", err: BrokerDenied, reason: BrokerDenied},
		{name: "collision", err: BrokerNameCollision, reason: BrokerNameCollision},
		{name: "drift", err: BrokerDrift, reason: BrokerDrift},
		{name: "invalid reply error", err: BrokerInvalidReply, reason: BrokerInvalidReply},
		{name: "invalid route", invalid: true, reason: BrokerInvalidReply},
		{name: "binding changed", changed: true, reason: BrokerBindingChanged},
		{name: "unknown error", err: errors.New("secret raw error"), reason: BrokerTransport},
		{name: "untrusted typed error", err: BrokerFailure("secret raw error"), reason: BrokerTransport},
	}
	for _, operation := range []string{"ensure", "authorize"} {
		for _, tc := range cases {
			if tc.changed && operation == "ensure" {
				continue
			}
			t.Run(operation+"/"+tc.name, func(t *testing.T) {
				h, a, _, sink, _ := fixture(t)
				a.broker = diagnosticBroker{operation: operation, err: tc.err, invalid: tc.invalid, changed: tc.changed}
				var buf bytes.Buffer
				a.log = CallbackLogger(&buf)
				state, flow := start(t, h)
				w := callback(h, state, flow)
				if w.Code != 403 || sink.calls != map[string]int{"ensure": 0, "authorize": 1}[operation] {
					t.Fatalf("failure semantics: %d sink=%d", w.Code, sink.calls)
				}
				if strings.Contains(w.Body.String(), "secret raw error") {
					t.Fatal("browser leaked error")
				}
				lines := strings.Split(strings.TrimSpace(buf.String()), "\n")
				if len(lines) != 2 {
					t.Fatalf("events: %d", len(lines))
				}
				var first, last map[string]any
				if json.Unmarshal([]byte(lines[0]), &first) != nil || json.Unmarshal([]byte(lines[1]), &last) != nil {
					t.Fatal("invalid JSONL")
				}
				if last["reason"] != "broker_denied" || last["broker_operation"] != operation || last["broker_reason"] != string(tc.reason) || first["attempt_id"] != last["attempt_id"] {
					t.Fatalf("wrong classification: %v", last)
				}
				for _, forbidden := range []string{"alice", "other", "/secret/socket", "/run/native-agent-host", "secret raw error", state, flow.Value} {
					if strings.Contains(buf.String(), forbidden) {
						t.Fatalf("leaked %q", forbidden)
					}
				}
				// Exact key sets catch even newly named identity/UID fields.
				allowed := map[string]bool{"time": true, "level": true, "event": true, "schema_version": true, "component": true, "outcome": true, "reason": true, "attempt_id": true}
				for index, event := range []map[string]any{first, last} {
					want := len(allowed)
					if index == 1 {
						want += 2
					}
					if len(event) != want {
						t.Fatalf("unexpected event fields: %v", event)
					}
					for key := range event {
						if !allowed[key] && !(index == 1 && (key == "broker_operation" || key == "broker_reason")) {
							t.Fatalf("unexpected field %s", key)
						}
					}
				}
				if first["outcome"] != "started" || first["reason"] != "none" || last["outcome"] != "rejected" || last["event"] != "oauth_callback" || first["component"] != "gateway" {
					t.Fatal("unexpected fixed event values")
				}
				if id, ok := last["attempt_id"].(string); !ok || len(id) != 22 || id == state {
					t.Fatal("invalid attempt ID")
				}
				// No session cookie is issued on either failure path.
				for _, c := range w.Result().Cookies() {
					if c.Name == cookieName && c.MaxAge >= 0 {
						t.Fatal("session issued")
					}
				}
			})
		}
	}
}
