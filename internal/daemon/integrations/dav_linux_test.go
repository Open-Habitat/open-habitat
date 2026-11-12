//go:build linux

package integrations

import (
	"bytes"
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
)

// A real native DAV client, not a stand-in, drives a local authenticated TLS
// endpoint from disposable homes. It exercises the same files an agent uses.
func TestDAVNativeConnectUseRenewRemove(t *testing.T) {
	binary, err := exec.LookPath("curl")
	if err != nil {
		t.Fatal("native curl test prerequisite missing")
	}
	ca, cert := syntheticTLS(t, t.TempDir())
	const secret = `app-"quote\slash:secret`
	var requests atomic.Int32
	var writes atomic.Int32
	srv := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		if r.Header.Get("X-From-Default") != "" {
			w.WriteHeader(400)
			return
		}
		user, password, ok := r.BasicAuth()
		if !ok || user != "person" || password != secret {
			w.WriteHeader(401)
			fmt.Fprint(w, secret)
			return
		}
		if r.Method == "PUT" {
			body, _ := io.ReadAll(r.Body)
			if r.Header.Get("If-None-Match") != "*" || !strings.Contains(string(body), "BEGIN:") {
				w.WriteHeader(412)
				return
			}
			writes.Add(1)
			w.WriteHeader(201)
			return
		}
		if r.Method == "PROPFIND" {
			if r.Header.Get("Depth") != "0" && r.Header.Get("Depth") != "1" {
				w.WriteHeader(400)
				return
			}
			w.WriteHeader(207)
			fmt.Fprint(w, `<d:multistatus xmlns:d="DAV:"><d:response><d:href>/collection/</d:href><d:propstat><d:prop><d:displayname>Synthetic</d:displayname></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`)
			return
		}
		if r.Method == "REPORT" && r.URL.Path == "/collection/" {
			body, _ := io.ReadAll(r.Body)
			if !strings.Contains(string(body), "query") {
				w.WriteHeader(400)
				return
			}
			w.WriteHeader(207)
			fmt.Fprint(w, `<d:multistatus xmlns:d="DAV:"/>`)
			return
		}
		w.Header().Set("ETag", `"synthetic-etag"`)
		fmt.Fprint(w, "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n")
	}))
	srv.TLS = &tls.Config{Certificates: []tls.Certificate{cert}}
	srv.StartTLS()
	defer srv.Close()
	endpoint := strings.Replace(srv.URL, "127.0.0.1", "localhost", 1) + "/dav/"
	extraToolEnv = []string{"CURL_CA_BUNDLE=" + ca}
	defer func() { extraToolEnv = nil }()

	for _, provider := range []Provider{CalDAV, CardDAV} {
		t.Run(string(provider), func(t *testing.T) {
			home := newHome(t)
			if err := os.WriteFile(filepath.Join(home, ".curlrc"), []byte("header = \"X-From-Default: yes\"\nlocation\n"), 0600); err != nil {
				t.Fatal(err)
			}
			var logs bytes.Buffer
			env := Env{Home: home, Config: Config{Tools: map[string]string{"curl": binary}}, FixtureTools: true}
			c := New(env, Production(), slog.New(slog.NewJSONHandler(&logs, nil)))
			h := c.Handler(allow)
			in := map[string]any{"action": "connect", "provider": provider, "address": "person@example.test", "url": endpoint, "username": "person", "password": "wrong"}
			if code, out, _ := call(t, h, "POST", AccountsPath, "", in); code != 422 || errorCode(out) != "credentials_rejected" {
				t.Fatalf("refusal: %d %v", code, out)
			}
			d := &dav{provider}
			if accounts, err := d.Accounts(env); err != nil || len(accounts) != 0 {
				t.Fatalf("refused account persisted: %v %v", accounts, err)
			}
			in["password"] = secret
			if !d.ValidAccount(PasswordAccount{Address: "person@example.test", URL: strings.Replace(endpoint, "localhost", "LOCALHOST", 1), Username: "person", Password: secret}) {
				t.Fatal("uppercase DNS hostname rejected")
			}
			code, _, raw := call(t, h, "POST", AccountsPath, "", in)
			if code != 200 || strings.Contains(raw, secret) {
				t.Fatalf("connect: %d %s", code, raw)
			}
			config := filepath.Join(home, d.dir(), "person@example.test.conf")
			st, err := os.Stat(config)
			if err != nil || st.Mode().Perm() != 0600 {
				t.Fatal("config not private", err)
			}
			skill, err := os.ReadFile(filepath.Join(home, SkillDir, "SKILL.md"))
			if err != nil || !strings.Contains(string(skill), "REPORT") || strings.Contains(string(skill), secret) {
				t.Fatal("agent skill missing or leaks credential")
			}
			// Native config + commands from the skill actually perform discovery,
			// queries and explicit writes. Credentials never appear in argv.
			for _, args := range [][]string{
				{"--request", "PROPFIND", "--header", "Depth: 1"},
				{"--request-target", "/collection/", "--request", "REPORT", "--data-binary", `<calendar-query/>`},
				{"--request-target", "/collection/item", "--request", "GET"},
				{"--request-target", "/collection/new", "--request", "PUT", "--header", "If-None-Match: *", "--data-binary", "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n"},
			} {
				out, err := env.run(t.Context(), Command{Path: binary, Args: append([]string{"--disable", "--config", config, "--silent", "--fail"}, args...)}, nil)
				if err != nil {
					t.Fatalf("native DAV agent call failed: %s %v", out, err)
				}
			}
			old, _ := os.ReadFile(config)
			before := requests.Load()
			if code, out, _ := call(t, h, "POST", AccountsPath, "", in); code != 409 || errorCode(out) != "account_exists" {
				t.Fatalf("duplicate connect: %d %v", code, out)
			}
			if requests.Load() != before {
				t.Fatal("duplicate connect sent credentials again")
			}
			if code, out, _ := call(t, h, "POST", AccountsPath, "", map[string]any{"action": "password", "provider": provider, "address": "person@example.test", "password": "wrong"}); code != 422 || errorCode(out) != "credentials_rejected" {
				t.Fatalf("renewal refusal: %d %v", code, out)
			}
			after, _ := os.ReadFile(config)
			if !bytes.Equal(old, after) {
				t.Fatal("refused password replaced working login")
			}
			if code, _, _ := call(t, h, "POST", AccountsPath, "", map[string]any{"action": "password", "provider": provider, "address": "person@example.test", "password": secret}); code != 200 {
				t.Fatal("renewal failed")
			}
			// Rebuild a catalog rather than relying on in-memory connection state.
			fresh := New(env, Production(), nil)
			if code, out, raw := call(t, fresh.Handler(allow), "GET", ListPath, "", nil); code != 200 || len(out["accounts"].([]any)) != 1 || strings.Contains(raw, secret) {
				t.Fatalf("reconstructed inventory: %d %s", code, raw)
			}
			other := New(Env{Home: newHome(t)}, Production(), nil)
			if accounts, _ := d.Accounts(other.env); len(accounts) != 0 {
				t.Fatal("account reached another home")
			}
			in["address"] = "second@example.test"
			if code, _, _ := call(t, h, "POST", AccountsPath, "", in); code != 200 {
				t.Fatal("second account failed")
			}
			if code, _, _ := call(t, h, "DELETE", AccountsPath, "", map[string]any{"action": "remove", "provider": provider, "address": "person@example.test", "delete_directories": false}); code != 200 {
				t.Fatal("remove failed")
			}
			if _, err := os.Stat(config); !os.IsNotExist(err) {
				t.Fatal("credential remains")
			}
			if accounts, err := d.Accounts(env); err != nil || len(accounts) != 1 || accounts[0] != "second@example.test" {
				t.Fatalf("removal affected other account: %v %v", accounts, err)
			}
			if strings.Contains(logs.String(), secret) || strings.Contains(logs.String(), endpoint) {
				t.Fatal("native credentials or URL logged")
			}
		})
	}
	if writes.Load() != 2 || requests.Load() == 0 {
		t.Fatal("native agent requests did not reach fake DAV")
	}
}

