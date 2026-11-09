//go:build linux

package gateway

import (
	"context"
	"io"
	"net/http"
	"strconv"
	"strings"
	"testing"
)

const offerTestA = "faaaaaaaaaaaaaaaaaaaaaaaaaa"

// newOfferDesk is a signed-in app with a daemon stand-in for the offer read
// routes that records every request reaching it and tries to decide the
// presentation itself.
func newOfferDesk(t *testing.T) (*editorDesk, chan *http.Request) {
	t.Helper()
	seen := make(chan *http.Request, 64)
	files := map[string]string{
		"/api/v1/file-offers/" + offerTestA + "/thumbnail/kaavio.png":    "jpeg-thumb",
		"/api/v1/file-offers/" + offerTestA + "/files/kaavio.png":        "png-bytes",
		"/api/v1/file-offers/" + offerTestA + "/files/logo.svg":          "<svg><script>alert(1)</script></svg>",
		"/api/v1/file-offers/" + offerTestA + "/files/raportti.html":     "<script>alert(1)</script>",
		"/api/v1/file-offers/" + offerTestA + "/files/kuvat/nauvo ä.jpg": "jpg",
		"/api/v1/file-offers/" + offerTestA + "/files/a;b=c'.png":        "x",
		"/api/v1/file-offers/" + offerTestA + "/zip":                     "PK-zip",
		"/api/v1/file-offers/" + offerTestA:                              `{"schema_version":1}`,
		"/api/v1/file-offers":                                            `{"schema_version":1,"offers":[]}`,
	}
	daemon := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen <- r.Clone(context.Background())
		body, ok := files[r.URL.Path]
		if !ok {
			w.WriteHeader(404)
			io.WriteString(w, `{"schema_version":1,"error":{"code":"file_not_found"}}`)
			return
		}
		// A daemon header must never decide how the app origin presents bytes.
		w.Header().Set("Content-Type", "text/html")
		w.Header().Set("Content-Disposition", "inline")
		w.Header().Set("Set-Cookie", "x=1")
		if strings.HasSuffix(r.URL.Path, ".png") && r.Header.Get("Range") == "bytes=0-2" {
			w.Header().Set("Content-Range", "bytes 0-2/9")
			w.Header().Set("Content-Length", "3")
			w.WriteHeader(206)
			io.WriteString(w, body[:3])
			return
		}
		w.Header().Set("Content-Length", strconv.Itoa(len(body)))
		io.WriteString(w, body)
	})
	return newEditorDesk(t, daemon), seen
}

