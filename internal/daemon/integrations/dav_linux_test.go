//go:build linux

package integrations

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
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
	var redirects atomic.Int32
	srv := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		if r.Header.Get("X-From-Default") != "" {
			w.WriteHeader(400)
			return
		}
		if r.URL.Path == "/redirect" {
			http.Redirect(w, r, "/redirect-target", 302)
			return
		}
		if r.URL.Path == "/redirect-target" {
			redirects.Add(1)
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
			originalURL := in["url"]
			in["url"] = strings.TrimSuffix(endpoint, "/dav/") + "/redirect"
			if code, _, _ := call(t, h, "POST", AccountsPath, "", in); code != 422 || redirects.Load() != 0 {
				t.Fatal("DAV followed a redirect")
			}
			in["url"] = originalURL
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
