//go:build linux

package gateway

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/testpython"
)

// fakeOwnerDaemon plays the owner's daemon on both of its gateway sockets:
// the members route on daemon.sock and the join route on guest.sock. It keeps
// a record of subject -> state, as the real one does, and is the only thing
// that decides whether a join succeeds.
type fakeOwnerDaemon struct {
	mu      sync.Mutex
	record  map[string]string
	dials   []string
	guests  []*http.Request
	headers []string
}

func (d *fakeOwnerDaemon) membersReply(w io.Writer) {
	type m struct {
		Subject     string `json:"subject"`
		DisplayName string `json:"display_name"`
		Role        string `json:"role"`
		State       string `json:"state"`
		Generation  int    `json:"generation"`
		InvitedAt   string `json:"invited_at"`
		UpdatedAt   string `json:"updated_at"`
	}
	members := []m{}
	for s, state := range d.record {
		members = append(members, m{s, "Someone", "participant", state, 1, "2026-11-21T09:00:00Z", "2026-11-21T09:00:00Z"})
	}
	json.NewEncoder(w).Encode(map[string]any{"schema_version": 1, "agent_id": "pi:" + membersConv, "generation": 1, "members": members})
}

func (d *fakeOwnerDaemon) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	d.mu.Lock()
	defer d.mu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	notFound := func() {
		w.WriteHeader(404)
		io.WriteString(w, `{"schema_version":1,"error":{"code":"resource_not_found"}}`)
	}
	switch {
	case r.URL.Path == "/api/v1/conversations/"+membersConv+"/members" && r.Method == http.MethodPost:
		if r.Header.Get(guestParticipantHeader) != "" {
			w.WriteHeader(400)
			return
		}
		var in struct{ Action, Subject string }
		json.NewDecoder(r.Body).Decode(&in)
		switch in.Action {
		case "invite":
			if d.record[in.Subject] == "" {
				d.record[in.Subject] = "invited"
			}
		case "remove":
			delete(d.record, in.Subject)
		}
		d.membersReply(w)
	case strings.HasPrefix(r.URL.Path, "/guest/v1/"):
		d.guests = append(d.guests, r)
		header := r.Header.Get(guestParticipantHeader)
		d.headers = append(d.headers, header)
		raw, _ := base64.RawURLEncoding.DecodeString(header)
		var p struct {
			Subject string `json:"subject"`
		}
		json.Unmarshal(raw, &p)
		if r.URL.Path != "/guest/v1/conversations/"+membersConv+"/join" || r.Method != http.MethodPost || d.record[p.Subject] == "" {
			notFound()
			return
		}
		d.record[p.Subject] = "joined"
		io.WriteString(w, `{"schema_version":1,"agent_id":"pi:`+membersConv+`","subject":"`+p.Subject+`","role":"participant","state":"joined","generation":2}`)
	default:
		notFound()
	}
}

type shareFixture struct {
	a      *Auth
	h      http.Handler
	daemon *fakeOwnerDaemon
	now    time.Time
}

