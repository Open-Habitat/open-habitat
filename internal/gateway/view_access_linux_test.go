//go:build linux

package gateway

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestAccessPinExemptsOnlyPublicViewReads(t *testing.T) {
	d := newLinkDesk(t)
	public := d.publish(d.ensure(viewTestA).AddressID, 7)
	private := d.ensure(viewTestB)
	ownerCookie := d.openView(viewTestA)
	grant := d.mintView(viewTestA)
	d.drain()
	d.a.access = &accessVerifier{} // Missing assertions must never invoke verification.
	h := NewWithAuth("", d.a)
	content, _ := url.Parse(public.ContentURL)
	request := func(method, target string, edit func(*http.Request)) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(method, target, nil)
		if edit != nil {
			edit(r)
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	for _, method := range []string{"GET", "HEAD"} {
		w := request(method, public.URL+"?fbclid=x", nil)
		if w.Code != 302 || w.Header().Get("Location") != public.ContentURL || w.Header().Get("Referrer-Policy") != "no-referrer" {
			t.Fatalf("entry %s: %d %v", method, w.Code, w.Header())
		}
		w = request(method, public.ContentURL+"site/app.js", nil)
		if w.Code != 200 || w.Header().Get("Set-Cookie") != "" {
			t.Fatalf("content %s: %d", method, w.Code)
		}
		assertViewCSP(t, w.Result(), method)
		if method == "GET" && w.Body.String() != "1" {
			t.Fatal(w.Body.String())
		}
	}
	d.drain()
	targets := []string{
		private.URL, private.ContentURL + "secret/index.html",
		"https://host.test/n/" + strings.Repeat("A", 43),
		"https://host.test/", "https://host.test/view?id=" + viewTestA,
		"https://host.test/api/v1/views", "https://host.test/auth/session", "https://host.test/auth/github/start",
		"https://host.test/auth/view", "https://host.test/api/v1/view-addresses/open",
		public.URL + "/extra", "https://host.test/x/../" + strings.TrimPrefix(entryPath(public), "/"),
		"https://" + content.Host + "/robots.txt", "https://" + content.Host + "/api/v1/views",
		"https://" + content.Host + "/" + strings.Repeat("A", 43) + "/site/app.js",
		"https://" + d.host(viewTestA) + "/site/app.js", grant.String(),
	}
	for _, target := range targets {
		for _, method := range []string{"GET", "HEAD"} {
			for _, edit := range []func(*http.Request){nil, appCookie, withCookie(ownerCookie)} {
				w := request(method, target, edit)
				if w.Code != 403 || w.Header().Get("Location") != "" || w.Header().Get("Set-Cookie") != "" {
					t.Fatalf("protected %s %s: %d", method, target, w.Code)
				}
			}
		}
	}
	for _, target := range []string{public.URL, public.ContentURL + "site/app.js"} {
		for _, method := range []string{"POST", "PUT", "DELETE", "OPTIONS"} {
			if w := request(method, target, nil); w.Code != 403 {
				t.Fatalf("write %s: %d", method, w.Code)
			}
		}
		for _, edit := range []func(*http.Request){
			func(r *http.Request) { r.TLS = nil },
			func(r *http.Request) { r.Header.Set("Upgrade", "websocket") },
			func(r *http.Request) { r.Body = io.NopCloser(strings.NewReader("x")); r.ContentLength = 1 },
			func(r *http.Request) { r.TransferEncoding = []string{"chunked"} },
		} {
			if w := request("GET", target, edit); w.Code != 403 {
				t.Fatalf("non-read: %d", w.Code)
			}
		}
	}
	if d.drain() != 0 {
		t.Fatal("protected request reached daemon")
	}
	// Valid bearer paths cannot escape their frozen export, even with cookies.
	for _, rest := range []string{"../" + viewTestB + "/secret/index.html", "%2e%2e/secret/index.html", "_open-habitat/handoff", ".env"} {
		w := request("GET", public.ContentURL+rest, withCookie(ownerCookie))
		if w.Code != 404 {
			t.Fatalf("escape %s: %d", rest, w.Code)
		}
	}
	d.drain()
	// End every form of publication; both addresses immediately lose exemption.
	for _, state := range []string{"private", "expired", "disabled", "denied", "fault", "deleted"} {
		t.Run(state, func(t *testing.T) {
			d.a.mu.Lock()
			old := d.a.viewAddresses[public.AddressID]
			v := old
			switch state {
			case "private":
				v.PublicUntil = time.Time{}
			case "expired":
				v.PublicUntil = d.a.now().Add(-time.Second)
			case "disabled":
				d.a.cfg.ViewLinkMaxDays = 0
			case "denied":
				d.a.settings.Denied = []string{"42"}
			case "fault":
				d.a.viewAddressFault = "test"
			}
			d.a.viewAddresses[public.AddressID] = v
			if state == "deleted" {
				delete(d.a.viewAddresses, public.AddressID)
			}
			d.a.mu.Unlock()
			for _, target := range []string{public.URL, public.ContentURL + "site/app.js"} {
				if w := request("GET", target, nil); w.Code != 403 {
					t.Fatalf("%s: %d", state, w.Code)
				}
			}
			d.a.mu.Lock()
			d.a.viewAddresses[public.AddressID] = old
			d.a.cfg.ViewLinkMaxDays = 90
			d.a.settings.Denied = nil
			d.a.viewAddressFault = ""
			d.a.mu.Unlock()
		})
	}
	if d.drain() != 0 {
		t.Fatal("unpublished address reached daemon")
	}
}
