//go:build linux

package gateway

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestPiModelsRouteRequiresSessionAndCSRF(t *testing.T) {
	calls := 0
	host, _ := proxyFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.Header.Get("X-Agent-Host-Identity") != "" {
			t.Error("browser identity leaked to daemon")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"schema_version":1,"default_model":null,"models":[]}`))
	}))
	if w := proxyCall(host, "GET", "/api/v1/pi/models", ""); w.Code != 200 {
		t.Fatalf("read: %d %s", w.Code, w.Body.String())
	}
	if w := proxyCall(host, "POST", "/api/v1/pi/models", `{"model":"gpt"}`); w.Code != 200 {
		t.Fatalf("write: %d %s", w.Code, w.Body.String())
	}
	if w := proxyCall(host, "POST", "/api/v1/pi/models?other=1", `{"model":"gpt"}`); w.Code != 400 {
		t.Fatalf("query: %d", w.Code)
	}
	if w := proxyCall(host, "PUT", "/api/v1/pi/models", ""); w.Code != 400 {
		t.Fatalf("method: %d", w.Code)
	}
	if calls != 2 {
		t.Fatalf("unexpected proxy calls: %d", calls)
	}
}

func TestPiCredentialsRoutesFenceWritesAndDoNotLogBodies(t *testing.T) {
	calls := 0
	host, a := proxyFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.Header.Get("X-Agent-Host-Identity") != "" {
			t.Error("identity header forwarded")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"schema_version":1,"openai":{"present":false,"suffix":null},"subscription":{"present":false}}`))
	}))
	var logs bytes.Buffer
	a.log = CallbackLogger(&logs)
	key := "sk-" + strings.Repeat("p", 24) + "abcd"
	for _, tc := range []struct{ method, path string }{{"POST", "/api/v1/pi/credentials"}, {"DELETE", "/api/v1/pi/credentials/openai"}} {
		r := httptest.NewRequest(tc.method, "https://host.test"+tc.path, strings.NewReader(`{"provider":"openai","key":"`+key+`"}`))
		r.AddCookie(&http.Cookie{Name: cookieName, Value: "browser"})
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		host.ServeHTTP(w, r)
		if w.Code != 403 {
			t.Fatal("write without Origin/CSRF accepted")
		}
		r = httptest.NewRequest(tc.method, "https://host.test"+tc.path, nil)
		r.AddCookie(&http.Cookie{Name: cookieName, Value: "browser"})
		r.Header.Set("Origin", "https://host.test")
		r.Header.Set("X-Agent-Host-CSRF", "token")
		w = httptest.NewRecorder()
		host.ServeHTTP(w, r)
		if w.Code != 200 {
			t.Fatalf("valid write not proxied: %d", w.Code)
		}
	}
	if calls != 2 || strings.Contains(logs.String(), key) {
		t.Fatal("bad route count or secret in logs")
	}
	r := httptest.NewRequest("GET", "https://host.test/api/v1/pi/credentials", nil)
	w := httptest.NewRecorder()
	host.ServeHTTP(w, r)
	if w.Code != 401 {
		t.Fatal("unauthenticated credential read accepted")
	}
}
