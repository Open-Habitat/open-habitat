//go:build linux

package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// trelloFixture is a synthetic Pi: it relays /mcp login for whichever
// server it is asked about and grants the requested scope under that
// name's own key.
func trelloFixture(t *testing.T) Env {
	t.Helper()
	home := newHome(t)
	pi := filepath.Join(t.TempDir(), "pi")
	script := `#!/usr/bin/python3
import sys,json,pathlib,os,urllib.parse
home=pathlib.Path(os.environ['HOME'])
agent=home/'.pi/agent'
url='https://mcp.trello.com/v1'
def load(n):
 p=agent/n
 return json.loads(p.read_text()) if p.exists() else {}
def save(n,d):
 p=agent/n;p.write_text(json.dumps(d));p.chmod(0o600)
if sys.argv[1:3]==['mcp','logout']:
 d=load('mcp-auth.json');d.pop('mcp__'+sys.argv[3]+'|'+url,None);save('mcp-auth.json',d);sys.exit(0)
if sys.argv[1:3]==['mcp','remove']:
 d=load('mcp.json');d['mcpServers'].pop(sys.argv[3],None);save('mcp.json',d);sys.exit(0)
assert os.environ.get('BROWSER')=='/bin/false' and 'builtin:mcp' in sys.argv
assert json.loads(input())=={'type':'prompt','message':'/mcp'}
print(json.dumps({'type':'response','command':'prompt','success':True}),flush=True)
msg=json.loads(input())['message']
assert msg.startswith('/mcp login ')
name=msg.split(' ',2)[2]
scope=load('mcp.json')['mcpServers'][name]['oauth']['scope']
auth='https://auth.atlassian.com/authorize?'+urllib.parse.urlencode({'redirect_uri':'http://127.0.0.1:45679/callback','state':'state-'+name,'scope':scope})
print(json.dumps({'type':'extension_ui_request','method':'notify','message':'Sign in:\n'+auth}),flush=True)
print(json.dumps({'type':'extension_ui_request','method':'input','id':'in'}),flush=True)
reply=json.loads(input())
q=urllib.parse.parse_qs(urllib.parse.urlparse(reply['value']).query)
assert q['state']==['state-'+name]
if q.get('error')==['access_denied']:
 print(json.dumps({'type':'extension_ui_request','method':'notify','notifyType':'error','message':'refused'}),flush=True)
else:
 d=load('mcp-auth.json');d['mcp__'+name+'|'+url]={'tokens':{'access_token':'secret-'+name,'scope':scope},'tokensExpireAt':9999999999999};save('mcp-auth.json',d)
 print(json.dumps({'type':'extension_ui_request','method':'notify','message':'Signed in to MCP server "'+name+'".'}),flush=True)
for _ in sys.stdin: pass
`
	if err := os.WriteFile(pi, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	return Env{Home: home, FixtureTools: true, Config: Config{Tools: map[string]string{"pi": pi}}}
}

func trelloSignIn(t *testing.T, env Env, address string, level Level) (string, error) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	l, err := (&trello{}).StartLevelLogin(ctx, env, address, level)
	if err != nil {
		return "", err
	}
	defer l.Cancel()
	p, err := l.Prompt(ctx)
	if err != nil || !validPrompt(PastedRedirect, p) {
		t.Fatal(p, err)
	}
	u, _ := url.Parse(p.AuthorizationURL)
	state := u.Query().Get("state")
	if err := l.Redirect(ctx, p.RedirectPrefix+"?state="+state+"&code=c"); err != nil {
		t.Fatal(err)
	}
	return l.Wait(ctx)
}

func readJSON(t *testing.T, path string) map[string]json.RawMessage {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var out map[string]json.RawMessage
	if err := json.Unmarshal(data, &out); err != nil {
		t.Fatal(err)
	}
	return out
}

// Several Trello connections are separate native names, each with its own
// requested scope and Pi credential; changing or removing one leaves the
// other's native configuration and credential alone.
func TestTrelloSeveralConnectionsAreSeparateNativeIdentities(t *testing.T) {
	env := trelloFixture(t)
	tr := &trello{}
	first, err := trelloSignIn(t, env, "", LevelRead)
	if err != nil || first != trelloServer {
		t.Fatal(first, err)
	}
	second, err := trelloSignIn(t, env, "", LevelFull)
	if err != nil || second != trelloServer+"_2" {
		t.Fatal(second, err)
	}
	if accounts, err := tr.Accounts(env); err != nil || len(accounts) != 2 {
		t.Fatal(accounts, err)
	}
	for address, want := range map[string]Level{first: LevelRead, second: LevelFull} {
		services, grant := tr.CheckGrant(context.Background(), env, address)
		if tr.Level(env, address, services) != want || grant == nil {
			t.Fatal(address, services, grant)
		}
		if !strings.Contains(tr.Skill(env, address).Body, "`"+address+"`") {
			t.Fatal("skill does not name its native server", address)
		}
	}
	auth := filepath.Join(env.Home, ".pi/agent/mcp-auth.json")
	firstKey := "mcp__" + first + "|" + trelloURL
	before := string(readJSON(t, auth)[firstKey])
	// A permission change of the second connection starts fresh consent for
	// it alone; an abandoned change leaves it signed out.
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	l, err := tr.StartLevelLogin(ctx, env, second, LevelRead)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := l.Prompt(ctx); err != nil {
		t.Fatal(err)
	}
	l.Cancel()
	states := readJSON(t, auth)
	if states["mcp__"+second+"|"+trelloURL] != nil || string(states[firstKey]) != before {
		t.Fatal("level change touched the wrong native credential", states)
	}
	if err := tr.Remove(ctx, env, second); err != nil {
		t.Fatal(err)
	}
	servers := map[string]json.RawMessage{}
	_ = json.Unmarshal(readJSON(t, filepath.Join(env.Home, ".pi/agent/mcp.json"))["mcpServers"], &servers)
	if servers[first] == nil || servers[second] != nil || string(readJSON(t, auth)[firstKey]) != before {
		t.Fatal("removal reached the other connection", servers)
	}
	// The freed name is the next new connection's.
	if again, err := trelloSignIn(t, env, "", LevelRead); err != nil || again != second {
		t.Fatal(again, err)
	}
}

