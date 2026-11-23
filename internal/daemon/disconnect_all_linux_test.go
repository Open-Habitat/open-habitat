//go:build linux

package daemon

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/open-habitat/open-habitat/internal/daemon/integrations"
	"github.com/open-habitat/open-habitat/internal/transport"
)

// The gateway's disconnect request takes one exact body and answers counts,
// including the person's own Tailscale node; anything else is refused.
func TestDisconnectAllHandler(t *testing.T) {
	calls := 0
	h := disconnectAllHandler(transport.Config{}, func(*http.Request) bool { return true }, func(context.Context) []integrations.DisconnectCount {
		calls++
		return []integrations.DisconnectCount{{Provider: "dropbox", Revoked: 1}}
	}, func(context.Context) string { return integrations.DisconnectRevoked })
	send := func(method, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "http://unix"+DisconnectAllPath, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	w := send(http.MethodPost, `{"schema_version":1}`)
	if w.Code != 200 || strings.TrimSpace(w.Body.String()) != `{"schema_version":1,"providers":[{"provider":"dropbox","revoked":1,"local_only":0,"failed":0},{"provider":"tailscale","revoked":1,"local_only":0,"failed":0}]}` {
		t.Fatal(w.Code, w.Body.String())
	}
	for _, bad := range []string{`{"schema_version":2}`, `{"schema_version":1,"subject":"7"}`, `{}`} {
		if w := send(http.MethodPost, bad); w.Code != 400 {
			t.Fatal(bad, w.Code)
		}
	}
	if w := send(http.MethodGet, ``); w.Code != 405 || calls != 1 {
		t.Fatal(w.Code, calls)
	}
	denied := disconnectAllHandler(transport.Config{}, func(*http.Request) bool { return false }, nil, nil)
	r := httptest.NewRequest(http.MethodPost, "http://unix"+DisconnectAllPath, strings.NewReader(`{"schema_version":1}`))
	r.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	denied.ServeHTTP(rec, r)
	if rec.Code != 403 {
		t.Fatal(rec.Code)
	}
}
