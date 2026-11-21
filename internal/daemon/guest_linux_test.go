//go:build linux

package daemon

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func participantHeader(t *testing.T, v any) string {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return base64.RawURLEncoding.EncodeToString(b)
}

func villeHeader(t *testing.T) string {
	return participantHeader(t, map[string]string{"subject": ville.Subject, "display_name": ville.DisplayName, "avatar_url": "https://avatars.githubusercontent.com/u/1001"})
}

func guestCall(t *testing.T, h http.Handler, method, path string, header []string) (int, string) {
	t.Helper()
	req := httptest.NewRequest(method, path, nil)
	for _, v := range header {
		req.Header.Add(GuestParticipantHeader, v)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	return w.Code, w.Body.String()
}

// The guest table holds the participant operations and nothing else: every
// owner route, and every route of the agent table, is refused before
// anything is read, with the same answer as an unknown conversation.
func TestGuestTableIsDefaultDeny(t *testing.T) {
	c, _ := membershipFixture(t)
	h := guestHandlerFor(c, func(*http.Request) bool { return true })
	header := []string{villeHeader(t)}
	if code, _, _ := memberCall(t, c, "POST", control("invite", ville.Subject, ville.DisplayName)); code != 200 {
		t.Fatal("invite", code)
	}
	for _, path := range []string{
		"/api/v1/snapshot",
		"/api/v1/conversations/" + memberConv + "/send",
		"/api/v1/conversations/" + memberConv + "/members",
		"/api/v1/workspaces/files",
		"/api/v1/terminals",
		"/api/v1/views",
		"/api/v1/account/preferences",
		"/api/v1/events",
		"/agent/v1/environment",
		"/agent/v1/conversation",
		"/guest/v1/conversations/" + memberConv,
		"/guest/v1/conversations/" + memberConv + "/",
		"/guest/v1/conversations/" + memberConv + "/members",
		"/guest/v1/conversations/" + memberConv + "/send",
		"/guest/v1/conversations/" + memberConv + "/history",
		"/guest/v1/conversations/" + memberConv + "/join/extra",
		"/guest/v1/conversations/not-a-uuid/join",
		"/guest/v1/conversations/" + memberConv + "/%6Aoin",
		"/guest/v1/workspaces",
	} {
		for _, method := range []string{"GET", "POST"} {
			code, body := guestCall(t, h, method, path, header)
			if code != 404 || !strings.Contains(body, `"resource_not_found"`) {
				t.Fatalf("%s %s: %d %s", method, path, code, body)
			}
		}
	}
	// Nothing changed in the record: the invitation is still only that.
	if x, ok := c.authorizeGuest(memberConv, ville, true); !ok || x.State != stateInvited {
		t.Fatal("refused routes touched the record", x)
	}
}

func TestGuestJoinThroughTheTable(t *testing.T) {
	c, _ := membershipFixture(t)
	h := guestHandlerFor(c, func(*http.Request) bool { return true })
	join := "/guest/v1/conversations/" + memberConv + "/join"
	// Not invited: the same refusal as an unknown conversation.
	if code, body := guestCall(t, h, "POST", join, []string{villeHeader(t)}); code != 404 || !strings.Contains(body, "resource_not_found") {
		t.Fatal("uninvited join", code, body)
	}
	if code, _, _ := memberCall(t, c, "POST", control("invite", ville.Subject, "Old Name")); code != 200 {
		t.Fatal("invite", code)
	}
	code, body := guestCall(t, h, "POST", join, []string{villeHeader(t)})
	if code != 200 || !strings.Contains(body, `"state":"joined"`) {
		t.Fatal("join", code, body)
	}
	x, ok := c.authorizeGuest(memberConv, ville, false)
	if !ok || x.State != stateJoined || x.DisplayName != ville.DisplayName {
		t.Fatal("join not recorded", x)
	}
	// Removed: refused again, whatever the header says.
	if code, _, _ := memberCall(t, c, "POST", control("remove", ville.Subject, "")); code != 200 {
		t.Fatal("remove", code)
	}
	if code, _ := guestCall(t, h, "POST", join, []string{villeHeader(t)}); code != 404 {
		t.Fatal("removed person joined", code)
	}
}

// The header names a person; it never grants anything. A missing, doubled,
// malformed or role-claiming header is refused, and a request from any peer
// but the gateway is refused before the header is read.
func TestGuestParticipantHeaderIsIdentityOnly(t *testing.T) {
	c, _ := membershipFixture(t)
	if code, _, _ := memberCall(t, c, "POST", control("invite", ville.Subject, ville.DisplayName)); code != 200 {
		t.Fatal("invite", code)
	}
	join := "/guest/v1/conversations/" + memberConv + "/join"
	notPeer := guestHandlerFor(c, func(*http.Request) bool { return false })
	if code, _ := guestCall(t, notPeer, "POST", join, []string{villeHeader(t)}); code != 403 {
		t.Fatal("non-gateway peer served", code)
	}
	h := guestHandlerFor(c, func(*http.Request) bool { return true })
	good := map[string]string{"subject": ville.Subject, "display_name": ville.DisplayName, "avatar_url": ""}
	with := func(k, v string) map[string]string {
		m := map[string]string{}
		for a, b := range good {
			m[a] = b
		}
		m[k] = v
		return m
	}
	bad := [][]string{
		nil,
		{""},
		{villeHeader(t), villeHeader(t)},
		{"not base64!"},
		{base64.StdEncoding.EncodeToString([]byte(`{"subject":"github:1001","display_name":"Example Participant"}`))},
		{base64.RawURLEncoding.EncodeToString([]byte(`{"subject":"github:1001","display_name":"Example Participant","role":"full_rights"}`))},
		{base64.RawURLEncoding.EncodeToString([]byte(`{"subject":"github:1001","subject":"github:1001","display_name":"Example Participant"}`))},
		{participantHeader(t, with("subject", "alice"))},
		{participantHeader(t, with("subject", "github:1001 "))},
		{participantHeader(t, with("display_name", ""))},
		{participantHeader(t, with("display_name", "Line\nbreak"))},
		{participantHeader(t, with("avatar_url", "https://example.org/a.png"))},
		{strings.Repeat("A", guestParticipantHeaderLimit+1)},
	}
	for i, header := range bad {
		if code, body := guestCall(t, h, "POST", join, header); code != 404 {
			t.Fatalf("header %d accepted: %d %s", i, code, body)
		}
	}
	if x, ok := c.authorizeGuest(memberConv, ville, true); !ok || x.State != stateInvited {
		t.Fatal("a refused header changed the record")
	}
	// Another person's well-formed header is that person, not Ville.
	other := participantHeader(t, map[string]string{"subject": "github:1002", "display_name": "Other", "avatar_url": ""})
	if code, _ := guestCall(t, h, "POST", join, []string{other}); code != 404 {
		t.Fatal("uninvited subject joined", code)
	}
	// The owner is never a guest of their own conversation.
	owner := participantHeader(t, map[string]string{"subject": "github:42", "display_name": "Owner", "avatar_url": ""})
	if code, _ := guestCall(t, h, "POST", join, []string{owner}); code != 404 {
		t.Fatal("owner admitted as guest", code)
	}
	if code, _ := guestCall(t, h, "POST", join, []string{participantHeader(t, good)}); code != 200 {
		t.Fatal("good header refused", code)
	}
}

func TestParticipantHeaderRefusedOnOtherListeners(t *testing.T) {
	reached := false
	h := refuseParticipantHeader(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { reached = true }))
	for _, value := range []string{"x", ""} {
		req := httptest.NewRequest("GET", "http://unix/api/v1/snapshot", nil)
		req.Header[GuestParticipantHeader] = []string{value}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, req)
		if w.Code != 400 || reached {
			t.Fatalf("header %q passed: %d", value, w.Code)
		}
	}
	req := httptest.NewRequest("GET", "http://unix/api/v1/snapshot", nil)
	h.ServeHTTP(httptest.NewRecorder(), req)
	if !reached {
		t.Fatal("ordinary request refused")
	}
}
