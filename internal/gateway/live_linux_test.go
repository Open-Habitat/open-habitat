//go:build linux

package gateway

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestStreamEndsWithSession(t *testing.T) {
	for _, ending := range []string{"logout", "revoke", "idle", "absolute", "store_invalid"} {
		t.Run(ending, func(t *testing.T) {
			upstreamDone := make(chan struct{})
			h, a := proxyFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "text/event-stream")
				io.WriteString(w, ": connected\n\n")
				w.(http.Flusher).Flush()
				<-r.Context().Done()
				close(upstreamDone)
			}))
			// Keep the clock synchronized with expiry checks under Auth.mu.
			now := time.Now()
			a.now = func() time.Time { return now }
			a.broker = newFakeBroker()
			a.log = CallbackLogger(io.Discard)
			server := httptest.NewTLSServer(h)
			defer server.Close()
			req, _ := http.NewRequest("GET", server.URL+"/api/v1/events?after=ev1:11111111-1111-1111-1111-111111111111:0", nil)
			req.Host = "host.test"
			req.AddCookie(&http.Cookie{Name: cookieName, Value: "browser"})
			res, err := server.Client().Do(req)
			if err != nil {
				t.Fatal(err)
			}
			defer res.Body.Close()
			if res.StatusCode != 200 {
				t.Fatalf("stream: %d", res.StatusCode)
			}
			done := make(chan error, 1)
			go func() { _, err := io.Copy(io.Discard, res.Body); done <- err }()
			switch ending {
			case "logout":
				if w := proxyCall(h, "POST", "/auth/logout", ""); w.Code != 204 {
					t.Fatalf("logout: %d", w.Code)
				}
			case "revoke":
				if err := a.RevokeSubject(context.Background(), "42"); err != nil {
					t.Fatal(err)
				}
			case "store_invalid":
				a.mu.Lock()
				a.sessionFile = "/nonexistent/sessions.json"
				a.mu.Unlock()
			default:
				a.mu.Lock()
				s := a.sessions["browser"]
				if ending == "idle" {
					s.absolute = now.Add(2 * time.Hour)
				} else {
					s.idle = now.Add(2 * time.Hour)
				}
				a.sessions["browser"] = s
				now = now.Add(time.Hour)
				a.mu.Unlock()
			}
			select {
			case <-done:
			case <-time.After(3 * time.Second):
				t.Fatal("stream survived session ending")
			}
			select {
			case <-upstreamDone:
			case <-time.After(time.Second):
				t.Fatal("daemon request survived")
			}
		})
	}
}

func TestLiveRegistrationRaceAndIsolation(t *testing.T) {
	_, a := proxyFixture(t, http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	req := httptest.NewRequest("GET", "/", nil)
	req.Host = "host.test"
	req.AddCookie(&http.Cookie{Name: cookieName, Value: "browser"})
	s, ok := a.authenticated(req)
	if !ok {
		t.Fatal("fixture not authenticated")
	}
	ctx, release, ok := a.liveRequest(req, s)
	if !ok {
		t.Fatal("registration denied")
	}
	defer release()
	a.mu.Lock()
	a.sessions["other"] = s
	a.mu.Unlock()
	other := httptest.NewRequest("GET", "/", nil)
	other.AddCookie(&http.Cookie{Name: cookieName, Value: "other"})
	otherCtx, otherRelease, ok := a.liveRequest(other, s)
	if !ok {
		t.Fatal("other registration denied")
	}
	defer otherRelease()
	a.mu.Lock()
	err := a.changedSessions(func(next map[string]session) { delete(next, "browser") })
	a.mu.Unlock()
	if err != nil {
		t.Fatal(err)
	}
	if ctx.Err() == nil {
		t.Fatal("removed session still live")
	}
	if otherCtx.Err() != nil {
		t.Fatal("unrelated session canceled")
	}
	if _, _, ok := a.liveRequest(req, s); ok {
		t.Fatal("revoked request registered after authentication")
	}
	otherRelease()
	a.mu.Lock()
	defer a.mu.Unlock()
	if len(a.live["other"]) != 0 {
		t.Fatal("finished relay retained")
	}
}
