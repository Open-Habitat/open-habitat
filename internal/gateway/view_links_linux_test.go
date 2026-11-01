//go:build linux

package gateway

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// newLinkDesk is a view desk whose site shares view addresses publicly.
func newLinkDesk(t *testing.T) *viewDesk {
	t.Helper()
	d := newViewDesk(t)
	d.a.cfg.ViewLinkMaxDays = 90
	d.a.mu.Lock()
	d.a.publishViewAddresses(map[string]viewAddress{})
	// These tests move the clock by days; the person stays signed in.
	s := d.a.sessions["browser"]
	s.id, s.idle, s.absolute = "s1", d.a.now().Add(365*24*time.Hour), d.a.now().Add(365*24*time.Hour)
	d.a.sessions["browser"] = s
	d.a.mu.Unlock()
	return d
}

type addressReply struct {
	AddressID   string `json:"address_id"`
	ViewID      string `json:"view_id"`
	Title       string `json:"title"`
	URL         string `json:"url"`
	ContentURL  string `json:"content_url"`
	State       string `json:"state"`
	PublicUntil string `json:"public_until"`
}

func (d *viewDesk) addressCall(path, body string, want int) addressReply {
	d.t.Helper()
	res := d.do("POST", "host.test", path, body, appWrite)
	var v struct{ Address addressReply }
	if res.StatusCode != want || want == 200 && json.NewDecoder(res.Body).Decode(&v) != nil {
		d.t.Fatalf("%s %s: %d, want %d", path, body, res.StatusCode, want)
	}
	d.drain()
	return v.Address
}

func (d *viewDesk) ensure(viewID string) addressReply {
	d.t.Helper()
	return d.addressCall(viewAddressesPath, `{"view_id":"`+viewID+`"}`, 200)
}

func (d *viewDesk) publish(id string, days int) addressReply {
	d.t.Helper()
	return d.addressCall(viewAddressPublishPath, `{"address_id":"`+id+`","days":`+itoa(days)+`}`, 200)
}

func itoa(n int) string { b, _ := json.Marshal(n); return string(b) }

// open reads a content URL (plus a path under it) anonymously: no cookie at all.
func (d *viewDesk) open(link, rest string) *http.Response {
	d.t.Helper()
	u, err := url.Parse(link)
	if err != nil {
		d.t.Fatal(err)
	}
	return d.do("GET", u.Host, u.Path+rest, "", nil)
}

func TestViewAddressAnonymousReadOfOneExport(t *testing.T) {
	d := newLinkDesk(t)
	l := d.publish(d.ensure(viewTestA).AddressID, 7)
	u, _ := url.Parse(l.ContentURL)
	entry, _ := url.Parse(l.URL)
	token := strings.Trim(u.Path, "/")
	if l.Title != "Kassavirta" || l.ViewID != viewTestA || l.State != "public" || !d.a.isViewHost(u.Host) || u.Host == d.host(viewTestA) || len(token) != 43 || strings.Contains(u.Host, token) {
		t.Fatalf("address %+v", l)
	}
	// The entry address is the app's own, with a secret of its own.
	if entry.Scheme != "https" || entry.Host != "host.test" || !strings.HasPrefix(entry.Path, viewEntryPrefix) || len(strings.TrimPrefix(entry.Path, viewEntryPrefix)) != 43 || strings.Contains(l.URL, token) {
		t.Fatalf("entry address %q", l.URL)
	}
	// The root goes to the entry under the token; files are relayed as the
	// owner's own view, with the sandbox, no cookie and no indexing.
	res := d.open(l.ContentURL, "")
	assertViewCSP(t, res, "content root")
	if res.StatusCode != 302 || res.Header.Get("Location") != "/"+token+"/site/index.html" {
		t.Fatalf("content root: %d %q", res.StatusCode, res.Header.Get("Location"))
	}
	res = d.open(l.ContentURL, "site/app.js")
	if body, _ := io.ReadAll(res.Body); res.StatusCode != 200 || string(body) != "1" || res.Header.Get("Set-Cookie") != "" || res.Header.Get("X-Robots-Tag") != "noindex, nofollow, noarchive" || res.Header.Get("Referrer-Policy") != "no-referrer" {
		t.Fatalf("content file: %d %q %v", res.StatusCode, body, res.Header)
	}
	assertViewCSP(t, res, "content file")
	if csp := res.Header.Get("Content-Security-Policy"); !strings.Contains(csp, "script-src https://"+u.Host+" ") {
		t.Fatalf("content sources must name the content host: %q", csp)
	}
	d.drain()
	// A wrong, truncated or absent token, the entry secret, another view's
	// path, traversal and the reserved namespace reach nothing.
	wrong := []byte(token)
	wrong[0] ^= 1
	entrySecret := strings.TrimPrefix(entry.Path, viewEntryPrefix)
	for _, path := range []string{"/", "/" + string(wrong) + "/site/app.js", "/" + token[:42] + "/site/app.js", "/" + entrySecret + "/site/app.js", "/site/app.js", "/" + token + "/../" + viewTestB + "/secret/index.html", "/" + token + "/%2e%2e/" + viewTestB + "/secret/index.html", "/" + token + "/_open-habitat/handoff?token=" + token, "/" + token + "/.env"} {
		res := d.do("GET", u.Host, path, "", nil)
		assertViewCSP(t, res, path)
		if res.StatusCode != 404 || res.Header.Get("Set-Cookie") != "" {
			t.Fatalf("%s: %d", path, res.StatusCode)
		}
	}
	for {
		select {
		case r := <-d.seen:
			if !strings.HasPrefix(r.URL.Path, "/view-export/"+viewTestA+"/") || strings.Contains(r.URL.Path, "..") || r.Header.Get("Cookie") != "" {
				t.Fatalf("daemon was asked for %q", r.URL.Path)
			}
			continue
		default:
		}
		break
	}
	// The token authorizes nothing on the owner's view host, another address
	// or the app; a view cookie authorizes nothing on the content host.
	if res := d.do("GET", d.host(viewTestA), "/"+token+"/site/app.js", "", nil); res.StatusCode != 404 || d.drain() != 0 {
		t.Fatalf("token on the owner's view host: %d", res.StatusCode)
	}
	other := d.publish(d.ensure(viewTestB).AddressID, 1)
	ou, _ := url.Parse(other.ContentURL)
	if res := d.do("GET", ou.Host, "/"+token+"/secret/index.html", "", nil); res.StatusCode != 404 {
		t.Fatalf("token on another address's host: %d", res.StatusCode)
	}
	if res := d.do("GET", "host.test", "/api/v1/views", "", withCookie(&http.Cookie{Name: cookieName, Value: token})); res.StatusCode != 401 {
		t.Fatalf("token as an app cookie: %d", res.StatusCode)
	}
	if res := d.do("POST", u.Host, "/"+token+"/site/index.html", "", nil); res.StatusCode != 405 {
		t.Fatalf("write on a content host: %d", res.StatusCode)
	}
	res = d.do("GET", u.Host, "/robots.txt", "", nil)
	if body, _ := io.ReadAll(res.Body); res.StatusCode != 200 || string(body) != "User-agent: *\nDisallow: /\n" {
		t.Fatalf("robots: %d %q", res.StatusCode, body)
	}
}

