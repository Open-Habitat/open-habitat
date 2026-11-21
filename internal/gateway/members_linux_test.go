//go:build linux

package gateway

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

type peopleBroker struct {
	*fakeBroker
	rows []AccessRow
}

func (b *peopleBroker) AccessList(context.Context) (AccessPage, error) {
	return AccessPage{Mode: "allowlist", Rows: b.rows}, nil
}
func (b *peopleBroker) AccessRead(context.Context, string) (AccessPage, error) {
	return AccessPage{}, nil
}
func (b *peopleBroker) Admit(context.Context, string, string, string) (AccessRow, error) {
	return AccessRow{}, ErrAccessRefused
}
func (b *peopleBroker) Withdraw(context.Context, string, string) (AccessRow, error) {
	return AccessRow{}, ErrAccessRefused
}

const membersConv = "11111111-2222-4333-8444-555555555555"

// The gateway names people for the owner's daemon; it lets only admitted,
// bound people be invited, builds every daemon body itself and passes the
// browser's identity claims nowhere.
func TestConversationMembersGatewayNamesOnlyAdmittedBoundPeople(t *testing.T) {
	now := time.Date(2026, 11, 21, 10, 0, 0, 0, time.UTC)
	socket := filepath.Join(t.TempDir(), "daemon.sock")
	ln, err := net.Listen("unix", socket)
	if err != nil {
		t.Fatal(err)
	}
	var mu sync.Mutex
	var posted []string
	feature := true
	srv := &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path != "/api/v1/conversations/"+membersConv+"/members" || r.Header.Get("Cookie") != "" || r.Header.Get("X-Agent-Host-CSRF") != "" {
			w.WriteHeader(403)
			return
		}
		if !feature {
			w.WriteHeader(404)
			io.WriteString(w, `{"schema_version":1,"error":{"code":"resource_not_found"}}`)
			return
		}
		if r.Method == http.MethodPost {
			b, _ := io.ReadAll(r.Body)
			posted = append(posted, string(b))
		}
		io.WriteString(w, `{"schema_version":1,"agent_id":"pi:`+membersConv+`","generation":1,"members":[{"subject":"github:43","display_name":"Bob","role":"participant","state":"invited","generation":1,"invited_at":"2026-11-21T09:00:00Z","updated_at":"2026-11-21T09:00:00Z"}]}`)
	})}
	go srv.Serve(ln)
	t.Cleanup(func() { srv.Close(); ln.Close() })

	alice := Identity{Provider: "github", Subject: "42", UID: os.Geteuid(), Username: "alice", Socket: "/run/open-habitat/users/alice/daemon.sock"}
	bob := Identity{Provider: "github", Subject: "43", UID: 1002, Username: "bob", Socket: "/run/open-habitat/users/bob/daemon.sock"}
	broker := &peopleBroker{fakeBroker: newFakeBroker(), rows: []AccessRow{
		{ID: "42", State: "joined", LoginHint: "alice"},
		{ID: "43", State: "joined", LoginHint: "bob"},
		{ID: "44", State: "allowed", LoginHint: "unbound"},
		{ID: "45", State: "joined", LoginHint: "denied"},
		{ID: "46", State: "joined", LoginHint: "carol"},
		{ID: "47", State: "withdrawn", LoginHint: "gone"},
	}}
	a := &Auth{cfg: OAuthConfig{Origin: "https://host.test"}, broker: broker, now: func() time.Time { return now }, sessions: map[string]session{
		"a": {identity: alice, csrf: "token", idle: now.Add(time.Hour), absolute: now.Add(time.Hour), created: now},
		"b": {identity: bob, profile: AccountProfile{Name: "Bob​ Example"}, csrf: "other", idle: now.Add(time.Hour), absolute: now.Add(time.Hour), created: now},
	}}
	a.settings.Denied = []string{"45"}
	a.snapshotDial = func(ctx context.Context, _ string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "unix", socket)
	}
	h := NewWithAuth("", a)
	send := func(method, path, body string, csrf bool) *httptest.ResponseRecorder {
		var reader io.Reader
		if body != "" {
			reader = strings.NewReader(body)
		}
		r := httptest.NewRequest(method, "https://host.test"+path, reader)
		r.RequestURI = r.URL.RequestURI()
		r.AddCookie(&http.Cookie{Name: cookieName, Value: "a"})
		r.Header.Set("Origin", "https://host.test")
		if body != "" {
			r.Header.Set("Content-Type", "application/json")
		}
		if csrf {
			r.Header.Set("X-Agent-Host-CSRF", "token")
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	base := "/api/v1/conversations/" + membersConv

	w := send("GET", base+"/people", "", false)
	if w.Code != 200 {
		t.Fatalf("people: %d %s", w.Code, w.Body.String())
	}
	var people struct {
		People []memberPerson `json:"people"`
	}
	if json.Unmarshal(w.Body.Bytes(), &people) != nil || len(people.People) != 2 {
		t.Fatalf("people listed: %s", w.Body.String())
	}
	got := map[string]memberPerson{}
	for _, p := range people.People {
		got[p.Subject] = p
	}
	if got["github:43"].DisplayName != "Bob  Example" || got["github:43"].Membership != "invited" || got["github:46"].DisplayName != "carol" || got["github:46"].Membership != "none" || !strings.HasPrefix(got["github:46"].AvatarURL, "https://avatars.githubusercontent.com/") {
		t.Fatalf("people: %+v", got)
	}
	if strings.Contains(w.Body.String(), "bob\"") || strings.Contains(w.Body.String(), "/run/") {
		t.Fatalf("people leaked a Unix name or path: %s", w.Body.String())
	}

	// Without the write token nothing reaches the daemon.
	if w := send("POST", base+"/members", `{"action":"invite","subject":"github:46"}`, false); w.Code != 403 {
		t.Fatalf("invite without CSRF: %d", w.Code)
	}
	for _, who := range []string{"github:42", "github:44", "github:45", "github:47", "github:99"} {
		if w := send("POST", base+"/members", `{"action":"invite","subject":"`+who+`"}`, true); w.Code != 404 {
			t.Fatalf("invite %s: %d %s", who, w.Code, w.Body.String())
		}
	}
	for _, bad := range []string{
		`{"action":"invite","subject":"github:46","display_name":"Root"}`,
		`{"action":"invite","subject":"github:46","role":"full_rights"}`,
		`{"action":"invite","subject":"alice"}`,
		`{"action":"owner","subject":"github:46"}`,
		`{"action":"invite","subject":"github:46","subject":"github:43"}`,
	} {
		if w := send("POST", base+"/members", bad, true); w.Code != 400 {
			t.Fatalf("%s: %d %s", bad, w.Code, w.Body.String())
		}
	}
	mu.Lock()
	if len(posted) != 0 {
		t.Fatalf("refused requests reached the daemon: %v", posted)
	}
	mu.Unlock()
	if w := send("POST", base+"/members", `{"action":"invite","subject":"github:46"}`, true); w.Code != 200 {
		t.Fatalf("invite: %d %s", w.Code, w.Body.String())
	}
	if w := send("POST", base+"/members", `{"action":"remove","subject":"github:43"}`, true); w.Code != 200 {
		t.Fatalf("remove: %d %s", w.Code, w.Body.String())
	}
	mu.Lock()
	want := []string{`{"action":"invite","display_name":"carol","subject":"github:46"}`, `{"action":"remove","subject":"github:43"}`}
	if len(posted) != 2 || posted[0] != want[0] || posted[1] != want[1] {
		t.Fatalf("daemon bodies: %v", posted)
	}
	feature = false
	mu.Unlock()
	// The directory shows only while the owner's daemon admits the route.
	if w := send("GET", base+"/people", "", false); w.Code != 404 || bytes.Contains(w.Body.Bytes(), []byte("carol")) {
		t.Fatalf("people with the feature off: %d %s", w.Code, w.Body.String())
	}
}
