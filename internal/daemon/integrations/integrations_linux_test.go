//go:build linux

package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

const ownerA = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
const ownerB = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"

func fakeHimalaya(t *testing.T) string {
	t.Helper()
	path, err := filepath.Abs("../../../test/fixtures/integrations/himalaya")
	if err != nil {
		t.Fatal(err)
	}
	return path
}

func newHome(t *testing.T) string {
	t.Helper()
	home := t.TempDir()
	if err := os.Chmod(home, 0o700); err != nil {
		t.Fatal(err)
	}
	return home
}

func testCatalog(t *testing.T, home string, entries []Entry, opts ...Option) *Catalog {
	t.Helper()
	env := Env{Home: home, Config: Config{Tools: map[string]string{"himalaya": fakeHimalaya(t)}}, FixtureTools: true}
	opts = append([]Option{WithQuota(func() Room { return Room{Free: 10 << 30, Limit: 50 << 30, OK: true} }), WithSyncBackoff(20*time.Millisecond, 80*time.Millisecond)}, opts...)
	c := New(env, entries, nil, opts...)
	ctx, cancel := context.WithCancel(context.Background())
	c.Start(ctx)
	t.Cleanup(func() { cancel(); c.sync.stopAll() })
	return c
}

func call(t *testing.T, h http.Handler, method, path, owner string, body any) (int, map[string]any, string) {
	t.Helper()
	var reader *bytes.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		reader = bytes.NewReader(b)
	} else {
		reader = bytes.NewReader(nil)
	}
	r := httptest.NewRequest(method, path, reader)
	if body != nil {
		r.Header.Set("Content-Type", "application/json")
	}
	if owner != "" {
		r.Header.Set("X-Agent-Host-Session", owner)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	raw := w.Body.String()
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out, raw
}

func allow(*http.Request) bool { return true }

func errorCode(m map[string]any) string {
	if e, ok := m["error"].(map[string]any); ok {
		s, _ := e["code"].(string)
		return s
	}
	return ""
}

func imapAccount(address, password string) map[string]any {
	return map[string]any{"action": "connect", "provider": "imap", "address": address, "server": "imap.example.test", "port": 993, "security": "tls", "username": address, "password": password}
}

func TestTOMLQuotingCannotAddConfiguration(t *testing.T) {
	for _, hostile := range []string{`a" \n[accounts.x]`, "back\\slash\"quote", "tab\there", "ünïcødé ✓", `"`} {
		q := tomlString(hostile)
		if strings.ContainsAny(q[1:len(q)-1], "\n\r") {
			t.Fatalf("quoted value spans lines: %q", q)
		}
		back, ok := tomlUnquote(q)
		if !ok || back != hostile {
			t.Fatalf("round trip of %q gave %q, %v", hostile, back, ok)
		}
	}
	a := PasswordAccount{Address: "p@example.test", Server: "imap.example.test", Port: 143, Security: "starttls", Username: "p", Password: "x\" ]\n[accounts.evil]"}
	got, ok := parseHimalayaConfig(a.Address, himalayaConfig(a))
	if !ok || got != a {
		t.Fatalf("config did not read back as written: %+v %v", got, ok)
	}
	tables := 0
	for _, line := range strings.Split(string(himalayaConfig(a)), "\n") {
		if strings.HasPrefix(line, "[") {
			tables++
		}
	}
	if tables != 1 {
		t.Fatal("a password added a table")
	}
}

func TestValidAddressRefusesPathsAndUppercase(t *testing.T) {
	for _, bad := range []string{"../x@example.test", "a/b@example.test", "A@example.test", "a@example", ".a@example.test", "a..b@example.test", "a@example..test", ""} {
		if ValidAddress(bad) {
			t.Fatalf("accepted %q", bad)
		}
	}
	if !ValidAddress("first.last+tag@sub.example.test") {
		t.Fatal("refused an ordinary address")
	}
}

// The IMAP entry end to end with the fake tool: a refused password and an
// unreachable server leave nothing in the home; a working one writes only
// the tool's own file and the skill; the password never comes back.
func TestIMAPConnectCheckRemove(t *testing.T) {
	home := newHome(t)
	c := testCatalog(t, home, Production())
	h := c.Handler(allow)
	const secret = "app-password-very-secret"

	code, out, _ := call(t, h, "POST", AccountsPath, "", imapAccount("person@example.test", "wrong-password"))
	if code != 422 || errorCode(out) != "credentials_rejected" {
		t.Fatalf("wrong password: %d %v", code, out)
	}
	bad := imapAccount("person@example.test", secret)
	bad["server"] = "unreachable.example.test"
	if code, out, _ = call(t, h, "POST", AccountsPath, "", bad); code != 422 || errorCode(out) != "server_unreachable" {
		t.Fatalf("unreachable: %d %v", code, out)
	}
	if entries, _ := os.ReadDir(filepath.Join(home, himalayaDir)); len(entries) != 0 {
		t.Fatalf("a refused sign-in left files: %v", entries)
	}
	if _, err := os.Stat(filepath.Join(home, SkillDir)); !os.IsNotExist(err) {
		t.Fatal("a refused sign-in wrote the skill")
	}

	code, out, raw := call(t, h, "POST", AccountsPath, "", imapAccount("person@example.test", secret))
	if code != 200 || out["skill"] != "current" || strings.Contains(raw, secret) {
		t.Fatalf("connect: %d %s", code, raw)
	}
	account := out["account"].(map[string]any)
	if account["address"] != "person@example.test" || account["services"].([]any)[0].(map[string]any)["state"] != "ok" {
		t.Fatalf("connected account: %v", account)
	}
	file := filepath.Join(home, himalayaDir, "person@example.test.toml")
	st, err := os.Stat(file)
	if err != nil || st.Mode().Perm() != 0o600 {
		t.Fatalf("tool configuration: %v %v", st, err)
	}
	if code, out, _ = call(t, h, "POST", AccountsPath, "", imapAccount("person@example.test", secret)); code != 409 || errorCode(out) != "account_exists" {
		t.Fatalf("second connect: %d %v", code, out)
	}
	skill, err := os.ReadFile(filepath.Join(home, SkillDir, "SKILL.md"))
	if err != nil || !bytes.Contains(skill, []byte("person@example.test")) || bytes.Contains(skill, []byte(secret)) || !ours(skill) {
		t.Fatalf("skill: %s %v", skill, err)
	}

	code, out, raw = call(t, h, "GET", ListPath, "", nil)
	if code != 200 || strings.Contains(raw, secret) || out["skill"] != "current" {
		t.Fatalf("list: %d %s", code, raw)
	}
	if n := len(out["accounts"].([]any)); n != 1 {
		t.Fatalf("listed %d accounts", n)
	}

	// A new password replaces the old only once it works.
	if code, out, _ = call(t, h, "POST", AccountsPath, "", map[string]any{"action": "password", "provider": "imap", "address": "person@example.test", "password": "wrong-password"}); code != 422 || errorCode(out) != "credentials_rejected" {
		t.Fatalf("bad new password: %d %v", code, out)
	}
	if b, _ := os.ReadFile(file); !bytes.Contains(b, []byte(secret)) {
		t.Fatal("a refused password replaced the working one")
	}
	if code, _, _ = call(t, h, "POST", AccountsPath, "", map[string]any{"action": "password", "provider": "imap", "address": "person@example.test", "password": "new-" + secret}); code != 200 {
		t.Fatalf("new password: %d", code)
	}

	code, out, _ = call(t, h, "DELETE", AccountsPath, "", map[string]any{"action": "remove", "provider": "imap", "address": "person@example.test", "delete_directories": false})
	if code != 200 || out["skill"] != "none" {
		t.Fatalf("remove: %d %v", code, out)
	}
	if _, err := os.Stat(file); !os.IsNotExist(err) {
		t.Fatal("removal kept the tool's configuration")
	}
	if _, err := os.Stat(filepath.Join(home, SkillDir)); !os.IsNotExist(err) {
		t.Fatal("removing the last account kept the skill")
	}
	if code, out, _ = call(t, h, "DELETE", AccountsPath, "", map[string]any{"action": "remove", "provider": "imap", "address": "person@example.test", "delete_directories": false}); code != 409 || errorCode(out) != "account_missing" {
		t.Fatalf("second remove: %d %v", code, out)
	}
}