func TestDAVRefusesUnsafeInputsAndSymlinkHome(t *testing.T) {
	d := &dav{CalDAV}
	a := PasswordAccount{Address: "person@example.test", URL: "https://dav.example.test/path/", Username: "person", Password: "secret"}
	for _, u := range []string{"http://dav.example.test/", "https://user:secret@dav.example.test/", "https://dav.example.test/?token=secret", "https://dav.example.test/#fragment", "https://dav.example.test:65536/", "file:///secret", "https://dav.example.test/\noutput=/secret"} {
		bad := a
		bad.URL = u
		if d.ValidAccount(bad) {
			t.Fatalf("accepted unsafe URL %q", u)
		}
	}
	bad := a
	bad.Username = "person\noutput=x"
	if d.ValidAccount(bad) {
		t.Fatal("accepted newline")
	}
	bad = a
	bad.Username = "person:password"
	if d.ValidAccount(bad) {
		t.Fatal("accepted ambiguous Basic username")
	}
	home, outside := newHome(t), newHome(t)
	if err := os.Symlink(outside, filepath.Join(home, ".config")); err != nil {
		t.Fatal(err)
	}
	env := Env{Home: home}
	if err := d.Connect(t.Context(), env, a); err == nil {
		t.Fatal("followed symlink")
	}
	if entries, _ := os.ReadDir(outside); len(entries) != 0 {
		t.Fatal("wrote outside home")
	}
	if _, err := d.Accounts(env); err == nil {
		t.Fatal("unsafe inventory presented as empty")
	}
}

