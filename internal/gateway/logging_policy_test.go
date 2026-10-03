package gateway

import (
	"bytes"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

type failedDiagnosticWriter struct{ calls int }

func (w *failedDiagnosticWriter) Write(_ []byte) (int, error) {
	w.calls++
	return 0, errors.New("synthetic diagnostic sink unavailable")
}

// A promptly failing diagnostic sink must not change either a rejection or a
// successful login. This does not establish safety against a writer that blocks.
func TestCallbackDiagnosticWriteFailurePreservesAuth(t *testing.T) {
	for _, reject := range []bool{false, true} {
		t.Run(fmt.Sprint("reject=", reject), func(t *testing.T) {
			h, a, p, sink, _ := fixture(t)
			writer := &failedDiagnosticWriter{}
			a.log = CallbackLogger(writer)
			state, flow := start(t, h)
			query := "&code=synthetic-code"
			want := http.StatusSeeOther
			if reject {
				query += "&unexpected=secret-payload"
				want = http.StatusBadRequest
			}
			w := request(h, "GET", "/auth/github/callback?state="+url.QueryEscape(state)+query, flow)
			if w.Code != want || writer.calls != 2 {
				t.Fatalf("status=%d writes=%d", w.Code, writer.calls)
			}
			if reject && (p.calls != 0 || sink.calls != 0) {
				t.Fatal("rejection reached provider/sink")
			}
			if !reject && (p.calls != 1 || sink.calls != 1) {
				t.Fatal("accepted login lost handoff")
			}
		})
	}
}

// Tool/conversation bytes and transport credentials can occur in an upstream
// failure or a malicious callback. Only fixed classifications may reach JSONL.
func TestCallbackDiagnosticWorkContentAndCredentialMarkers(t *testing.T) {
	h, a, p, sink, _ := fixture(t)
	var buf bytes.Buffer
	a.log = CallbackLogger(&buf)
	p.token = "synthetic-token-marker"
	p.login = "synthetic-identity-marker"
	sink.err = errors.New("synthetic-conversation-marker synthetic-tool-output-marker")
	state, flow := start(t, h)
	req := httptest.NewRequest("GET", "https://host.test/auth/github/callback?state="+url.QueryEscape(state)+"&code=synthetic-code-marker", nil)
	req.AddCookie(flow)
	req.Header.Set("Authorization", "Bearer synthetic-authorization-marker")
	req.Header.Set("X-Agent-Host-CSRF", "synthetic-csrf-marker")
	req.Header.Set("Cookie", req.Header.Get("Cookie")+"; extra=synthetic-cookie-marker")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != http.StatusServiceUnavailable || sink.calls != 1 || !strings.Contains(buf.String(), `"reason":"handoff_failed"`) {
		t.Fatalf("handoff outcome=%d calls=%d logs=%s", w.Code, sink.calls, buf.String())
	}
	for _, marker := range []string{state, flow.Value, p.token, p.login, "synthetic-conversation-marker", "synthetic-tool-output-marker", "synthetic-code-marker", "synthetic-authorization-marker", "synthetic-csrf-marker", "synthetic-cookie-marker"} {
		if strings.Contains(buf.String(), marker) {
			t.Fatalf("diagnostic leaked marker %q", marker)
		}
	}
}
