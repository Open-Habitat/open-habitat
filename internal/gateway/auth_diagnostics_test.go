package gateway

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestCallbackDiagnostics(t *testing.T) {
	tests := []struct {
		name, query, reason string
		mutate              func(*http.Request)
		status              int
		setup               func(*Auth, *fakeProvider, *fakeSink)
	}{
		{name: "accepted", query: "&code=synthetic-code", status: 303},
		{name: "issuer accepted", query: "&code=synthetic-code&iss=" + url.QueryEscape(githubOAuthIssuer), status: 303},
		{name: "issuer error", query: "&error=denied&iss=" + url.QueryEscape(githubOAuthIssuer), reason: "provider_denied", status: 403},
		{name: "wrong issuer host", query: "&code=synthetic-code&iss=" + url.QueryEscape("https://github.example/login/oauth"), reason: "shape_issuer_mismatch", status: 400},
		{name: "wrong issuer path", query: "&code=synthetic-code&iss=" + url.QueryEscape("https://github.com/login/oauth/"), reason: "shape_issuer_mismatch", status: 400},
		{name: "wrong issuer scheme", query: "&code=synthetic-code&iss=" + url.QueryEscape("http://github.com/login/oauth"), reason: "shape_issuer_mismatch", status: 400},
		{name: "wrong issuer encoding", query: "&code=synthetic-code&iss=https%3A%2F%2Fgithub.com%2Flogin%2F%256Fauth", reason: "shape_issuer_mismatch", status: 400},
		{name: "empty issuer", query: "&code=synthetic-code&iss=", reason: "shape_issuer_mismatch", status: 400},
		{name: "duplicate issuer", query: "&code=synthetic-code&iss=" + url.QueryEscape(githubOAuthIssuer) + "&iss=" + url.QueryEscape(githubOAuthIssuer), reason: "shape_duplicate_key", status: 400},
		{name: "issuer with extra", query: "&code=synthetic-code&iss=" + url.QueryEscape(githubOAuthIssuer) + "&extra=x", reason: "shape_extra_key", status: 400},
		{name: "issuer with both outcomes", query: "&code=synthetic-code&error=denied&iss=" + url.QueryEscape(githubOAuthIssuer), reason: "shape_extra_key", status: 400},
		{name: "extra", query: "&code=synthetic-code&unexpected=secret-query", reason: "shape_extra_key", status: 400},
		{name: "both", query: "&code=synthetic-code&error=denied", reason: "shape_extra_key", status: 400},
		{name: "duplicate", query: "&code=synthetic-code&code=secret-query", reason: "shape_duplicate_key", status: 400},
		{name: "empty", query: "&code=", reason: "shape_missing_or_empty", status: 400},
		{name: "missing", query: "", reason: "shape_missing_or_empty", status: 400},
		{name: "malformed", query: "&code=x&%zz", reason: "shape_malformed", status: 400},
		{name: "host", query: "&code=x", reason: "host_mismatch", status: 400, mutate: func(r *http.Request) { r.Host = "foreign.invalid" }},
		{name: "tls", query: "&code=x", reason: "tls_missing", status: 400, mutate: func(r *http.Request) { r.TLS = nil }},
		{name: "browser", query: "&code=x", reason: "browser_mismatch", status: 403, mutate: func(r *http.Request) { r.Header.Set("Cookie", flowCookie+"=secret-cookie") }},
		{name: "expired", query: "&code=x", reason: "flow_missing_or_expired", status: 403, mutate: func(r *http.Request) { /* clock moved below */ }},
		{name: "provider", query: "&error=secret-query", reason: "provider_denied", status: 403},
		{name: "exchange", query: "&code=x", reason: "exchange_failed", status: 403, setup: func(_ *Auth, p *fakeProvider, _ *fakeSink) { p.err = fmt.Errorf("secret-provider-error") }},
		{name: "identity", query: "&code=x", reason: "identity_denied", status: 403, setup: func(_ *Auth, p *fakeProvider, _ *fakeSink) { p.login = "" }},
		{name: "broker", query: "&code=x", reason: "broker_denied", status: 403, setup: func(a *Auth, _ *fakeProvider, _ *fakeSink) { a.broker = &fakeBroker{fail: true} }},
		{name: "handoff", query: "&code=x", reason: "handoff_failed", status: 503, setup: func(_ *Auth, _ *fakeProvider, s *fakeSink) { s.err = fmt.Errorf("secret-sink-error") }},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			h, a, p, s, clock := fixture(t)
			broker := newFakeBroker()
			brokerCalls := 0
			broker.hook = func(BrokerRequest) { brokerCalls++ }
			a.broker = broker
			var buf bytes.Buffer
			a.log = CallbackLogger(&buf)
			if tc.setup != nil {
				tc.setup(a, p, s)
			}
			state, flow := start(t, h)
			if tc.name == "expired" {
				*clock = clock.Add(6 * time.Minute)
			}
			r := httptest.NewRequest("GET", "https://host.test/auth/github/callback?state="+url.QueryEscape(state)+tc.query, nil)
			r.AddCookie(flow)
			r.Header.Set("Accept", "application/json")
			r.Header.Set("Authorization", "Bearer secret-authorization")
			if tc.mutate != nil {
				tc.mutate(r)
			}
			w := httptest.NewRecorder()
			h.ServeHTTP(w, r)
			if w.Code != tc.status {
				t.Fatalf("status %d want %d", w.Code, tc.status)
			}
			lines := strings.Split(strings.TrimSpace(buf.String()), "\n")
			if len(lines) != 2 {
				t.Fatalf("events: %d", len(lines))
			}
			var started, result map[string]any
			if err := json.Unmarshal([]byte(lines[0]), &started); err != nil {
				t.Fatal(err)
			}
			if err := json.Unmarshal([]byte(lines[1]), &result); err != nil {
				t.Fatal(err)
			}
			if started["outcome"] != "started" || result["reason"] != map[bool]string{true: "none", false: tc.reason}[tc.status == 303] {
				t.Fatalf("incorrect diagnostic: %v", result)
			}
			id, ok := started["attempt_id"].(string)
			if !ok || len(id) != 22 || id != result["attempt_id"] || id == state {
				t.Fatal("invalid server-owned attempt ID")
			}
			for _, secret := range []string{state, flow.Value, "github.example", "%256Fauth", "secret-query", "secret-cookie", "secret-authorization", "secret-provider-error", "secret-sink-error", "synthetic-code", p.token, p.authorization, "host.test", "foreign.invalid"} {
				if secret != "" && strings.Contains(buf.String(), secret) {
					t.Fatalf("log leaked forbidden value (%s)", tc.name)
				}
			}
			if tc.status == 303 && result["user"] != "alice" || tc.status != 303 && result["user"] != nil {
				t.Fatalf("unexpected broker-verified user: %v", result)
			}
			if tc.status != 303 && tc.setup == nil && (p.calls != 0 || s.calls != 0 || brokerCalls != 0) {
				t.Fatal("failure reached provider or provisioning")
			}
			if tc.status != 303 && callback(h, state, flow).Code == 303 {
				t.Fatal("replay accepted")
			}
		})
	}
}