func TestViewAddressReservationIsPrivateAndStable(t *testing.T) {
	d := newLinkDesk(t)
	// Only an app write with CSRF reserves, and only an existing export.
	if res := d.do("POST", "host.test", viewAddressesPath, `{"view_id":"`+viewTestA+`"}`, appCookie); res.StatusCode != 403 {
		t.Fatalf("reserve without CSRF: %d", res.StatusCode)
	}
	d.addressCall(viewAddressesPath, `{"view_id":"vcccccccccccccccccccccccccc"}`, 404)
	if res := d.do("GET", "host.test", viewAddressesPath+"?view_id="+viewTestA, "", appCookie); res.StatusCode != 400 {
		t.Fatalf("GET with a query: %d", res.StatusCode)
	}
	if n := len(d.a.viewAddresses); n != 0 {
		t.Fatalf("a refused or read request reserved %d", n)
	}
	a := d.ensure(viewTestA)
	if a.State != "private" || a.PublicUntil != "" || a.Title != "Kassavirta" {
		t.Fatalf("new reservation %+v", a)
	}
	// A private address serves nothing, though its content URL is known.
	if res := d.open(a.ContentURL, "site/app.js"); res.StatusCode != 404 || d.drain() != 0 {
		t.Fatalf("private address: %d", res.StatusCode)
	}
	// The same view always answers the same reservation without a daemon call.
	if again := d.do("POST", "host.test", viewAddressesPath, `{"view_id":"`+viewTestA+`"}`, appWrite); again.StatusCode != 200 || d.drain() != 0 {
		t.Fatalf("second ensure: %d", again.StatusCode)
	}
	if again := d.ensure(viewTestA); again != a {
		t.Fatalf("second ensure answered %+v, want %+v", again, a)
	}
	// Publication, expiry, making private and republishing keep both URLs.
	p := d.publish(a.AddressID, 1)
	if p.URL != a.URL || p.ContentURL != a.ContentURL || p.State != "public" || p.PublicUntil != d.now.Add(24*time.Hour).UTC().Format(time.RFC3339) {
		t.Fatalf("published %+v", p)
	}
	if res := d.open(a.ContentURL, "site/app.js"); res.StatusCode != 200 {
		t.Fatalf("published address: %d", res.StatusCode)
	}
	*d.now = d.now.Add(25 * time.Hour)
	if res := d.open(a.ContentURL, "site/app.js"); res.StatusCode != 404 {
		t.Fatalf("expired address: %d", res.StatusCode)
	}
	if e := d.ensure(viewTestA); e.State != "expired" || e.URL != a.URL {
		t.Fatalf("expired reservation %+v", e)
	}
	// A duration change never publishes what is not public.
	d.addressCall(viewAddressDurationPath, `{"address_id":"`+a.AddressID+`","days":7}`, 409)
	p = d.publish(a.AddressID, 1)
	if p.URL != a.URL || p.ContentURL != a.ContentURL {
		t.Fatalf("republished %+v", p)
	}
	if res := d.open(a.ContentURL, "site/app.js"); res.StatusCode != 200 {
		t.Fatalf("an old copy after republishing: %d", res.StatusCode)
	}
	// Duration may extend or shorten the current period, from now.
	if c := d.addressCall(viewAddressDurationPath, `{"address_id":"`+a.AddressID+`","days":30}`, 200); c.PublicUntil != d.now.Add(30*24*time.Hour).UTC().Format(time.RFC3339) || c.URL != a.URL {
		t.Fatalf("extended %+v", c)
	}
	*d.now = d.now.Add(48 * time.Hour)
	if res := d.open(a.ContentURL, "site/app.js"); res.StatusCode != 200 {
		t.Fatalf("extended address: %d", res.StatusCode)
	}
	if c := d.addressCall(viewAddressPrivatePath, `{"address_id":"`+a.AddressID+`"}`, 200); c.State != "private" || c.PublicUntil != "" || c.URL != a.URL {
		t.Fatalf("made private %+v", c)
	}
	if res := d.open(a.ContentURL, "site/app.js"); res.StatusCode != 404 {
		t.Fatalf("private again: %d", res.StatusCode)
	}
	// The person's list holds every reservation; nobody else's shows it.
	d.ensure(viewTestB)
	res := d.do("GET", "host.test", viewAddressesPath, "", appCookie)
	var list struct {
		MaxDays   int            `json:"max_days"`
		Addresses []addressReply `json:"addresses"`
	}
	if res.StatusCode != 200 || json.NewDecoder(res.Body).Decode(&list) != nil || list.MaxDays != 90 || len(list.Addresses) != 2 || list.Addresses[1].URL != a.URL || list.Addresses[0].ViewID != viewTestB {
		t.Fatalf("list: %d %+v", res.StatusCode, list)
	}
	// Delete is for good: the old URLs die, and a new reservation of the
	// same view has fresh secrets and starts private.
	d.publish(a.AddressID, 7)
	d.addressCall(viewAddressDeletePath, `{"address_id":"`+a.AddressID+`"}`, 204)
	if res := d.open(a.ContentURL, "site/app.js"); res.StatusCode != 404 {
		t.Fatalf("deleted address: %d", res.StatusCode)
	}
	d.addressCall(viewAddressDeletePath, `{"address_id":"`+a.AddressID+`"}`, 404)
	d.addressCall(viewAddressPublishPath, `{"address_id":"`+a.AddressID+`","days":7}`, 404)
	fresh := d.ensure(viewTestA)
	if fresh.AddressID == a.AddressID || fresh.URL == a.URL || fresh.ContentURL == a.ContentURL || fresh.State != "private" {
		t.Fatalf("reservation after delete %+v", fresh)
	}
}