// fakeICloud reproduces iCloud's documented discovery on synthetic names: the
// address a person knows answers PROPFIND with the account's principal (after
// a redirect, for CalDAV), and the principal names an absolute home set on the
// account's partition host. Every hostname resolves to one local TLS server,
// which routes by Host and counts authenticated requests per host.
type fakeICloud struct {
	srv      *httptest.Server
	port     string
	redirect atomic.Bool
	mu       sync.Mutex
	seen     map[string]int
	homeHost string // where the principal says the home set is
	front    string // where the contacts front door redirects
}

func (f *fakeICloud) set(homeHost, front string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.homeHost, f.front = homeHost, front
}

func newFakeICloud(t *testing.T, secret string) (*fakeICloud, string) {
	t.Helper()
	ca, cert := syntheticTLS(t, t.TempDir(), "contacts.icloud.localhost", "caldav.icloud.localhost", "p42-contacts.icloud.localhost", "p42-caldav.icloud.localhost", "p42-contacts.evil.localhost", "elsewhere.localhost", "cloud.nc.localhost")
	f := &fakeICloud{seen: map[string]int{}}
	f.srv = httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host, _, _ := strings.Cut(r.Host, ":")
		user, password, ok := r.BasicAuth()
		f.mu.Lock()
		if ok {
			f.seen[host]++
		}
		homeHost, front := f.homeHost, f.front
		f.mu.Unlock()
		if !ok || user != "person@icloud.test" || password != secret {
			w.WriteHeader(401)
			return
		}
		if r.Method != "PROPFIND" {
			w.WriteHeader(405)
			return
		}
		body, _ := io.ReadAll(r.Body)
		multistatus := func(href, props string) {
			w.WriteHeader(207)
			fmt.Fprintf(w, `<?xml version="1.0" encoding="UTF-8"?><multistatus xmlns="DAV:"><response><href>%s</href><propstat><prop>%s</prop><status>HTTP/1.1 200 OK</status></propstat></response></multistatus>`, href, props)
		}
		kind := "addressbook"
		ns := "urn:ietf:params:xml:ns:carddav"
		if strings.HasPrefix(host, "caldav.") || strings.HasPrefix(host, "p42-caldav.") {
			kind, ns = "calendar", "urn:ietf:params:xml:ns:caldav"
		}
		switch {
		case host == "cloud.nc.localhost":
			// Nextcloud: the site root is no DAV resource; RFC 6764's
			// well-known name redirects to the DAV root on the same host.
			switch r.URL.Path {
			case "/.well-known/carddav":
				http.Redirect(w, r, "/remote.php/dav/", http.StatusMovedPermanently)
			case "/remote.php/dav/":
				multistatus(r.URL.Path, `<current-user-principal><href>/remote.php/dav/principals/users/person/</href></current-user-principal>`)
			case "/remote.php/dav/principals/users/person/":
				multistatus(r.URL.Path, `<C:addressbook-home-set xmlns:C="urn:ietf:params:xml:ns:carddav"><href>/remote.php/dav/addressbooks/users/person/</href></C:addressbook-home-set>`)
			case "/remote.php/dav/addressbooks/users/person/":
				if f.redirect.Load() {
					http.Redirect(w, r, "/moved/", http.StatusMovedPermanently)
					return
				}
				multistatus(r.URL.Path, `<resourcetype><collection/></resourcetype><displayname>Synthetic</displayname>`)
			default:
				w.WriteHeader(405)
			}
		case host == "contacts.icloud.localhost" && front != "":
			http.Redirect(w, r, front, http.StatusFound)
		case host == "caldav.icloud.localhost" && r.URL.Path == "/":
			// iCloud's CalDAV front door may hand the account to its partition.
			http.Redirect(w, r, "https://p42-caldav.icloud.localhost:"+f.port+"/", http.StatusMovedPermanently)
		case (host == "contacts.icloud.localhost" || host == "p42-caldav.icloud.localhost") && r.URL.Path == "/":
			// iCloud's front door answers with a relative principal; the
			// home set it does not know is a 404 propstat.
			w.WriteHeader(207)
			fmt.Fprintf(w, `<?xml version="1.0" encoding="UTF-8"?><multistatus xmlns="DAV:"><response><href>/</href><propstat><prop><current-user-principal><href>/1234567890/principal/</href></current-user-principal></prop><status>HTTP/1.1 200 OK</status></propstat><propstat><prop><%s-home-set xmlns="%s"/></prop><status>HTTP/1.1 404 Not Found</status></propstat></response></multistatus>`, kind, ns)
		case r.URL.Path == "/1234567890/principal/" && strings.Contains(string(body), kind+"-home-set"):
			home := homeHost
			if home == "" {
				home = "p42-" + strings.TrimPrefix(strings.Split(host, ".")[0], "p42-") + ".icloud.localhost"
			}
			multistatus("/1234567890/principal/", fmt.Sprintf(`<%[1]s-home-set xmlns="%[2]s"><href xmlns="DAV:">https://%[3]s:%[4]s/1234567890/%[5]shome/</href></%[1]s-home-set>`, kind, ns, home, f.port, map[string]string{"addressbook": "carddav", "calendar": "calendars"}[kind]))
		case strings.HasPrefix(host, "p42-") && strings.HasPrefix(r.URL.Path, "/1234567890/"):
			if f.redirect.Load() {
				http.Redirect(w, r, "/moved/", http.StatusMovedPermanently)
				return
			}
			multistatus(r.URL.Path, `<resourcetype><collection/></resourcetype><displayname>Synthetic</displayname>`)
		default:
			w.WriteHeader(404)
		}
	}))
	f.srv.TLS = &tls.Config{Certificates: []tls.Certificate{cert}}
	f.srv.StartTLS()
	t.Cleanup(f.srv.Close)
	_, f.port, _ = net.SplitHostPort(f.srv.Listener.Addr().String())
	return f, ca
}