func TestCallbackUnmatchedStateGetsIndependentAttempt(t *testing.T) {
	h, a, p, s, _ := fixture(t)
	var buf bytes.Buffer
	a.log = CallbackLogger(&buf)
	w := request(h, "GET", "/auth/github/callback?state=attacker-supplied-state&code=attacker-supplied-code")
	if w.Code != 403 || p.calls != 0 || s.calls != 0 {
		t.Fatal("unmatched flow accepted")
	}
	var event map[string]any
	if err := json.Unmarshal(bytes.TrimSpace(buf.Bytes()), &event); err != nil {
		t.Fatal(err)
	}
	if event["reason"] != "flow_missing_or_expired" || event["attempt_id"] == "attacker-supplied-state" || strings.Contains(buf.String(), "attacker-supplied") {
		t.Fatal("untrusted state logged")
	}
}

// Unknown states cannot make the gateway an unlimited diagnostic log emitter.
// The budget must not suppress a matching flow's event or change any response.
func TestCallbackUnmatchedLogBudget(t *testing.T) {
	h, a, p, s, _ := fixture(t)
	var buf bytes.Buffer
	a.log = CallbackLogger(&buf)
	for i := 0; i < 80; i++ {
		path := "/auth/github/callback?state=unknown&code=x"
		if i%2 == 0 {
			path += "&extra=x"
		}
		w := request(h, "GET", path)
		if i%2 == 0 && w.Code != 400 || i%2 != 0 && w.Code != 403 {
			t.Fatalf("unmatched response %d", w.Code)
		}
	}
	if count := bytes.Count(buf.Bytes(), []byte("\n")); count != 32 {
		t.Fatalf("unmatched events %d, want 32", count)
	}
	if p.calls != 0 || s.calls != 0 {
		t.Fatal("unmatched callback reached provider or sink")
	}
	state, flow := start(t, h)
	if callback(h, state, flow).Code != 303 || bytes.Count(buf.Bytes(), []byte("\n")) != 34 {
		t.Fatal("matched callback lost after budget exhaustion")
	}
}
