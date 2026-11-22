//go:build linux

package integrations

import (
	"bufio"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/msmcp"
)

// The synthetic child retains a key like the pinned native storage. The Node
// regression exercises the real encrypted storage and MSAL; this covers the
// publication/verification wiring through the daemon and a persistent relay.
func TestMicrosoftStopKeepsSlotForNativeCleanup(t *testing.T) {
	env := microsoftEnv(t)
	const address = "person@example.test"
	m := syntheticMicrosoft(t, address, "")
	l := msLogin(t, m, env, "")
	if _, err := l.Wait(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := l.Commit(context.Background(), address); err != nil {
		t.Fatal(err)
	}
	c := New(env, []Entry{m}, nil)
	ctx, cancel := context.WithCancel(context.Background())
	c.Start(ctx)
	defer cancel()
	deadline := time.Now().Add(5 * time.Second)
	for {
		if _, err := os.Stat(msmcp.SocketPath(env.Home)); err == nil {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("no socket")
		}
		time.Sleep(10 * time.Millisecond)
	}
	// Stand in for a login driver still cleaning up a canceled new account.
	cleanup := make(chan struct{})
	removed := make(chan error, 1)
	c.background.Add(1)
	go func() {
		defer c.background.Done()
		<-ctx.Done()
		<-cleanup
		removed <- m.Remove(context.Background(), env, address)
	}()
	cancel()
	select {
	case <-c.muxDone:
		t.Error("endpoint released before native cleanup")
	case <-time.After(100 * time.Millisecond):
	}
	close(cleanup)
	c.Stop()
	if err := <-removed; err != nil {
		t.Fatal("native cleanup failed", err)
	}
	if accounts, err := m.Accounts(env); err != nil || len(accounts) != 0 {
		t.Fatal("abandoned account survived", accounts, err)
	}
}

func TestMicrosoftVerifyDeadlineIsUnknown(t *testing.T) {
	env := microsoftEnv(t)
	m := syntheticMicrosoft(t, "person@example.test", "")
	l := msLogin(t, m, env, "")
	if _, err := l.Wait(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := l.Commit(context.Background(), "person@example.test"); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if state, _ := microsoftMCPState(ctx, env, "person@example.test"); state != StateUnknown {
		t.Fatal("local deadline became provider failure", state)
	}
}

func TestMicrosoftReconnectQuiescesSharedChild(t *testing.T) {
	env := microsoftEnv(t)
	const address = "person@example.test"
	m := syntheticMicrosoft(t, address, "")
	tool := filepath.Join(t.TempDir(), "native-mcp")
	const script = `#!/usr/bin/python3
import json, os, sys
if '--list-accounts' in sys.argv:
 print(json.dumps({'accounts':[{'username':os.environ['MS365_MCP_EXPECTED_USERNAME']}]}))
 sys.exit(0)
keypath = os.path.join(os.path.dirname(os.environ['MS365_MCP_TOKEN_CACHE_PATH']), '.cache-key')
with open(keypath) as f: key = f.read()
for line in sys.stdin:
 r = json.loads(line)
 if 'id' not in r: continue
 method = r['method']
 if method == 'initialize': result = {'protocolVersion':'2024-11-05','capabilities':{'tools':{}},'serverInfo':{'name':'synthetic','version':'1'}}
 elif method == 'tools/list': result = {'tools':[{'name':'list-mail-messages','inputSchema':{'type':'object'}}]}
 elif method == 'tools/call':
  with open(keypath) as f: current = f.read()
  result = {'content':[{'type':'text','text':key}], 'isError':current != key}
 else: result = {}
 print(json.dumps({'jsonrpc':'2.0','id':r['id'],'result':result}), flush=True)
`
	if err := os.WriteFile(tool, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	env.Config.Tools["ms-365-mcp-server"] = tool
	connect := func(key string) *microsoftLogin {
		t.Helper()
		l := msLogin(t, m, env, "")
		if _, err := l.Wait(context.Background()); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(env.Home, l.staging, ".cache-key"), []byte(key), 0600); err != nil {
			t.Fatal(err)
		}
		return l
	}
	if err := connect("first-key").Commit(context.Background(), address); err != nil {
		t.Fatal(err)
	}
	srv := msmcp.NewServer(func(a string) (msmcp.Binding, error) { return microsoftBinding(env, a) }, msmcp.Options{})
	m.mux = srv
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { defer close(done); _ = srv.Serve(ctx, env.Home) }()
	defer func() { cancel(); <-done }()
	deadline := time.Now().Add(5 * time.Second)
	for {
		if _, err := os.Stat(msmcp.SocketPath(env.Home)); err == nil {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("no socket")
		}
		time.Sleep(10 * time.Millisecond)
	}
	conn, err := msmcp.Dial(env.Home, msmcp.Hello{Provider: "microsoft", Account: address, Area: "mail"}, nil, time.Second)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	reader := bufio.NewReader(conn)
	call := func(want string) {
		t.Helper()
		_ = conn.SetDeadline(time.Now().Add(10 * time.Second))
		_, err := conn.Write([]byte(`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list-mail-messages","arguments":{}}}` + "\n"))
		if err != nil {
			t.Fatal(err)
		}
		line, err := reader.ReadBytes('\n')
		if err != nil {
			t.Fatal(err)
		}
		var reply struct {
			Result struct {
				IsError bool `json:"isError"`
				Content []struct {
					Text string `json:"text"`
				} `json:"content"`
			} `json:"result"`
		}
		if json.Unmarshal(line, &reply) != nil || reply.Result.IsError || len(reply.Result.Content) != 1 || reply.Result.Content[0].Text != want {
			t.Fatalf("tool reply: %s", line)
		}
	}
	call("first-key")
	oldPID := srv.Running()
	if oldPID == 0 {
		t.Fatal("child not running")
	}
	// A same-account/same-permissions reconnect leaves the binding unchanged.
	if err := connect("replacement-key").Commit(context.Background(), address); err != nil {
		t.Fatal(err)
	}
	if srv.Running() != 0 {
		t.Fatal("publication left the old native child running")
	}
	call("replacement-key")
	if srv.Running() == oldPID {
		t.Fatal("old process survived reconnect")
	}
	// Health refresh is another native cache writer. It must run without a
	// child holding an earlier refresh token, then the same relay works again.
	services, _ := m.CheckGrant(context.Background(), env, address)
	for _, s := range services {
		if s.State != StateOK {
			t.Fatalf("health: %+v", services)
		}
	}
	if srv.Running() != 0 {
		t.Fatal("health did not quiesce native cache writer")
	}
	call("replacement-key")
}
