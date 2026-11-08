//go:build linux

package gateway

import (
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

const (
	pubOfferA = "faaaaaaaaaaaaaaaaaaaaaaaaaa"
	pubOfferB = "fbbbbbbbbbbbbbbbbbbbbbbbbbb"
)

// newOfferLinkDesk is a link desk whose daemon also has two file offers: a
// folder (A) and a one-file table (B).
func newOfferLinkDesk(t *testing.T) *viewDesk {
	t.Helper()
	d := newLinkDesk(t)
	d.mu.Lock()
	for k, v := range map[string]string{
		"/api/v1/file-offers/" + pubOfferA:                             `{"schema_version":1,"offer":{"offer_id":"` + pubOfferA + `","title":"Kuvat <b>&</b>","folder":"kuvat","files":3,"bytes":12,"created_at":"2026-11-08T10:00:00Z","conversation_id":"pi:00000000-0000-4000-8000-000000000001"},"items":[{"path":"kuvat/a b.png","bytes":3,"kind":"image"},{"path":"kuvat/huomio.pdf","bytes":4,"kind":"pdf"},{"path":"kuvat/<i>.txt","bytes":5,"kind":"text"}]}`,
		"/api/v1/file-offers/" + pubOfferA + "/files/kuvat/a b.png":    "png",
		"/api/v1/file-offers/" + pubOfferA + "/files/kuvat/huomio.pdf": "%PDF",
		"/api/v1/file-offers/" + pubOfferA + "/files/kuvat/<i>.txt":    "hello",
		"/api/v1/file-offers/" + pubOfferA + "/zip":                    "PK-zip",
		"/api/v1/file-offers/" + pubOfferB:                             `{"schema_version":1,"offer":{"offer_id":"` + pubOfferB + `","title":"Taulu","files":1,"bytes":29,"created_at":"2026-11-08T10:00:00Z","conversation_id":"pi:00000000-0000-4000-8000-000000000001"},"items":[{"path":"taulu.csv","bytes":29,"kind":"csv"}]}`,
		"/api/v1/file-offers/" + pubOfferB + "/files/taulu.csv":        "nimi;arvo\n<script>;1\nb;\"2;3\"\n",
	} {
		d.files[k] = v
	}
	d.mu.Unlock()
	return d
}

func (d *viewDesk) ensureOffer(offerID string) addressReply {
	d.t.Helper()
	return d.addressCall(viewAddressesPath, `{"offer_id":"`+offerID+`"}`, 200)
}

func readBody(res *http.Response) string {
	b, _ := io.ReadAll(res.Body)
	return string(b)
}

func TestOfferAddressAnonymousReadOfOneOffer(t *testing.T) {
	d := newOfferLinkDesk(t)
	a := d.ensureOffer(pubOfferA)
	if a.Title != "Kuvat <b>&</b>" || a.ViewID != "" || a.State != "private" {
		t.Fatalf("offer reservation %+v", a)
	}
	// Private: nothing is read, though the content URL is known.
	if res := d.open(a.ContentURL, ""); res.StatusCode != 404 {
		t.Fatalf("private offer page: %d", res.StatusCode)
	}
	d.drain()
	l := d.publish(a.AddressID, 7)
	u, _ := url.Parse(l.ContentURL)
	token := strings.Trim(u.Path, "/")
	// The page is the gateway's own: the title and names as text, the
	// image shown, every file and the whole offer downloadable, nothing
	// about the conversation, and no script.
	res := d.open(l.ContentURL, "")
	body := readBody(res)
	csp := res.Header.Get("Content-Security-Policy")
	if res.StatusCode != 200 || res.Header.Get("Content-Type") != "text/html; charset=utf-8" || !strings.HasPrefix(csp, "sandbox allow-downloads;") || strings.Contains(csp, "allow-scripts") || strings.Contains(csp, "allow-same-origin") || !strings.Contains(csp, "img-src https://"+u.Host+";") || !strings.Contains(csp, "frame-ancestors 'none'") || res.Header.Get("X-Robots-Tag") != "noindex, nofollow, noarchive" || res.Header.Get("Set-Cookie") != "" || res.Header.Get("Cache-Control") != "no-store" || res.Header.Get("Referrer-Policy") != "no-referrer" {
		t.Fatalf("offer page: %d %v", res.StatusCode, res.Header)
	}
	for _, want := range []string{"Kuvat &lt;b&gt;&amp;&lt;/b&gt;", `<img src="f/kuvat/a%20b.png"`, `href="d/kuvat/huomio.pdf"`, `href="d/kuvat/%3Ci%3E.txt"`, "kuvat/&lt;i&gt;.txt", `href="zip"`, "kuvat/ · 3 files"} {
		if !strings.Contains(body, want) {
			t.Fatalf("offer page lacks %q:\n%s", want, body)
		}
	}
	for _, never := range []string{"<script", "<b>", "<i>", "pi:0000", "conversation"} {
		if strings.Contains(body, never) {
			t.Fatalf("offer page has %q:\n%s", never, body)
		}
	}
	// A Finnish browser reads the page in Finnish.
	fi := d.do("GET", u.Host, u.Path, "", func(r *http.Request) { r.Header.Set("Accept-Language", "fi-FI,fi;q=0.9") })
	if b := readBody(fi); !strings.Contains(b, "Lataa kaikki (.zip)") || fi.Header.Get("Content-Language") != "fi" {
		t.Fatalf("Finnish page: %s", b)
	}
	// Images are shown by type; everything else is a download, as is every
	// d/ read and the zip, which is named after the folder.
	res = d.open(l.ContentURL, "f/kuvat/a%20b.png")
	if b := readBody(res); res.StatusCode != 200 || b != "png" || res.Header.Get("Content-Type") != "image/png" || res.Header.Get("Content-Disposition") != "inline" || res.Header.Get("Set-Cookie") != "" || !strings.HasPrefix(res.Header.Get("Content-Security-Policy"), "sandbox;") || res.Header.Get("Cross-Origin-Resource-Policy") != "" {
		t.Fatalf("inline image: %d %q %v", res.StatusCode, b, res.Header)
	}
	res = d.open(l.ContentURL, "f/kuvat/huomio.pdf")
	if readBody(res); res.Header.Get("Content-Type") != "application/octet-stream" || !strings.HasPrefix(res.Header.Get("Content-Disposition"), `attachment; filename="huomio.pdf"`) {
		t.Fatalf("a pdf is a download: %v", res.Header)
	}
	res = d.open(l.ContentURL, "d/kuvat/a%20b.png")
	if readBody(res); res.Header.Get("Content-Type") != "application/octet-stream" || !strings.HasPrefix(res.Header.Get("Content-Disposition"), "attachment;") {
		t.Fatalf("download: %v", res.Header)
	}
	res = d.open(l.ContentURL, "zip")
	if b := readBody(res); res.StatusCode != 200 || b != "PK-zip" || res.Header.Get("Content-Type") != "application/zip" || !strings.HasPrefix(res.Header.Get("Content-Disposition"), `attachment; filename="kuvat.zip"`) {
		t.Fatalf("zip: %d %q %v", res.StatusCode, b, res.Header)
	}
	d.drain()
	// Nothing outside the one offer: traversal, another offer, a view's
	// export, an encoded separator, a hidden name, an unknown route.
	for _, rest := range []string{"f/../" + pubOfferB + "/files/taulu.csv", "f/%2e%2e/" + pubOfferB + "/files/taulu.csv", "d/kuvat%2Fa%20b.png", "f/.env", "files/kuvat/a%20b.png", "f/", "x", "../" + pubOfferB + "/zip", "f/kuvat/puuttuu.png"} {
		res := d.open(l.ContentURL, rest)
		if res.StatusCode != 404 || res.Header.Get("Set-Cookie") != "" {
			t.Fatalf("%s: %d", rest, res.StatusCode)
		}
	}
	for {
		select {
		case r := <-d.seen:
			if !strings.HasPrefix(r.URL.Path, fileOffersPath+"/"+pubOfferA) || strings.Contains(r.URL.Path, "..") || r.Header.Get("Cookie") != "" {
				t.Fatalf("daemon was asked for %q", r.URL.Path)
			}
			continue
		default:
		}
		break
	}
	// Writes and the token on another host reach nothing.
	if res := d.do("POST", u.Host, "/"+token+"/zip", "", nil); res.StatusCode != 405 {
		t.Fatalf("write on an offer's content host: %d", res.StatusCode)
	}
	if res := d.do("GET", d.host(viewTestA), "/"+token+"/zip", "", nil); res.StatusCode != 404 || d.drain() != 0 {
		t.Fatalf("token on a view host: %d", res.StatusCode)
	}
}

func TestOfferAddressTablePreviewAndLifecycle(t *testing.T) {
	d := newOfferLinkDesk(t)
	l := d.publish(d.ensureOffer(pubOfferB).AddressID, 1)
	res := d.open(l.ContentURL, "")
	body := readBody(res)
	if res.StatusCode != 200 || !strings.Contains(body, "<td>nimi</td><td>arvo</td>") || !strings.Contains(body, "<td>&lt;script&gt;</td><td>1</td>") || !strings.Contains(body, "<td>2;3</td>") || strings.Contains(body, `href="zip"`) || strings.Contains(body, "beginning") {
		t.Fatalf("table page: %d\n%s", res.StatusCode, body)
	}
	// The entry address goes to the content host while public.
	entry, _ := url.Parse(l.URL)
	if res := d.do("GET", "host.test", entry.Path, "", nil); res.StatusCode != 302 || res.Header.Get("Location") != l.ContentURL {
		t.Fatalf("public entry: %d %q", res.StatusCode, res.Header.Get("Location"))
	}
	// Expiry ends anonymous reads; republishing revives the same address.
	*d.now = d.now.Add(25 * time.Hour)
	if res := d.open(l.ContentURL, "d/taulu.csv"); res.StatusCode != 404 {
		t.Fatalf("expired offer: %d", res.StatusCode)
	}
	if p := d.publish(l.AddressID, 1); p.ContentURL != l.ContentURL || p.URL != l.URL {
		t.Fatalf("republished %+v", p)
	}
	if res := d.open(l.ContentURL, "d/taulu.csv"); res.StatusCode != 200 {
		t.Fatalf("republished offer: %d", res.StatusCode)
	}
	// Making private and deleting end it.
	d.addressCall(viewAddressPrivatePath, `{"address_id":"`+l.AddressID+`"}`, 200)
	if res := d.open(l.ContentURL, ""); res.StatusCode != 404 {
		t.Fatalf("private again: %d", res.StatusCode)
	}
	d.publish(l.AddressID, 1)
	d.addressCall(viewAddressDeletePath, `{"address_id":"`+l.AddressID+`"}`, 204)
	if res := d.open(l.ContentURL, ""); res.StatusCode != 404 {
		t.Fatalf("deleted: %d", res.StatusCode)
	}
	// An offer the agent removed reads as gone, and cannot be published.
	n := d.publish(d.ensureOffer(pubOfferB).AddressID, 1)
	if n.ContentURL == l.ContentURL {
		t.Fatal("a deleted address came back")
	}
	d.mu.Lock()
	delete(d.files, "/api/v1/file-offers/"+pubOfferB)
	d.mu.Unlock()
	res = d.open(n.ContentURL, "")
	if b := readBody(res); res.StatusCode != 404 || !strings.Contains(b, "no longer available") {
		t.Fatalf("removed offer: %d %q", res.StatusCode, b)
	}
	d.addressCall(viewAddressPublishPath, `{"address_id":"`+n.AddressID+`","days":1}`, 404)
	d.addressCall(viewAddressesPath, `{"offer_id":"`+pubOfferB+`"}`, 200)
}

func TestOfferAddressRequestsAndBudget(t *testing.T) {
	d := newOfferLinkDesk(t)
	for _, body := range []string{`{"view_id":"` + viewTestA + `","offer_id":"` + pubOfferA + `"}`, `{}`, `{"offer_id":"` + viewTestA + `"}`, `{"view_id":"` + pubOfferA + `"}`, `{"offer_id":"fA"}`} {
		d.addressCall(viewAddressesPath, body, 400)
	}
	d.addressCall(viewAddressesPath, `{"offer_id":"fcccccccccccccccccccccccccc"}`, 404)
	// A view and an offer each get their own address; the list holds both.
	v, o := d.ensure(viewTestA), d.ensureOffer(pubOfferA)
	if v.AddressID == o.AddressID || v.URL == o.URL {
		t.Fatal("a view and an offer share an address")
	}
	if again := d.ensureOffer(pubOfferA); again != o {
		t.Fatalf("second ensure %+v", again)
	}
	list := readBody(d.do("GET", "host.test", viewAddressesPath, "", appCookie))
	if !strings.Contains(list, `"offer_id":"`+pubOfferA+`"`) || !strings.Contains(list, `"view_id":"`+viewTestA+`"`) {
		t.Fatalf("list: %s", list)
	}
	// The owner's tab learns it is an offer.
	entry := strings.TrimPrefix(entryPath(o), viewEntryPrefix)
	if open := readBody(d.do("POST", "host.test", viewAddressOpenPath, `{"entry":"`+entry+`"}`, appWrite)); !strings.Contains(open, `"offer_id":"`+pubOfferA+`"`) || strings.Contains(open, `"view_id"`) {
		t.Fatalf("owner's open: %s", open)
	}
	// Bytes come out of the address's day like a view's.
	l := d.publish(o.AddressID, 1)
	d.a.mu.Lock()
	d.a.viewLinkTraffic.day = d.a.now().UTC().Format(time.DateOnly)
	d.a.viewLinkTraffic.bytes = map[string]int64{o.AddressID: viewLinkDailyPerLink - 2}
	d.a.mu.Unlock()
	if res := d.open(l.ContentURL, "d/kuvat/a%20b.png"); res.StatusCode != 429 {
		t.Fatalf("over budget: %d", res.StatusCode)
	}
	if res := d.open(l.ContentURL, "zip"); res.StatusCode != 429 {
		t.Fatalf("zip over budget: %d", res.StatusCode)
	}
	if res := d.open(l.ContentURL, ""); res.StatusCode != 429 {
		t.Fatalf("page over budget: %d", res.StatusCode)
	}
}

func TestOfferAddressStoreRoundTrip(t *testing.T) {
	dir := t.TempDir()
	now := time.Now()
	owner := Identity{"github", "42", 1001, "alice", "/run/open-habitat/users/alice/daemon.sock"}
	a := storeAuth(dir, &now)
	a.loadViewLinks()
	offer := viewAddress{ID: "a" + strings.Repeat("a", 26), Entry: strings.Repeat("E", 43), Token: strings.Repeat("A", 43), Owner: owner, OfferID: pubOfferA, Title: "Kuvat", Created: now}
	view := viewAddress{ID: "a" + strings.Repeat("b", 26), Entry: strings.Repeat("F", 43), Token: strings.Repeat("B", 43), Owner: owner, ViewID: viewTestA, Title: "Näkymä", Created: now}
	a.mu.Lock()
	err := a.changeViewAddresses(func(next map[string]viewAddress) bool {
		next[offer.ID], next[view.ID] = offer, view
		return true
	})
	a.mu.Unlock()
	if err != nil {
		t.Fatal(err)
	}
	b := storeAuth(dir, &now)
	b.loadViewLinks()
	if b.viewAddressFault != "" || b.viewAddresses[offer.ID].OfferID != pubOfferA || b.viewAddresses[offer.ID].ViewID != "" || b.viewAddresses[view.ID].ViewID != viewTestA {
		t.Fatalf("reloaded: %q %+v", b.viewAddressFault, b.viewAddresses)
	}
	// An address naming both, or neither, is not a store.
	for _, bad := range []string{`"view_id":"` + viewTestA + `","offer_id":"` + pubOfferA + `"`, `"offer_id":"` + viewTestA + `"`} {
		data, _ := os.ReadFile(filepath.Join(dir, viewLinkStoreName))
		broken := strings.Replace(string(data), `"offer_id":"`+pubOfferA+`"`, bad, 1)
		if err := os.WriteFile(filepath.Join(dir, viewLinkStoreName), []byte(broken), 0o600); err != nil {
			t.Fatal(err)
		}
		c := storeAuth(dir, &now)
		if c.loadViewLinks(); c.viewAddressFault == "" {
			t.Fatalf("accepted %s", bad)
		}
		if err := os.WriteFile(filepath.Join(dir, viewLinkStoreName), data, 0o600); err != nil {
			t.Fatal(err)
		}
	}
}

func TestOfferAddressZipStopsAtItsCharge(t *testing.T) {
	d := newOfferLinkDesk(t)
	l := d.publish(d.ensureOffer(pubOfferA).AddressID, 1)
	// A daemon zip longer than the offer's items is cut off, never sent
	// whole past what the budget was charged.
	d.mu.Lock()
	d.files["/api/v1/file-offers/"+pubOfferA+"/zip"] = strings.Repeat("x", 200000)
	d.mu.Unlock()
	u, _ := url.Parse(l.ContentURL)
	req, _ := http.NewRequest("GET", d.server.URL+u.Path+"zip", nil)
	req.Host = u.Host
	if res, err := d.server.Client().Do(req); err == nil {
		body, err := io.ReadAll(res.Body)
		res.Body.Close()
		if err == nil || len(body) >= 200000 {
			t.Fatalf("an overlong zip was sent whole: %d bytes, %v", len(body), err)
		}
	}
	d.a.mu.Lock()
	charged := d.a.viewLinkTraffic.bytes[l.AddressID]
	d.a.mu.Unlock()
	if charged == 0 || charged > 2000 {
		t.Fatalf("zip charge %d", charged)
	}
}
