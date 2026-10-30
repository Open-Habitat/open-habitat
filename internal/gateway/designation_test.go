package gateway

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

type roleReply struct {
	Entry struct {
		ID            string     `json:"id"`
		State         string     `json:"state"`
		Administrator bool       `json:"administrator"`
		Role          *roleEntry `json:"administrator_role"`
	} `json:"entry"`
}

func designate(t *testing.T, x *accessHarness, c *http.Cookie, csrf, id string, administrator bool) (int, roleReply, string) {
	t.Helper()
	body := `{"id":"` + id + `","administrator":false}`
	if administrator {
		body = `{"id":"` + id + `","administrator":true}`
	}
	w := accessPost(x.h, c, csrf, accessPath+"/role", body)
	var v roleReply
	if w.Code == 200 && json.Unmarshal(w.Body.Bytes(), &v) != nil {
		t.Fatal(w.Body.String())
	}
	return w.Code, v, w.Body.String()
}

// A browser administrator names a person who has not signed in; the role
// binds to the GitHub id at the sign-in that creates the binding, never to
// a login, and only a browser designation is revocable from the browser.
func TestAdministratorDesignatedBeforeFirstSignIn(t *testing.T) {
	x := newAccessHarness(t)
	x.broker.fakeBroker.routes["44"] = BrokerRoute{UID: 1003, Username: "carol", Socket: "/run/open-habitat/users/carol/daemon.sock"}
	x.broker.fakeBroker.unbound = map[string]bool{"44": true}
	x.broker.runtime["44"] = "admitted"
	alice := x.login("42", "alice")
	csrf := extractCSRF(t, request(x.h, "GET", "/auth/session", alice).Body.String())
	bob := x.login("43", "bob")
	bobCSRF := extractCSRF(t, request(x.h, "GET", "/auth/session", bob).Body.String())

	if code, _, _ := designate(t, x, bob, bobCSRF, "44", true); code != 403 {
		t.Fatal("non-administrator designated", code)
	}
	if w := accessPost(x.h, alice, "wrong", accessPath+"/role", `{"id":"44","administrator":true}`); w.Code != 403 {
		t.Fatal("CSRF bypass", w.Code)
	}
	for path, body := range map[string]string{"/role": `{"id":"44"}`, "/add": `{"id":"44","administrator":true}`} {
		if w := accessPost(x.h, alice, csrf, accessPath+path, body); w.Code != 400 {
			t.Fatal(path, body, w.Code)
		}
	}
	// Root's administrator is not the browser's to revoke; an id nobody
	// admits cannot be named.
	if code, _, body := designate(t, x, alice, csrf, "42", false); code != 409 || !strings.Contains(body, "operator_owned") {
		t.Fatal(code, body)
	}
	if code, _, body := designate(t, x, alice, csrf, "45", true); code != 409 || !strings.Contains(body, "not_admitted") {
		t.Fatal(code, body)
	}

	// Pending until the sign-in, and revocable while pending.
	code, v, body := designate(t, x, alice, csrf, "44", true)
	if code != 200 || v.Entry.Administrator || v.Entry.Role == nil || *v.Entry.Role != (roleEntry{"site_admin", "pending", "42", "2026-10-24T09:00:00Z"}) {
		t.Fatal(code, body)
	}
	if code, v, body = designate(t, x, alice, csrf, "44", false); code != 200 || v.Entry.Role != nil {
		t.Fatal(code, body)
	}
	if code, _, body = designate(t, x, alice, csrf, "44", true); code != 200 {
		t.Fatal(code, body)
	}
	// Another person whose login is now carol gains nothing: the role is
	// carol's GitHub id's, not her name's.
	if renamed := x.login("43", "carol"); renamed == nil || serverAdministrator(t, x.h, renamed) {
		t.Fatal("role followed a login")
	}
	carol := x.login("44", "carol")
	if carol == nil || !serverAdministrator(t, x.h, carol) {
		t.Fatal("designation not granted at first sign-in")
	}
	x.restart()
	if !x.auth.isAdministrator("44") {
		t.Fatal("grant not persisted")
	}
	alice = x.login("42", "alice")
	csrf = extractCSRF(t, request(x.h, "GET", "/auth/session", alice).Body.String())
	list := request(x.h, "GET", accessPath, alice)
	if !strings.Contains(list.Body.String(), `"administrator_role":{"source":"site_admin","state":"granted","actor":"42"`) || !strings.Contains(list.Body.String(), `"administrator_role":{"source":"operator","state":"granted"}`) {
		t.Fatal(list.Body.String())
	}

	// A bound person is granted at once; revoking ends the role at once.
	bob = x.login("43", "bob")
	if code, v, body = designate(t, x, alice, csrf, "43", true); code != 200 || !v.Entry.Administrator || !serverAdministrator(t, x.h, bob) {
		t.Fatal(code, body)
	}
	if code, _, body = designate(t, x, alice, csrf, "43", false); code != 200 || serverAdministrator(t, x.h, bob) {
		t.Fatal(code, body)
	}

	// Root declaring a designated subject takes the role over.
	if _, err := x.auth.AdminControl(context.Background(), []byte(`{"operation":"role_declared","subject":"44","administrator":true}`)); err != nil {
		t.Fatal(err)
	}
	if code, _, body = designate(t, x, alice, csrf, "44", false); code != 409 || !strings.Contains(body, "operator_owned") || !x.auth.isAdministrator("44") {
		t.Fatal(code, body)
	}
}

