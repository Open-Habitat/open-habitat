//go:build linux

package gateway

import (
	"net/http"
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