func TestTrelloGrantLabelsComeFromTheNativeGrant(t *testing.T) {
	env := Env{Home: newHome(t)}
	dir := filepath.Join(env.Home, ".pi/agent")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	config := []byte(`{"mcpServers":{"open_habitat_trello_3":{"url":"https://mcp.trello.com/v1","oauth":{"scope":"` + trelloReadScopes + `"}}}}`)
	if err := os.WriteFile(filepath.Join(dir, "mcp.json"), config, 0600); err != nil {
		t.Fatal(err)
	}
	tr := &trello{}
	for _, tc := range []struct {
		scope  string
		level  Level
		access Access
	}{
		{trelloReadScopes, LevelRead, AccessRead},
		{trelloWriteScopes, LevelFull, AccessFull},
		// Requested read, granted more: never called read-only.
		{trelloReadScopes + " write:organization:trello", LevelFull, AccessFull},
		{trelloReadScopes + " write:board:trello", LevelFull, AccessFull},
		{trelloReadScopes + " manage:enterprise:trello", "", ""},
		{"read:me read:organization:trello", "", AccessNone},
		{"", "", ""},
	} {
		b, _ := json.Marshal(map[string]any{"mcp__open_habitat_trello_3|" + trelloURL: map[string]any{"tokens": map[string]any{"access_token": "secret", "scope": tc.scope}}})
		if err := os.WriteFile(filepath.Join(dir, "mcp-auth.json"), b, 0600); err != nil {
			t.Fatal(err)
		}
		services, _ := tr.CheckGrant(context.Background(), env, "open_habitat_trello_3")
		if level := tr.Level(env, "open_habitat_trello_3", services); level != tc.level || services[0].Access != tc.access {
			t.Fatalf("scope %q: %q/%q not %q/%q", tc.scope, level, services[0].Access, tc.level, tc.access)
		}
	}
	// Another connection's credential is not this one's grant.
	b, _ := json.Marshal(map[string]any{"mcp__" + trelloServer + "|" + trelloURL: map[string]any{"tokens": map[string]any{"access_token": "secret", "scope": trelloReadScopes}}})
	if err := os.WriteFile(filepath.Join(dir, "mcp-auth.json"), b, 0600); err != nil {
		t.Fatal(err)
	}
	if services, grant := tr.CheckGrant(context.Background(), env, "open_habitat_trello_3"); grant != nil || services[0].State != StateLoginExpired {
		t.Fatal(services, grant)
	}
}