func TestViewAddressOwnershipAndRequests(t *testing.T) {
	d := newLinkDesk(t)
	a := d.ensure(viewTestA)
	d.a.mu.Lock()
	d.a.sessions["bob"] = session{identity: Identity{"github", "43", os.Getuid(), "bob", "/run/open-habitat/users/bob/daemon.sock"}, csrf: "bob", idle: d.a.now().Add(time.Hour), absolute: d.a.now().Add(time.Hour)}
	d.a.mu.Unlock()
	bob := func(r *http.Request) {
		r.AddCookie(&http.Cookie{Name: cookieName, Value: "bob"})
		r.Header.Set("Origin", "https://host.test")
		r.Header.Set("X-Agent-Host-CSRF", "bob")
	}
	res := d.do("GET", "host.test", viewAddressesPath, "", bob)
	if body, _ := io.ReadAll(res.Body); res.StatusCode != 200 || strings.Contains(string(body), a.AddressID) {
		t.Fatalf("another person's list: %d %s", res.StatusCode, body)
	}
	for path, body := range map[string]string{
		viewAddressPublishPath:  `{"address_id":"` + a.AddressID + `","days":7}`,
		viewAddressDurationPath: `{"address_id":"` + a.AddressID + `","days":7}`,
		viewAddressPrivatePath:  `{"address_id":"` + a.AddressID + `"}`,
		viewAddressDeletePath:   `{"address_id":"` + a.AddressID + `"}`,
	} {
		if res := d.do("POST", "host.test", path, body, bob); res.StatusCode != 404 {
			t.Fatalf("another person's %s: %d", path, res.StatusCode)
		}
	}
	d.drain()
	// Each write takes exactly its own fields, within the operator's maximum.
	for path, body := range map[string]string{
		viewAddressPublishPath + "#none":  `{"address_id":"` + a.AddressID + `"}`,
		viewAddressPublishPath + "#max":   `{"address_id":"` + a.AddressID + `","days":91}`,
		viewAddressPublishPath + "#zero":  `{"address_id":"` + a.AddressID + `","days":0}`,
		viewAddressPrivatePath + "#days":  `{"address_id":"` + a.AddressID + `","days":7}`,
		viewAddressDeletePath + "#bad":    `{"address_id":"l` + a.AddressID[1:] + `"}`,
		viewAddressPublishPath + "#view":  `{"address_id":"` + a.AddressID + `","days":7,"view_id":"` + viewTestB + `"}`,
		viewAddressDurationPath + "#addr": `{"address_id":"` + a.AddressID + `","new_address":true}`,
	} {
		path, _, _ = strings.Cut(path, "#")
		if res := d.do("POST", "host.test", path, body, appWrite); res.StatusCode != 400 {
			t.Fatalf("%s %s: %d", path, body, res.StatusCode)
		}
	}
	// The movable-link routes are gone.
	for _, path := range []string{"/api/v1/view-links", "/api/v1/view-links/change", "/api/v1/view-links/revoke"} {
		if res := d.do("POST", "host.test", path, `{"view_id":"`+viewTestA+`","days":1}`, appWrite); res.StatusCode == 200 || res.StatusCode == 204 {
			t.Fatalf("%s still answers: %d", path, res.StatusCode)
		}
	}
}

