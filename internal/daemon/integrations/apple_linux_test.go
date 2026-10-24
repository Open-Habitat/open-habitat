//go:build linux

package integrations

import (
	"crypto/tls"
	"net"
	"net/netip"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
)

// appleTestHosts is Apple's endpoint set moved onto the synthetic iCloud.
func appleTestHosts(f *fakeICloud) AppleHosts {
	return AppleHosts{IMAP: "imap.mail.me.localhost", IMAPPort: 993, SMTP: "smtp.mail.me.localhost", SMTPPort: 587,
		CalDAV: "https://caldav.icloud.localhost:" + f.port + "/", CardDAV: "https://contacts.icloud.localhost:" + f.port}
}

func appleConnect(services []string, password, mail string) map[string]any {
	in := map[string]any{"action": "connect", "provider": "apple", "address": "person@icloud.test", "services": services, "password": password}
	if mail != "" {
		in["mail_address"] = mail
	}
	return in
}

func accountsOf(t *testing.T, out map[string]any) []map[string]any {
	t.Helper()
	raw, _ := out["accounts"].([]any)
	var list []map[string]any
	for _, a := range raw {
		list = append(list, a.(map[string]any))
	}
	return list
}

// One Apple ID and one app-specific password connect the services the
// person chose against Apple's hosts; a service added later takes the
// password from the person's own stored Apple configuration, and only from
// an account whose stored server is Apple's.
func TestAppleConnectsChosenServicesAndReusesThePassword(t *testing.T) {
	curl, err := exec.LookPath("curl")
	if err != nil {
		t.Fatal("native curl test prerequisite missing")
	}
	const secret = "abcd-efgh-ijkl-mnop"
	f, ca := newFakeICloud(t, secret)
	extraToolEnv = []string{"CURL_CA_BUNDLE=" + ca}
	defer func() { extraToolEnv = nil }()
	home := newHome(t)
	env := Env{Home: home, Config: Config{Tools: map[string]string{"curl": curl, "himalaya": fakeHimalaya(t)}}, FixtureTools: true, Resolve: localhostResolver(netip.MustParseAddr("127.0.0.1"))}
	h := New(env, Production(), nil, WithAppleHosts(appleTestHosts(f))).Handler(allow)
	carddav, caldav, mailbox := &dav{CardDAV}, &dav{CalDAV}, &himalaya{}

	code, list, _ := call(t, h, "GET", ListPath, "", nil)
	if code != 200 {
		t.Fatalf("list: %d %v", code, list)
	}
	var apple map[string]any
	for _, p := range list["providers"].([]any) {
		if p.(map[string]any)["id"] == "apple" {
			apple = p.(map[string]any)
		}
	}
	if apple == nil || apple["available"] != true || apple["login"] != "app_password" {
		t.Fatalf("apple tile: %v", list["providers"])
	}

	// Requests the Apple card never makes are refused before any tool runs.
	for name, in := range map[string]map[string]any{
		"mail without an iCloud address":   appleConnect([]string{"mail"}, secret, ""),
		"a custom-domain mail address":     appleConnect([]string{"mail"}, secret, "person@example.test"),
		"mail address without mail":        appleConnect([]string{"contacts"}, secret, "person@icloud.com"),
		"no services":                      appleConnect([]string{}, secret, ""),
		"a service twice":                  appleConnect([]string{"contacts", "contacts"}, secret, ""),
		"an unknown service":               appleConnect([]string{"drive"}, secret, ""),
		"add with a password":              {"action": "add", "provider": "apple", "address": "person@icloud.test", "services": []string{"calendar"}, "password": secret},
		"a generic account with services":  {"action": "connect", "provider": "carddav", "address": "person@icloud.test", "url": "https://contacts.icloud.localhost:" + f.port, "username": "person@icloud.test", "password": secret, "services": []string{"contacts"}},
		"an Apple connect naming a server": {"action": "connect", "provider": "apple", "address": "person@icloud.test", "services": []string{"contacts"}, "password": secret, "url": "https://elsewhere.localhost/"},
	} {
		if code, out, _ := call(t, h, "POST", AccountsPath, "", in); code != 400 {
			t.Errorf("%s: %d %v", name, code, out)
		}
	}

	// Apple refuses the password: nothing is written for any service.
	if code, out, _ := call(t, h, "POST", AccountsPath, "", appleConnect([]string{"mail", "calendar", "contacts"}, "wrong", "person@icloud.com")); code != 422 || errorCode(out) != "credentials_rejected" {
		t.Fatalf("wrong password: %d %v", code, out)
	}
	for _, e := range []Entry{carddav, caldav, mailbox} {
		if a, err := e.Accounts(env); err != nil || len(a) != 0 {
			t.Fatalf("refused password left %s %v %v", e.Provider(), a, err)
		}
	}

	// The person chose contacts only.
	code, out, _ := call(t, h, "POST", AccountsPath, "", appleConnect([]string{"contacts"}, secret, ""))
	if got := accountsOf(t, out); code != 200 || len(got) != 1 || got[0]["provider"] != "carddav" || got[0]["apple_id"] != "person@icloud.test" || out["failed"] != nil {
		t.Fatalf("contacts: %d %v", code, out)
	}
	if a, err := carddav.read(env, "person@icloud.test"); err != nil || !strings.HasPrefix(a.URL, "https://p42-contacts.icloud.localhost:") {
		t.Fatalf("contacts discovery: %v %v", a.URL, err)
	}

	// A CardDAV account elsewhere signs in with the same name and password,
	// but its server is not Apple's: it is no Apple account and no source.
	nc := map[string]any{"action": "connect", "provider": "carddav", "address": "nc@example.test", "url": "https://cloud.nc.localhost:" + f.port + "/", "username": "person@icloud.test", "password": secret}
	if code, out, _ := call(t, h, "POST", AccountsPath, "", nc); code != 200 {
		t.Fatalf("nextcloud: %d %v", code, out)
	} else if acc := out["account"].(map[string]any); acc["apple_id"] != nil {
		t.Fatalf("a Nextcloud account joined the Apple card: %v", acc)
	}

	// Apple's IMAP with another provider's SMTP relay is no Apple account:
	// the Apple card's renewal must never send the password to the relay.
	relay := map[string]any{"action": "connect", "provider": "imap", "address": "relay@icloud.com", "server": "imap.mail.me.localhost", "port": 993, "security": "tls", "username": "relay", "password": secret, "smtp_server": "smtp.relay.example", "smtp_port": 587, "smtp_security": "starttls"}
	if code, out, _ := call(t, h, "POST", AccountsPath, "", relay); code != 200 {
		t.Fatalf("relay: %d %v", code, out)
	} else if acc := out["account"].(map[string]any); acc["apple_id"] != nil {
		t.Fatalf("a mixed-provider mail account joined the Apple card: %v", acc)
	}
	if code, out, _ := call(t, h, "DELETE", AccountsPath, "", map[string]any{"action": "remove", "provider": "imap", "address": "relay@icloud.com", "delete_directories": false}); code != 200 {
		t.Fatalf("relay remove: %d %v", code, out)
	}

	// Later: calendar and mail with the same password, which the browser
	// never sends; the daemon takes it from the stored contacts account.
	add := map[string]any{"action": "add", "provider": "apple", "address": "person@icloud.test", "services": []string{"mail", "calendar"}, "mail_address": "person@icloud.com"}
	code, out, raw := call(t, h, "POST", AccountsPath, "", add)
	if got := accountsOf(t, out); code != 200 || len(got) != 2 || got[0]["provider"] != "caldav" || got[1]["provider"] != "imap" || got[1]["address"] != "person@icloud.com" || got[1]["apple_id"] != "person@icloud.test" {
		t.Fatalf("add: %d %v", code, out)
	}
	if strings.Contains(raw, secret) {
		t.Fatal("the stored password reached the reply")
	}
	if a, err := caldav.read(env, "person@icloud.test"); err != nil || a.Password != secret || !strings.HasPrefix(a.URL, "https://p42-caldav.icloud.localhost:") {
		t.Fatalf("calendar: %+v %v", a.URL, err)
	}
	// Apple: IMAP signs in with the address's name part, SMTP with the full
	// address, and the mail address may differ from the Apple ID.
	m, err := mailbox.read(env, "person@icloud.com")
	if err != nil || m.Password != secret || m.Server != "imap.mail.me.localhost" || m.Port != 993 || m.Security != "tls" || m.Username != "person" ||
		m.SMTPServer != "smtp.mail.me.localhost" || m.SMTPPort != 587 || m.SMTPSecurity != "starttls" || m.SMTPUsername != "person@icloud.com" || m.AppleID != "person@icloud.test" {
		t.Fatalf("mail: %+v %v", m, err)
	}
	_, list, _ = call(t, h, "GET", ListPath, "", nil)
	members := 0
	for _, a := range list["accounts"].([]any) {
		if a.(map[string]any)["apple_id"] == "person@icloud.test" {
			members++
		}
	}
	if members != 3 {
		t.Fatalf("Apple card: %v", list["accounts"])
	}

	// A new password Apple refuses replaces nothing.
	if code, out, _ := call(t, h, "POST", AccountsPath, "", map[string]any{"action": "password", "provider": "apple", "address": "person@icloud.test", "password": "revoked"}); code != 422 || errorCode(out) != "credentials_rejected" {
		t.Fatalf("renew refused: %d %v", code, out)
	}
	if a, _ := carddav.read(env, "person@icloud.test"); a.Password != secret {
		t.Fatal("a refused renewal replaced the password")
	}
	if code, out, _ := call(t, h, "POST", AccountsPath, "", map[string]any{"action": "password", "provider": "apple", "address": "person@icloud.test", "password": secret}); code != 200 || len(accountsOf(t, out)) != 3 {
		t.Fatalf("renew: %d %v", code, out)
	}

	// Removing the Apple ID removes its three accounts and nothing else.
	if code, out, _ := call(t, h, "DELETE", AccountsPath, "", map[string]any{"action": "remove", "provider": "apple", "address": "person@icloud.test", "delete_directories": false}); code != 200 || out["removed"].(map[string]any)["provider"] != "apple" {
		t.Fatalf("remove: %d %v", code, out)
	}
	for _, e := range []Entry{caldav, mailbox} {
		if a, _ := e.Accounts(env); len(a) != 0 {
			t.Fatalf("remove left %s %v", e.Provider(), a)
		}
	}
	if a, _ := carddav.Accounts(env); len(a) != 1 || a[0] != "nc@example.test" {
		t.Fatalf("remove touched another account: %v", a)
	}
	// With no Apple account left, the Nextcloud password is not reused.
	before := f.count("p42-caldav.icloud.localhost") + f.count("caldav.icloud.localhost")
	if code, out, _ := call(t, h, "POST", AccountsPath, "", map[string]any{"action": "add", "provider": "apple", "address": "person@icloud.test", "services": []string{"calendar"}}); code != 409 || errorCode(out) != "account_missing" {
		t.Fatalf("add without an Apple source: %d %v", code, out)
	}
	if f.count("p42-caldav.icloud.localhost")+f.count("caldav.icloud.localhost") != before {
		t.Fatal("a non-Apple password reached Apple")
	}
}