func (f *fakeICloud) count(host string) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.seen[host]
}

func localhostResolver(addr netip.Addr) func(context.Context, string) ([]netip.Addr, error) {
	return func(_ context.Context, host string) ([]netip.Addr, error) {
		if strings.HasSuffix(host, ".localhost") {
			return []netip.Addr{addr}, nil
		}
		return nil, errors.New("no such host")
	}
}

// Connecting with the address a person knows stores the account's partition
// home set, and every later request uses it without following redirects.
func TestDAVDiscoversICloudPartition(t *testing.T) {
	binary, err := exec.LookPath("curl")
	if err != nil {
		t.Fatal("native curl test prerequisite missing")
	}
	const secret = "abcd-efgh-ijkl-mnop"
	f, ca := newFakeICloud(t, secret)
	extraToolEnv = []string{"CURL_CA_BUNDLE=" + ca}
	defer func() { extraToolEnv = nil }()
	for _, c := range []struct {
		provider Provider
		entered  string
		home     string
	}{
		{CardDAV, "https://contacts.icloud.localhost:" + f.port, "https://p42-contacts.icloud.localhost:" + f.port + "/1234567890/carddavhome/"},
		{CalDAV, "https://caldav.icloud.localhost:" + f.port + "/", "https://p42-caldav.icloud.localhost:" + f.port + "/1234567890/calendarshome/"},
		{CardDAV, "https://CLOUD.nc.localhost:" + f.port + "/", "https://cloud.nc.localhost:" + f.port + "/remote.php/dav/addressbooks/users/person/"},
	} {
		t.Run(string(c.provider)+" "+c.entered, func(t *testing.T) {
			f.redirect.Store(false)
			home := newHome(t)
			env := Env{Home: home, Config: Config{Tools: map[string]string{"curl": binary}}, FixtureTools: true, Resolve: localhostResolver(netip.MustParseAddr("127.0.0.1"))}
			h := New(env, Production(), nil).Handler(allow)
			in := map[string]any{"action": "connect", "provider": c.provider, "address": "person@icloud.test", "url": c.entered, "username": "person@icloud.test", "password": secret}
			if code, out, raw := call(t, h, "POST", AccountsPath, "", in); code != 200 || strings.Contains(raw, secret) {
				t.Fatalf("connect: %d %v", code, out)
			}
			d := &dav{c.provider}
			a, err := d.read(env, "person@icloud.test")
			if err != nil || a.URL != c.home {
				t.Fatalf("stored %q, want %q (%v)", a.URL, c.home, err)
			}
			skill, err := os.ReadFile(filepath.Join(home, SkillDir, "SKILL.md"))
			if err != nil || strings.Contains(string(skill), secret) || strings.Contains(string(skill), "--location") && !strings.Contains(string(skill), "another --url have\nno place with this config") {
				t.Fatal("skill missing or unsafe")
			}
			// The agent's command from the skill reaches the partition host.
			config := filepath.Join(home, d.dir(), "person@icloud.test.conf")
			homeHost := strings.Split(strings.TrimPrefix(c.home, "https://"), ":")[0]
			before := f.count(homeHost)
			if out, err := env.run(t.Context(), Command{Path: binary, Args: []string{"--disable", "--config", config, "--silent", "--fail", "--resolve", homeHost + ":" + f.port + ":127.0.0.1", "--request", "PROPFIND", "--header", "Depth: 1"}}, nil); err != nil || !strings.Contains(string(out), "Synthetic") || f.count(homeHost) != before+1 {
				t.Fatalf("agent request did not reach the discovered host: %s %v", out, err)
			}
			if got := d.Check(t.Context(), env, "person@icloud.test"); got[0].State != StateOK {
				t.Fatalf("status %v", got)
			}
			// At use time a redirect is never followed, even within the site.
			f.redirect.Store(true)
			if got := d.Check(t.Context(), env, "person@icloud.test"); got[0].State == StateOK {
				t.Fatal("status followed a redirect")
			}
			if code, _, _ := call(t, h, "POST", AccountsPath, "", map[string]any{"action": "password", "provider": c.provider, "address": "person@icloud.test", "password": secret}); code != 422 {
				t.Fatal("renewal followed a redirect")
			}
			if after, _ := d.read(env, "person@icloud.test"); after.URL != c.home {
				t.Fatal("renewal changed the server")
			}
		})
	}
}

