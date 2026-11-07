package gateway

import (
	"net/url"
	"strings"
	"testing"
)

func TestOAuthReturnRouteBoundToPendingFlow(t *testing.T) {
	for _, tc := range []struct {
		input, want string
		status      int
	}{
		{"/", "/", 302}, {"/settings", "/settings", 302}, {"/settings/account", "/settings/account", 302}, {"/settings/devices", "/settings/devices", 302}, {"/settings/ai", "/settings/ai", 302}, {"/settings/code-hosts", "/settings/code-hosts", 302}, {"/settings/agent-data", "/settings/agent-data", 302}, {"/settings/appearance", "/settings/appearance", 302}, {"/settings/editor", "/settings/editor", 302}, {"/settings/storage", "/settings/storage", 302}, {"/settings/server", "/settings/server", 302}, {"/settings/users", "/settings/users", 302}, {"/settings/disk", "/settings/disk", 302}, {"/workspaces", "/workspaces", 302}, {"/resources", "/resources", 302}, {"/workspaces/ws_abcdefgh", "/workspaces/ws_abcdefgh", 302}, {"/agents/pi:11111111-1111-4111-8111-111111111111", "/agents/pi:11111111-1111-4111-8111-111111111111", 302}, {"/agents/pi:11111111-1111-4111-8111-11111111111-", "/agents/pi:11111111-1111-4111-8111-11111111111-", 302},
		{"/api/v1/snapshot", "", 400}, {"/auth/logout", "", 400}, {"/events", "", 400}, {"https://evil.test/", "", 400}, {"//evil.test/", "", 400}, {"/workspaces/ws_abcdefgh/..", "", 400}, {"/workspaces/ws_abcdefgh?x=1", "", 400}, {"/agents/pi:11111111-1111-4111-8111-111111111111?x=1", "", 400}, {"/agents/pi:11111111-1111-4111-8111-11111111111Z", "", 400},
	} {
		t.Run(tc.input, func(t *testing.T) {
			h, _, _, _, _ := fixture(t)
			w := request(h, "GET", "/auth/github/start?return_to="+url.QueryEscape(tc.input))
			if w.Code != tc.status {
				t.Fatalf("start: %d", w.Code)
			}
			if tc.status != 302 {
				return
			}
			loc, _ := url.Parse(w.Header().Get("Location"))
			cb := callback(h, loc.Query().Get("state"), w.Result().Cookies()[0])
			if cb.Code != 303 || cb.Header().Get("Location") != tc.want {
				t.Fatalf("return: %d %q", cb.Code, cb.Header().Get("Location"))
			}
		})
	}
	for _, path := range []string{"/settings/integraatiot", "/settings/tili", "/settings/editor/", "/settings/../api/v1/snapshot", "/settings//evil.test", "/settings/account?x=1", "/settings/account#frag", "/settings/not-a-section", "/workspaces/ws_abcdefgh%2F..", "/workspaces/ws_abcdefgh#frag", "/resources/", "/resources/x", "/resources?source=x"} {
		if uiReturn(path) {
			t.Fatalf("unsafe %q", path)
		}
	}
	if uiReturn("/workspaces/ws_abcdefgh" + strings.Repeat("a", 100)) {
		t.Fatal("oversized route")
	}
}