// The pinned himalaya signs in to iCloud Mail as Apple documents it: IMAP
// with the name part, SMTP over STARTTLS with the full address, falling back
// to the full address for IMAP when the name part is refused.
func TestAppleMailRealHimalaya(t *testing.T) {
	binary := os.Getenv("OH_TEST_HIMALAYA")
	if binary == "" {
		t.Skip("OH_TEST_HIMALAYA names no himalaya binary; the fake tool covers the catalog")
	}
	curl, err := exec.LookPath("curl")
	if err != nil {
		t.Fatal("native curl test prerequisite missing")
	}
	dir := t.TempDir()
	caFile, cert := syntheticTLS(t, dir)
	extraToolEnv = []string{"SSL_CERT_FILE=" + caFile}
	defer func() { extraToolEnv = nil }()
	const secret = "abcd-efgh-ijkl-mnop"
	for _, c := range []struct{ name, imapUser, stored string }{
		{"name part", "person", "person"},
		{"full address", "person@icloud.com", "person@icloud.com"},
	} {
		t.Run(c.name, func(t *testing.T) {
			imap, err := tls.Listen("tcp", "127.0.0.1:0", &tls.Config{Certificates: []tls.Certificate{cert}})
			if err != nil {
				t.Fatal(err)
			}
			defer imap.Close()
			go serveIMAP(imap, c.imapUser+"\x00"+secret)
			smtp, err := net.Listen("tcp", "127.0.0.1:0")
			if err != nil {
				t.Fatal(err)
			}
			defer smtp.Close()
			var sent atomic.Int32
			go serveSMTP(smtp, "person@icloud.com\x00"+secret, &sent, &tls.Config{Certificates: []tls.Certificate{cert}})
			home := newHome(t)
			env := Env{Home: home, Config: Config{Tools: map[string]string{"himalaya": binary, "curl": curl}}, FixtureTools: true}
			hosts := AppleHosts{IMAP: "localhost", IMAPPort: imap.Addr().(*net.TCPAddr).Port, SMTP: "localhost", SMTPPort: smtp.Addr().(*net.TCPAddr).Port, CalDAV: "https://caldav.icloud.localhost/", CardDAV: "https://contacts.icloud.localhost/"}
			h := New(env, Production(), nil, WithAppleHosts(hosts)).Handler(allow)
			in := map[string]any{"action": "connect", "provider": "apple", "address": "person@icloud.com", "services": []string{"mail"}, "password": secret}
			code, out, _ := call(t, h, "POST", AccountsPath, "", in)
			got := accountsOf(t, out)
			if code != 200 || len(got) != 1 || got[0]["apple_id"] != "person@icloud.com" {
				t.Fatalf("%d %v", code, out)
			}
			if s := got[0]["services"].([]any)[0].(map[string]any); s["state"] != "ok" {
				t.Fatalf("status: %v", s)
			}
			m, err := (&himalaya{}).read(env, "person@icloud.com")
			if err != nil || m.Username != c.stored || (m.SMTPUsername != "" && m.SMTPUsername != "person@icloud.com") {
				t.Fatalf("stored: %+v %v", m, err)
			}
			if sent.Load() != 0 {
				t.Fatal("connecting sent mail")
			}
			if entries, _ := os.ReadDir(filepath.Join(home, himalayaDir)); len(entries) != 1 {
				t.Fatalf("staging left behind: %v", entries)
			}
		})
	}
}