func TestFileOfferBytesArePresentedByTheGateway(t *testing.T) {
	d, seen := newOfferDesk(t)
	base := "/api/v1/file-offers/" + offerTestA
	assertSafe := func(res *http.Response, what string) {
		t.Helper()
		csp := res.Header.Get("Content-Security-Policy")
		if !strings.HasPrefix(csp, "sandbox;") || strings.Contains(csp, "allow-") || !strings.Contains(csp, "default-src 'none'") || res.Header.Get("X-Content-Type-Options") != "nosniff" || res.Header.Get("Cache-Control") != "no-store" || res.Header.Get("Set-Cookie") != "" {
			t.Fatalf("%s: unsafe headers %v", what, res.Header)
		}
	}
	for _, tc := range []struct{ path, typ, disposition string }{
		// Only the app's own media elements get a type, and only inline.
		{base + "/inline/kaavio.png", "image/png", "inline"},
		{base + "/thumbnail/kaavio.png", "image/jpeg", "inline"},
		{base + "/inline/logo.svg", "image/svg+xml", "inline"},
		// Anything else is opaque octets as a named attachment.
		{base + "/inline/raportti.html", "application/octet-stream", `attachment; filename="raportti.html"; filename*=UTF-8''raportti.html`},
		{base + "/download/kaavio.png", "application/octet-stream", `attachment; filename="kaavio.png"; filename*=UTF-8''kaavio.png`},
		{base + "/download/kuvat/nauvo%20%C3%A4.jpg", "application/octet-stream", `attachment; filename="nauvo _.jpg"; filename*=UTF-8''nauvo%20%C3%A4.jpg`},
		{base + "/zip", "application/zip", "attachment"},
		// A separator inside a name cannot end the parameter.
		{base + "/download/a;b=c%27.png", "application/octet-stream", `attachment; filename="a_b=c'.png"; filename*=UTF-8''a%3Bb%3Dc%27.png`},
	} {
		res := d.do("GET", "host.test", tc.path, "", appCookie)
		assertSafe(res, tc.path)
		if res.StatusCode != 200 || res.Header.Get("Content-Type") != tc.typ || res.Header.Get("Content-Disposition") != tc.disposition {
			t.Fatalf("%s: %d %v", tc.path, res.StatusCode, res.Header)
		}
	}
	// A byte range crosses for media seeking, and only the range does.
	res := d.do("GET", "host.test", base+"/inline/kaavio.png", "", func(r *http.Request) {
		appCookie(r)
		r.Header.Set("Range", "bytes=0-2")
		r.Header.Set("Authorization", "Bearer x")
	})
	if body, _ := io.ReadAll(res.Body); res.StatusCode != 206 || string(body) != "png" || res.Header.Get("Content-Range") != "bytes 0-2/9" {
		t.Fatalf("range: %d %q %v", res.StatusCode, body, res.Header)
	}
	// Several ranges would come back multipart: the whole file is sent instead.
	res = d.do("GET", "host.test", base+"/inline/kaavio.png", "", func(r *http.Request) {
		appCookie(r)
		r.Header.Set("Range", "bytes=0-2,4-5")
	})
	if res.StatusCode != 200 || res.Header.Get("Content-Range") != "" {
		t.Fatalf("multi-range: %d %v", res.StatusCode, res.Header)
	}
	for len(seen) > 0 {
		got := <-seen
		if got.Header.Get("Range") == "bytes=0-2,4-5" {
			t.Fatal("multi-range reached the daemon")
		}
		if got.Header.Get("Cookie") != "" || got.Header.Get("Authorization") != "" || got.URL.RawQuery != "" {
			t.Fatalf("daemon saw %s %v", got.URL, got.Header)
		}
	}
	// Without the app session nothing reaches the daemon.
	for _, edit := range []func(*http.Request){nil, withCookie(&http.Cookie{Name: editorCookie, Value: "browser"})} {
		if res := d.do("GET", "host.test", base+"/download/kaavio.png", "", edit); res.StatusCode != 401 {
			t.Fatalf("without session: %d", res.StatusCode)
		}
	}
	if res := d.do("GET", editorTestHost, base+"/download/kaavio.png", "", appCookie); res.StatusCode < 400 {
		t.Fatalf("on the editor host: %d", res.StatusCode)
	}
	if n := len(seen); n != 0 {
		t.Fatalf("%d unauthorized requests reached the daemon", n)
	}
	// Traversal, encoded separators, hidden names, writes and unknown modes
	// never leave the gateway.
	for _, tc := range []struct{ method, path string }{
		{"GET", base + "/download/kuvat%2Fnauvo.jpg"},
		{"GET", base + "/download/.env"},
		{"GET", base + "/download/kuvat//x.png"},
		{"GET", base + "/files/kaavio.png"},
		{"GET", base + "/inline/"},
		{"GET", "/api/v1/file-offers/fzz/zip"},
		{"POST", base + "/zip"},
		{"GET", base + "/zip?x=1"},
	} {
		if res := d.do(tc.method, "host.test", tc.path, "", appWrite); res.StatusCode < 400 {
			t.Fatalf("%s %s: %d", tc.method, tc.path, res.StatusCode)
		}
	}
	for len(seen) > 0 {
		if got := <-seen; got.URL.Path != base && !strings.HasPrefix(got.URL.Path, base+"/") {
			t.Fatalf("daemon was asked for %q", got.URL.Path)
		}
	}
	// A daemon 404 is the browser's removed offer.
	if res := d.do("GET", "host.test", base+"/download/missing.png", "", appCookie); res.StatusCode != 404 {
		t.Fatalf("missing: %d", res.StatusCode)
	}
	// The list and one offer's facts are ordinary JSON reads; only the list
	// takes its one query.
	if res := d.do("GET", "host.test", base+"?conversation_id=pi:11111111-1111-4111-8111-111111111111", "", appCookie); res.StatusCode != 400 {
		t.Fatalf("query on an offer: %d", res.StatusCode)
	}
	for _, path := range []string{"/api/v1/file-offers", "/api/v1/file-offers?conversation_id=pi:11111111-1111-4111-8111-111111111111", base} {
		if res := d.do("GET", "host.test", path, "", appCookie); res.StatusCode != 200 {
			t.Fatalf("%s: %d", path, res.StatusCode)
		}
	}
}