func TestViewAddressMissingExportAndSitePolicy(t *testing.T) {
	d := newLinkDesk(t)
	a := d.ensure(viewTestB)
	// A removed export is never published and never replaced by another.
	d.mu.Lock()
	removed := map[string]string{}
	for path, body := range d.files {
		if strings.HasPrefix(path, "/view-export/"+viewTestB+"/") {
			removed[path] = body
			delete(d.files, path)
		}
	}
	d.mu.Unlock()
	d.addressCall(viewAddressPublishPath, `{"address_id":"`+a.AddressID+`","days":7}`, 404)
	if e := d.ensure(viewTestB); e.State != "private" || e.URL != a.URL {
		t.Fatalf("missing export's reservation %+v", e)
	}
	d.mu.Lock()
	for path, body := range removed {
		d.files[path] = body
	}
	d.mu.Unlock()
	d.publish(a.AddressID, 7)
	d.mu.Lock()
	for path := range removed {
		delete(d.files, path)
	}
	d.mu.Unlock()
	res := d.open(a.ContentURL, "")
	if body, _ := io.ReadAll(res.Body); res.StatusCode != 404 || strings.TrimSpace(string(body)) != viewShareGone.en {
		t.Fatalf("removed export: %d %q", res.StatusCode, body)
	}
	// The operator's switch pauses every publication; private reservation,
	// making private and deletion keep working, and the paused publication
	// returns while it is still unexpired.
	l := d.publish(d.ensure(viewTestA).AddressID, 7)
	d.a.cfg.ViewLinkMaxDays = 0
	if res := d.open(l.ContentURL, "site/app.js"); res.StatusCode != 404 {
		t.Fatalf("address with sharing off: %d", res.StatusCode)
	}
	res = d.do("GET", "host.test", viewAddressesPath, "", appCookie)
	var list struct {
		MaxDays   int            `json:"max_days"`
		Addresses []addressReply `json:"addresses"`
	}
	if res.StatusCode != 200 || json.NewDecoder(res.Body).Decode(&list) != nil || list.MaxDays != 0 || len(list.Addresses) != 2 {
		t.Fatalf("list with sharing off: %d %+v", res.StatusCode, list)
	}
	d.addressCall(viewAddressPublishPath, `{"address_id":"`+l.AddressID+`","days":1}`, 409)
	d.addressCall(viewAddressDurationPath, `{"address_id":"`+l.AddressID+`","days":1}`, 409)
	d.ensure(viewTestA)
	d.addressCall(viewAddressDeletePath, `{"address_id":"`+a.AddressID+`"}`, 204)
	d.a.cfg.ViewLinkMaxDays = 90
	if res := d.open(l.ContentURL, "site/app.js"); res.StatusCode != 200 {
		t.Fatalf("address after sharing is back: %d", res.StatusCode)
	}
	// Without the view namespace there are no addresses at all.
	d.a.cfg.ViewOrigin = ""
	if res := d.do("GET", "host.test", viewAddressesPath, "", appCookie); res.StatusCode != 204 {
		t.Fatalf("list without views: %d", res.StatusCode)
	}
	if res := d.do("POST", "host.test", viewAddressesPath, `{"view_id":"`+viewTestA+`"}`, appWrite); res.StatusCode != 404 {
		t.Fatalf("reserve without views: %d", res.StatusCode)
	}
	d.a.cfg.ViewOrigin = "https://oh-view-*.test"
	// A denied (withdrawn) owner's addresses answer nothing, and revoking
	// the subject deletes them for good: admitting the person again
	// republishes nothing.
	d.a.mu.Lock()
	d.a.settings.Denied = []string{"42"}
	d.a.mu.Unlock()
	if res := d.open(l.ContentURL, "site/app.js"); res.StatusCode != 404 {
		t.Fatalf("denied owner's address: %d", res.StatusCode)
	}
	d.a.mu.Lock()
	_, err := d.a.revokeSessionsLocked("42")
	n := len(d.a.viewAddresses)
	d.a.settings.Denied = nil
	d.a.mu.Unlock()
	if err != nil || n != 0 {
		t.Fatalf("revoked subject's addresses: %v %d", err, n)
	}
	if res := d.open(l.ContentURL, "site/app.js"); res.StatusCode != 404 {
		t.Fatalf("revoked subject's address: %d", res.StatusCode)
	}
}

