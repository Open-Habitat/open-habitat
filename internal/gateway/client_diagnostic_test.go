package gateway

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

const validClientDiagnostic = `{"schema_version":1,"read":"session","reason":"network","status":0,"phase":"landing","online":false,"read_duration_ms":42,"episode_duration_ms":1000,"attempts":2}`

func TestClientDiagnosticClosedInput(t *testing.T) {
	var original map[string]any
	_ = json.Unmarshal([]byte(validClientDiagnostic), &original)
	for key := range original {
		t.Run("missing-"+key, func(t *testing.T) {
			fields := make(map[string]any)
			for k, v := range original {
				if k != key {
					fields[k] = v
				}
			}
			b, _ := json.Marshal(fields)
			if _, ok := decodeClientLoadFailure(bytes.NewReader(b)); ok {
				t.Fatal("missing field accepted")
			}
		})
		t.Run("null-"+key, func(t *testing.T) {
			fields := make(map[string]any)
			for k, v := range original {
				fields[k] = v
			}
			fields[key] = nil
			b, _ := json.Marshal(fields)
			if _, ok := decodeClientLoadFailure(bytes.NewReader(b)); ok {
				t.Fatal("null accepted")
			}
		})
	}
	for _, change := range []struct {
		key   string
		value any
	}{
		{"read", "secret-path"}, {"reason", "secret-error"}, {"phase", "unknown"}, {"extra", "secret"}, {"schema_version", 2}, {"status", 600}, {"status", -1}, {"online", "false"}, {"attempts", 0}, {"attempts", 10001}, {"read_duration_ms", -1}, {"read_duration_ms", 86400001}, {"episode_duration_ms", 86400001}, {"attempts", 1.5},
	} {
		fields := make(map[string]any)
		for k, v := range original {
			fields[k] = v
		}
		fields[change.key] = change.value
		b, _ := json.Marshal(fields)
		if _, ok := decodeClientLoadFailure(bytes.NewReader(b)); ok {
			t.Errorf("accepted %s=%v", change.key, change.value)
		}
	}
	if _, ok := decodeClientLoadFailure(strings.NewReader(validClientDiagnostic + ` {}`)); ok {
		t.Fatal("trailing body accepted")
	}
}

func TestClientDiagnosticAuthLogAndBudget(t *testing.T) {
	h, a, _, _, clock := fixture(t)
	_, cookie := login(t, h)
	csrf := extractCSRF(t, request(h, "GET", "/auth/session", cookie).Body.String())
	var logs bytes.Buffer
	a.log = CallbackLogger(&logs)
	send := func(body string, authenticated bool, origin, token string) int {
		r := httptest.NewRequest("POST", "https://host.test"+clientLoadFailurePath, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Origin", origin)
		r.Header.Set("X-Agent-Host-CSRF", token)
		if authenticated {
			r.AddCookie(cookie)
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w.Code
	}
	for _, tc := range []struct {
		auth         bool
		origin, csrf string
		status       int
	}{
		{false, "https://host.test", csrf, 401}, {true, "https://foreign.test", csrf, 403}, {true, "https://host.test", "secret-wrong-csrf", 403},
	} {
		if got := send(validClientDiagnostic, tc.auth, tc.origin, tc.csrf); got != tc.status {
			t.Fatalf("got %d want %d", got, tc.status)
		}
	}
	if logs.Len() != 0 {
		t.Fatal("refusal emitted client event")
	}
	if got := send(strings.Replace(validClientDiagnostic, `"network"`, `"secret-error"`, 1), true, "https://host.test", csrf); got != 400 {
		t.Fatal(got)
	}
	for i := 0; i < 19; i++ {
		if got := send(validClientDiagnostic, true, "https://host.test", csrf); got != http.StatusNoContent {
			t.Fatal(got)
		}
	}
	if got := send(validClientDiagnostic, true, "https://host.test", csrf); got != 429 {
		t.Fatal(got)
	}
	if strings.Count(logs.String(), `"event":"client_load_failed"`) != 19 || strings.Contains(logs.String(), "secret") {
		t.Fatal(logs.String())
	}
	var event map[string]any
	if err := json.Unmarshal(bytes.Split(logs.Bytes(), []byte("\n"))[0], &event); err != nil {
		t.Fatal(err)
	}
	if event["read"] != "session" || event["online"] != false || event["user"] != "alice" || event["outcome"] != "recovered" {
		t.Fatal(event)
	}
	*clock = clock.Add(3 * time.Second)
	if got := send(validClientDiagnostic, true, "https://host.test", csrf); got != 204 {
		t.Fatal(got)
	}
}