// Accounts the person configured by hand are not the catalog's: neither
// their own himalaya configuration nor a personal-data skill they wrote is
// touched.
func TestCatalogLeavesThePersonsOwnFilesAlone(t *testing.T) {
	home := newHome(t)
	own := filepath.Join(home, ".config/himalaya/config.toml")
	ownSkill := filepath.Join(home, SkillDir, "SKILL.md")
	for path, data := range map[string]string{own: "[accounts.mine]\n", ownSkill: "---\nname: personal-data\ndescription: mine\n---\n"} {
		if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(data), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	c := testCatalog(t, home, Production())
	h := c.Handler(allow)
	code, out, _ := call(t, h, "POST", AccountsPath, "", imapAccount("person@example.test", "x-secret"))
	if code != 200 || out["skill"] != "blocked" {
		t.Fatalf("connect beside a foreign skill: %d %v", code, out)
	}
	if b, _ := os.ReadFile(ownSkill); string(b) != "---\nname: personal-data\ndescription: mine\n---\n" {
		t.Fatal("the person's own skill was overwritten")
	}
	call(t, h, "DELETE", AccountsPath, "", map[string]any{"action": "remove", "provider": "imap", "address": "person@example.test", "delete_directories": false})
	if b, _ := os.ReadFile(own); string(b) != "[accounts.mine]\n" {
		t.Fatal("the person's himalaya configuration changed")
	}
	if _, err := os.Stat(ownSkill); err != nil {
		t.Fatal("the person's own skill was removed")
	}
}

func TestSkillDirectorySymlinkIsNotFollowed(t *testing.T) {
	home := newHome(t)
	elsewhere := t.TempDir()
	if err := os.MkdirAll(filepath.Join(home, ".agents"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(elsewhere, filepath.Join(home, ".agents/skills")); err != nil {
		t.Fatal(err)
	}
	if state := writeSkill(home, []SkillAccount{{Address: "p@example.test", Label: "mail", Kinds: []string{"mail"}, Body: "x"}}); state != SkillFailed {
		t.Fatalf("state through a symlink: %s", state)
	}
	if entries, _ := os.ReadDir(elsewhere); len(entries) != 0 {
		t.Fatal("the skill was written through a symlink")
	}
}

func TestHandlerRefusesUntrustedAndMalformedRequests(t *testing.T) {
	c := testCatalog(t, newHome(t), Production())
	denied := c.Handler(func(*http.Request) bool { return false })
	if code, out, _ := call(t, denied, "GET", ListPath, "", nil); code != 403 || errorCode(out) != "cross_user_denied" {
		t.Fatalf("untrusted peer: %d %v", code, out)
	}
	h := c.Handler(allow)
	for _, tc := range []struct {
		method, path string
		body         any
	}{
		{"GET", ListPath + "?x=1", nil},
		{"POST", ListPath, nil},
		{"POST", AccountsPath, map[string]any{"action": "connect", "provider": "imap", "address": "../../x@example.test", "server": "s", "port": 993, "security": "tls", "username": "u", "password": "p"}},
		{"POST", AccountsPath, map[string]any{"action": "connect", "provider": "imap", "address": "p@example.test", "server": "s", "port": 993, "security": "none", "username": "u", "password": "p"}},
		{"POST", AccountsPath, map[string]any{"action": "connect", "provider": "imap", "address": "p@example.test", "server": "s", "port": 993, "security": "tls", "username": "u", "password": "line\nbreak"}},
		{"POST", AccountsPath, map[string]any{"action": "connect", "provider": "imap", "address": "p@example.test", "server": "s", "port": 993, "security": "tls", "username": "u", "password": "p", "extra": true}},
		{"DELETE", AccountsPath, map[string]any{"action": "remove", "provider": "imap", "address": "p@example.test"}},
		{"POST", AccountsPath, map[string]any{"action": "connect", "provider": "google", "address": "p@example.test", "server": "s", "port": 993, "security": "tls", "username": "u", "password": "p"}},
	} {
		code, out, _ := call(t, h, tc.method, tc.path, "", tc.body)
		if code < 400 || code >= 500 || errorCode(out) == "" {
			t.Fatalf("%s %s %v: %d %v", tc.method, tc.path, tc.body, code, out)
		}
	}
	// A login route needs the gateway's session owner.
	if code, _, _ := call(t, h, "GET", LoginPath, "", nil); code != 403 {
		t.Fatalf("login without owner: %d", code)
	}
}

func TestUnavailableToolIsShownNotConnectable(t *testing.T) {
	home := newHome(t)
	c := New(Env{Home: home}, Production(), nil)
	h := c.Handler(allow)
	_, out, _ := call(t, h, "GET", ListPath, "", nil)
	for _, provider := range out["providers"].([]any) {
		if provider.(map[string]any)["available"] != false || provider.(map[string]any)["unavailable_reason"] != "tool_unavailable" {
			t.Fatalf("provider available without tools: %v", provider)
		}
	}
	if out["skill"] != "none" {
		t.Fatalf("list without tools: %v", out)
	}
	if code, out, _ := call(t, h, "POST", AccountsPath, "", imapAccount("p@example.test", "x")); code != 409 || errorCode(out) != "provider_unavailable" {
		t.Fatalf("connect without tool: %d %v", code, out)
	}
}

func TestConfigRefusesAFileRootDidNotWrite(t *testing.T) {
	// A missing file in a root-owned directory is an installation without
	// integrations, not an error.
	if cfg, err := loadConfig("/open-habitat-test-no-such-integrations.json", nil); err != nil || len(cfg.Tools) != 0 {
		t.Fatalf("missing file: %+v %v", cfg, err)
	}
	dir := t.TempDir()
	path := filepath.Join(dir, "integrations.json")
	if err := os.WriteFile(path, []byte(`{"tools":{"himalaya":"/usr/bin/himalaya"}}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := loadConfig(path, nil); err == nil && os.Geteuid() != 0 {
		t.Fatal("a configuration written by an ordinary user was trusted")
	}
	env := Env{Config: Config{Tools: map[string]string{"himalaya": fakeHimalaya(t)}}}
	if _, ok := env.Tool("himalaya"); ok && os.Geteuid() != 0 {
		t.Fatal("a tool not owned by root was trusted outside a fixture")
	}
}

func TestConfigEntryFailuresAreIsolated(t *testing.T) {
	for _, broken := range []string{
		`"microsoft":{"client_id":123}`,
		`"microsoft":{"client_id":"not-a-uuid"}`,
		`"microsoft":{"client_id":"00000000-0000-0000-0000-000000000000","unexpected":"secret"}`,
		`"microsoft":null`,
	} {
		t.Run(broken, func(t *testing.T) {
			var logs bytes.Buffer
			data := fmt.Sprintf(`{
				"unknown-secret-provider":{"token":"secret"},
				%s,
				"tools":{"himalaya":%q,"rclone":%q,"bad":"relative","other":123},
				"dropbox":{"client_id":"test-client","client_secret":"test-secret"}
			}`, broken, fakeHimalaya(t), fakeRclone(t))
			cfg, err := parseConfig([]byte(data), slog.New(slog.NewJSONHandler(&logs, nil)))
			if err != nil {
				t.Fatal(err)
			}
			env := Env{FixtureTools: true, LoadConfig: func() (Config, error) { return cfg, nil }}
			if !(&himalaya{}).Available(env) || !(&dropbox{}).Available(env) {
				t.Fatalf("valid integrations unavailable: %+v", cfg)
			}
			if cfg.Microsoft != nil || (&microsoft{}).Available(env) || len(cfg.Tools) != 2 {
				t.Fatalf("invalid entries retained: %+v", cfg)
			}
			for _, reason := range []string{"unknown_entry", "invalid_entry", "invalid_tool"} {
				if !strings.Contains(logs.String(), reason) {
					t.Fatalf("missing diagnostic %s: %s", reason, &logs)
				}
			}
			if strings.Contains(logs.String(), "secret") || strings.Contains(logs.String(), "relative") {
				t.Fatalf("configuration leaked in diagnostics: %s", &logs)
			}
		})
	}
}

func TestConfigRejectsMalformedDocument(t *testing.T) {
	for _, data := range []string{`null`, `[]`, `{"tools":`, `{} {}`} {
		if _, err := parseConfig([]byte(data), nil); err == nil {
			t.Fatalf("accepted malformed document %q", data)
		}
	}
}

func TestConfigMalformedToolsLeaveAppsAvailable(t *testing.T) {
	for _, tools := range []string{`[]`, `null`, `"wrong"`} {
		cfg, err := parseConfig([]byte(`{"tools":`+tools+`,"google":{"client_id":"client","client_secret":"secret"}}`), nil)
		if err != nil || cfg.Google == nil || len(cfg.Tools) != 0 {
			t.Fatalf("tools %s: %+v %v", tools, cfg, err)
		}
	}
}

// ---- Relayed logins, folder choice and sync, with synthetic entries ----

// scriptEntry is a synthetic login entry. Its "tool" records the account in
// a file in the home, as a real tool's token store would, so the catalog's
// view of accounts comes from files exactly as in production.
type scriptEntry struct {
	provider Provider
	kind     LoginKind
	// signsIn is the address the provider reports after consent.
	signsIn  string
	sync     bool
	folders  []Folder
	syncTool string
	// login controls the synthetic tool.
	consent   string
	blocked   bool
	redirects atomic.Int32
	mu        sync.Mutex
	chosen    []string
}

func (s *scriptEntry) dir(env Env) string {
	return filepath.Join(env.Home, ".config/synthetic-"+string(s.provider))
}

func (s *scriptEntry) Provider() Provider { return s.provider }
func (s *scriptEntry) Login() LoginKind   { return s.kind }
func (s *scriptEntry) Services() []string {
	if s.sync {
		return []string{"drive"}
	}
	return []string{"mail"}
}
func (s *scriptEntry) Available(Env) bool { return true }
func (s *scriptEntry) Accounts(env Env) ([]string, error) {
	entries, err := os.ReadDir(s.dir(env))
	if os.IsNotExist(err) {
		return nil, nil
	}
	var out []string
	for _, e := range entries {
		out = append(out, e.Name())
	}
	return out, err
}
func (s *scriptEntry) Check(_ context.Context, _ Env, _ string) []Service {
	return []Service{{ID: s.Services()[0], State: StateOK}}
}
func (s *scriptEntry) Remove(_ context.Context, env Env, address string) error {
	return os.Remove(filepath.Join(s.dir(env), address))
}
func (s *scriptEntry) Skill(Env, string) SkillAccount {
	return SkillAccount{Label: "synthetic", Kinds: []string{"files"}, Body: "Synthetic.", Synced: s.sync}
}

// syncScriptEntry adds folder choice and a sync client to scriptEntry.
type syncScriptEntry struct{ *scriptEntry }

func (s syncScriptEntry) Directories(_ Env, address string) []SyncDirectory {
	return []SyncDirectory{{Service: "drive", Path: "cloud/synthetic/" + address}}
}
func (s syncScriptEntry) SyncCommand(env Env, address string) (Command, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.chosen) == 0 {
		return Command{}, false
	}
	return Command{Path: "/bin/sh", Args: []string{"-c", s.syncTool, "sync", filepath.Join(env.Home, "cloud/synthetic", address)}}, true
}
func (s syncScriptEntry) Folders(context.Context, Env, string) ([]Folder, error) {
	return s.folders, nil
}
func (s syncScriptEntry) ChooseFolders(_ context.Context, _ Env, _ string, ids []string) error {
	s.mu.Lock()
	s.chosen = ids
	s.mu.Unlock()
	return nil
}

// StartLogin runs a real child process through the relay's LineTool, so
// the cancel and output paths are the production ones: the script prints
// its prompt, then waits for a pasted line or for its "provider" to approve
// (a file the test creates), and records the account.
func (s *scriptEntry) StartLogin(ctx context.Context, env Env, address string) (Login, error) {
	if err := os.MkdirAll(s.dir(env), 0o700); err != nil {
		return nil, err
	}
	script := `
if [ "$KIND" = device_code ]; then
  echo "Open https://login.example.test/device and enter the code K7QM-2PXD"
  while [ ! -e "$HOME/approve" ]; do sleep 0.05; done
else
  echo "Visit https://accounts.example.test/o/oauth2/auth?state=s1"
  read -r pasted
  case "$pasted" in *state=s1*) ;; *) echo "state mismatch"; exit 3 ;; esac
fi
: > "$STORE/$SIGNS_IN"
echo "signed in $SIGNS_IN"
`
	tool, err := env.StartLineTool(ctx, Command{Path: "/bin/sh", Args: []string{"-c", script}, Env: []string{"KIND=" + string(s.kind), "STORE=" + s.dir(env), "SIGNS_IN=" + s.signsIn}})
	if err != nil {
		return nil, err
	}
	return &scriptLogin{entry: s, tool: tool}, nil
}

type scriptLogin struct {
	entry *scriptEntry
	tool  *LineTool
}

func (l *scriptLogin) Prompt(ctx context.Context) (Prompt, error) {
	for {
		select {
		case line, ok := <-l.tool.Lines():
			if !ok {
				return Prompt{}, ToolFailed
			}
			if l.entry.blocked {
				return Prompt{}, DeviceCodeBlocked
			}
			if l.entry.consent != "" {
				return Prompt{}, ConsentRequired{URL: l.entry.consent}
			}
			if strings.Contains(line, "/device") {
				return Prompt{VerificationURI: "https://login.example.test/device", UserCode: "K7QM-2PXD", ExpiresAt: time.Now().Add(15 * time.Minute)}, nil
			}
			if strings.Contains(line, "oauth2/auth") {
				return Prompt{AuthorizationURL: "https://accounts.example.test/o/oauth2/auth?state=s1", RedirectPrefix: "http://127.0.0.1", ExpiresAt: time.Now().Add(5 * time.Minute)}, nil
			}
		case <-ctx.Done():
			return Prompt{}, ctx.Err()
		}
	}
}

func (l *scriptLogin) Redirect(_ context.Context, raw string) error {
	l.entry.redirects.Add(1)
	return l.tool.Write(raw)
}

func (l *scriptLogin) Wait(ctx context.Context) (string, error) {
	select {
	case <-l.tool.Done():
	case <-ctx.Done():
		l.tool.Stop()
		return "", ctx.Err()
	}
	if l.tool.Err() != nil {
		return "", RedirectRejected
	}
	return l.entry.signsIn, nil
}

func (l *scriptLogin) Cancel() { l.tool.Stop() }

func waitState(t *testing.T, h http.Handler, owner string, want ...string) map[string]any {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for {
		_, out, _ := call(t, h, "GET", LoginPath, owner, nil)
		for _, w := range want {
			if out["state"] == w {
				return out
			}
		}
		if time.Now().After(deadline) {
			t.Fatalf("login stayed %v, want %v", out, want)
		}
		time.Sleep(30 * time.Millisecond)
	}
}

// Login completion commits the native account before reconciliation so a late
// cancellation cannot undo it. Tests inspecting the derived skill, boot signal
// or supervised clients must wait for the worker, not just the browser state.
func waitLoginWorker(t *testing.T, c *Catalog) {
	t.Helper()
	c.relay.mu.Lock()
	a := c.relay.a
	c.relay.mu.Unlock()
	if a == nil {
		t.Fatal("no login attempt")
	}
	select {
	case <-a.done:
	case <-time.After(10 * time.Second):
		t.Fatal("login worker did not finish reconciliation")
	}
}

func TestDeviceCodeRelayBelongsToItsSession(t *testing.T) {
	home := newHome(t)
	e := &scriptEntry{provider: Microsoft, kind: DeviceCode, signsIn: "person@work.example.test"}
	c := testCatalog(t, home, []Entry{e})
	h := c.Handler(allow)

	code, out, _ := call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "microsoft"})
	if code != 200 {
		t.Fatalf("start: %d %v", code, out)
	}
	out = waitState(t, h, ownerA, "device_code")
	if out["user_code"] != "K7QM-2PXD" || out["verification_uri"] != "https://login.example.test/device" {
		t.Fatalf("device prompt: %v", out)
	}
	id := out["attempt_id"].(string)
	// Another browser session sees no attempt of its own and cannot take
	// over or cancel this one.
	if _, other, _ := call(t, h, "GET", LoginPath, ownerB, nil); other["state"] != "none" || len(other) != 2 {
		t.Fatalf("other session saw: %v", other)
	}
	if code, out, _ := call(t, h, "POST", LoginPath, ownerB, map[string]any{"action": "start", "provider": "microsoft"}); code != 409 || errorCode(out) != "attempt_active" {
		t.Fatalf("other session start: %d %v", code, out)
	}
	if code, _, _ := call(t, h, "DELETE", LoginPath, ownerB, map[string]any{"action": "cancel", "attempt_id": id}); code != 404 {
		t.Fatalf("other session cancel: %d", code)
	}
	if err := os.WriteFile(filepath.Join(home, "approve"), nil, 0o600); err != nil {
		t.Fatal(err)
	}
	out = waitState(t, h, ownerA, "completed")
	waitLoginWorker(t, c)
	if out["address"] != "person@work.example.test" {
		t.Fatalf("completed: %v", out)
	}
	if b, err := os.ReadFile(filepath.Join(home, SkillDir, "SKILL.md")); err != nil || !bytes.Contains(b, []byte("person@work.example.test")) {
		t.Fatalf("skill after login: %v", err)
	}
}

func TestDeviceCodeFailuresAreFixedCodes(t *testing.T) {
	for _, tc := range []struct {
		entry   *scriptEntry
		failure string
	}{
		{&scriptEntry{provider: Microsoft, kind: DeviceCode, signsIn: "p@example.test", consent: "https://login.example.test/contoso/adminconsent?client_id=x"}, "consent_required"},
		{&scriptEntry{provider: Microsoft, kind: DeviceCode, signsIn: "p@example.test", blocked: true}, "device_code_blocked"},
	} {
		h := testCatalog(t, newHome(t), []Entry{tc.entry}).Handler(allow)
		call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "microsoft"})
		out := waitState(t, h, ownerA, "failed")
		if out["failure"] != tc.failure || (tc.failure == "consent_required") != (out["consent_url"] != nil) {
			t.Fatalf("failure: %v", out)
		}
	}
}

func TestPastedRedirectIsValidatedAndHandedOnce(t *testing.T) {
	home := newHome(t)
	e := &scriptEntry{provider: Google, kind: PastedRedirect, signsIn: "person.home@example.test", sync: true, syncTool: "sleep 30",
		folders: []Folder{{ID: "own", Name: "Oma Drive", Bytes: 4 << 30, Suggested: true}, {ID: "photos", Name: "Kuvat", Bytes: 31 << 30}}}
	c := testCatalog(t, home, []Entry{syncScriptEntry{e}})
	h := c.Handler(allow)
	call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "google"})
	out := waitState(t, h, ownerA, "open_url")
	id := out["attempt_id"].(string)
	if out["redirect_prefix"] != "http://127.0.0.1" {
		t.Fatalf("prompt: %v", out)
	}
	// The provider's own page and a non-loopback address never reach the tool.
	for _, wrong := range []string{"https://accounts.example.test/signin/oauth/consent?x=1", "http://127.0.0.2/?code=x&state=s1", "http://127.0.0.1.evil.test/?state=s1", "http://localhost:53682/?state=s1"} {
		if code, out, _ := call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "redirect", "attempt_id": id, "redirect_url": wrong}); code != 422 || errorCode(out) != "redirect_invalid" {
			if code != 400 {
				t.Fatalf("%s: %d %v", wrong, code, out)
			}
		}
	}
	if e.redirects.Load() != 0 {
		t.Fatal("an invalid address reached the tool")
	}
	paste := "http://127.0.0.1:46399/oauth2/callback?state=s1&code=4/synthetic"
	if code, _, _ := call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "redirect", "attempt_id": id, "redirect_url": paste}); code != 200 {
		t.Fatalf("paste: %d", code)
	}
	if code, out, _ := call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "redirect", "attempt_id": id, "redirect_url": paste}); code != 409 || errorCode(out) != "attempt_active" {
		t.Fatalf("second paste: %d %v", code, out)
	}
	out = waitState(t, h, ownerA, "choose_folders")
	if out["directory"] != "~/cloud/synthetic/person.home@example.test" || out["free_bytes"].(float64) != float64(10<<30) {
		t.Fatalf("folders: %v", out)
	}
	// A choice that does not fit the home is refused, and nothing syncs.
	if code, out, _ := call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "folders", "attempt_id": id, "folders": []string{"own", "photos"}}); code != 422 || errorCode(out) != "quota_insufficient" {
		t.Fatalf("over quota: %d %v", code, out)
	}
	if code, out, _ := call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "folders", "attempt_id": id, "folders": []string{"elsewhere"}}); code != 400 {
		t.Fatalf("unknown folder: %d %v", code, out)
	}
	if code, _, _ := call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "folders", "attempt_id": id, "folders": []string{"own"}}); code != 200 {
		t.Fatalf("folders: %d", code)
	}
	waitState(t, h, ownerA, "completed")
	// Completion precedes reconciliation so cancellation cannot undo committed
	// credentials. Wait for its side effects before issuing another write;
	// remove deliberately refuses contention rather than queuing a deletion.
	c.write.Lock()
	c.write.Unlock()
	if !c.sync.supervised(key{Google, "person.home@example.test"}) {
		t.Fatal("sync did not start after the folder choice")
	}
	if _, err := os.Stat(filepath.Join(home, BootSignal)); err != nil {
		t.Fatal("no boot signal for a syncing account")
	}
	_, list, _ := call(t, h, "GET", ListPath, "", nil)
	svc := list["accounts"].([]any)[0].(map[string]any)["services"].([]any)[0].(map[string]any)
	if svc["directory"] != "~/cloud/synthetic/person.home@example.test" {
		t.Fatalf("listed service: %v", svc)
	}
	// Removal stops sync and the boot signal goes; the folder stays unless
	// asked, and then goes to the Trash.
	if err := os.MkdirAll(filepath.Join(home, "cloud/synthetic/person.home@example.test"), 0o700); err != nil {
		t.Fatal(err)
	}
	var trashed []string
	c.trash = func(rel string) error { trashed = append(trashed, rel); return nil }
	code, out, _ := call(t, h, "DELETE", AccountsPath, "", map[string]any{"action": "remove", "provider": "google", "address": "person.home@example.test", "delete_directories": true})
	if code != 200 || len(trashed) != 1 || trashed[0] != "cloud/synthetic/person.home@example.test" || out["trashed_directories"] == nil {
		t.Fatalf("remove: %d %v %v", code, out, trashed)
	}
	if c.sync.supervised(key{Google, "person.home@example.test"}) {
		t.Fatal("sync kept running after removal")
	}
	if _, err := os.Stat(filepath.Join(home, BootSignal)); !os.IsNotExist(err) {
		t.Fatal("boot signal stayed without a syncing account")
	}
}

func TestCancelAtFolderChoiceKeepsNothingNew(t *testing.T) {
	home := newHome(t)
	e := &scriptEntry{provider: Google, kind: PastedRedirect, signsIn: "new@example.test", sync: true, syncTool: "sleep 30", folders: []Folder{{ID: "own", Name: "Oma", Bytes: 1}}}
	h := testCatalog(t, home, []Entry{syncScriptEntry{e}}).Handler(allow)
	call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "google"})
	id := waitState(t, h, ownerA, "open_url")["attempt_id"].(string)
	call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "redirect", "attempt_id": id, "redirect_url": "http://127.0.0.1:1/?state=s1&code=x"})
	waitState(t, h, ownerA, "choose_folders")
	if code, _, _ := call(t, h, "DELETE", LoginPath, ownerA, map[string]any{"action": "cancel", "attempt_id": id}); code != 200 {
		t.Fatal("cancel refused")
	}
	if out := waitState(t, h, ownerA, "failed"); out["failure"] != "cancelled" {
		t.Fatalf("cancelled: %v", out)
	}
	deadline := time.Now().Add(5 * time.Second)
	for {
		if list, _ := e.Accounts(Env{Home: home}); len(list) == 0 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("an abandoned connection was kept")
		}
		time.Sleep(20 * time.Millisecond)
	}
}

func TestReloginToAnotherAccountIsRefused(t *testing.T) {
	home := newHome(t)
	e := &scriptEntry{provider: Microsoft, kind: DeviceCode, signsIn: "first@example.test"}
	h := testCatalog(t, home, []Entry{e}).Handler(allow)
	call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "microsoft"})
	waitState(t, h, ownerA, "device_code")
	os.WriteFile(filepath.Join(home, "approve"), nil, 0o600)
	waitState(t, h, ownerA, "completed")

	e.signsIn = "second@example.test"
	if code, out, _ := call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "microsoft", "address": "first@example.test"}); code != 200 {
		t.Fatalf("relogin: %d %v", code, out)
	}
	if out := waitState(t, h, ownerA, "failed"); out["failure"] != "account_mismatch" {
		t.Fatalf("mismatch: %v", out)
	}
	list, _ := e.Accounts(Env{Home: home})
	if len(list) != 1 || list[0] != "first@example.test" {
		t.Fatalf("accounts after a mismatched relogin: %v", list)
	}
}

func TestSupervisorRestartsAFailingClient(t *testing.T) {
	home := newHome(t)
	runs := filepath.Join(home, "runs")
	sup := newSupervisor(Env{Home: home}, nil)
	sup.first, sup.max = 10*time.Millisecond, 40*time.Millisecond
	k := key{Google, "p@example.test"}
	sup.reconcile(map[key]Command{k: {Path: "/bin/sh", Args: []string{"-c", "echo x >> " + runs + "; exit 1"}}})
	deadline := time.Now().Add(5 * time.Second)
	for {
		b, _ := os.ReadFile(runs)
		if bytes.Count(b, []byte("x")) >= 3 && sup.restarting(k) {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("restarts: %q", b)
		}
		time.Sleep(10 * time.Millisecond)
	}
	sup.reconcile(nil)
	if sup.supervised(k) {
		t.Fatal("client kept after reconcile")
	}
	b1, _ := os.ReadFile(runs)
	time.Sleep(150 * time.Millisecond)
	if b2, _ := os.ReadFile(runs); !bytes.Equal(b1, b2) {
		t.Fatal("a stopped client was restarted")
	}
}

func TestLineToolCancelKillsAToolThatIgnoresTerm(t *testing.T) {
	home := newHome(t)
	pidFile := filepath.Join(home, "pid")
	tool, err := Env{Home: home}.StartLineTool(context.Background(), Command{Path: "/bin/sh", Args: []string{"-c", "trap '' TERM; echo $$ > " + pidFile + "; echo ready; while :; do sleep 0.05; done"}})
	if err != nil {
		t.Fatal(err)
	}
	<-tool.Lines()
	start := time.Now()
	tool.Stop()
	if time.Since(start) > 5*time.Second {
		t.Fatal("stop waited too long")
	}
	b, _ := os.ReadFile(pidFile)
	if _, err := os.Stat("/proc/" + strings.TrimSpace(string(b))); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("tool still running after Stop: %v", err)
	}
}

// brokenEntry's tool files cannot be read.
type brokenEntry struct{ *scriptEntry }

func (brokenEntry) Accounts(Env) ([]string, error) { return nil, errors.New("unreadable") }

// An unreadable inventory is not an empty one: the page gets no false "no
// accounts", and the skill keeps the accounts the other tools still hold.
func TestUnreadableInventoryChangesNothing(t *testing.T) {
	home := newHome(t)
	// Seed the native account and skill without starting background work.
	env := Env{Home: home, Config: Config{Tools: map[string]string{"himalaya": fakeHimalaya(t)}}, FixtureTools: true}
	seed := New(env, []Entry{&himalaya{}}, nil)
	if code, _, _ := call(t, seed.Handler(allow), "POST", AccountsPath, "", imapAccount("person@example.test", "x-secret")); code != 200 {
		t.Fatal("connect failed")
	}
	before, err := os.ReadFile(filepath.Join(home, SkillDir, "SKILL.md"))
	if err != nil || !bytes.Contains(before, []byte("person@example.test")) {
		t.Fatalf("initial skill missing the connected account: %s %v", before, err)
	}
	// Entries stay fixed after construction, including while Start reconciles.
	c := testCatalog(t, home, []Entry{&himalaya{}, brokenEntry{&scriptEntry{provider: Google, kind: PastedRedirect}}})
	h := c.Handler(allow)
	if code, out, _ := call(t, h, "GET", ListPath, "", nil); code != 503 {
		t.Fatalf("list with an unreadable tool: %d %v", code, out)
	}
	c.write.Lock()
	state := c.reconcile()
	c.write.Unlock()
	after, err := os.ReadFile(filepath.Join(home, SkillDir, "SKILL.md"))
	if err != nil || state != SkillFailed || !bytes.Equal(before, after) {
		t.Fatalf("reconcile from a partial inventory: %s, skill read: %v", state, err)
	}
}

func TestSkillDescriptionIsAQuotedScalar(t *testing.T) {
	skill := string(renderSkill([]SkillAccount{{Address: "p@example.test", Label: "mail (IMAP)", Kinds: []string{"mail"}, Body: "x"}}))
	line := strings.Split(skill, "\n")[2]
	var description string
	if !strings.HasPrefix(line, "description: \"") || json.Unmarshal([]byte(strings.TrimPrefix(line, "description: ")), &description) != nil || !strings.Contains(description, "accounts: p@example.test (mail)") {
		t.Fatalf("description line: %q", line)
	}
}

// A removal while another session is choosing folders ends that attempt; a
// late folder choice cannot bring the account back.
func TestRemovalDuringFolderChoiceIsFinal(t *testing.T) {
	home := newHome(t)
	e := &scriptEntry{provider: Google, kind: PastedRedirect, signsIn: "new@example.test", sync: true, syncTool: "sleep 30", folders: []Folder{}}
	c := testCatalog(t, home, []Entry{syncScriptEntry{e}})
	h := c.Handler(allow)
	call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "google"})
	id := waitState(t, h, ownerA, "open_url")["attempt_id"].(string)
	call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "redirect", "attempt_id": id, "redirect_url": "http://127.0.0.1:1/?state=s1&code=x"})
	_, _, raw := call(t, h, "GET", LoginPath, ownerA, nil)
	for !strings.Contains(raw, `"choose_folders"`) {
		time.Sleep(20 * time.Millisecond)
		_, _, raw = call(t, h, "GET", LoginPath, ownerA, nil)
	}
	// An empty folder list is still a list.
	if !strings.Contains(raw, `"folders":[]`) {
		t.Fatalf("empty folders omitted: %s", raw)
	}
	e.folders = []Folder{{ID: "own", Name: "Oma", Bytes: 1}}
	if code, _, _ := call(t, h, "DELETE", AccountsPath, "", map[string]any{"action": "remove", "provider": "google", "address": "new@example.test", "delete_directories": false}); code != 200 {
		t.Fatal("remove refused")
	}
	if code, _, _ := call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "folders", "attempt_id": id, "folders": []string{"own"}}); code < 400 {
		t.Fatal("a folder choice after removal was accepted")
	}
	time.Sleep(200 * time.Millisecond)
	if list, _ := e.Accounts(Env{Home: home}); len(list) != 0 {
		t.Fatalf("removed account came back: %v", list)
	}
}

// Cancelling at the folder step and starting again at once: the first
// attempt's cleanup finishes before the second starts, so it cannot delete
// what the second connects.
func TestCancelledAttemptCleansUpBeforeItsSuccessor(t *testing.T) {
	home := newHome(t)
	e := &scriptEntry{provider: Google, kind: PastedRedirect, signsIn: "new@example.test", sync: true, syncTool: "sleep 30", folders: []Folder{{ID: "own", Name: "Oma", Bytes: 1}}}
	h := testCatalog(t, home, []Entry{syncScriptEntry{e}}).Handler(allow)
	login := func() string {
		call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "google"})
		id := waitState(t, h, ownerA, "open_url")["attempt_id"].(string)
		call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "redirect", "attempt_id": id, "redirect_url": "http://127.0.0.1:1/?state=s1&code=x"})
		waitState(t, h, ownerA, "choose_folders")
		return id
	}
	first := login()
	call(t, h, "DELETE", LoginPath, ownerA, map[string]any{"action": "cancel", "attempt_id": first})
	second := login()
	call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "folders", "attempt_id": second, "folders": []string{"own"}})
	waitState(t, h, ownerA, "completed")
	time.Sleep(200 * time.Millisecond)
	if list, _ := e.Accounts(Env{Home: home}); len(list) != 1 {
		t.Fatalf("the successor's account: %v", list)
	}
}

func TestToolDiscoversOperatorChanges(t *testing.T) {
	cfg := Config{}
	var loadErr error
	env := Env{FixtureTools: true, LoadConfig: func() (Config, error) { return cfg, loadErr }}
	check := func(want bool) {
		t.Helper()
		if _, ok := env.Tool("himalaya"); ok != want {
			t.Fatalf("tool availability = %v, want %v", ok, want)
		}
	}
	check(false)
	cfg = Config{Tools: map[string]string{"himalaya": fakeHimalaya(t)}}
	check(true)
	loadErr = errors.New("untrusted configuration")
	check(false)
	loadErr = nil
	check(true)
	cfg.Tools["himalaya"] = "/no-such-installed-tool"
	check(false)
	cfg = Config{}
	check(false)
}

// A tool can finish just as cancellation arrives; Wait may report success even
// then. The final sync commit must check that the attempt still owns its result.
type lateFolderEntry struct {
	syncScriptEntry
	started, release chan struct{}
}

func (e lateFolderEntry) ChooseFolders(ctx context.Context, env Env, address string, ids []string) error {
	close(e.started)
	<-e.release
	return e.syncScriptEntry.ChooseFolders(ctx, env, address, ids)
}
func TestInitialSyncRejectsReplacementButExplicitStopKeepsNativeAccount(t *testing.T) {
	home := newHome(t)
	s := &scriptEntry{provider: Google, kind: PastedRedirect, signsIn: "new@example.test", sync: true, syncTool: "sleep 30", folders: []Folder{{ID: "own", Name: "Own", Bytes: 1}}}
	e := lateFolderEntry{syncScriptEntry: syncScriptEntry{s}, started: make(chan struct{}), release: make(chan struct{})}
	c := testCatalog(t, home, []Entry{e})
	h := c.Handler(allow)
	call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "google"})
	view := waitState(t, h, ownerA, "open_url")
	id := view["attempt_id"].(string)
	call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "redirect", "attempt_id": id, "redirect_url": "http://127.0.0.1:1/?state=s1&code=x"})
	waitState(t, h, ownerA, "choose_folders")
	// PUT's short settling wait is independent of the tool's initial sync.
	call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "folders", "attempt_id": id, "folders": []string{"own"}})
	select {
	case <-e.started:
	case <-time.After(3 * time.Second):
		t.Fatal("initial sync did not start")
	}
	if view := waitState(t, h, ownerA, "completing"); view["address"] != s.signsIn {
		t.Fatal("first native sync lost its phase observation", view)
	}
	if err := c.startLogin(ownerA, e, "", ""); err != errAttemptActive {
		t.Fatal("replacement interrupted sync", err)
	}
	// Status does not wait behind the long native initial pass.
	account := c.check(context.Background(), e, s.signsIn)
	if account.Services[0].State != StateSyncing {
		t.Fatal(account)
	}
	if code, _, _ := call(t, h, "DELETE", LoginPath, ownerA, map[string]any{"action": "cancel", "attempt_id": id}); code != 200 {
		t.Fatal("explicit stop refused", code)
	}
	close(e.release)
	c.relay.mu.Lock()
	done := c.relay.a.done
	c.relay.mu.Unlock()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("cancelled sync did not finish")
	}
	if list, _ := s.Accounts(Env{Home: home}); len(list) != 1 {
		t.Fatal("background sync lost the native account")
	}
	if c.sync.supervised(key{Google, s.signsIn}) {
		t.Fatal("explicitly stopped initial sync started a background client")
	}
}

func TestBusyIntegrationMutationsDoNotQueue(t *testing.T) {
	c := testCatalog(t, newHome(t), []Entry{&himalaya{}})
	h := c.Handler(allow)
	code, _, _ := call(t, h, "POST", AccountsPath, "", imapAccount("person@example.test", "initial-secret"))
	if code != 200 {
		t.Fatal(code)
	}
	for _, tc := range []struct {
		method string
		body   map[string]any
	}{
		{"POST", imapAccount("another@example.test", "new-secret")},
		{"POST", map[string]any{"action": "password", "provider": "imap", "address": "person@example.test", "password": "changed-secret"}},
		{"DELETE", map[string]any{"action": "remove", "provider": "imap", "address": "person@example.test", "delete_directories": false}},
	} {
		t.Run(tc.method+tc.body["action"].(string), func(t *testing.T) {
			c.write.Lock()
			type response struct {
				code int
				out  map[string]any
			}
			done := make(chan response, 1)
			go func() { code, out, _ := call(t, h, tc.method, AccountsPath, "", tc.body); done <- response{code, out} }()
			select {
			case res := <-done:
				c.write.Unlock()
				if res.code != 503 || errorCode(res.out) != "native_unavailable" {
					t.Fatalf("busy mutation: %d %v", res.code, res.out)
				}
			case <-time.After(time.Second):
				c.write.Unlock()
				<-done
				t.Fatal("mutation queued behind long-running initial sync")
			}
		})
	}
	exists, err := c.has(&himalaya{}, "person@example.test")
	if err != nil || !exists {
		t.Fatal("refused removal executed later")
	}
	exists, err = c.has(&himalaya{}, "another@example.test")
	if err != nil || exists {
		t.Fatal("refused connection executed later")
	}
}

// Completion must linearize before reconciliation starts independent native
// refreshers. Otherwise cancellation here reports failure but leaves a new
// connection usable. Exercise both folder and non-folder finalization paths.
type completionBarrierEntry struct {
	*scriptEntry
	reached, release chan struct{}
	once             sync.Once
}

func (e *completionBarrierEntry) Accounts(env Env) ([]string, error) {
	accounts, err := e.scriptEntry.Accounts(env)
	if len(accounts) > 0 {
		e.once.Do(func() { close(e.reached); <-e.release })
	}
	return accounts, err
}

type completionFolderBarrier struct{ *completionBarrierEntry }

func (e completionFolderBarrier) Directories(env Env, a string) []SyncDirectory {
	return syncScriptEntry{e.scriptEntry}.Directories(env, a)
}
func (e completionFolderBarrier) SyncCommand(env Env, a string) (Command, bool) {
	return syncScriptEntry{e.scriptEntry}.SyncCommand(env, a)
}
func (e completionFolderBarrier) Folders(ctx context.Context, env Env, a string) ([]Folder, error) {
	return syncScriptEntry{e.scriptEntry}.Folders(ctx, env, a)
}
func (e completionFolderBarrier) ChooseFolders(ctx context.Context, env Env, a string, ids []string) error {
	return syncScriptEntry{e.scriptEntry}.ChooseFolders(ctx, env, a, ids)
}
func TestCompletionWinsCancellationDuringReconciliation(t *testing.T) {
	for _, folders := range []bool{false, true} {
		t.Run(fmt.Sprint(folders), func(t *testing.T) {
			s := &scriptEntry{provider: Google, kind: PastedRedirect, signsIn: "new@example.test", sync: folders, syncTool: "sleep 30", folders: []Folder{{ID: "own", Name: "Own", Bytes: 1}}}
			e := &completionBarrierEntry{scriptEntry: s, reached: make(chan struct{}), release: make(chan struct{})}
			var entry Entry = e
			if folders {
				entry = completionFolderBarrier{e}
			}
			c := testCatalog(t, newHome(t), []Entry{entry})
			defer c.sync.stopAll()
			h := c.Handler(allow)
			call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "google"})
			id := waitState(t, h, ownerA, "open_url")["attempt_id"].(string)
			call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "redirect", "attempt_id": id, "redirect_url": "http://127.0.0.1:1/?state=s1&code=x"})
			if folders {
				waitState(t, h, ownerA, "choose_folders")
				call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "folders", "attempt_id": id, "folders": []string{"own"}})
			}
			select {
			case <-e.reached:
			case <-time.After(3 * time.Second):
				t.Fatal("final reconciliation not reached")
			}
			if err := c.cancelLogin(ownerA, id); err != nil {
				t.Fatal(err)
			}
			state := c.relay.view(ownerA, time.Now()).State
			close(e.release)
			waitLoginWorker(t, c)
			if state != "completed" {
				t.Fatalf("late cancellation reported %s while retaining credentials", state)
			}
			accounts, err := s.Accounts(c.env)
			if err != nil || len(accounts) != 1 {
				t.Fatal(accounts, err)
			}
			if b, err := os.ReadFile(filepath.Join(c.env.Home, SkillDir, "SKILL.md")); err != nil || !bytes.Contains(b, []byte(s.signsIn)) {
				t.Fatalf("skill after reconciliation: %v", err)
			}
			if folders && !c.sync.supervised(key{Google, s.signsIn}) {
				t.Fatal("completed account not supervised")
			}
		})
	}
}

func TestLoginFailureDiagnosticKeepsNativeTextPrivate(t *testing.T) {
	var logs bytes.Buffer
	c := testCatalog(t, newHome(t), nil)
	c.log = slog.New(slog.NewJSONHandler(&logs, nil))
	a := &attempt{provider: Microsoft, state: "device_code"}
	c.relay.a = a
	c.failAttempt(a, loginPhaseError{phase: "graph_discovery", err: fmt.Errorf("provider-token-secret: %w", ToolFailed)})
	var event map[string]any
	if err := json.Unmarshal(logs.Bytes(), &event); err != nil {
		t.Fatal(err)
	}
	if event["phase"] != "graph_discovery" || event["reason"] != "tool_failed" || event["provider"] != "microsoft" {
		t.Fatal(event)
	}
	if strings.Contains(logs.String(), "provider-token-secret") {
		t.Fatal("native error crossed diagnostic boundary")
	}
}

// The address in a completing view is a first-sync observation, not merely
// the identity known from the start of a renewal. This survives browser reloads.
func TestRenewalExchangeDoesNotClaimInitialSync(t *testing.T) {
	r := relay{a: &attempt{owner: ownerA, state: "completing", address: "person@example.test", relogin: true}}
	if got := r.view(ownerA, time.Now()); got.Address != "" {
		t.Fatal("renewal exchange reported initial sync", got)
	}
	r.a.syncing = true
	if got := r.view(ownerA, time.Now()); got.Address != "person@example.test" {
		t.Fatal("renewal of uninitialized sync lost native phase", got)
	}
}