func TestViewAddressAdminListsAndDeletes(t *testing.T) {
	d := newLinkDesk(t)
	l := d.publish(d.ensure(viewTestA).AddressID, 7)
	private := d.ensure(viewTestB)
	if res := d.do("GET", "host.test", adminPublicationsPath, "", appCookie); res.StatusCode != 403 {
		t.Fatalf("admin list for a non-administrator: %d", res.StatusCode)
	}
	d.a.mu.Lock()
	d.a.settings.Administrators = []string{"42"}
	d.a.mu.Unlock()
	res := d.do("GET", "host.test", adminPublicationsPath, "", appCookie)
	body, _ := io.ReadAll(res.Body)
	u, _ := url.Parse(l.ContentURL)
	entry, _ := url.Parse(l.URL)
	for _, secret := range []string{strings.Trim(u.Path, "/"), u.Host, strings.TrimPrefix(entry.Path, viewEntryPrefix), private.AddressID} {
		if strings.Contains(string(body), secret) {
			t.Fatalf("admin list shows %q: %s", secret, body)
		}
	}
	if res.StatusCode != 200 || !strings.Contains(string(body), l.AddressID) || !strings.Contains(string(body), `"owner_id":"42"`) {
		t.Fatalf("admin list: %d %s", res.StatusCode, body)
	}
	if res := d.do("POST", "host.test", adminPublicationsDelete, `{"address_id":"`+l.AddressID+`"}`, appCookie); res.StatusCode != 403 {
		t.Fatalf("admin delete without CSRF: %d", res.StatusCode)
	}
	if res := d.do("POST", "host.test", adminPublicationsDelete, `{"address_id":"`+l.AddressID+`"}`, appWrite); res.StatusCode != 204 {
		t.Fatalf("admin delete: %d", res.StatusCode)
	}
	if res := d.open(l.ContentURL, "site/app.js"); res.StatusCode != 404 {
		t.Fatalf("address after admin delete: %d", res.StatusCode)
	}
	// The owner's next reservation is a new, private address.
	if fresh := d.ensure(viewTestA); fresh.URL == l.URL || fresh.ContentURL == l.ContentURL || fresh.State != "private" {
		t.Fatalf("reservation after admin delete %+v", fresh)
	}
}

func TestViewAddressBudgetsAndCaps(t *testing.T) {
	d := newLinkDesk(t)
	l := d.publish(d.ensure(viewTestA).AddressID, 7)
	d.a.mu.Lock()
	d.a.viewLinkTraffic.day = d.a.now().UTC().Format(time.DateOnly)
	d.a.viewLinkTraffic.bytes = map[string]int64{l.AddressID: viewLinkDailyPerLink}
	d.a.mu.Unlock()
	if res := d.open(l.ContentURL, "site/app.js"); res.StatusCode != 429 {
		t.Fatalf("over the daily budget: %d", res.StatusCode)
	}
	// A new day starts a new budget.
	*d.now = d.now.Add(24 * time.Hour)
	if res := d.open(l.ContentURL, "site/app.js"); res.StatusCode != 200 {
		t.Fatalf("next day: %d", res.StatusCode)
	}
	d.a.mu.Lock()
	d.a.viewLinkTraffic.relays = map[string]int{l.AddressID: viewLinkRelaysPerLink}
	d.a.mu.Unlock()
	if res := d.open(l.ContentURL, "site/app.js"); res.StatusCode != 429 {
		t.Fatalf("over the concurrent relays: %d", res.StatusCode)
	}
	d.a.mu.Lock()
	d.a.viewLinkTraffic.relays = nil
	d.a.mu.Unlock()
	d.drain()
	// Active publications and reservations are capped separately: private
	// and expired reservations do not count against publishing.
	b := d.ensure(viewTestB)
	seed := func(n int, public bool) {
		d.a.mu.Lock()
		next := map[string]viewAddress{}
		for id, v := range d.a.viewAddresses {
			next[id] = v
		}
		owner := d.a.viewAddresses[l.AddressID].Owner
		for i := 0; i < n; i++ {
			id, _ := d.a.newViewAddressID()
			v := viewAddress{ID: id, Owner: owner, ViewID: "v" + id[1:], Created: d.a.now().Add(-48 * time.Hour)}
			if public {
				v.PublicUntil = d.a.now().Add(time.Hour)
			} else if i%2 == 0 {
				v.PublicUntil = d.a.now().Add(-time.Hour)
			}
			next[id] = v
		}
		d.a.publishViewAddresses(next)
		d.a.mu.Unlock()
	}
	seed(viewPublicationsPerPerson-2, false)
	d.publish(b.AddressID, 1)
	d.addressCall(viewAddressPrivatePath, `{"address_id":"`+b.AddressID+`"}`, 200)
	seed(viewPublicationsPerPerson-1, true)
	d.addressCall(viewAddressPublishPath, `{"address_id":"`+b.AddressID+`","days":1}`, 429)
	// Republishing what is already public is not a new publication.
	d.publish(l.AddressID, 1)
	// At the reservation cap a new view is refused, and nothing is evicted.
	seed(viewAddressesPerPerson-len(d.a.viewAddresses), false)
	before := len(d.a.viewAddresses)
	d.a.mu.Lock()
	for id, v := range d.a.viewAddresses {
		if v.ViewID == viewTestB {
			delete(d.a.viewAddresses, id)
		}
	}
	d.a.publishViewAddresses(d.a.viewAddresses)
	d.a.mu.Unlock()
	seed(1, false)
	d.addressCall(viewAddressesPath, `{"view_id":"`+viewTestB+`"}`, 429)
	if len(d.a.viewAddresses) != before {
		t.Fatalf("cap changed the store: %d, want %d", len(d.a.viewAddresses), before)
	}
	// An existing reservation is still answered at the cap.
	d.ensure(viewTestA)
}

