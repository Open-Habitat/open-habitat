//go:build linux

package gateway

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// linkDesk is a view desk whose site enables shared view links.
func newLinkDesk(t *testing.T) *viewDesk {
	t.Helper()
	d := newViewDesk(t)
	d.a.cfg.ViewLinkMaxDays = 90
	d.a.mu.Lock()
	d.a.publishViewLinks(map[string]viewLink{})
	// These tests move the clock by days; the person stays signed in.
	s := d.a.sessions["browser"]
	s.id, s.idle, s.absolute = "s1", d.a.now().Add(365*24*time.Hour), d.a.now().Add(365*24*time.Hour)
	d.a.sessions["browser"] = s
	d.a.mu.Unlock()
	return d
}

type linkReply struct {
	LinkID    string `json:"link_id"`
	ViewID    string `json:"view_id"`
	Title     string `json:"title"`
	URL       string `json:"url"`
	ExpiresAt string `json:"expires_at"`
}

func (d *viewDesk) createLink(viewID string, days int) linkReply {
	d.t.Helper()
	res := d.do("POST", "host.test", viewLinksPath, `{"view_id":"`+viewID+`","days":`+itoa(days)+`}`, appWrite)
	var v struct{ Link linkReply }
	if res.StatusCode != 200 || json.NewDecoder(res.Body).Decode(&v) != nil {
		d.t.Fatalf("create link: %d", res.StatusCode)
	}
	return v.Link
}

func itoa(n int) string { b, _ := json.Marshal(n); return string(b) }

// open reads a link URL (plus a path under it) anonymously: no cookie at all.
func (d *viewDesk) open(link, rest string) *http.Response {
	d.t.Helper()
	u, err := url.Parse(link)
	if err != nil {
		d.t.Fatal(err)
	}
	return d.do("GET", u.Host, u.Path+rest, "", nil)
}