func TestViewZipIsAnAttachmentForTheOwner(t *testing.T) {
	const viewID = "vaaaaaaaaaaaaaaaaaaaaaaaaaa"
	seen := make(chan *http.Request, 16)
	daemon := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen <- r.Clone(context.Background())
		if r.URL.Path != "/api/v1/views/"+viewID+"/zip" {
			w.WriteHeader(404)
			return
		}
		// The daemon's headers never decide how the app origin presents it.
		w.Header().Set("Content-Type", "text/html")
		w.Header().Set("Content-Disposition", "inline")
		io.WriteString(w, "PK-zip")
	})
	d := newEditorDesk(t, daemon)
	path := "/api/v1/views/" + viewID + "/zip"
	// Without a view origin the installation offers no views at all.
	if res := d.do("GET", "host.test", path, "", appCookie); res.StatusCode != 404 {
		t.Fatalf("without views: %d", res.StatusCode)
	}
	d.a.cfg.ViewOrigin = "https://oh-view-*.test"
	res := d.do("GET", "host.test", path, "", appCookie)
	body, _ := io.ReadAll(res.Body)
	if res.StatusCode != 200 || string(body) != "PK-zip" || res.Header.Get("Content-Type") != "application/zip" || res.Header.Get("Content-Disposition") != "attachment" || !strings.HasPrefix(res.Header.Get("Content-Security-Policy"), "sandbox;") || res.Header.Get("X-Content-Type-Options") != "nosniff" {
		t.Fatalf("zip: %d %q %v", res.StatusCode, body, res.Header)
	}
	if res := d.do("GET", "host.test", path, "", nil); res.StatusCode != 401 {
		t.Fatalf("without session: %d", res.StatusCode)
	}
	for _, tc := range []struct{ method, path string }{
		{"POST", path},
		{"GET", path + "?x=1"},
		{"GET", "/api/v1/views/vzz/zip"},
		{"GET", "/api/v1/views/" + viewID},
		{"GET", "/api/v1/views/" + viewID + "/zip/x"},
		{"GET", "/api/v1/views/" + viewID + "%2Fzip"},
	} {
		if res := d.do(tc.method, "host.test", tc.path, "", appWrite); res.StatusCode < 400 {
			t.Fatalf("%s %s: %d", tc.method, tc.path, res.StatusCode)
		}
	}
	got := 0
	for len(seen) > 0 {
		if r := <-seen; r.URL.Path != "/api/v1/views/"+viewID+"/zip" {
			t.Fatalf("daemon was asked for %q", r.URL.Path)
		}
		got++
	}
	if got != 1 {
		t.Fatalf("daemon reads: %d", got)
	}
}

func TestViewListForwardsOnlyItsPageAndConversation(t *testing.T) {
	seen := make(chan *http.Request, 16)
	daemon := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen <- r.Clone(context.Background())
		w.Header().Set("Content-Type", "application/json")
		io.WriteString(w, `{"schema_version":1,"views":[]}`)
	})
	d := newEditorDesk(t, daemon)
	d.a.cfg.ViewOrigin = "https://oh-view-*.test"
	const conversation = "conversation_id=pi:11111111-1111-4111-8111-111111111111"
	const cursor = "cursor=2026-11-09T10:00:00Z_vaaaaaaaaaaaaaaaaaaaaaaaaaa"
	for _, query := range []string{"", "?" + conversation, "?" + cursor, "?" + conversation + "&" + cursor} {
		if res := d.do("GET", "host.test", "/api/v1/views"+query, "", appCookie); res.StatusCode != 200 {
			t.Fatalf("%q: %d", query, res.StatusCode)
		}
		if r := <-seen; r.URL.RequestURI() != "/api/v1/views"+query {
			t.Fatalf("%q reached the daemon as %q", query, r.URL.RequestURI())
		}
	}
	// Anything else is refused before the daemon is asked.
	for _, query := range []string{"?x=1", "?" + conversation + "&x=1", "?" + cursor + "&" + cursor, "?cursor="} {
		if res := d.do("GET", "host.test", "/api/v1/views"+query, "", appCookie); res.StatusCode != 400 {
			t.Fatalf("%q: %d", query, res.StatusCode)
		}
	}
	if len(seen) != 0 {
		t.Fatalf("a refused list reached the daemon")
	}
}