func TestViewAddressConcurrentEnsureAgrees(t *testing.T) {
	d := newLinkDesk(t)
	var wg sync.WaitGroup
	urls := make([]string, 8)
	for i := range urls {
		wg.Go(func() {
			res := d.do("POST", "host.test", viewAddressesPath, `{"view_id":"`+viewTestA+`"}`, appWrite)
			var v struct{ Address addressReply }
			if res.StatusCode == 200 && json.NewDecoder(res.Body).Decode(&v) == nil {
				urls[i] = v.Address.URL
			}
		})
	}
	wg.Wait()
	d.drain()
	for _, u := range urls {
		if u == "" || u != urls[0] {
			t.Fatalf("concurrent ensures answered %q", urls)
		}
	}
	if n := len(d.a.viewAddresses); n != 1 {
		t.Fatalf("concurrent ensures reserved %d", n)
	}
}

func storeAuth(dir string, now *time.Time) *Auth {
	return &Auth{cfg: OAuthConfig{Origin: "https://host.test", ViewOrigin: "https://oh-view-*.test", ViewLinkMaxDays: 30}, sessionFile: filepath.Join(dir, "sessions.json"), now: func() time.Time { return *now }, log: CallbackLogger(io.Discard)}
}

func TestViewAddressStoreRoundTripAndFaults(t *testing.T) {
	dir := t.TempDir()
	now := time.Now()
	owner := Identity{"github", "42", 1001, "alice", "/run/open-habitat/users/alice/daemon.sock"}
	a := storeAuth(dir, &now)
	a.loadViewLinks()
	public := viewAddress{ID: "a" + strings.Repeat("a", 26), Entry: strings.Repeat("E", 43), Token: strings.Repeat("A", 43), Owner: owner, ViewID: viewTestA, Title: "Kassavirta", Created: now, PublicUntil: now.Add(time.Hour)}
	private := viewAddress{ID: "a" + strings.Repeat("b", 26), Entry: strings.Repeat("F", 43), Token: strings.Repeat("B", 43), Owner: owner, ViewID: viewTestB, Title: "Toinen", Created: now}
	expiring := private
	expiring.ID, expiring.Entry, expiring.Token, expiring.ViewID, expiring.PublicUntil = "a"+strings.Repeat("c", 26), strings.Repeat("G", 43), strings.Repeat("C", 43), "v"+strings.Repeat("c", 26), now.Add(time.Minute)
	a.mu.Lock()
	err := a.changeViewAddresses(func(next map[string]viewAddress) bool {
		next[public.ID], next[private.ID], next[expiring.ID] = public, private, expiring
		return true
	})
	a.mu.Unlock()
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, viewLinkStoreName)
	info, err := os.Stat(path)
	if err != nil || info.Mode().Perm() != 0600 {
		t.Fatalf("store file: %v %v", err, info)
	}
	// Private and expired reservations survive a restart.
	now = now.Add(2 * time.Minute)
	b := storeAuth(dir, &now)
	b.loadViewLinks()
	if got := b.viewAddresses[public.ID]; len(b.viewAddresses) != 3 || got.Token != public.Token || got.Entry != public.Entry || got.Owner != owner || !got.PublicUntil.Equal(public.PublicUntil) || b.viewLinkHosts[b.viewLinkHost(public.ID)] != public.ID || !b.viewAddresses[private.ID].PublicUntil.IsZero() || b.viewAddresses[expiring.ID].public(now) {
		t.Fatalf("reloaded store: %+v", b.viewAddresses)
	}
	if outcome, err := ResetLegacyViewLinks(dir); outcome != "current" || err != nil {
		t.Fatalf("reset of a current store: %q %v", outcome, err)
	}
	again := storeAuth(dir, &now)
	if again.loadViewLinks(); len(again.viewAddresses) != 3 {
		t.Fatal("the upgrade reset a current store")
	}
	// A loosened store disables addresses at once and after a restart, and
	// is never replaced: tightening it again restores every reservation.
	good, _ := os.ReadFile(path)
	if err := os.Chmod(path, 0644); err != nil {
		t.Fatal(err)
	}
	b.mu.Lock()
	usable := b.viewAddressStoreUsable()
	writeErr := b.changeViewAddresses(func(next map[string]viewAddress) bool { clear(next); return true })
	b.mu.Unlock()
	c := storeAuth(dir, &now)
	c.loadViewLinks()
	if usable || writeErr == nil || len(c.viewAddresses) != 0 || c.viewAddressFault == "" {
		t.Fatalf("loosened store: usable %v, write %v, %d addresses", usable, writeErr, len(c.viewAddresses))
	}
	if outcome, err := ResetLegacyViewLinks(dir); outcome != "unusable_left_unchanged" || err != nil {
		t.Fatalf("reset of a loosened store: %q %v", outcome, err)
	}
	if now, _ := os.ReadFile(path); !bytes.Equal(now, good) {
		t.Fatal("a loosened store was rewritten")
	}
	_ = os.Chmod(path, 0600)
	// A corrupt store stays as it is; the upgrade does not recover it.
	for _, bad := range []string{`{"version":2,"addresses":[{}]}`, `{"version":3,"addresses":[]}`, `not json`} {
		if err := os.WriteFile(path, []byte(bad), 0600); err != nil {
			t.Fatal(err)
		}
		c := storeAuth(dir, &now)
		c.loadViewLinks()
		outcome, err := ResetLegacyViewLinks(dir)
		after, _ := os.ReadFile(path)
		if c.viewAddressFault != "invalid_view_address_store" || outcome != "unusable_left_unchanged" || err != nil || string(after) != bad {
			t.Fatalf("corrupt store %q: fault %q, reset %q %v", bad, c.viewAddressFault, outcome, err)
		}
	}
	// A duplicate view, entry or token is refused whole.
	dup := private
	dup.ID = "a" + strings.Repeat("d", 26)
	dup.Entry, dup.Token = strings.Repeat("H", 43), strings.Repeat("D", 43)
	data, _ := json.Marshal(viewAddressState{viewLinkStoreVersion, []viewAddress{private, dup}})
	if _, reason := decodeViewAddressStore(data); reason != "invalid_view_address_store" {
		t.Fatalf("duplicate reservation of one view: %q", reason)
	}
	// A record naming a route the broker would never give is refused whole.
	bad := public
	bad.Owner.Socket = "/tmp/elsewhere.sock"
	if validViewAddress(bad) {
		t.Fatal("record with a foreign socket accepted")
	}
	// Deleting the last address leaves an empty store a restart reads.
	_ = os.WriteFile(path, good, 0600)
	e := storeAuth(dir, &now)
	e.loadViewLinks()
	e.mu.Lock()
	_, err = e.removeViewLinksLocked(owner.Subject)
	e.mu.Unlock()
	f := storeAuth(dir, &now)
	f.loadViewLinks()
	if err != nil || f.viewAddressFault != "" || len(f.viewAddresses) != 0 {
		t.Fatalf("store emptied by deletion: %v, fault %q", err, f.viewAddressFault)
	}
	// The absent store is empty and the reset leaves it absent.
	_ = os.Remove(path)
	if outcome, err := ResetLegacyViewLinks(dir); outcome != "absent" || err != nil {
		t.Fatalf("reset of an absent store: %q %v", outcome, err)
	}
	if _, err := os.Lstat(path); !os.IsNotExist(err) {
		t.Fatal("the reset created a store")
	}
}