func TestViewLinkAnonymousReadOfOneExport(t *testing.T) {
	d := newLinkDesk(t)
	l := d.createLink(viewTestA, 7)
	u, _ := url.Parse(l.URL)
	token := strings.Trim(u.Path, "/")
	if l.Title != "Kassavirta" || l.ViewID != viewTestA || !d.a.isViewHost(u.Host) || u.Host == d.host(viewTestA) || len(token) != 43 || strings.Contains(u.Host, token) {
		t.Fatalf("link %+v", l)
	}
	d.drain()
	// The root goes to the entry under the token; files are relayed as the
	// owner's own view, with the sandbox, no cookie and no indexing.
	res := d.open(l.URL, "")
	assertViewCSP(t, res, "link root")
	if res.StatusCode != 302 || res.Header.Get("Location") != "/"+token+"/site/index.html" {
		t.Fatalf("link root: %d %q", res.StatusCode, res.Header.Get("Location"))
	}
	res = d.open(l.URL, "site/app.js")
	if body, _ := io.ReadAll(res.Body); res.StatusCode != 200 || string(body) != "1" || res.Header.Get("Set-Cookie") != "" || res.Header.Get("X-Robots-Tag") != "noindex, nofollow, noarchive" || res.Header.Get("Referrer-Policy") != "no-referrer" {
		t.Fatalf("link file: %d %q %v", res.StatusCode, body, res.Header)
	}
	assertViewCSP(t, res, "link file")
	if csp := res.Header.Get("Content-Security-Policy"); !strings.Contains(csp, "script-src https://"+u.Host+" ") {
		t.Fatalf("link sources must name the link host: %q", csp)
	}
	d.drain()
	// A wrong, truncated or absent token, another view's path, traversal and
	// the reserved namespace reach nothing.
	wrong := []byte(token)
	wrong[0] ^= 1
	for _, path := range []string{"/", "/" + string(wrong) + "/site/app.js", "/" + token[:42] + "/site/app.js", "/site/app.js", "/" + token + "/../" + viewTestB + "/secret/index.html", "/" + token + "/%2e%2e/" + viewTestB + "/secret/index.html", "/" + token + "/_open-habitat/handoff?token=" + token, "/" + token + "/.env"} {
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
	// The token authorizes nothing on the owner's view host, another link or
	// the app; a view cookie authorizes nothing on the link host.
	if res := d.do("GET", d.host(viewTestA), "/"+token+"/site/app.js", "", nil); res.StatusCode != 404 || d.drain() != 0 {
		t.Fatalf("token on the owner's view host: %d", res.StatusCode)
	}
	other := d.createLink(viewTestB, 1)
	ou, _ := url.Parse(other.URL)
	if res := d.do("GET", ou.Host, "/"+token+"/secret/index.html", "", nil); res.StatusCode != 404 {
		t.Fatalf("token on another link's host: %d", res.StatusCode)
	}
	if res := d.do("GET", "host.test", "/api/v1/views", "", withCookie(&http.Cookie{Name: cookieName, Value: token})); res.StatusCode != 401 {
		t.Fatalf("token as an app cookie: %d", res.StatusCode)
	}
	if res := d.do("POST", u.Host, "/"+token+"/site/index.html", "", nil); res.StatusCode != 405 {
		t.Fatalf("write on a link host: %d", res.StatusCode)
	}
	res = d.do("GET", u.Host, "/robots.txt", "", nil)
	if body, _ := io.ReadAll(res.Body); res.StatusCode != 200 || string(body) != "User-agent: *\nDisallow: /\n" {
		t.Fatalf("robots: %d %q", res.StatusCode, body)
	}
}

func TestViewLinkLifecycleExpiryAndRevocation(t *testing.T) {
	d := newLinkDesk(t)
	// Only an app write with CSRF creates a link, and only within the
	// operator's maximum.
	if res := d.do("POST", "host.test", viewLinksPath, `{"view_id":"`+viewTestA+`","days":7}`, appCookie); res.StatusCode != 403 {
		t.Fatalf("create without CSRF: %d", res.StatusCode)
	}
	if res := d.do("POST", "host.test", viewLinksPath, `{"view_id":"`+viewTestA+`","days":91}`, appWrite); res.StatusCode != 400 {
		t.Fatalf("create beyond the maximum: %d", res.StatusCode)
	}
	if res := d.do("POST", "host.test", viewLinksPath, `{"view_id":"vcccccccccccccccccccccccccc","days":7}`, appWrite); res.StatusCode != 404 {
		t.Fatalf("create for a missing view: %d", res.StatusCode)
	}
	l := d.createLink(viewTestA, 1)
	if res := d.open(l.URL, "site/app.js"); res.StatusCode != 200 {
		t.Fatalf("fresh link: %d", res.StatusCode)
	}
	// The person's list carries the URL; another person sees nothing of it.
	res := d.do("GET", "host.test", viewLinksPath, "", appCookie)
	var list struct {
		MaxDays int         `json:"max_days"`
		Links   []linkReply `json:"links"`
	}
	if res.StatusCode != 200 || json.NewDecoder(res.Body).Decode(&list) != nil || list.MaxDays != 90 || len(list.Links) != 1 || list.Links[0].URL != l.URL {
		t.Fatalf("list: %d %+v", res.StatusCode, list)
	}
	d.a.mu.Lock()
	d.a.sessions["bob"] = session{identity: Identity{"github", "43", os.Getuid(), "bob", "/run/open-habitat/users/bob/daemon.sock"}, csrf: "bob", idle: d.a.now().Add(time.Hour), absolute: d.a.now().Add(time.Hour)}
	d.a.mu.Unlock()
	bob := func(r *http.Request) {
		r.AddCookie(&http.Cookie{Name: cookieName, Value: "bob"})
		r.Header.Set("Origin", "https://host.test")
		r.Header.Set("X-Agent-Host-CSRF", "bob")
	}
	res = d.do("GET", "host.test", viewLinksPath, "", bob)
	if body, _ := io.ReadAll(res.Body); res.StatusCode != 200 || strings.Contains(string(body), l.LinkID) {
		t.Fatalf("another person's list: %d %s", res.StatusCode, body)
	}
	for _, body := range []string{`{"link_id":"` + l.LinkID + `","days":30}`, `{"link_id":"` + l.LinkID + `","new_address":true}`} {
		if res := d.do("POST", "host.test", viewLinkChangePath, body, bob); res.StatusCode != 404 {
			t.Fatalf("another person's change: %d", res.StatusCode)
		}
	}
	if res := d.do("POST", "host.test", viewLinkRevokePath, `{"link_id":"`+l.LinkID+`"}`, bob); res.StatusCode != 404 {
		t.Fatalf("another person's revoke: %d", res.StatusCode)
	}
	// One change at a time.
	if res := d.do("POST", "host.test", viewLinkChangePath, `{"link_id":"`+l.LinkID+`","days":30,"new_address":true}`, appWrite); res.StatusCode != 400 {
		t.Fatalf("two changes at once: %d", res.StatusCode)
	}
	// Expiry is checked at every read; an extension counts from its own day.
	*d.now = d.now.Add(25 * time.Hour)
	if res := d.open(l.URL, "site/app.js"); res.StatusCode != 404 {
		t.Fatalf("expired link: %d", res.StatusCode)
	}
	if res := d.do("POST", "host.test", viewLinkChangePath, `{"link_id":"`+l.LinkID+`","days":7}`, appWrite); res.StatusCode != 404 {
		t.Fatalf("extending an expired link: %d", res.StatusCode)
	}
	l = d.createLink(viewTestA, 1)
	res = d.do("POST", "host.test", viewLinkChangePath, `{"link_id":"`+l.LinkID+`","days":30}`, appWrite)
	var changed struct{ Link linkReply }
	if res.StatusCode != 200 || json.NewDecoder(res.Body).Decode(&changed) != nil || changed.Link.URL != l.URL || changed.Link.ExpiresAt != d.now.Add(30*24*time.Hour).UTC().Format(time.RFC3339) {
		t.Fatalf("extend: %d %+v", res.StatusCode, changed)
	}
	*d.now = d.now.Add(48 * time.Hour)
	if res := d.open(l.URL, "site/app.js"); res.StatusCode != 200 {
		t.Fatalf("extended link: %d", res.StatusCode)
	}
	// A new address keeps the host and the content, and the old URL dies.
	res = d.do("POST", "host.test", viewLinkChangePath, `{"link_id":"`+l.LinkID+`","new_address":true}`, appWrite)
	if res.StatusCode != 200 || json.NewDecoder(res.Body).Decode(&changed) != nil || changed.Link.URL == l.URL {
		t.Fatalf("new address: %d %+v", res.StatusCode, changed)
	}
	if res := d.open(l.URL, "site/app.js"); res.StatusCode != 404 {
		t.Fatalf("old address after a new one: %d", res.StatusCode)
	}
	l = changed.Link
	// Re-pointing keeps the URL and serves the other view only.
	res = d.do("POST", "host.test", viewLinkChangePath, `{"link_id":"`+l.LinkID+`","view_id":"`+viewTestB+`"}`, appWrite)
	if res.StatusCode != 200 || json.NewDecoder(res.Body).Decode(&changed) != nil || changed.Link.URL != l.URL || changed.Link.ViewID != viewTestB {
		t.Fatalf("re-point: %d %+v", res.StatusCode, changed)
	}
	if res := d.open(l.URL, "site/app.js"); res.StatusCode != 404 {
		t.Fatalf("old view's file after re-pointing: %d", res.StatusCode)
	}
	if res := d.open(l.URL, "secret/index.html"); res.StatusCode != 200 {
		t.Fatalf("re-pointed view: %d", res.StatusCode)
	}
	// A removed view answers "no longer available", never another view.
	d.mu.Lock()
	for path := range d.files {
		if strings.HasPrefix(path, "/view-export/"+viewTestB+"/") {
			delete(d.files, path)
		}
	}
	d.mu.Unlock()
	res = d.open(l.URL, "")
	if body, _ := io.ReadAll(res.Body); res.StatusCode != 404 || strings.TrimSpace(string(body)) != viewShareGone.en {
		t.Fatalf("removed view: %d %q", res.StatusCode, body)
	}
	// Revocation ends the next read.
	if res := d.do("POST", "host.test", viewLinkRevokePath, `{"link_id":"`+l.LinkID+`"}`, appWrite); res.StatusCode != 204 {
		t.Fatalf("revoke: %d", res.StatusCode)
	}
	if res := d.open(l.URL, "secret/index.html"); res.StatusCode != 404 {
		t.Fatalf("revoked link: %d", res.StatusCode)
	}
	// The operator's switch stops every link and restoring it brings them back.
	l = d.createLink(viewTestA, 7)
	d.a.cfg.ViewLinkMaxDays = 0
	if res := d.open(l.URL, "site/app.js"); res.StatusCode != 404 {
		t.Fatalf("link with links off: %d", res.StatusCode)
	}
	if res := d.do("GET", "host.test", viewLinksPath, "", appCookie); res.StatusCode != 204 {
		t.Fatalf("list with links off: %d", res.StatusCode)
	}
	if res := d.do("POST", "host.test", viewLinksPath, `{"view_id":"`+viewTestA+`","days":1}`, appWrite); res.StatusCode != 404 {
		t.Fatalf("create with links off: %d", res.StatusCode)
	}
	d.a.cfg.ViewLinkMaxDays = 90
	if res := d.open(l.URL, "site/app.js"); res.StatusCode != 200 {
		t.Fatalf("link after links are back: %d", res.StatusCode)
	}
	// A denied (withdrawn) owner's links answer nothing, and revoking the
	// subject removes them.
	d.a.mu.Lock()
	d.a.settings.Denied = []string{"42"}
	d.a.mu.Unlock()
	if res := d.open(l.URL, "site/app.js"); res.StatusCode != 404 {
		t.Fatalf("denied owner's link: %d", res.StatusCode)
	}
	d.a.mu.Lock()
	d.a.settings.Denied = nil
	_, err := d.a.revokeSessionsLocked("42")
	n := len(d.a.viewLinks)
	d.a.mu.Unlock()
	if err != nil || n != 0 {
		t.Fatalf("revoked subject's links: %v %d", err, n)
	}
	if res := d.open(l.URL, "site/app.js"); res.StatusCode != 404 {
		t.Fatalf("revoked subject's link: %d", res.StatusCode)
	}
}

func TestViewLinkAdministratorSeesMetadataAndRevokes(t *testing.T) {
	d := newLinkDesk(t)
	l := d.createLink(viewTestA, 7)
	if res := d.do("GET", "host.test", adminViewLinksPath, "", appCookie); res.StatusCode != 403 {
		t.Fatalf("admin list for a non-administrator: %d", res.StatusCode)
	}
	d.a.mu.Lock()
	d.a.settings.Administrators = []string{"42"}
	d.a.mu.Unlock()
	res := d.do("GET", "host.test", adminViewLinksPath, "", appCookie)
	body, _ := io.ReadAll(res.Body)
	u, _ := url.Parse(l.URL)
	if res.StatusCode != 200 || !strings.Contains(string(body), l.LinkID) || !strings.Contains(string(body), `"owner_id":"42"`) || strings.Contains(string(body), strings.Trim(u.Path, "/")) || strings.Contains(string(body), u.Host) {
		t.Fatalf("admin list: %d %s", res.StatusCode, body)
	}
	if res := d.do("POST", "host.test", adminViewLinksRevoke, `{"link_id":"`+l.LinkID+`"}`, appCookie); res.StatusCode != 403 {
		t.Fatalf("admin revoke without CSRF: %d", res.StatusCode)
	}
	if res := d.do("POST", "host.test", adminViewLinksRevoke, `{"link_id":"`+l.LinkID+`"}`, appWrite); res.StatusCode != 204 {
		t.Fatalf("admin revoke: %d", res.StatusCode)
	}
	if res := d.open(l.URL, "site/app.js"); res.StatusCode != 404 {
		t.Fatalf("link after admin revoke: %d", res.StatusCode)
	}
}

func TestViewLinkBudgetsAndCaps(t *testing.T) {
	d := newLinkDesk(t)
	l := d.createLink(viewTestA, 7)
	d.a.mu.Lock()
	d.a.viewLinkTraffic.day = d.a.now().UTC().Format(time.DateOnly)
	d.a.viewLinkTraffic.bytes = map[string]int64{l.LinkID: viewLinkDailyPerLink}
	d.a.mu.Unlock()
	if res := d.open(l.URL, "site/app.js"); res.StatusCode != 429 {
		t.Fatalf("over the daily budget: %d", res.StatusCode)
	}
	// A new day starts a new budget.
	*d.now = d.now.Add(24 * time.Hour)
	if res := d.open(l.URL, "site/app.js"); res.StatusCode != 200 {
		t.Fatalf("next day: %d", res.StatusCode)
	}
	d.a.mu.Lock()
	d.a.viewLinkTraffic.relays = map[string]int{l.LinkID: viewLinkRelaysPerLink}
	d.a.mu.Unlock()
	if res := d.open(l.URL, "site/app.js"); res.StatusCode != 429 {
		t.Fatalf("over the concurrent relays: %d", res.StatusCode)
	}
	d.a.mu.Lock()
	d.a.viewLinkTraffic.relays = nil
	d.a.mu.Unlock()
	for i := 1; i < viewLinksPerPerson; i++ {
		d.createLink(viewTestA, 1)
	}
	if res := d.do("POST", "host.test", viewLinksPath, `{"view_id":"`+viewTestA+`","days":1}`, appWrite); res.StatusCode != 429 {
		t.Fatalf("over the per-person cap: %d", res.StatusCode)
	}
}

func TestViewLinkStoreRoundTripAndDiscard(t *testing.T) {
	dir := t.TempDir()
	now := time.Now()
	owner := Identity{"github", "42", 1001, "alice", "/run/open-habitat/users/alice/daemon.sock"}
	a := &Auth{cfg: OAuthConfig{Origin: "https://host.test", ViewOrigin: "https://oh-view-*.test", ViewLinkMaxDays: 30}, sessionFile: filepath.Join(dir, "sessions.json"), now: func() time.Time { return now }, log: CallbackLogger(io.Discard)}
	a.loadViewLinks()
	live := viewLink{ID: "l" + strings.Repeat("a", 26), Token: strings.Repeat("A", 43), Owner: owner, ViewID: viewTestA, Title: "Kassavirta", Created: now, Expires: now.Add(time.Hour)}
	old := live
	old.ID, old.Expires = "l"+strings.Repeat("b", 26), now.Add(time.Minute)
	a.mu.Lock()
	err := a.changeViewLinks(func(next map[string]viewLink) { next[live.ID], next[old.ID] = live, old })
	a.mu.Unlock()
	if err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(filepath.Join(dir, viewLinkStoreName))
	if err != nil || info.Mode().Perm() != 0600 {
		t.Fatalf("store file: %v %v", err, info)
	}
	now = now.Add(2 * time.Minute)
	b := &Auth{cfg: a.cfg, sessionFile: a.sessionFile, now: a.now, log: a.log}
	b.loadViewLinks()
	if got := b.viewLinks[live.ID]; len(b.viewLinks) != 1 || got.Token != live.Token || got.Owner != owner || !got.Expires.Equal(live.Expires) || b.viewLinkHosts[b.viewLinkHost(live.ID)] != live.ID {
		t.Fatalf("reloaded store: %+v", b.viewLinks)
	}
	// A loosened store stops every link, at once and after a restart.
	if err := os.Chmod(filepath.Join(dir, viewLinkStoreName), 0644); err != nil {
		t.Fatal(err)
	}
	b.mu.Lock()
	healthy := b.viewLinkStoreHealthy()
	b.mu.Unlock()
	c := &Auth{cfg: a.cfg, sessionFile: a.sessionFile, now: a.now, log: a.log}
	c.loadViewLinks()
	if healthy || len(c.viewLinks) != 0 {
		t.Fatalf("loosened store: healthy %v, %d links", healthy, len(c.viewLinks))
	}
	// A record naming a route the broker would never give is refused whole.
	bad := live
	bad.Owner.Socket = "/tmp/elsewhere.sock"
	if validViewLink(bad) {
		t.Fatal("record with a foreign socket accepted")
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

func TestViewLinkCommitChecksAndCapacity(t *testing.T) {
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
	// A site full of expired links still accepts a new one.
	full := map[string]viewLink{}
	for i := 0; i < viewLinksMax; i++ {
		id, _ := d.a.newViewLinkID()
		full[id] = viewLink{ID: id, Owner: Identity{Provider: "github", Subject: "43"}, Expires: d.a.now().Add(-time.Minute)}
	}
	d.a.publishViewLinks(full)
	d.a.mu.Unlock()
	if !live || stale {
		t.Fatalf("commit check: live %v, expired accepted %v", live, stale)
	}
	d.createLink(viewTestA, 1)
}