// Credentials never leave the entered registrable domain, never go over
// plain HTTP and never reach a refused destination class.
func TestDAVDiscoveryRefusesOtherSites(t *testing.T) {
	binary, err := exec.LookPath("curl")
	if err != nil {
		t.Fatal("native curl test prerequisite missing")
	}
	const secret = "abcd-efgh-ijkl-mnop"
	f, ca := newFakeICloud(t, secret)
	extraToolEnv = []string{"CURL_CA_BUNDLE=" + ca}
	defer func() { extraToolEnv = nil }()
	connect := func(t *testing.T, resolve func(context.Context, string) ([]netip.Addr, error), url string) (int, map[string]any) {
		home := newHome(t)
		env := Env{Home: home, Config: Config{Tools: map[string]string{"curl": binary}}, FixtureTools: true, Resolve: resolve}
		h := New(env, Production(), nil).Handler(allow)
		code, out, _ := call(t, h, "POST", AccountsPath, "", map[string]any{"action": "connect", "provider": CardDAV, "address": "person@icloud.test", "url": url, "username": "person@icloud.test", "password": secret})
		if accounts, err := (&dav{CardDAV}).Accounts(env); err != nil || len(accounts) != 0 {
			t.Fatalf("refused account persisted: %v %v", accounts, err)
		}
		return code, out
	}
	local := localhostResolver(netip.MustParseAddr("127.0.0.1"))

	t.Run("home set on another registrable domain", func(t *testing.T) {
		f.set("p42-contacts.evil.localhost", "")
		defer f.set("", "")
		if code, out := connect(t, local, "https://contacts.icloud.localhost:"+f.port+"/"); code != 422 || errorCode(out) != "endpoint_rejected" {
			t.Fatalf("%d %v", code, out)
		}
		if f.count("p42-contacts.evil.localhost") != 0 {
			t.Fatal("credentials reached another site")
		}
	})
	for _, target := range []string{"https://elsewhere.localhost:%s/", "http://p42-contacts.icloud.localhost:%s/", "https://person:x@p42-contacts.icloud.localhost:%s/", "https://p42-contacts.icloud.localhost:%s/?token=x"} {
		t.Run("redirect to "+target, func(t *testing.T) {
			f.set("", fmt.Sprintf(target, f.port))
			defer f.set("", "")
			before, elsewhere := f.count("p42-contacts.icloud.localhost"), f.count("elsewhere.localhost")
			if code, out := connect(t, local, "https://contacts.icloud.localhost:"+f.port+"/"); code != 422 || errorCode(out) != "endpoint_rejected" {
				t.Fatalf("%d %v", code, out)
			}
			if f.count("elsewhere.localhost") != elsewhere || f.count("p42-contacts.icloud.localhost") != before {
				t.Fatal("credentials followed a refused redirect")
			}
		})
	}
	t.Run("refused destination classes", func(t *testing.T) {
		for _, ip := range []string{"169.254.169.254", "127.0.0.1", "0.0.0.0", "fd00:ec2::254"} {
			resolve := func(context.Context, string) ([]netip.Addr, error) {
				return []netip.Addr{netip.MustParseAddr("192.0.2.1"), netip.MustParseAddr(ip)}, nil
			}
			if code, out := connect(t, resolve, "https://contacts.icloud.example/"); code != 422 || errorCode(out) != "endpoint_rejected" {
				t.Fatalf("%s: %d %v", ip, code, out)
			}
		}
	})
}