func TestViewAddressLegacyStoreWaitsForTheUpgrade(t *testing.T) {
	dir := t.TempDir()
	now := time.Now()
	path := filepath.Join(dir, viewLinkStoreName)
	legacy := `{"version":1,"links":[{"id":"l` + strings.Repeat("a", 26) + `","token":"` + strings.Repeat("A", 43) + `","owner":{"provider":"github","subject":"42","uid":1001,"username":"alice","socket":"/run/open-habitat/users/alice/daemon.sock"},"view_id":"` + viewTestA + `","title":"Kassavirta","created":"2026-10-30T12:00:00Z","expires":"2026-11-30T12:00:00Z"}]}`
	if err := os.WriteFile(path, []byte(legacy), 0600); err != nil {
		t.Fatal(err)
	}
	// Ordinary startup disables addresses and leaves the old file alone.
	var logs bytes.Buffer
	a := storeAuth(dir, &now)
	a.log = CallbackLogger(&logs)
	a.loadViewLinks()
	a.mu.Lock()
	writeErr := a.changeViewAddresses(func(next map[string]viewAddress) bool { return true })
	a.mu.Unlock()
	after, _ := os.ReadFile(path)
	if a.viewAddressFault != "legacy_view_link_store" || writeErr == nil || string(after) != legacy || !strings.Contains(logs.String(), `"reason":"legacy_view_link_store"`) || strings.Contains(logs.String(), strings.Repeat("A", 43)) {
		t.Fatalf("legacy startup: fault %q, write %v, log %s", a.viewAddressFault, writeErr, logs.String())
	}
	// The upgrade's reset installs the empty new format once.
	if outcome, err := ResetLegacyViewLinks(dir); outcome != "reset" || err != nil {
		t.Fatalf("legacy reset: %q %v", outcome, err)
	}
	info, err := os.Stat(path)
	b := storeAuth(dir, &now)
	b.loadViewLinks()
	if err != nil || info.Mode().Perm() != 0600 || b.viewAddressFault != "" || len(b.viewAddresses) != 0 {
		t.Fatalf("after the reset: %v %v fault %q", err, info, b.viewAddressFault)
	}
	if outcome, err := ResetLegacyViewLinks(dir); outcome != "current" || err != nil {
		t.Fatalf("second reset: %q %v", outcome, err)
	}
}