func TestTrelloNamesAndForeignNativeEntries(t *testing.T) {
	for _, name := range []string{trelloServer, trelloServer + "_2", trelloServer + "_9"} {
		if !validCatalogAddress(Trello, name) {
			t.Fatal("refused", name)
		}
	}
	for _, name := range []string{trelloServer + "_1", trelloServer + "_02", trelloServer + "_10", trelloServer + "_x", atlassianServer, "a@example.test"} {
		if validCatalogAddress(Trello, name) {
			t.Fatal("accepted", name)
		}
	}
	if validCatalogAddress(Atlassian, trelloServer) || validCatalogAddress(Atlassian, atlassianServer+"_2") {
		t.Fatal("Atlassian took another name")
	}
	for _, tc := range []struct{ name, contents string }{
		{"foreign endpoint", `{"mcpServers":{"open_habitat_trello_2":{"url":"https://other.invalid/mcp"},"keep":{"command":"x"}}}`},
		{"folded name", `{"mcpServers":{"open-habitat-trello-2":{"url":"https://mcp.trello.com/v1"}}}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			env := trelloFixture(t)
			dir := filepath.Join(env.Home, ".pi/agent")
			if err := os.MkdirAll(dir, 0700); err != nil {
				t.Fatal(err)
			}
			path := filepath.Join(dir, "mcp.json")
			if err := os.WriteFile(path, []byte(tc.contents), 0600); err != nil {
				t.Fatal(err)
			}
			if _, err := (&trello{}).StartLevelLogin(context.Background(), env, "", LevelRead); err == nil {
				t.Fatal("adopted foreign native state")
			}
			if after, _ := os.ReadFile(path); string(after) != tc.contents {
				t.Fatal("changed native state")
			}
		})
	}
	// Every name in use: no tenth connection, and nothing is written.
	env := trelloFixture(t)
	servers := map[string]any{"open_habitat_trello_10": map[string]any{"url": "https://other.invalid"}}
	for i := 1; i <= trelloMaxConnections; i++ {
		name := trelloServer
		if i > 1 {
			name += "_" + string(rune('0'+i))
		}
		servers[name] = map[string]any{"url": trelloURL}
	}
	data, _ := json.Marshal(map[string]any{"mcpServers": servers})
	dir := filepath.Join(env.Home, ".pi/agent")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "mcp.json"), data, 0600); err != nil {
		t.Fatal(err)
	}
	if accounts, err := (&trello{}).Accounts(env); err != nil || len(accounts) != trelloMaxConnections {
		t.Fatal("an unowned name was listed", accounts, err)
	}
	if _, err := (&trello{}).StartLevelLogin(context.Background(), env, "", LevelRead); !errors.Is(err, ToolFailed) {
		t.Fatal(err)
	}
	if after, _ := os.ReadFile(filepath.Join(dir, "mcp.json")); string(after) != string(data) {
		t.Fatal("full set changed")
	}
}

// Through the daemon's own routes: a second start adds a connection beside
// the first rather than refusing, a refused consent keeps nothing, and the
// personal-data skill lists every connection.
func TestTrelloCatalogAddsAnotherConnection(t *testing.T) {
	env := trelloFixture(t)
	c := testCatalog(t, env.Home, []Entry{&trello{}, &atlassian{}})
	c.env.Config.Tools["pi"] = env.Config.Tools["pi"]
	h := c.Handler(allow)
	connect := func(want, outcome string) {
		t.Helper()
		code, out, _ := call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "trello", "level": "read"})
		if code != 200 {
			t.Fatal(code, out)
		}
		v := waitAttempt(t, h, ownerA, Trello, "open_url")
		redirect := "http://127.0.0.1:45679/callback?state=state-" + want + "&code=c"
		if outcome == "refused" {
			redirect = "http://127.0.0.1:45679/callback?state=state-" + want + "&error=access_denied"
		}
		if code, out, _ := call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "redirect", "attempt_id": v["attempt_id"], "redirect_url": redirect}); code != 200 {
			t.Fatal(code, out)
		}
		v = waitAttempt(t, h, ownerA, Trello, "completed", "failed")
		if outcome == "refused" {
			if v["state"] != "failed" || v["failure"] != "permission_refused" {
				t.Fatal(v)
			}
			return
		}
		if v["state"] != "completed" || v["address"] != want {
			t.Fatal(v)
		}
	}
	connect(trelloServer, "ok")
	connect(trelloServer+"_2", "refused")
	// While _2 waits for consent, removing the first connection does not
	// fence it: its name is known before consent. Another session's Pi MCP
	// sign-in, Atlassian included, waits: Pi keeps one credential file.
	if code, out, _ := call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "trello", "level": "read"}); code != 200 {
		t.Fatal(code, out)
	}
	pending := waitAttempt(t, h, ownerA, Trello, "open_url")
	if code, out, _ := call(t, h, "POST", LoginPath, ownerB, map[string]any{"action": "start", "provider": "atlassian"}); code != 409 || errorCode(out) != "attempt_active" {
		t.Fatal("concurrent Pi MCP sign-in", code, out)
	}
	if code, out, _ := call(t, h, "DELETE", AccountsPath, ownerA, map[string]any{"action": "remove", "provider": "trello", "address": trelloServer, "delete_directories": false}); code != 200 {
		t.Fatal(code, out)
	}
	if code, out, _ := call(t, h, "PUT", LoginPath, ownerA, map[string]any{"action": "redirect", "attempt_id": pending["attempt_id"], "redirect_url": "http://127.0.0.1:45679/callback?state=state-" + trelloServer + "_2&code=c"}); code != 200 {
		t.Fatal(code, out)
	}
	if v := waitAttempt(t, h, ownerA, Trello, "completed", "failed"); v["state"] != "completed" || v["address"] != trelloServer+"_2" {
		t.Fatal("removal of another connection fenced this sign-in", v)
	}
	connect(trelloServer, "ok")
	_, list, raw := call(t, h, "GET", ListPath, ownerA, nil)
	accounts, _ := list["accounts"].([]any)
	if len(accounts) != 2 || strings.Contains(raw, "secret-") {
		t.Fatal(raw)
	}
	skill, err := os.ReadFile(filepath.Join(env.Home, SkillDir, "SKILL.md"))
	if err != nil || !strings.Contains(string(skill), "### "+trelloServer+" — Trello") || !strings.Contains(string(skill), "### "+trelloServer+"_2 — Trello") || !strings.Contains(string(skill), "Trello cards") {
		t.Fatal(string(skill), err)
	}
}