func newShareFixture(t *testing.T, sessionFile string) *shareFixture {
	t.Helper()
	now := time.Date(2026, 11, 21, 10, 0, 0, 0, time.UTC)
	socket := filepath.Join(t.TempDir(), "owner.sock")
	ln, err := net.Listen("unix", socket)
	if err != nil {
		t.Fatal(err)
	}
	d := &fakeOwnerDaemon{record: map[string]string{}}
	srv := &http.Server{Handler: d}
	go srv.Serve(ln)
	t.Cleanup(func() { srv.Close(); ln.Close() })
	alice := Identity{Provider: "github", Subject: "42", UID: os.Geteuid(), Username: "alice", Socket: "/run/open-habitat/users/alice/daemon.sock"}
	bob := Identity{Provider: "github", Subject: "43", UID: 1002, Username: "bob", Socket: "/run/open-habitat/users/bob/daemon.sock"}
	carol := Identity{Provider: "github", Subject: "46", UID: 1003, Username: "carol", Socket: "/run/open-habitat/users/carol/daemon.sock"}
	broker := &peopleBroker{fakeBroker: newFakeBroker(), rows: []AccessRow{{ID: "42", State: "joined"}, {ID: "43", State: "joined"}}}
	a := &Auth{cfg: OAuthConfig{Origin: "https://host.test"}, broker: broker, now: func() time.Time { return now }, random: strings.NewReader(strings.Repeat("0123456789abcdef", 64)), sessionFile: sessionFile, sessions: map[string]session{
		"a": {identity: alice, profile: AccountProfile{Name: "Alice Owner"}, csrf: "ta", id: "sa", idle: now.Add(time.Hour), absolute: now.Add(time.Hour), created: now},
		"b": {identity: bob, profile: AccountProfile{Name: "Bob Guest"}, csrf: "tb", id: "sb", idle: now.Add(time.Hour), absolute: now.Add(time.Hour), created: now},
		// Carol signed in on a server that admits anyone: she is in no
		// access list, but the picker lists her.
		"c": {identity: carol, csrf: "tc", id: "sc", idle: now.Add(time.Hour), absolute: now.Add(time.Hour), created: now},
	}}
	a.loadShares()
	a.snapshotDial = func(ctx context.Context, path string) (net.Conn, error) {
		d.mu.Lock()
		d.dials = append(d.dials, path)
		d.mu.Unlock()
		return (&net.Dialer{}).DialContext(ctx, "unix", socket)
	}
	return &shareFixture{a: a, h: NewWithAuth("", a), daemon: d, now: now}
}

func (f *shareFixture) send(cookie, method, path, body string) *httptest.ResponseRecorder {
	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	r := httptest.NewRequest(method, "https://host.test"+path, reader)
	r.RequestURI = r.URL.RequestURI()
	r.AddCookie(&http.Cookie{Name: cookieName, Value: cookie})
	r.Header.Set("Origin", "https://host.test")
	if body != "" {
		r.Header.Set("Content-Type", "application/json")
	}
	if method == http.MethodPost {
		r.Header.Set("X-Agent-Host-CSRF", "t"+cookie)
	}
	w := httptest.NewRecorder()
	f.h.ServeHTTP(w, r)
	return w
}

func (f *shareFixture) shares(t *testing.T, cookie string) []sharedItem {
	t.Helper()
	w := f.send(cookie, "GET", sharedPath, "")
	if w.Code != 200 {
		t.Fatalf("shared list: %d %s", w.Code, w.Body.String())
	}
	var out struct {
		Shares []sharedItem `json:"shares"`
	}
	if json.Unmarshal(w.Body.Bytes(), &out) != nil {
		t.Fatal(w.Body.String())
	}
	return out.Shares
}

func (f *shareFixture) invite(t *testing.T, action, subject string) {
	t.Helper()
	if w := f.send("a", "POST", "/api/v1/conversations/"+membersConv+"/members", `{"action":"`+action+`","subject":"`+subject+`"}`); w.Code != 200 {
		t.Fatalf("%s %s: %d %s", action, subject, w.Code, w.Body.String())
	}
}

const refusal = `"resource_not_found"`