// A designation never outlives the admission it was made for unseen.
func TestDesignationFollowsAdmission(t *testing.T) {
	x := newAccessHarness(t)
	x.broker.fakeBroker.routes["44"] = BrokerRoute{UID: 1003, Username: "carol", Socket: "/run/open-habitat/users/carol/daemon.sock"}
	x.broker.fakeBroker.unbound = map[string]bool{"44": true}
	x.broker.runtime["44"] = "admitted"
	alice := x.login("42", "alice")
	csrf := extractCSRF(t, request(x.h, "GET", "/auth/session", alice).Body.String())
	if code, _, body := designate(t, x, alice, csrf, "44", true); code != 200 {
		t.Fatal(code, body)
	}
	// Deleting the never-used admission deletes the pending designation, so
	// admitting the id again brings no role back.
	if w := accessPost(x.h, alice, csrf, accessPath+"/remove", `{"id":"44"}`); w.Code != 200 || !strings.Contains(w.Body.String(), `"state":"removed"`) {
		t.Fatal(w.Code, w.Body.String())
	}
	if len(x.auth.settingsView().Designated) != 0 {
		t.Fatal("designation outlived its admission")
	}
	// Root removing an admission the gateway cannot see leaves the
	// designation listed as unlisted, still revocable.
	x.broker.runtime["44"] = "admitted"
	if code, _, body := designate(t, x, alice, csrf, "44", true); code != 200 {
		t.Fatal(code, body)
	}
	delete(x.broker.runtime, "44")
	list := request(x.h, "GET", accessPath, alice).Body.String()
	if !strings.Contains(list, `"id":"44","source":"none","state":"unlisted"`) {
		t.Fatal(list)
	}
	if code, v, body := designate(t, x, alice, csrf, "44", false); code != 200 || v.Entry.State != "unlisted" || v.Entry.Role != nil {
		t.Fatal(code, body)
	}
	// A withdrawal of a never-used admission whose reply was lost leaves a
	// bare deny; revoking the designation must not hide it.
	x.broker.runtime["44"] = "admitted"
	if code, _, body := designate(t, x, alice, csrf, "44", true); code != 200 {
		t.Fatal(code, body)
	}
	x.broker.lose = true
	if w := accessPost(x.h, alice, csrf, accessPath+"/remove", `{"id":"44"}`); w.Code != 503 {
		t.Fatal(w.Code, w.Body.String())
	}
	delete(x.broker.runtime, "44")
	if code, v, body := designate(t, x, alice, csrf, "44", false); code != 200 || v.Entry.State != "denied" {
		t.Fatal(code, body)
	}
	// A withdrawn person cannot be named until restored.
	x.login("43", "bob")
	if w := accessPost(x.h, alice, csrf, accessPath+"/remove", `{"id":"43"}`); w.Code != 200 {
		t.Fatal(w.Code)
	}
	if code, _, body := designate(t, x, alice, csrf, "43", true); code != 409 || !strings.Contains(body, "not_admitted") {
		t.Fatal(code, body)
	}
}

// A designated administrator admitted at runtime can be withdrawn; from the
// deny on, a request of theirs already past its session check has no
// authority left.
func TestWithdrawnAdministratorHoldsNoAuthority(t *testing.T) {
	x := newAccessHarness(t)
	alice := x.login("42", "alice")
	csrf := extractCSRF(t, request(x.h, "GET", "/auth/session", alice).Body.String())
	x.login("43", "bob")
	if code, v, body := designate(t, x, alice, csrf, "43", true); code != 200 || !v.Entry.Administrator {
		t.Fatal(code, body)
	}
	if w := accessPost(x.h, alice, csrf, accessPath+"/remove", `{"id":"43"}`); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	if _, err := x.auth.designateAdministrator(context.Background(), "43", "42"); err != errAdminDenied {
		t.Fatal("withdrawn administrator designated", err)
	}
	if _, err := x.auth.revokeDesignation(context.Background(), "43", "43"); err != errAdminDenied {
		t.Fatal("withdrawn administrator revoked", err)
	}
	// Restoring access restores the role the designation still holds.
	if w := accessPost(x.h, alice, csrf, accessPath+"/add", `{"id":"43"}`); w.Code != 200 || !x.auth.isAdministrator("43") {
		t.Fatal(w.Code, w.Body.String())
	}
}
