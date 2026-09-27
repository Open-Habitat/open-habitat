package gateway

import (
	"bytes"
	"encoding/json"
	"log/slog"
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
	}{
		{name: "accepted", query: "&code=synthetic-code", status: 303},
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
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			h, a, p, s, clock := fixture(t)
			var buf bytes.Buffer
			a.log = slog.New(slog.NewJSONHandler(&buf, nil))
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
			for _, secret := range []string{state, flow.Value, "secret-query", "secret-cookie", "secret-authorization", "synthetic-code", "alice", p.token, p.authorization, "host.test", "foreign.invalid"} {
				if secret != "" && strings.Contains(buf.String(), secret) {
					t.Fatalf("log leaked forbidden value (%s)", tc.name)
				}
			}
			if tc.status != 303 && (p.calls != 0 || s.calls != 0) {
				t.Fatal("failure reached provisioning")
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
	a.log = slog.New(slog.NewJSONHandler(&buf, nil))
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
