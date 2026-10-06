//go:build linux

package gateway

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestGitHubDisconnectRequiresRecentOAuthSession(t *testing.T) {
	h, _, _, _, now := fixture(t)
	state, flow := start(t, h)
	cookie := callback(h, state, flow).Result().Cookies()[1]
	call := func() *httptest.ResponseRecorder {
		r := httptest.NewRequest("GET", "https://host.test"+githubDisconnectPath, nil)
		r.RequestURI = githubDisconnectPath
		r.AddCookie(cookie)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	*now = now.Add(4 * time.Minute)
	if got := call().Code; got != http.StatusServiceUnavailable {
		t.Fatalf("fresh session should reach absent daemon: %d", got)
	}
	*now = now.Add(2 * time.Minute)
	response := call()
	if response.Code != http.StatusForbidden {
		t.Fatalf("stale session accepted: %d %s", response.Code, response.Body.String())
	}
}