func TestViewAddressUnusableStoreAnswersUnavailable(t *testing.T) {
	d := newLinkDesk(t)
	l := d.publish(d.ensure(viewTestA).AddressID, 7)
	d.a.mu.Lock()
	d.a.viewAddressStoreFailed("invalid_view_address_store")
	d.a.settings.Administrators = []string{"42"}
	d.a.mu.Unlock()
	if res := d.do("GET", "host.test", viewAddressesPath, "", appCookie); res.StatusCode != 503 {
		t.Fatalf("list from an unusable store: %d", res.StatusCode)
	}
	if res := d.do("GET", "host.test", adminPublicationsPath, "", appCookie); res.StatusCode != 503 {
		t.Fatalf("admin list from an unusable store: %d", res.StatusCode)
	}
	d.addressCall(viewAddressesPath, `{"view_id":"`+viewTestA+`"}`, 503)
	d.addressCall(viewAddressPublishPath, `{"address_id":"`+l.AddressID+`","days":7}`, 503)
	d.addressCall(viewAddressDeletePath, `{"address_id":"`+l.AddressID+`"}`, 503)
	if res := d.open(l.ContentURL, "site/app.js"); res.StatusCode != 404 {
		t.Fatalf("content from an unusable store: %d", res.StatusCode)
	}
	// The rest of the app answers.
	if res := d.do("GET", "host.test", "/api/v1/views", "", appCookie); res.StatusCode == 503 {
		t.Fatalf("views with an unusable address store: %d", res.StatusCode)
	}
	// Revocation cannot delete the person's addresses, so it fails rather
	// than leave them for a repaired store to revive.
	d.a.mu.Lock()
	_, err := d.a.revokeSessionsLocked("42")
	d.a.mu.Unlock()
	if err == nil {
		t.Fatal("revocation with an unusable store reported success")
	}
}

func TestViewLinkConfiguration(t *testing.T) {
	base := OAuthConfig{ClientID: "id", ClientSecret: "secret", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback"}
	for _, tc := range []struct {
		view string
		days int
		ok   bool
	}{{"https://oh-view-*.test", 90, true}, {"", 90, false}, {"https://oh-view-*.test", 366, false}, {"https://oh-view-*.test", -1, false}, {"", 0, true}} {
		cfg := base
		cfg.ViewOrigin, cfg.ViewLinkMaxDays = tc.view, tc.days
		_, err := NewAuth(cfg, AuthOptions{Provider: GitHubProvider{}, Sink: nopSink{}, Broker: newFakeBroker(), Log: CallbackLogger(io.Discard)})
		if (err == nil) != tc.ok {
			t.Errorf("view %q days %d: %v", tc.view, tc.days, err)
		}
	}
}

type nopSink struct{}

func (nopSink) Deliver(context.Context, Identity, string, string) (Handoff, error) {
	return HandoffInUse, nil
}

func TestViewAddressWritesNeedALiveSession(t *testing.T) {
	d := newLinkDesk(t)
	a := d.publish(d.ensure(viewTestA).AddressID, 7)
	// A session that ended after the request was authenticated, as while
	// its body was read, changes nothing.
	d.a.mu.Lock()
	s := d.a.sessions["browser"]
	d.a.mu.Unlock()
	ended := s
	ended.id = "gone"
	for _, write := range []func(http.ResponseWriter){
		func(w http.ResponseWriter) {
			d.a.changeViewAddress(w, ended, a.AddressID, "duration", func(v *viewAddress, now time.Time) string {
				v.PublicUntil = now.Add(time.Hour)
				return ""
			})
		},
		func(w http.ResponseWriter) {
			d.a.deleteViewAddress(w, &ended, a.AddressID, func(viewAddress) bool { return true }, "owner")
		},
	} {
		rec := httptest.NewRecorder()
		write(rec)
		if rec.Code != 401 {
			t.Fatalf("write with an ended session: %d", rec.Code)
		}
	}
	if e := d.ensure(viewTestA); e != a {
		t.Fatalf("address changed by an ended session: %+v", e)
	}
}

func TestViewAddressCommitChecks(t *testing.T) {
	d := newLinkDesk(t)
	// The commit after the daemon call refuses a session that expired
	// meanwhile, though it is still in memory.
	d.a.mu.Lock()
	s := d.a.sessions["browser"]
	_, live := d.a.authenticatedLocked(s)
	expired := s
	expired.absolute = d.a.now()
	d.a.sessions["browser"] = expired
	_, stale := d.a.authenticatedLocked(s)
	d.a.sessions["browser"] = s
	d.a.mu.Unlock()
	if !live || stale {
		t.Fatalf("commit check: live %v, expired accepted %v", live, stale)
	}
}
