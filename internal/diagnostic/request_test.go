package diagnostic

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestRouteKeepsOnlyFixedWords(t *testing.T) {
	for path, want := range map[string]string{
		"/api/v1/snapshot": "/api/v1/snapshot",
		"/api/v1/conversations/7e85a75e-e6d5-432c-bdf0-d7e4afa640b1/send":                     "/api/v1/conversations/{id}/send",
		"/api/v1/conversations/7e85a75e-e6d5-432c-bdf0-d7e4afa640b1/processes/proc_ab12/stop": "/api/v1/conversations/{id}/processes/{id}/stop",
		"/api/v1/agents/pi:7e85a75e-e6d5-432c-bdf0-d7e4afa640b1/entries/first/blocks/0":       "/api/v1/agents/{id}/entries/{id}/blocks/{id}",
		"/api/v1/synthetic-content-marker":                                                    "/api/v1/{id}",
		"/workspaces/ws_secretname":                                                           "ui",
		"/a/b":                                                                                "ui",
		"/api/" + strings.Repeat("x/", 20):                                                    "/api/{id}/{id}/{id}/{id}/{id}/{id}/{id}/{id}/{id}/...",
	} {
		if got := Route(path); got != want {
			t.Errorf("Route(%q) = %q, want %q", path, got, want)
		}
	}
}

func TestValidRequestID(t *testing.T) {
	if id := NewRequestID(); !ValidRequestID(id) {
		t.Fatalf("generated ID rejected: %q", id)
	}
	for _, id := range []string{"", "short", "abcdefghijklmno\n", "abcdefghijklmnop0", `abcdefgh"jklmnop`} {
		if ValidRequestID(id) {
			t.Fatalf("accepted %q", id)
		}
	}
}

// fakeClock advances only when a handler says so, so thresholds are tested
// exactly and without sleeping.
func fakeClock(t *testing.T) func(time.Duration) {
	t.Helper()
	at := time.Unix(1_800_000_000, 0)
	old := now
	now = func() time.Time { return at }
	t.Cleanup(func() { now = old })
	return func(d time.Duration) { at = at.Add(d) }
}

func serve(t *testing.T, method, target string, h http.HandlerFunc) []map[string]any {
	t.Helper()
	var buf bytes.Buffer
	r := httptest.NewRequest(method, target, strings.NewReader(`{"text":"synthetic-body-marker"}`))
	r.Header.Set("Cookie", "oh_session=synthetic-cookie-marker")
	Requests(New(&buf, "gateway"), RequestOptions{ID: func(*http.Request) string { return "AAAAAAAAAAAAAAAA" }}, h).ServeHTTP(httptest.NewRecorder(), r)
	for _, marker := range []string{"synthetic-body-marker", "synthetic-cookie-marker", "synthetic-query-marker", "7e85a75e"} {
		if strings.Contains(buf.String(), marker) {
			t.Fatalf("record leaked %q: %s", marker, buf.String())
		}
	}
	var out []map[string]any
	for _, line := range strings.Split(strings.TrimSpace(buf.String()), "\n") {
		if line == "" {
			continue
		}
		var m map[string]any
		if err := json.Unmarshal([]byte(line), &m); err != nil {
			t.Fatal(err)
		}
		out = append(out, m)
	}
	return out
}

func TestRequestsLogsMutationsSlowReadsAndFailures(t *testing.T) {
	advance := fakeClock(t)
	target := "https://host.test/api/v1/conversations/7e85a75e-e6d5-432c-bdf0-d7e4afa640b1/send?after=synthetic-query-marker"

	if got := serve(t, "GET", target, func(w http.ResponseWriter, _ *http.Request) { advance(SlowRead - time.Millisecond) }); len(got) != 0 {
		t.Fatalf("fast read logged: %v", got)
	}

	got := serve(t, "POST", target, func(w http.ResponseWriter, r *http.Request) {
		SetUser(r.Context(), "alice")
		started := now()
		advance(40 * time.Millisecond)
		Phase(r.Context(), "discovery", started)
		w.WriteHeader(http.StatusAccepted)
	})
	if len(got) != 1 {
		t.Fatalf("mutation not logged once: %v", got)
	}
	rec := got[0]
	for key, want := range map[string]any{"event": "http_request", "level": "INFO", "outcome": "completed", "method": "POST", "route": "/api/v1/conversations/{id}/send", "status": float64(202), "duration_ms": float64(40), "slow": false, "request_id": "AAAAAAAAAAAAAAAA", "user": "alice"} {
		if rec[key] != want {
			t.Fatalf("%s = %v in %v", key, rec[key], rec)
		}
	}

	if phases, _ := rec["phases_ms"].(map[string]any); phases["discovery"] != float64(40) {
		t.Fatalf("phases: %v", rec)
	}

	got = serve(t, "GET", target, func(w http.ResponseWriter, _ *http.Request) { advance(Slow) })
	if len(got) != 1 || got[0]["level"] != "WARN" || got[0]["slow"] != true || got[0]["status"] != float64(200) {
		t.Fatalf("slow read: %v", got)
	}

	if got := serve(t, "SYNTHETIC-METHOD-MARKER", target, func(http.ResponseWriter, *http.Request) {}); len(got) != 1 || got[0]["method"] != "other" {
		t.Fatalf("unclassified method: %v", got)
	}

	got = serve(t, "GET", target, func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(503) })
	if len(got) != 1 || got[0]["level"] != "WARN" || got[0]["outcome"] != "failed" {
		t.Fatalf("failed read: %v", got)
	}
}

// A healthy event stream stays open for hours; only a slow first byte is slow.
func TestRequestsJudgesStreamsByHeaderTime(t *testing.T) {
	advance := fakeClock(t)
	stream := func(first time.Duration) http.HandlerFunc {
		return func(w http.ResponseWriter, _ *http.Request) {
			advance(first)
			w.(http.Flusher).Flush()
			advance(time.Hour)
		}
	}
	if got := serve(t, "GET", "https://host.test/api/v1/events", stream(10*time.Millisecond)); len(got) != 0 {
		t.Fatalf("healthy stream logged: %v", got)
	}
	got := serve(t, "GET", "https://host.test/api/v1/events", stream(2*time.Second))
	if len(got) != 1 || got[0]["slow"] != true || got[0]["stream"] != true || got[0]["header_ms"] != float64(2000) {
		t.Fatalf("slow stream start: %v", got)
	}
}

func TestRequestsDoesNotBlameHostForClientCancel(t *testing.T) {
	advance := fakeClock(t)
	for _, tc := range []struct {
		took  time.Duration
		level string
	}{{100 * time.Millisecond, "INFO"}, {2 * time.Second, "WARN"}} {
		var buf bytes.Buffer
		ctx, cancel := context.WithCancel(context.Background())
		r := httptest.NewRequest("POST", "https://host.test/api/v1/workspaces", nil).WithContext(ctx)
		Requests(New(&buf, "gateway"), RequestOptions{}, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			advance(tc.took)
			cancel()
			w.WriteHeader(503)
		})).ServeHTTP(httptest.NewRecorder(), r)
		if !strings.Contains(buf.String(), `"outcome":"client_canceled"`) || !strings.Contains(buf.String(), `"level":"`+tc.level+`"`) || strings.Contains(buf.String(), "request_id") {
			t.Fatalf("cancel after %v: %s", tc.took, buf.String())
		}
	}
}