func TestSharesRouteParticipantsOnlyThroughTheIndexAndTheRecord(t *testing.T) {
	f := newShareFixture(t, "")
	if len(f.shares(t, "b")) != 0 {
		t.Fatal("shares before any invitation")
	}
	f.invite(t, "invite", "github:43")
	list := f.shares(t, "b")
	if len(list) != 1 || list[0].State != "invited" || list[0].Owner.DisplayName != "Alice Owner" || !shareIDPattern.MatchString(list[0].ShareID) {
		t.Fatalf("bob's shares: %+v", list)
	}
	raw := f.send("b", "GET", sharedPath, "").Body.String()
	sharesMatchSchema(t, "", raw)
	for _, leak := range []string{"alice", "/run/", membersConv, "1001", "uid"} {
		if strings.Contains(raw, leak) {
			t.Fatalf("share list leaked %q: %s", leak, raw)
		}
	}
	if len(f.shares(t, "a")) != 0 || len(f.shares(t, "c")) != 0 {
		t.Fatal("the share is listed to someone else")
	}
	share := list[0].ShareID
	join := sharedPrefix + share + "/join"

	// Every way in that is not Bob's own share looks the same as a missing
	// one, and none of them reaches the owner's daemon.
	missing := f.send("b", "POST", sharedPrefix+"saaaaaaaaaaaaaaaaaaaaaaaaaa/join", "")
	if missing.Code != 404 || !strings.Contains(missing.Body.String(), refusal) {
		t.Fatal("missing share", missing.Code, missing.Body.String())
	}
	for name, w := range map[string]*httptest.ResponseRecorder{
		"foreign share":      f.send("c", "POST", join, ""),
		"owner on own share": f.send("a", "POST", join, ""),
		"other operation":    f.send("b", "POST", sharedPrefix+share+"/send", ""),
		"wrong method":       f.send("b", "GET", join, ""),
		"malformed id":       f.send("b", "POST", sharedPrefix+"alice/join", ""),
		"extra segment":      f.send("b", "POST", join+"/x", ""),
	} {
		if w.Code != missing.Code || w.Body.String() != missing.Body.String() {
			t.Fatalf("%s: %d %s", name, w.Code, w.Body.String())
		}
	}
	f.daemon.mu.Lock()
	if len(f.daemon.guests) != 0 {
		t.Fatalf("refused requests reached the guest socket: %d", len(f.daemon.guests))
	}
	f.daemon.mu.Unlock()
	// A write without the session's token is refused before anything.
	r := httptest.NewRequest("POST", "https://host.test"+join, nil)
	r.RequestURI = r.URL.RequestURI()
	r.AddCookie(&http.Cookie{Name: cookieName, Value: "b"})
	r.Header.Set("Origin", "https://host.test")
	w := httptest.NewRecorder()
	f.h.ServeHTTP(w, r)
	if w.Code != 403 {
		t.Fatal("join without CSRF", w.Code)
	}
	if w := f.send("", "POST", join, ""); w.Code != 401 {
		t.Fatal("join without a session", w.Code)
	}

	w = f.send("b", "POST", join, "")
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"state":"joined"`) || !strings.Contains(w.Body.String(), share) || strings.Contains(w.Body.String(), membersConv) {
		t.Fatalf("join: %d %s", w.Code, w.Body.String())
	}
	f.daemon.mu.Lock()
	req, header, dial := f.daemon.guests[0], f.daemon.headers[0], f.daemon.dials[len(f.daemon.dials)-1]
	f.daemon.mu.Unlock()
	if dial != "/run/open-habitat/users/alice/guest.sock" {
		t.Fatalf("dialled %s", dial)
	}
	if req.Header.Get("Cookie") != "" || req.Header.Get("X-Agent-Host-CSRF") != "" || req.Header.Get("Origin") != "" {
		t.Fatal("browser headers crossed to the guest socket")
	}
	decoded, _ := base64.RawURLEncoding.DecodeString(header)
	var p map[string]string
	if json.Unmarshal(decoded, &p) != nil || len(p) != 3 || p["subject"] != "github:43" || p["display_name"] != "Bob Guest" || !strings.HasPrefix(p["avatar_url"], "https://avatars.githubusercontent.com/") {
		t.Fatalf("participant header: %s", decoded)
	}
	if strings.Contains(string(decoded), "bob\"") || strings.Contains(string(decoded), "1002") || strings.Contains(string(decoded), "/run/") {
		t.Fatalf("participant header names a Unix user: %s", decoded)
	}
	sharesMatchSchema(t, "join", w.Body.String())
	sharesMatchSchema(t, "participant", string(decoded))
	if list := f.shares(t, "b"); len(list) != 1 || list[0].State != "joined" {
		t.Fatalf("joined not listed: %+v", list)
	}

	// Removal deletes the share and ends that participant's relays, under
	// the lock new relays are admitted under.
	entry, ctx, release, ok := f.a.shareRequest(shareCookieRequest("b"), f.a.sessions["b"], share)
	if !ok || entry.Participant != "github:43" {
		t.Fatal("relay not admitted")
	}
	defer release()
	f.invite(t, "remove", "github:43")
	select {
	case <-ctx.Done():
	case <-time.After(2 * time.Second):
		t.Fatal("removal left the participant's relay running")
	}
	if len(f.shares(t, "b")) != 0 {
		t.Fatal("removed share still listed")
	}
	if w := f.send("b", "POST", join, ""); w.Code != missing.Code || w.Body.String() != missing.Body.String() {
		t.Fatal("removed person: ", w.Code, w.Body.String())
	}
	if _, _, _, ok := f.a.shareRequest(shareCookieRequest("b"), f.a.sessions["b"], share); ok {
		t.Fatal("a relay was admitted after removal")
	}
}

// sharesMatchSchema validates body against the root of
// conversation-shares.schema.json, or against one of its $defs.
func sharesMatchSchema(t *testing.T, def, body string) {
	t.Helper()
	python := testpython.Validator(t)
	cmd := exec.Command(python, "-c", `import sys,runpy,json
m=runpy.run_path('../../scripts/validate-contracts.py')
schema=m['schemas']['conversation-shares.schema.json']
if sys.argv[1]: schema={'$ref':schema['$id']+'#/$defs/'+sys.argv[1]}
m['Draft202012Validator'](schema,registry=m['registry'],format_checker=m['format_checker']).validate(json.load(sys.stdin))`, def)
	cmd.Stdin = strings.NewReader(body)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("%s: %s: %v\n%s", def, out, err, body)
	}
}

func shareCookieRequest(value string) *http.Request {
	r := httptest.NewRequest("POST", "https://host.test/", nil)
	r.AddCookie(&http.Cookie{Name: cookieName, Value: value})
	return r
}

// The index alone admits nobody: the owner's record decides. A share whose
// record entry is gone (archived conversation, drift) gets the daemon's
// refusal, which is the same refusal.
func TestShareWithoutRecordIsRefusedByTheOwnerDaemon(t *testing.T) {
	f := newShareFixture(t, "")
	f.invite(t, "invite", "github:43")
	share := f.shares(t, "b")[0].ShareID
	f.daemon.mu.Lock()
	delete(f.daemon.record, "github:43")
	f.daemon.mu.Unlock()
	w := f.send("b", "POST", sharedPrefix+share+"/join", "")
	if w.Code != 404 || !strings.Contains(w.Body.String(), refusal) {
		t.Fatal(w.Code, w.Body.String())
	}
}

// Withdrawing either person deletes their shares, as owner and as
// participant; admitted again, an old record in someone's daemon gives them
// nothing.
func TestWithdrawalDeletesSharesForGood(t *testing.T) {
	f := newShareFixture(t, "")
	f.invite(t, "invite", "github:43")
	f.invite(t, "invite", "github:46")
	old := f.shares(t, "b")[0].ShareID
	_, ctx, release, ok := f.a.shareRequest(shareCookieRequest("b"), f.a.sessions["b"], old)
	if !ok {
		t.Fatal("relay not admitted")
	}
	defer release()
	bob := f.a.sessions["b"]
	f.a.mu.Lock()
	_, err := f.a.revokeSessionsLocked("43")
	f.a.mu.Unlock()
	if err != nil {
		t.Fatal(err)
	}
	select {
	case <-ctx.Done():
	case <-time.After(2 * time.Second):
		t.Fatal("withdrawal left the relay running")
	}
	// Bob is admitted again and signs in; the owner's record still names him.
	f.a.mu.Lock()
	f.a.sessions["b2"] = session{identity: bob.identity, csrf: "tb2", id: "sb2", idle: f.now.Add(time.Hour), absolute: f.now.Add(time.Hour), created: f.now}
	f.a.mu.Unlock()
	if len(f.shares(t, "b2")) != 0 {
		t.Fatal("a readmitted person kept a share")
	}
	if w := f.send("b2", "POST", sharedPrefix+old+"/join", ""); w.Code != 404 || !strings.Contains(w.Body.String(), refusal) {
		t.Fatal("old share admitted a readmitted person", w.Code)
	}
	// Carol's share is the owner's: withdrawing the owner deletes it.
	if len(f.shares(t, "c")) != 1 {
		t.Fatal("carol's share missing")
	}
	f.a.mu.Lock()
	_, err = f.a.revokeSessionsLocked("42")
	f.a.mu.Unlock()
	if err != nil {
		t.Fatal(err)
	}
	if len(f.shares(t, "c")) != 0 {
		t.Fatal("the withdrawn owner's share survived")
	}
}

func TestShareIndexIsPrivateDurableAndNeverReset(t *testing.T) {
	dir := t.TempDir()
	sessions := filepath.Join(dir, "sessions.json")
	// The session store only has to be present and private here.
	if err := os.WriteFile(sessions, []byte("{}"), 0600); err != nil {
		t.Fatal(err)
	}
	reply := []byte(`{"schema_version":1,"members":[{"subject":"github:43","state":"invited"}]}`)
	list := func(f *shareFixture) (int, []sharedItem) {
		w := httptest.NewRecorder()
		f.a.listShared(w, f.a.sessions["b"])
		var out struct {
			Shares []sharedItem `json:"shares"`
		}
		json.Unmarshal(w.Body.Bytes(), &out)
		return w.Code, out.Shares
	}
	f := newShareFixture(t, sessions)
	if err := f.a.reconcileShare(f.a.sessions["a"], membersConv, "github:43", reply); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, shareStoreName)
	info, err := os.Stat(path)
	if err != nil || info.Mode().Perm() != 0600 {
		t.Fatal("index not written private", err)
	}
	data, _ := os.ReadFile(path)
	if strings.Contains(string(data), "message") || strings.Contains(string(data), "role") {
		t.Fatalf("index holds more than metadata: %s", data)
	}
	_, first := list(f)
	g := newShareFixture(t, sessions)
	if code, again := list(g); code != 200 || len(first) != 1 || len(again) != 1 || again[0].ShareID != first[0].ShareID {
		t.Fatal("index not read back", code, first, again)
	}
	if err := os.WriteFile(path, []byte(`{"version":1,"shares":null}`), 0600); err != nil {
		t.Fatal(err)
	}
	broken := newShareFixture(t, sessions)
	if code, _ := list(broken); code != 503 {
		t.Fatal("damaged index served", code)
	}
	if broken.a.reconcileShare(broken.a.sessions["a"], membersConv, "github:43", reply) == nil {
		t.Fatal("invitation recorded without an index")
	}
	if b, _ := os.ReadFile(path); string(b) != `{"version":1,"shares":null}` {
		t.Fatal("damaged index was rewritten")
	}
	if err := writeShareFile(path, nil); err != nil {
		t.Fatal(err)
	}
	os.Chmod(path, 0644)
	loose := newShareFixture(t, sessions)
	if code, _ := list(loose); code != 503 {
		t.Fatal("loosened index served", code)
	}
}

// The picker lists every signed-in, bound person, also on a server whose
// broker keeps no access list of them.
func TestInvitePickerListsSignedInPeople(t *testing.T) {
	f := newShareFixture(t, "")
	people, err := f.a.invitablePeople(context.Background(), f.a.sessions["a"].identity)
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]bool{}
	for _, p := range people {
		got[p.Subject] = true
	}
	if !got["github:43"] || !got["github:46"] || got["github:42"] || len(people) != 2 {
		t.Fatalf("picker: %+v", people)
	}
	f.a.settings.Denied = []string{"46"}
	people, _ = f.a.invitablePeople(context.Background(), f.a.sessions["a"].identity)
	if len(people) != 1 || people[0].Subject != "github:43" {
		t.Fatalf("denied person listed: %+v", people)
	}
}