// A provider path with brackets is one request, not a curl URL glob that
// would multiply credentialed requests past discovery's bounds.
func TestDAVBracketPathIsOneRequest(t *testing.T) {
	binary, err := exec.LookPath("curl")
	if err != nil {
		t.Fatal("native curl test prerequisite missing")
	}
	ca, cert := syntheticTLS(t, t.TempDir())
	var requests atomic.Int32
	srv := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		if r.URL.Path != "/dav/[1-3]/" {
			w.WriteHeader(404)
			return
		}
		w.WriteHeader(207)
		fmt.Fprint(w, `<d:multistatus xmlns:d="DAV:"/>`)
	}))
	srv.TLS = &tls.Config{Certificates: []tls.Certificate{cert}}
	srv.StartTLS()
	defer srv.Close()
	extraToolEnv = []string{"CURL_CA_BUNDLE=" + ca}
	defer func() { extraToolEnv = nil }()
	env := Env{Home: newHome(t), Config: Config{Tools: map[string]string{"curl": binary}}, FixtureTools: true}
	d := &dav{CardDAV}
	url := strings.Replace(srv.URL, "127.0.0.1", "localhost", 1) + "/dav/[1-3]/"
	if err := d.Connect(t.Context(), env, PasswordAccount{Address: "person@example.test", URL: url, Username: "person", Password: "secret"}); err != nil {
		t.Fatal(err)
	}
	if requests.Load() != 1 {
		t.Fatalf("discovery sent %d requests", requests.Load())
	}
	if got := d.Check(t.Context(), env, "person@example.test"); got[0].State != StateOK || requests.Load() != 2 {
		t.Fatalf("status %v after %d requests", got, requests.Load())
	}
}
