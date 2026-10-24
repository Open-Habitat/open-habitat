//go:build linux

package provision

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"os"
	"os/user"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"golang.org/x/sys/unix"

	"github.com/Open-Habitat/open-habitat/internal/integrationapps"
)

const (
	testGoogleID     = "704213598812-k3v9q2mfa0b7s1dn5e8rjhtc4lpu6xwo.apps.googleusercontent.com"
	testGoogleSecret = "GOCSPX-sentinel-secret"
	// The operator's file as host apply and a hand edit leave it: odd
	// spacing and member order that a rewrite would not reproduce.
	operatorFile = "{\n  \"tools\" : {\"rclone\":\"/opt/open-habitat/profiles/integrations/bin/rclone\", \"curl\":\"/usr/bin/curl\"},\n  \"dropbox\": {\"client_id\":\"p3n8vq1zt6ka0rw\", \"client_secret\":\"dropbox-secret\"}\n}\n"
)

func integrationWriter(t *testing.T) Writer {
	t.Helper()
	w, _ := writerFixture(t)
	w.Now = func() time.Time { return time.Date(2026, 10, 24, 12, 0, 0, 0, time.UTC) }
	account, err := user.Current()
	if err != nil {
		t.Fatal(err)
	}
	// Ancestors must be writable by nobody else, as on a real host.
	base, err := os.MkdirTemp(account.HomeDir, "integrations-test-")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(base) })
	for _, d := range []struct {
		name string
		mode os.FileMode
	}{{"opt", 0755}, {"host", 0700}} {
		if err = os.Mkdir(filepath.Join(base, d.name), d.mode); err != nil {
			t.Fatal(err)
		}
	}
	os.Chmod(base, 0755)
	w.IntegrationsFile = filepath.Join(base, "opt", "integrations.json")
	w.HostLock = filepath.Join(base, "host")
	writeOperatorFile(t, w, operatorFile)
	return w
}
func writeOperatorFile(t *testing.T, w Writer, s string) {
	t.Helper()
	if err := os.WriteFile(w.IntegrationsFile, []byte(s), 0644); err != nil {
		t.Fatal(err)
	}
	os.Chmod(w.IntegrationsFile, 0644)
}
func googleSet(w Writer, actor string) Reply {
	return w.Handle(context.Background(), Request{Version: 1, Operation: OpIntegrationSet, Provider: "google", ID: "0", Actor: actor, Fields: map[string]string{"client_id": testGoogleID, "client_secret": testGoogleSecret}})
}
func integrationClear(w Writer, provider, actor string) Reply {
	return w.Handle(context.Background(), Request{Version: 1, Operation: OpIntegrationClear, Provider: provider, ID: "0", Actor: actor})
}
func integrationList(w Writer) Reply {
	return w.Handle(context.Background(), Request{Version: 1, Operation: OpIntegrationList, Provider: "all", ID: "0"})
}
func appOf(t *testing.T, r Reply, provider string) *IntegrationApp {
	t.Helper()
	if r.Failure != "" || r.Integrations == nil {
		t.Fatalf("no integrations page: %+v", r)
	}
	for i := range r.Integrations.Apps {
		if r.Integrations.Apps[i].Provider == provider {
			return &r.Integrations.Apps[i]
		}
	}
	return nil
}
func fileText(t *testing.T, path string) string {
	t.Helper()
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

// A set splices exactly one section in, keeps the tools and every other
// operator byte, publishes the file as root's 0644 for every daemon and
// records who asked; a later clear removes exactly that section again.
func TestIntegrationSetAndClearTouchOnlyTheirSection(t *testing.T) {
	w := integrationWriter(t)
	r := googleSet(w, "42")
	google := appOf(t, r, "google")
	if google == nil || google.ClientID != testGoogleID || !google.Usable || google.Source != AppSourceSiteAdmin || google.Actor != "42" || google.At != "2026-10-24T12:00:00Z" {
		t.Fatalf("set reply: %+v", r.Integrations)
	}
	if d := appOf(t, r, "dropbox"); d == nil || d.Source != AppSourceOperator || d.Actor != "" {
		t.Fatalf("operator's section misattributed: %+v", d)
	}
	section := integrationapps.Section("google", map[string]string{"client_id": testGoogleID, "client_secret": testGoogleSecret})
	want := strings.Replace(operatorFile, "\"dropbox-secret\"}", "\"dropbox-secret\"},\"google\":"+string(section), 1)
	if got := fileText(t, w.IntegrationsFile); got != want {
		t.Fatalf("file:\n%s\nwant\n%s", got, want)
	}
	var st unix.Stat_t
	if unix.Stat(w.IntegrationsFile, &st) != nil || st.Mode&0777 != 0644 || st.Nlink != 1 {
		t.Fatalf("published mode %o", st.Mode&0777)
	}
	if !fileAbsent(filepath.Join(filepath.Dir(w.IntegrationsFile), integrationStage)) {
		t.Fatal("staging file left behind")
	}
	if r = integrationClear(w, "google", "root"); r.Failure != "" || appOf(t, r, "google") != nil {
		t.Fatalf("clear: %+v", r)
	}
	if got := fileText(t, w.IntegrationsFile); got != operatorFile {
		t.Fatalf("clear changed other bytes:\n%q\nwant\n%q", got, operatorFile)
	}
	// Clearing what is not there changes nothing and succeeds, so a repeat
	// after an uncertain reply is harmless.
	if r = integrationClear(w, "microsoft", "42"); r.Failure != "" || fileText(t, w.IntegrationsFile) != operatorFile {
		t.Fatalf("clear of an absent section: %+v", r)
	}
	// The operator's own section can be removed through the broker too.
	if r = integrationClear(w, "dropbox", "42"); r.Failure != "" || strings.Contains(fileText(t, w.IntegrationsFile), "dropbox") || !strings.Contains(fileText(t, w.IntegrationsFile), `"tools" : {"rclone"`) {
		t.Fatalf("dropbox clear: %+v\n%s", r, fileText(t, w.IntegrationsFile))
	}
}

// Microsoft's app is single tenant: the broker writes the organisation's
// Directory (tenant) ID and refuses an audience keyword, a domain or the
// client id pasted twice, whether the request arrives encoded or not.
func TestIntegrationMicrosoftSingleTenant(t *testing.T) {
	const client, tenant = "5b7e0d3a-91c2-4f68-a4d1-2c9e8f60b7a3", "e04c61f9-3b8d-4a27-9f5e-7d1a2c48b903"
	set := func(f map[string]string) Request {
		return Request{Version: 1, Operation: OpIntegrationSet, Provider: "microsoft", ID: "0", Actor: "42", Fields: f}
	}
	w := integrationWriter(t)
	for name, f := range map[string]map[string]string{
		"common":          {"client_id": client, "tenant_id": "common"},
		"organizations":   {"client_id": client, "tenant_id": "organizations"},
		"consumers":       {"client_id": client, "tenant_id": "consumers"},
		"domain":          {"client_id": client, "tenant_id": "contoso.onmicrosoft.com"},
		"no tenant":       {"client_id": client},
		"empty tenant":    {"client_id": client, "tenant_id": ""},
		"client twice":    {"client_id": client, "tenant_id": strings.ToUpper(client)},
		"client not guid": {"client_id": "open-habitat", "tenant_id": tenant},
		"secret":          {"client_id": client, "tenant_id": tenant, "client_secret": "x"},
	} {
		if _, err := EncodeRequest(set(f)); err == nil {
			t.Errorf("%s encoded", name)
		}
		if r := w.Handle(context.Background(), set(f)); r.Failure != Invalid || fileText(t, w.IntegrationsFile) != operatorFile {
			t.Errorf("%s: %+v", name, r)
		}
	}
	r := w.Handle(context.Background(), set(map[string]string{"client_id": client, "tenant_id": tenant}))
	if a := appOf(t, r, "microsoft"); a == nil || a.ClientID != client || a.TenantID != tenant || !a.Usable || a.Source != AppSourceSiteAdmin {
		t.Fatalf("set: %+v", r.Integrations)
	}
	if !strings.Contains(fileText(t, w.IntegrationsFile), `"microsoft":{"client_id":"`+client+`","tenant_id":"`+tenant+`"}`) {
		t.Fatal(fileText(t, w.IntegrationsFile))
	}
	// An operator's hand-written audience keyword is listed as present but
	// not usable, so the tab offers removal rather than calling it in use.
	writeOperatorFile(t, w, `{"microsoft":{"client_id":"`+client+`","tenant_id":"common"}}`)
	if a := appOf(t, integrationList(w), "microsoft"); a == nil || a.Usable || a.TenantID != "common" || a.Source != AppSourceOperator {
		t.Fatalf("hand-written common: %+v", a)
	}
}

// A section root edits by hand after the broker wrote it is root's, not the
// administrator's: the record names exact bytes, not just a provider.
func TestIntegrationProvenanceFollowsTheBytes(t *testing.T) {
	w := integrationWriter(t)
	if r := googleSet(w, "42"); r.Failure != "" {
		t.Fatal(r)
	}
	edited := strings.Replace(fileText(t, w.IntegrationsFile), testGoogleSecret, "GOCSPX-rotated-by-root", 1)
	writeOperatorFile(t, w, edited)
	if g := appOf(t, integrationList(w), "google"); g == nil || g.Source != AppSourceOperator || g.Actor != "" || g.At != "" {
		t.Fatalf("hand edit still attributed: %+v", g)
	}
	s, err := w.inspectIntegrations(context.Background())
	if err != nil || !s.BrowserSetup || len(s.Apps) != 2 {
		t.Fatalf("host plan view: %+v %v", s, err)
	}
}

// Root's switch: off refuses every write and changes nothing, while the
// list stays readable; host apply's publication keeps the records.
func TestIntegrationBrowserSetupSwitch(t *testing.T) {
	w := integrationWriter(t)
	if r := googleSet(w, "42"); r.Failure != "" {
		t.Fatal(r)
	}
	before := fileText(t, w.IntegrationsFile)
	if err := publishIntegrationSetup(context.Background(), w.Dir, w.owner, false); err != nil {
		t.Fatal(err)
	}
	if r := googleSet(w, "42"); r.Failure != BrowserSetupOff {
		t.Fatalf("set with the switch off: %+v", r)
	}
	if r := integrationClear(w, "google", "42"); r.Failure != BrowserSetupOff {
		t.Fatalf("clear with the switch off: %+v", r)
	}
	r := integrationList(w)
	if g := appOf(t, r, "google"); r.Integrations.BrowserSetup || g == nil || g.Actor != "42" || fileText(t, w.IntegrationsFile) != before {
		t.Fatalf("list with the switch off: %+v", r.Integrations)
	}
	if err := publishIntegrationSetup(context.Background(), w.Dir, w.owner, true); err != nil {
		t.Fatal(err)
	}
	if r = integrationClear(w, "google", "42"); r.Failure != "" {
		t.Fatalf("switch back on: %+v", r)
	}
}

// The broker writes only while no host maintenance holds the operation lock
// that host apply writes the tools section under. A busy lock is a definite
// refusal with nothing written; the list never waits for it.
func TestIntegrationWritesShareTheHostOperationLock(t *testing.T) {
	w := integrationWriter(t)
	held, err := unix.Open(w.HostLock, unix.O_RDONLY|unix.O_DIRECTORY, 0)
	if err != nil {
		t.Fatal(err)
	}
	if err = unix.Flock(held, unix.LOCK_EX|unix.LOCK_NB); err != nil {
		t.Fatal(err)
	}
	started := time.Now()
	if r := googleSet(w, "42"); r.Failure != HostBusy || fileText(t, w.IntegrationsFile) != operatorFile {
		t.Fatalf("write under a held host lock: %+v", r)
	}
	if time.Since(started) > 5*time.Second {
		t.Fatal("refusal waited for maintenance")
	}
	if r := integrationList(w); r.Failure != "" {
		t.Fatalf("list blocked by maintenance: %+v", r)
	}
	unix.Close(held)
	if r := googleSet(w, "42"); r.Failure != "" {
		t.Fatalf("after maintenance: %+v", r)
	}
	// The broker never creates the host's lock directory.
	os.Remove(w.HostLock)
	if r := googleSet(w, "42"); r.Failure != IntegrationsFile || !fileAbsent(w.HostLock) {
		t.Fatalf("missing host lock: %+v", r)
	}
}

// Only a file host apply could have published is edited; anything else is
// left for root, byte for byte.
func TestIntegrationRefusesAnUntrustedOrUnreadableFile(t *testing.T) {
	for name, prepare := range map[string]func(Writer){
		"absent":         func(w Writer) { os.Remove(w.IntegrationsFile) },
		"group writable": func(w Writer) { os.Chmod(w.IntegrationsFile, 0664) },
		"not one object": func(w Writer) { writeOperatorFile(t, w, `{"tools":{}} {}`) },
		"duplicate key":  func(w Writer) { writeOperatorFile(t, w, `{"google":{},"google":{}}`) },
		"hard linked":    func(w Writer) { os.Link(w.IntegrationsFile, w.IntegrationsFile+".link") },
		"symlinked": func(w Writer) {
			os.Rename(w.IntegrationsFile, w.IntegrationsFile+".real")
			os.Symlink(w.IntegrationsFile+".real", w.IntegrationsFile)
		},
		"writable parent": func(w Writer) { os.Chmod(filepath.Dir(w.IntegrationsFile), 0777) },
	} {
		t.Run(name, func(t *testing.T) {
			w := integrationWriter(t)
			prepare(w)
			before, _ := os.ReadFile(w.IntegrationsFile)
			if r := googleSet(w, "42"); r.Failure != IntegrationsFile {
				t.Fatalf("set: %+v", r)
			}
			if after, _ := os.ReadFile(w.IntegrationsFile); !bytes.Equal(before, after) {
				t.Fatal("refused write changed the file")
			}
		})
	}
}

// An interrupted earlier write leaves only the broker's own staging files,
// which never took effect; the next write proceeds.
func TestIntegrationStaleStagingDoesNotBlock(t *testing.T) {
	w := integrationWriter(t)
	stage := filepath.Join(filepath.Dir(w.IntegrationsFile), integrationStage)
	os.WriteFile(stage, []byte(`{"google":{"client_id":"stale"}}`), 0600)
	put(t, w.Dir, integrationState+".next", `{"version":1}`)
	if r := googleSet(w, "42"); r.Failure != "" || !fileAbsent(stage) || !fileAbsent(filepath.Join(w.Dir, integrationState+".next")) {
		t.Fatalf("after interrupted write: %+v", r)
	}
}

// The secret is in the request only: no reply, record or log line carries
// it, and a reply that tried to would not parse.
func TestIntegrationSecretNeverLeaves(t *testing.T) {
	w := integrationWriter(t)
	var logged bytes.Buffer
	var events []string
	w.IntegrationEvent = func(op, provider, actor string) { events = append(events, op+" "+provider+" "+actor) }
	handler := loggedBrokerHandler(w.Handle, slog.New(slog.NewJSONHandler(&logged, nil)))
	request := Request{Version: 1, Operation: OpIntegrationSet, Provider: "google", ID: "0", Actor: "42", Fields: map[string]string{"client_id": testGoogleID, "client_secret": testGoogleSecret}}
	wire, err := EncodeRequest(request)
	if err != nil || !bytes.Contains(wire, []byte(testGoogleSecret)) {
		t.Fatal("request does not carry the secret", err)
	}
	r := handler(context.Background(), request)
	reply, err := EncodeReply(r)
	if err != nil {
		t.Fatal(err)
	}
	list, _ := EncodeReply(handler(context.Background(), Request{Version: 1, Operation: OpIntegrationList, Provider: "all", ID: "0"}))
	record, _ := os.ReadFile(filepath.Join(w.Dir, integrationState))
	for name, b := range map[string][]byte{"reply": reply, "list": list, "record": record, "log": logged.Bytes(), "events": []byte(strings.Join(events, "\n"))} {
		if bytes.Contains(b, []byte(testGoogleSecret)) || bytes.Contains(b, []byte("dropbox-secret")) {
			t.Fatalf("%s carries a secret: %s", name, b)
		}
	}
	if len(events) != 1 || events[0] != "set_integration_app google 42" || !strings.Contains(logged.String(), `"outcome":"accepted"`) {
		t.Fatalf("events %v log %s", events, logged.String())
	}
	leak := strings.Replace(string(reply), `"usable":true`, `"usable":true,"client_secret":"x"`, 1)
	if _, err := ParseReply([]byte(leak)); err == nil {
		t.Fatal("a reply carrying a secret parsed")
	}
}

func TestIntegrationRequestValidation(t *testing.T) {
	valid := Request{Version: 1, Operation: OpIntegrationSet, Provider: "google", ID: "0", Actor: "42", Fields: map[string]string{"client_id": testGoogleID, "client_secret": testGoogleSecret}}
	if _, err := EncodeRequest(valid); err != nil {
		t.Fatal(err)
	}
	for name, mutate := range map[string]func(*Request){
		"google id format":    func(r *Request) { r.Fields = map[string]string{"client_id": "abc", "client_secret": "x"} },
		"missing secret":      func(r *Request) { r.Fields = map[string]string{"client_id": testGoogleID} },
		"extra field":         func(r *Request) { r.Fields["tenant_id"] = "common" },
		"unknown provider":    func(r *Request) { r.Provider = "slack" },
		"identity provider":   func(r *Request) { r.Provider = "github" },
		"no actor":            func(r *Request) { r.Actor = "" },
		"login actor":         func(r *Request) { r.Actor = "kaisa" },
		"id":                  func(r *Request) { r.ID = "42" },
		"login hint":          func(r *Request) { r.LoginHint = "x" },
		"fields on clear":     func(r *Request) { r.Operation = OpIntegrationClear },
		"fields on list":      func(r *Request) { r.Operation, r.Provider, r.Actor = OpIntegrationList, "all", "" },
		"fields on admission": func(r *Request) { r.Operation, r.Provider, r.ID = "authorize", "github", "42"; r.Actor = "" },
		"same value twice": func(r *Request) {
			r.Provider, r.Fields = "dropbox", map[string]string{"client_id": "same", "client_secret": "same"}
		},
	} {
		r := valid
		r.Fields = map[string]string{"client_id": testGoogleID, "client_secret": testGoogleSecret}
		mutate(&r)
		if _, err := EncodeRequest(r); err == nil {
			t.Errorf("%s accepted", name)
		}
	}
	w := integrationWriter(t)
	bad := valid
	bad.Fields = map[string]string{"client_id": "abc", "client_secret": "x"}
	if r := w.Handle(context.Background(), bad); r.Failure != Invalid || fileText(t, w.IntegrationsFile) != operatorFile {
		t.Fatalf("invalid fields: %+v", r)
	}
	var page struct{ Apps []json.RawMessage }
	r := integrationList(w)
	b, _ := json.Marshal(r.Integrations)
	if json.Unmarshal(b, &page) != nil || len(page.Apps) != 1 {
		t.Fatalf("list: %s", b)
	}
}
