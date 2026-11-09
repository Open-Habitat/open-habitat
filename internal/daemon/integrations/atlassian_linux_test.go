//go:build linux

package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func atlassianFixture(t *testing.T) Env {
	t.Helper()
	home := newHome(t)
	pi := filepath.Join(t.TempDir(), "pi")
	script := `#!/usr/bin/python3
import sys,json,pathlib,os,urllib.parse
home=pathlib.Path(os.environ['HOME'])
if sys.argv[1:3] == ['mcp','logout']:
 p=home/'.pi/agent/mcp-auth.json'
 if p.exists():
  data=json.loads(p.read_text());data.pop('mcp__open_habitat_atlassian|https://mcp.atlassian.com/v2/mcp',None);p.write_text(json.dumps(data))
 sys.exit(0)
if sys.argv[1:3] == ['mcp','remove']:
 p=home/'.pi/agent/mcp.json';data=json.loads(p.read_text());data['mcpServers'].pop('open_habitat_atlassian',None);p.write_text(json.dumps(data));sys.exit(0)
assert os.environ.get('BROWSER') == '/bin/false'
assert '--no-session' in sys.argv and '--no-extensions' in sys.argv and 'builtin:mcp' in sys.argv
assert json.loads(input()) == {'type':'prompt','message':'/mcp'}
print(json.dumps({'type':'response','command':'prompt','success':True}),flush=True)
assert json.loads(input()) == {'type':'prompt','message':'/mcp login open_habitat_atlassian'}
mode=(home/'mode').read_text() if (home/'mode').exists() else ''
if mode in ('immediate','fail'):
 print(json.dumps({'type':'extension_ui_request','method':'notify','notifyType':'error' if mode=='fail' else 'info','message':'failure' if mode=='fail' else 'Signed in to MCP server "open_habitat_atlassian".'}),flush=True)
 for _ in sys.stdin: pass
 sys.exit(0)
url='https://auth.atlassian.com/authorize?'+urllib.parse.urlencode({'redirect_uri':'http://127.0.0.1:45678/callback','state':'fixture-state','scope':'read:jira:agent-interface'})
print(json.dumps({'type':'extension_ui_request','method':'notify','message':'Sign in:\n'+url}),flush=True)
print(json.dumps({'type':'extension_ui_request','method':'input','id':'fixture-input'}),flush=True)
reply=json.loads(input()) if mode!='loopback' else {'type':'extension_ui_response','id':'fixture-input','value':'http://127.0.0.1:45678/callback?state=fixture-state&code=fixture-code'}
assert reply['type']=='extension_ui_response' and reply['id']=='fixture-input'
query=urllib.parse.parse_qs(urllib.parse.urlparse(reply['value']).query)
assert query['state']==['fixture-state']
if query.get('error')==['access_denied']:
 print(json.dumps({'type':'extension_ui_request','method':'notify','notifyType':'error','message':'secret-native-error'}),flush=True)
else:
 assert query['code']==['fixture-code']
 p=home/'.pi/agent/mcp-auth.json'
 p.write_text(json.dumps({'mcp__open_habitat_atlassian|https://mcp.atlassian.com/v2/mcp':{'tokens':{'access_token':'fixture-secret','scope':'read:jira:agent-interface read:confluence:agent-interface'},'tokensExpireAt':9999999999999}}))
 p.chmod(0o600)
 print(json.dumps({'type':'extension_ui_request','method':'notify','message':'Signed in to MCP server "open_habitat_atlassian".'}),flush=True)
for _ in sys.stdin: pass
`
	if err := os.WriteFile(pi, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	return Env{Home: home, FixtureTools: true, Config: Config{Tools: map[string]string{"pi": pi}}}
}
func TestAtlassianNativeRPCRelay(t *testing.T) {
	env := atlassianFixture(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	a := &atlassian{}
	login, err := a.StartLevelLogin(ctx, env, "", LevelRead)
	if err != nil {
		t.Fatal(err)
	}
	defer login.Cancel()
	p, err := login.Prompt(ctx)
	if err != nil || !validPrompt(PastedRedirect, p) {
		t.Fatal(p, err)
	}
	for _, bad := range []string{
		"http://127.0.0.1:45678/callback-other?state=fixture-state&code=fixture-code",
		"http://127.0.0.1:456789/callback?state=fixture-state&code=fixture-code",
		"http://127.0.0.1:45678/callback?state=wrong&code=fixture-code",
		"http://127.0.0.1:45678/callback?state=fixture-state&state=fixture-state&code=fixture-code",
		"http://127.0.0.1:45678/callback?state=fixture-state&code=fixture-code#fragment",
	} {
		if !errors.Is(login.Redirect(ctx, bad), RedirectRejected) {
			t.Fatalf("accepted %s", bad)
		}
	}
	good := p.RedirectPrefix + "?state=fixture-state&code=fixture-code"
	if err := login.Redirect(ctx, good); err != nil {
		t.Fatal(err)
	}
	if !errors.Is(login.Redirect(ctx, good), RedirectRejected) {
		t.Fatal("repeated callback accepted")
	}
	address, err := login.Wait(ctx)
	if err != nil || address != atlassianServer {
		t.Fatal(address, err)
	}
	services, grant := a.CheckGrant(ctx, env, address)
	if a.Level(env, address, services) != LevelRead || grant == nil || len(grant.Granted) != 2 {
		t.Fatal(services, grant)
	}
	b, _ := json.Marshal(struct {
		Services []Service
		Grant    *Grant
	}{services, grant})
	if strings.Contains(string(b), "fixture-secret") {
		t.Fatal("credential escaped")
	}
}
func TestAtlassianRefusedCallback(t *testing.T) {
	env := atlassianFixture(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	l, err := (&atlassian{}).StartLevelLogin(ctx, env, "", LevelRead)
	if err != nil {
		t.Fatal(err)
	}
	defer l.Cancel()
	p, err := l.Prompt(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err = l.Redirect(ctx, p.RedirectPrefix+"?state=fixture-state&error=access_denied"); err != nil {
		t.Fatal(err)
	}
	_, err = l.Wait(ctx)
	if !errors.Is(err, PermissionRefused) {
		t.Fatal(err)
	}
	if loginFailure(err) != "permission_refused" {
		t.Fatal("lost refusal")
	}
}
func TestAtlassianGrantNeverUsesRequestedScopeAsCeiling(t *testing.T) {
	env := Env{Home: newHome(t)}
	dir := filepath.Join(env.Home, ".pi/agent")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	config := []byte(`{"mcpServers":{"open_habitat_atlassian":{"url":"https://mcp.atlassian.com/v2/mcp","oauth":{"scope":"` + atlassianWriteScopes + `"}}}}`)
	if err := os.WriteFile(filepath.Join(dir, "mcp.json"), config, 0600); err != nil {
		t.Fatal(err)
	}
	a := &atlassian{}
	for _, tc := range []struct {
		scope string
		level Level
	}{
		{atlassianReadScopes, LevelRead},
		{atlassianWriteScopes, LevelFull},
		{atlassianReadScopes + " manage:jira-configuration", ""},
		{atlassianReadScopes + " unknown!scope", ""},
		{"", ""},
	} {
		b, _ := json.Marshal(map[string]any{"mcp__" + atlassianServer + "|" + atlassianURL: map[string]any{"tokens": map[string]any{"access_token": "secret", "scope": tc.scope}, "tokensExpireAt": time.Now().Add(time.Hour).UnixMilli()}})
		if err := os.WriteFile(filepath.Join(dir, "mcp-auth.json"), b, 0600); err != nil {
			t.Fatal(err)
		}
		services, _ := a.CheckGrant(context.Background(), env, atlassianServer)
		if level := a.Level(env, atlassianServer, services); level != tc.level {
			t.Fatalf("scope %q: %q not %q", tc.scope, level, tc.level)
		}
	}
	// An unrelated native connection with the same endpoint is not ours.
	if err := os.WriteFile(filepath.Join(dir, "mcp-auth.json"), []byte(`{"https://mcp.atlassian.com/v2/mcp":{"tokens":{"access_token":"other-secret","scope":"read:jira:agent-interface"}}}`), 0600); err != nil {
		t.Fatal(err)
	}
	services, grant := a.CheckGrant(context.Background(), env, atlassianServer)
	if grant != nil || services[0].State != StateLoginExpired {
		t.Fatal(services, grant)
	}
}
func TestAtlassianRefusesForeignNativeConfig(t *testing.T) {
	env := atlassianFixture(t)
	dir := filepath.Join(env.Home, ".pi/agent")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	original := []byte(`{"mcpServers":{"open_habitat_atlassian":{"url":"https://other.invalid/mcp"},"unrelated":{"command":"keep"}}}`)
	path := filepath.Join(dir, "mcp.json")
	if err := os.WriteFile(path, original, 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := (&atlassian{}).StartLevelLogin(context.Background(), env, "", LevelRead); err == nil {
		t.Fatal("replaced foreign config")
	}
	after, _ := os.ReadFile(path)
	if string(after) != string(original) {
		t.Fatal("changed unrelated native state")
	}
}
