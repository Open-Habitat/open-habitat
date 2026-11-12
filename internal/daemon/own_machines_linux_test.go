//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/daemon/tailnetfake"
	"github.com/open-habitat/open-habitat/internal/testpython"
	"github.com/open-habitat/open-habitat/internal/transport"
)

type machinesFixture struct {
	home, runtime, sshDir string
	env                   ownMachineEnv
	node                  *tailnetfake.Node
	manager               []string
	failStop              bool
	handler               http.Handler
	// replies are every successful reply, for the contract check.
	replies []json.RawMessage
}

// newMachinesFixture is one account with the fake node behind its user
// manager: starting the unit starts the fake LocalAPI at the unit's socket.
func newMachinesFixture(t *testing.T) *machinesFixture {
	t.Helper()
	needTool(t, "/usr/bin/ssh-keygen")
	f := &machinesFixture{home: t.TempDir()}
	var err error
	if f.runtime, err = os.MkdirTemp("", "rt"); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(f.runtime) })
	bin := t.TempDir()
	for _, name := range []string{"tailscale", "tailscaled"} {
		if err := os.WriteFile(filepath.Join(bin, name), []byte("#!/bin/sh\nexit 1\n"), 0700); err != nil {
			t.Fatal(err)
		}
	}
	f.sshDir = t.TempDir()
	ssh, err := tailnetfake.WriteSSH(f.sshDir)
	if err != nil {
		t.Fatal(err)
	}
	f.env = ownMachineEnv{
		home: f.home, username: "alice", uid: os.Geteuid(), runtimeDir: f.runtime,
		tailscale: filepath.Join(bin, "tailscale"), tailscaled: filepath.Join(bin, "tailscaled"), ssh: ssh,
		keys:    keyTools{sshKeygen: "/usr/bin/ssh-keygen", ageKeygen: "/nonexistent"},
		now:     func() time.Time { return time.Date(2026, 10, 29, 12, 0, 0, 0, time.Local) },
		comment: "habitat:alice@habitat.example.org", managerReady: func() bool { return true },
	}
	f.env.userManager = func(_ context.Context, args ...string) error {
		f.manager = append(f.manager, strings.Join(args, " "))
		switch args[0] {
		case "start", "restart":
			if f.node == nil {
				// systemd makes the RuntimeDirectory with the unit's mode.
				if err := os.Mkdir(filepath.Join(f.runtime, tailnetRuntimeName), 0700); err != nil && !os.IsExist(err) {
					return err
				}
				n, err := tailnetfake.Start(f.env.socket(), tailnetfake.DefaultPeers())
				if err != nil {
					return err
				}
				f.node = n
			}
		case "disable":
			if f.failStop {
				return os.ErrPermission
			}
			if f.node != nil {
				f.node.Close()
				f.node = nil
				os.RemoveAll(filepath.Join(f.runtime, tailnetRuntimeName))
			}
		}
		return nil
	}
	t.Cleanup(func() {
		if f.node != nil {
			f.node.Close()
		}
	})
	cfg := transport.Config{Home: f.home, UID: os.Geteuid(), Username: "alice", Provider: "github", Subject: "42"}
	f.handler = ownMachinesHandler(cfg, func(*http.Request) bool { return true }, f.env)
	return f
}

func (f *machinesFixture) do(t *testing.T, body string) (int, map[string]any) {
	t.Helper()
	method := http.MethodGet
	if body != "" {
		method = http.MethodPost
	}
	r := httptest.NewRequest(method, "http://unix"+OwnMachinesPath, strings.NewReader(body))
	if body != "" {
		r.Header.Set("Content-Type", "application/json")
	}
	w := httptest.NewRecorder()
	f.handler.ServeHTTP(w, r)
	var reply map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &reply)
	if w.Code == 200 {
		f.replies = append(f.replies, append(json.RawMessage(nil), w.Body.Bytes()...))
	}
	return w.Code, reply
}

// matchContract validates every successful reply against the contract in
// one run of the repository's validator.
func (f *machinesFixture) matchContract(t *testing.T) {
	t.Helper()
	all, _ := json.Marshal(f.replies)
	python := testpython.Validator(t)
	cmd := exec.Command(python, "-c", `import sys,runpy,json; m=runpy.run_path('../../scripts/validate-contracts.py'); v=m['Draft202012Validator'](m['schemas']['own-machines.schema.json'],registry=m['registry'],format_checker=m['format_checker']); [v.validate(r) for r in json.load(sys.stdin)]`)
	cmd.Stdin = strings.NewReader(string(all))
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("own-machines contract: %s: %v", out, err)
	}
}

func (f *machinesFixture) must(t *testing.T, body string) map[string]any {
	t.Helper()
	code, reply := f.do(t, body)
	if code != 200 {
		t.Fatalf("%s: %d %v", body, code, reply)
	}
	return reply
}

func field(v any, path ...string) any {
	for _, p := range path {
		m, _ := v.(map[string]any)
		v = m[p]
	}
	return v
}

// The node is a user unit whose socket can only be in a 0700 runtime
// directory, never with a proxy port, and whose locked config keeps shields
// up and takes nothing from the tailnet.
func TestOwnMachinesUnitAndConfig(t *testing.T) {
	env := ownMachineEnv{tailscaled: "/opt/x/tailscaled", username: "Alice"}
	unit := env.tailnetUnitText()
	for _, want := range []string{
		"\nExecStart=/opt/x/tailscaled " + strings.Join(tailscaledArgs("%t/habitat-tailscale/ts.sock", "%h/.local/state/habitat-tailscale", "%h/.config/habitat-tailscale/tailscaled.json"), " ") + "\n",
		"\nRuntimeDirectory=habitat-tailscale\n", "\nRuntimeDirectoryMode=0700\n", "\nNoNewPrivileges=yes\n", "\nEnvironment=TS_LOGS_DIR=%h/.local/state/habitat-tailscale\n",
	} {
		if !strings.Contains(unit, want) {
			t.Fatalf("unit lacks %q:\n%s", want, unit)
		}
	}
	for _, never := range []string{"socks5", "outbound-http-proxy", "/var/run/tailscale", "--tun=tailscale0"} {
		if strings.Contains(unit, never) {
			t.Fatalf("unit has %q", never)
		}
	}
	if !strings.Contains(strings.Join(tailscaledArgs("s", "d", "c"), " "), "--tun=userspace-networking") {
		t.Fatal("not userspace networking")
	}
	var conf map[string]any
	if err := json.Unmarshal(env.tailnetConfig(), &conf); err != nil {
		t.Fatal(err)
	}
	for k, v := range map[string]any{"Version": "alpha0", "Locked": true, "ShieldsUp": true, "AcceptDNS": false, "AcceptRoutes": false, "RunSSHServer": false, "Hostname": "habitat-alice"} {
		if conf[k] != v {
			t.Fatalf("config %s = %v", k, conf[k])
		}
	}
}

// The whole guided path against a fake node and machine: join, line,
// rejected and then accepted key, a host key the person compares, the saved
// machine reachable by name; a second machine; renewal; removal; leaving.
func TestOwnMachinesGuidedFlow(t *testing.T) {
	f := newMachinesFixture(t)
	reply := f.must(t, "")
	if field(reply, "tailscale", "state") != "off" || len(reply["machines"].([]any)) != 0 {
		t.Fatalf("fresh account: %v", reply)
	}
	// A line before the node is on is refused.
	if code, r := f.do(t, `{"action":"grant","peer":"alice-macbook","user":"alice","days":30}`); code != 409 || field(r, "error", "code") != "tailscale_not_connected" {
		t.Fatalf("grant without node: %d %v", code, r)
	}
	reply = f.must(t, `{"action":"connect"}`)
	if field(reply, "tailscale", "state") != "login" || field(reply, "tailscale", "auth_url") != tailnetfake.AuthURL {
		t.Fatalf("connect: %v", reply)
	}
	unit, err := os.ReadFile(filepath.Join(f.home, ".config/systemd/user", tailnetUnit))
	if err != nil || !strings.Contains(string(unit), "ExecStart="+f.env.tailscaled+" ") {
		t.Fatalf("unit: %v %s", err, unit)
	}
	if strings.Join(f.manager, ";") != "daemon-reload;enable habitat-tailscale.service;restart habitat-tailscale.service" {
		t.Fatalf("user manager calls: %v", f.manager)
	}
	f.node.Approve()
	reply = f.must(t, "")
	if field(reply, "tailscale", "state") != "on" || field(reply, "tailscale", "node", "address") != tailnetfake.SelfAddress || field(reply, "tailscale", "node", "shields_up") != true {
		t.Fatalf("on: %v", reply)
	}
	peers := map[string]string{}
	for _, p := range reply["peers"].([]any) {
		peers[field(p, "name").(string)] = field(p, "ssh").(string)
	}
	if peers["alice-macbook"] != "possible" || peers["alice-phone"] != "no" || peers["gaming-pc"] != "possible" {
		t.Fatalf("peers: %v", peers)
	}
	// A Windows machine gets PowerShell, with the administrators' branch.
	reply = f.must(t, `{"action":"grant","peer":"gaming-pc","user":"alice","days":30}`)
	if field(reply, "grant", "shell") != "powershell" || !strings.Contains(field(reply, "grant", "admin_command").(string), "administrators_authorized_keys") || strings.Contains(field(reply, "grant", "command").(string), "administrators_authorized_keys") {
		t.Fatalf("windows grant: %v", reply["grant"])
	}

	// The line names the node's address and the expiry, with the account key
	// made for it.
	reply = f.must(t, `{"action":"grant","peer":"alice-macbook","user":"alice","days":30}`)
	line := field(reply, "grant", "line").(string)
	if !regexp.MustCompile(`^restrict,from="100\.101\.22\.7",expiry-time="20261128" ssh-ed25519 [A-Za-z0-9+/]+=* habitat:alice@habitat\.example\.org$`).MatchString(line) {
		t.Fatalf("line: %q", line)
	}
	if field(reply, "grant", "expires") != "2026-11-28" || field(reply, "account_key", "fingerprint") != field(reply, "grant", "key_fingerprint") {
		t.Fatalf("grant: %v", reply)
	}
	if field(reply, "grant", "shell") != "sh" || field(reply, "grant", "admin_command") != nil {
		t.Fatalf("mac grant: %v", reply["grant"])
	}
	if cmd := field(reply, "grant", "command").(string); !strings.Contains(cmd, "grep -v ' habitat:alice@habitat\\.example\\.org$'") || !strings.Contains(cmd, "echo '"+line+"'") {
		t.Fatalf("command: %s", cmd)
	}
	if _, err := os.Stat(filepath.Join(f.home, ".ssh/id_ed25519")); err != nil {
		t.Fatal("account key not made")
	}

	check := func(body, want string) map[string]any {
		t.Helper()
		r := f.must(t, body)
		if field(r, "check", "result") != want {
			t.Fatalf("%s: %v", body, r)
		}
		return r
	}
	reply = check(`{"action":"check","peer":"alice-macbook","user":"alice"}`, "key_rejected")
	shown := field(reply, "check", "host_key").(string)
	if !fingerprintPattern.MatchString(shown) {
		t.Fatalf("host key: %v", reply)
	}
	tailnetfake.SetMachine(f.sshDir, "100.88.14.53", "ok")
	check(`{"action":"check","peer":"alice-macbook","user":"alice"}`, "ok")

	// A fingerprint other than the one the machine shows saves nothing.
	other := "SHA256:" + strings.Repeat("A", 43)
	if code, r := f.do(t, `{"action":"save","peer":"alice-macbook","user":"alice","expires":"2026-11-28","host_key":"`+other+`"}`); code != 409 || field(r, "error", "code") != "host_key_mismatch" {
		t.Fatalf("mismatch: %d %v", code, r)
	}
	if _, err := os.Stat(filepath.Join(f.home, ".ssh/config.d/habitat-alice-macbook.conf")); err == nil {
		t.Fatal("saved on mismatch")
	}
	// The person's own ~/.ssh/config keeps its content behind the Include.
	if err := os.WriteFile(filepath.Join(f.home, ".ssh/config"), []byte("Host *\n  ServerAliveInterval 30\n"), 0600); err != nil {
		t.Fatal(err)
	}
	reply = f.must(t, `{"action":"save","peer":"alice-macbook","user":"alice","expires":"2026-11-28","host_key":"`+shown+`"}`)
	if reply["saved"] != "alice-macbook" || reply["ssh_include"] != true {
		t.Fatalf("save: %v", reply)
	}
	cfgText, _ := os.ReadFile(filepath.Join(f.home, ".ssh/config"))
	if !strings.HasPrefix(string(cfgText), "# Open Habitat") || !strings.Contains(string(cfgText), sshInclude+"\n\nHost *\n  ServerAliveInterval 30\n") {
		t.Fatalf("ssh config: %q", cfgText)
	}
	conf, _ := os.ReadFile(filepath.Join(f.home, ".ssh/config.d/habitat-alice-macbook.conf"))
	for _, want := range []string{"Host alice-macbook\n", "\tHostName 100.88.14.53\n", "\tUser alice\n", "\tProxyCommand " + f.env.tailscale + " --socket=" + f.env.socket() + " nc %h %p\n", "\tStrictHostKeyChecking yes\n", "\tControlPath " + f.runtime + "/habitat-tailscale/ssh-%n\n"} {
		if !strings.Contains(string(conf), want) {
			t.Fatalf("machine config lacks %q:\n%s", want, conf)
		}
	}
	machine := reply["machines"].([]any)[0]
	if field(machine, "host_key") != shown || field(machine, "expires") != "2026-11-28" || field(machine, "expired") != false || field(machine, "online") != true || field(machine, "os") != "macOS" {
		t.Fatalf("machine: %v", machine)
	}
	if code, r := f.do(t, `{"action":"grant","peer":"alice-macbook","user":"alice","days":7}`); code != 409 || field(r, "error", "code") != "machine_exists" {
		t.Fatalf("second grant for a saved machine: %d %v", code, r)
	}

	// A second machine is added the same way.
	tailnetfake.SetMachine(f.sshDir, "100.71.203.9", "ok")
	f.must(t, `{"action":"grant","peer":"workstation","user":"alice","days":7}`)
	reply = check(`{"action":"check","peer":"workstation","user":"alice"}`, "ok")
	f.must(t, `{"action":"save","peer":"workstation","user":"alice","expires":"2026-11-05","host_key":"`+field(reply, "check", "host_key").(string)+`"}`)

	// The saved machine is checked against its pinned key: another key is a
	// changed machine, never accepted.
	check(`{"action":"recheck","machine":"alice-macbook"}`, "ok")
	tailnetfake.SetHostKey(f.sshDir, "100.88.14.53", 'B')
	check(`{"action":"recheck","machine":"alice-macbook"}`, "host_key_changed")
	tailnetfake.SetHostKey(f.sshDir, "100.88.14.53", 'A')
	// Revoked on the machine: the key is refused before the date.
	tailnetfake.SetMachine(f.sshDir, "100.88.14.53", "rejected")
	check(`{"action":"recheck","machine":"alice-macbook"}`, "key_rejected")

	// Renewal: a new line, then the new date once the machine accepts it,
	// with no new host key comparison.
	reply = f.must(t, `{"action":"renew","machine":"alice-macbook","days":90}`)
	if field(reply, "grant", "expires") != "2027-01-27" {
		t.Fatalf("renew: %v", reply)
	}
	reply = f.must(t, `{"action":"extend","machine":"alice-macbook","expires":"2027-01-27"}`)
	if reply["saved"] != nil || field(reply, "check", "result") != "key_rejected" {
		t.Fatalf("extend before the line: %v", reply)
	}
	tailnetfake.SetMachine(f.sshDir, "100.88.14.53", "ok")
	reply = f.must(t, `{"action":"extend","machine":"alice-macbook","expires":"2027-01-27"}`)
	if reply["saved"] != "alice-macbook" || field(reply["machines"].([]any)[0], "expires") != "2027-01-27" || field(reply["machines"].([]any)[0], "host_key") != shown {
		t.Fatalf("extend: %v", reply)
	}
	if code, _ := f.do(t, `{"action":"extend","machine":"alice-macbook","expires":"2027-03-01"}`); code != 400 {
		t.Fatal("an expiry beyond 90 days was taken")
	}

	reply = f.must(t, `{"action":"remove","machine":"workstation"}`)
	if reply["removed"] != "workstation" || len(reply["machines"].([]any)) != 1 || !strings.Contains(reply["remove_command"].(string), "habitat:alice@habitat\\.example\\.org$") {
		t.Fatalf("remove: %v", reply)
	}

	reply = f.must(t, `{"action":"disconnect"}`)
	if field(reply, "tailscale", "state") != "off" || len(reply["machines"].([]any)) != 0 {
		t.Fatalf("disconnect: %v", reply)
	}
	for _, gone := range []string{".config/systemd/user/" + tailnetUnit, ".config/habitat-tailscale", ".local/state/habitat-tailscale", ".ssh/config.d/habitat-alice-macbook.conf", ".ssh/config.d/habitat-alice-macbook.known_hosts"} {
		if _, err := os.Lstat(filepath.Join(f.home, gone)); !os.IsNotExist(err) {
			t.Fatalf("%s left behind", gone)
		}
	}
	if _, err := os.Stat(filepath.Join(f.home, ".ssh/id_ed25519")); err != nil {
		t.Fatal("the account key went with the node")
	}
	f.matchContract(t)
}

// The browser names a machine only by its tailnet name: an address, a
// device without SSH and anything not in the person's tailnet are refused,
// and each action takes exactly its own fields.
func TestOwnMachinesRequestsNameOnlyTailnetPeers(t *testing.T) {
	f := newMachinesFixture(t)
	f.must(t, `{"action":"connect"}`)
	f.node.Approve()
	for body, want := range map[string]string{
		`{"action":"grant","peer":"alice-phone","user":"alice","days":30}`:                                     "unknown_peer",
		`{"action":"grant","peer":"stranger","user":"alice","days":30}`:                                        "unknown_peer",
		`{"action":"grant","peer":"100.88.14.53","user":"alice","days":30}`:                                    "invalid_request",
		`{"action":"grant","peer":"alice-macbook","user":"alice","days":365}`:                                  "invalid_request",
		`{"action":"grant","peer":"alice-macbook","user":"al ice","days":30}`:                                  "invalid_request",
		`{"action":"grant","peer":"alice-macbook","user":"-oProxy","days":30}`:                                 "invalid_request",
		`{"action":"check","peer":"alice-macbook","user":"alice","address":"x"}`:                               "invalid_request",
		`{"action":"recheck","machine":"alice-macbook"}`:                                                       "unknown_machine",
		`{"action":"remove","machine":"../../.bashrc"}`:                                                        "invalid_request",
		`{"action":"connect","action":"disconnect"}`:                                                           "invalid_request",
		`{"action":"save","peer":"alice-macbook","user":"alice","expires":"2026-11-31","host_key":"SHA256:x"}`: "invalid_request",
	} {
		code, r := f.do(t, body)
		if field(r, "error", "code") != want || code < 400 {
			t.Fatalf("%s: %d %v", body, code, r)
		}
	}
}

// Only Tailscale's own login host reaches the browser as a login link.
func TestOwnMachinesLoginURLIsTailscales(t *testing.T) {
	f := newMachinesFixture(t)
	f.must(t, `{"action":"connect"}`)
	for url, shown := range map[string]bool{
		tailnetfake.AuthURL:                      true,
		"https://evil.example/a/1":               false,
		"http://login.tailscale.com/a/1":         false,
		"https://login.tailscale.com/a/1?next=x": false,
		"https://x@login.tailscale.com/a/1":      false,
		"javascript:alert(1)":                    false,
	} {
		f.node.SetAuthURL(url)
		reply := f.must(t, "")
		if got := field(reply, "tailscale", "auth_url"); (got == url) != shown {
			t.Fatalf("%s: %v", url, got)
		}
	}
}

// A ~/.ssh/config that is a link (a dotfiles checkout) is never rewritten;
// the page says the Include is missing instead.
func TestOwnMachinesLeavesLinkedSSHConfig(t *testing.T) {
	f := newMachinesFixture(t)
	f.must(t, `{"action":"connect"}`)
	f.node.Approve()
	dotfiles := filepath.Join(t.TempDir(), "ssh_config")
	if err := os.WriteFile(dotfiles, []byte("Host *\n"), 0600); err != nil {
		t.Fatal(err)
	}
	os.MkdirAll(filepath.Join(f.home, ".ssh"), 0700)
	if err := os.Symlink(dotfiles, filepath.Join(f.home, ".ssh/config")); err != nil {
		t.Fatal(err)
	}
	tailnetfake.SetMachine(f.sshDir, "100.88.14.53", "ok")
	f.must(t, `{"action":"grant","peer":"alice-macbook","user":"alice","days":30}`)
	r := f.must(t, `{"action":"check","peer":"alice-macbook","user":"alice"}`)
	reply := f.must(t, `{"action":"save","peer":"alice-macbook","user":"alice","expires":"2026-11-28","host_key":"`+field(r, "check", "host_key").(string)+`"}`)
	if reply["saved"] != "alice-macbook" || reply["ssh_include"] != false {
		t.Fatalf("save: %v", reply)
	}
	if b, _ := os.ReadFile(dotfiles); string(b) != "Host *\n" {
		t.Fatalf("linked config rewritten: %q", b)
	}
	if fi, _ := os.Lstat(filepath.Join(f.home, ".ssh/config")); fi.Mode()&os.ModeSymlink == 0 {
		t.Fatal("link replaced")
	}
}

// An Include after the first Host block applies only inside it.
func TestIncludeBeforeHosts(t *testing.T) {
	for text, want := range map[string]bool{
		sshInclude + "\nHost *\n":          true,
		"# mine\n\n" + sshInclude + "\n":   true,
		"Host a\n" + sshInclude + "\n":     false,
		"Match all\n" + sshInclude + "\n":  false,
		"Include ~/.ssh/config.d/*.conf\n": false,
		"":                                 false,
	} {
		if includeBeforeHosts([]byte(text)) != want {
			t.Fatalf("%q", text)
		}
	}
}

func TestOwnMachinesUnavailableWithoutProfile(t *testing.T) {
	f := newMachinesFixture(t)
	f.env.tailscaled = "/nonexistent/tailscaled"
	cfg := transport.Config{Home: f.home, UID: os.Geteuid(), Username: "alice", Provider: "github", Subject: "42"}
	f.handler = ownMachinesHandler(cfg, func(*http.Request) bool { return true }, f.env)
	if r := f.must(t, ""); field(r, "tailscale", "state") != "unavailable" {
		t.Fatalf("%v", r)
	}
	if code, r := f.do(t, `{"action":"connect"}`); code != 409 || field(r, "error", "code") != "tailscale_unavailable" {
		t.Fatalf("%d %v", code, r)
	}
	if len(f.manager) != 0 {
		t.Fatal("user manager called")
	}
}

// Leaving is only done when the node has stopped: a failed stop keeps the
// unit and the node's state, and a retry stops it by name.
func TestOwnMachinesDisconnectNeedsAStoppedNode(t *testing.T) {
	f := newMachinesFixture(t)
	f.must(t, `{"action":"connect"}`)
	f.failStop = true
	if code, _ := f.do(t, `{"action":"disconnect"}`); code != 503 {
		t.Fatalf("disconnect with a failed stop: %d", code)
	}
	for _, kept := range []string{".config/systemd/user/" + tailnetUnit, ".config/habitat-tailscale/tailscaled.json"} {
		if _, err := os.Stat(filepath.Join(f.home, kept)); err != nil {
			t.Fatalf("%s removed under a running node", kept)
		}
	}
	f.failStop = false
	if r := f.must(t, `{"action":"disconnect"}`); field(r, "tailscale", "state") != "off" {
		t.Fatalf("%v", r)
	}
}

// A saved machine is removed while the node is down, and its shared SSH
// connection goes with it so the name cannot reach the earlier machine.
func TestOwnMachinesRemoveWithoutNodeAndRetireConnection(t *testing.T) {
	f := newMachinesFixture(t)
	f.must(t, `{"action":"connect"}`)
	f.node.Approve()
	tailnetfake.SetMachine(f.sshDir, "100.88.14.53", "ok")
	f.must(t, `{"action":"grant","peer":"alice-macbook","user":"alice","days":30}`)
	r := f.must(t, `{"action":"check","peer":"alice-macbook","user":"alice"}`)
	f.must(t, `{"action":"save","peer":"alice-macbook","user":"alice","expires":"2026-11-28","host_key":"`+field(r, "check", "host_key").(string)+`"}`)
	// An agent's open connection: the master's socket.
	ln, err := net.Listen("unix", f.env.controlPath("alice-macbook"))
	if err != nil {
		t.Fatal(err)
	}
	ln.(*net.UnixListener).SetUnlinkOnClose(false)
	defer ln.Close()
	if r := f.must(t, ""); field(r["machines"].([]any)[0], "connection_open") != true {
		t.Fatalf("open connection not seen: %v", r)
	}
	f.node.Close()
	f.node = nil
	if r := f.must(t, ""); field(r, "tailscale", "state") != "stopped" {
		t.Fatalf("%v", r)
	}
	reply := f.must(t, `{"action":"remove","machine":"alice-macbook"}`)
	if reply["removed"] != "alice-macbook" || len(reply["machines"].([]any)) != 0 {
		t.Fatalf("remove: %v", reply)
	}
	if _, err := os.Lstat(f.env.controlPath("alice-macbook")); !os.IsNotExist(err) {
		t.Fatal("shared connection left reachable")
	}
}

// expiry-time="YYYYMMDD" is refused from the start of that day, so that day
// is already expired and is not a date to save.
func TestOwnMachinesExpiryDayIsExpired(t *testing.T) {
	f := newMachinesFixture(t)
	f.must(t, `{"action":"connect"}`)
	f.node.Approve()
	tailnetfake.SetMachine(f.sshDir, "100.88.14.53", "ok")
	f.must(t, `{"action":"grant","peer":"alice-macbook","user":"alice","days":7}`)
	r := f.must(t, `{"action":"check","peer":"alice-macbook","user":"alice"}`)
	hk := field(r, "check", "host_key").(string)
	if code, _ := f.do(t, `{"action":"save","peer":"alice-macbook","user":"alice","expires":"2026-10-29","host_key":"`+hk+`"}`); code != 400 {
		t.Fatal("today's date saved")
	}
	f.must(t, `{"action":"save","peer":"alice-macbook","user":"alice","expires":"2026-11-05","host_key":"`+hk+`"}`)
	f.env.now = func() time.Time { return time.Date(2026, 11, 5, 8, 0, 0, 0, time.Local) }
	cfg := transport.Config{Home: f.home, UID: os.Geteuid(), Username: "alice", Provider: "github", Subject: "42"}
	f.handler = ownMachinesHandler(cfg, func(*http.Request) bool { return true }, f.env)
	if r := f.must(t, ""); field(r["machines"].([]any)[0], "expired") != true {
		t.Fatalf("expiry day not expired: %v", r)
	}
}

// Toistaiseksi, days 0, is a line without expiry-time= that is never
// expired here; renewal moves a machine between a dated line and one
// without an end.
func TestOwnMachinesIndefiniteLine(t *testing.T) {
	f := newMachinesFixture(t)
	f.must(t, `{"action":"connect"}`)
	f.node.Approve()
	tailnetfake.SetMachine(f.sshDir, "100.88.14.53", "ok")
	reply := f.must(t, `{"action":"grant","peer":"alice-macbook","user":"alice","days":0}`)
	line := field(reply, "grant", "line").(string)
	if !regexp.MustCompile(`^restrict,from="100\.101\.22\.7" ssh-ed25519 [A-Za-z0-9+/]+=* habitat:alice@habitat\.example\.org$`).MatchString(line) || field(reply, "grant", "expires") != "" {
		t.Fatalf("grant: %v", reply["grant"])
	}
	if cmd := field(reply, "grant", "command").(string); !strings.Contains(cmd, "echo '"+line+"'") {
		t.Fatalf("command: %s", cmd)
	}
	tailnetfake.SetMachine(f.sshDir, "100.90.1.3", "ok")
	reply = f.must(t, `{"action":"grant","peer":"gaming-pc","user":"alice","days":0}`)
	for _, k := range []string{"command", "admin_command"} {
		if c := field(reply, "grant", k).(string); !strings.Contains(c, "$k+='"+field(reply, "grant", "line").(string)+"'") || strings.Contains(c, "expiry-time") {
			t.Fatalf("windows %s: %s", k, c)
		}
	}
	r := f.must(t, `{"action":"check","peer":"alice-macbook","user":"alice"}`)
	hk := field(r, "check", "host_key").(string)
	reply = f.must(t, `{"action":"save","peer":"alice-macbook","user":"alice","expires":"","host_key":"`+hk+`"}`)
	if m := reply["machines"].([]any)[0]; field(m, "expires") != "" || field(m, "expired") != false {
		t.Fatalf("saved: %v", m)
	}
	conf, _ := os.ReadFile(filepath.Join(f.home, ".ssh/config.d/habitat-alice-macbook.conf"))
	if strings.Contains(string(conf), "expires=") || !strings.Contains(string(conf), machineMarker+"name=alice-macbook user=alice address=100.88.14.53 os=macOS\n") {
		t.Fatalf("machine config:\n%s", conf)
	}

	// Years later it is still the person's to revoke.
	f.env.now = func() time.Time { return time.Date(2031, 1, 1, 8, 0, 0, 0, time.Local) }
	cfg := transport.Config{Home: f.home, UID: os.Geteuid(), Username: "alice", Provider: "github", Subject: "42"}
	f.handler = ownMachinesHandler(cfg, func(*http.Request) bool { return true }, f.env)
	if m := f.must(t, "")["machines"].([]any)[0]; field(m, "expired") != false {
		t.Fatalf("an indefinite line expired: %v", m)
	}
	reply = f.must(t, `{"action":"renew","machine":"alice-macbook","days":30}`)
	if field(reply, "grant", "expires") != "2031-01-31" || !strings.Contains(field(reply, "grant", "line").(string), `,expiry-time="20310131" ssh-ed25519 `) {
		t.Fatalf("dated renewal: %v", reply["grant"])
	}
	if m := f.must(t, `{"action":"extend","machine":"alice-macbook","expires":"2031-01-31"}`)["machines"].([]any)[0]; field(m, "expires") != "2031-01-31" {
		t.Fatalf("dated: %v", m)
	}
	f.must(t, `{"action":"renew","machine":"alice-macbook","days":0}`)
	if m := f.must(t, `{"action":"extend","machine":"alice-macbook","expires":""}`)["machines"].([]any)[0]; field(m, "expires") != "" || field(m, "expired") != false {
		t.Fatalf("back to no end: %v", m)
	}
	for _, body := range []string{
		`{"action":"grant","peer":"alice-macbook","user":"alice","days":null}`,
		`{"action":"renew","machine":"alice-macbook","days":-1}`,
		`{"action":"renew","machine":"alice-macbook","days":"0"}`,
		`{"action":"extend","machine":"alice-macbook","expires":"never"}`,
		`{"action":"extend","machine":"alice-macbook","expires":null}`,
	} {
		if code, _ := f.do(t, body); code != 400 {
			t.Fatalf("%s: %d", body, code)
		}
	}
	f.matchContract(t)
}

// The commands the person runs on their machine replace only this
// account's line, keep every other key, and leave authorized_keys alone
// when it cannot be read.
func TestOwnMachinesInstallAndRemoveCommands(t *testing.T) {
	home := t.TempDir()
	comment := "habitat:alice@habitat.example.org"
	run := func(cmd string) error {
		c := exec.Command("/bin/sh", "-c", cmd)
		c.Env = []string{"HOME=" + home, "PATH=/usr/bin:/bin"}
		return c.Run()
	}
	keys := filepath.Join(home, ".ssh", "authorized_keys")
	os.MkdirAll(filepath.Join(home, ".ssh"), 0700)
	os.WriteFile(keys, []byte("ssh-ed25519 AAAAother bob@laptop\nssh-ed25519 AAAAold "+comment+"\nssh-ed25519 AAAAx habitat:alice@habitat-example-org\n"), 0600)
	line := `restrict,from="100.101.22.7",expiry-time="20261128" ssh-ed25519 AAAAnew ` + comment
	if err := run(installCommand(line, comment)); err != nil {
		t.Fatal(err)
	}
	b, _ := os.ReadFile(keys)
	if string(b) != "ssh-ed25519 AAAAother bob@laptop\nssh-ed25519 AAAAx habitat:alice@habitat-example-org\n"+line+"\n" {
		t.Fatalf("after install: %q", b)
	}
	if err := run(removeCommand(comment)); err != nil {
		t.Fatal(err)
	}
	if b, _ = os.ReadFile(keys); string(b) != "ssh-ed25519 AAAAother bob@laptop\nssh-ed25519 AAAAx habitat:alice@habitat-example-org\n" {
		t.Fatalf("after remove: %q", b)
	}
	// Only this account's line: removing it leaves an empty file, not an error.
	os.WriteFile(keys, []byte(line+"\n"), 0600)
	if err := run(removeCommand(comment)); err != nil {
		t.Fatal(err)
	}
	if b, _ = os.ReadFile(keys); len(b) != 0 {
		t.Fatalf("%q", b)
	}
	// grep cannot read it: nothing replaces it.
	os.Remove(keys)
	os.Mkdir(keys, 0700)
	os.WriteFile(filepath.Join(keys, "marker"), nil, 0600)
	if run(removeCommand(comment)) == nil || run(installCommand(line, comment)) == nil {
		t.Fatal("a failed read was not a failure")
	}
	if _, err := os.Stat(filepath.Join(keys, "marker")); err != nil {
		t.Fatal("authorized_keys replaced after a failed read")
	}
}

// A Windows machine keeps its PowerShell commands after it leaves the
// tailnet: its OS is saved with it.
func TestOwnMachinesWindowsMachineGoneFromTailnet(t *testing.T) {
	f := newMachinesFixture(t)
	f.must(t, `{"action":"connect"}`)
	f.node.Approve()
	tailnetfake.SetMachine(f.sshDir, "100.90.1.3", "ok")
	f.must(t, `{"action":"grant","peer":"gaming-pc","user":"alice","days":30}`)
	r := f.must(t, `{"action":"check","peer":"gaming-pc","user":"alice"}`)
	f.must(t, `{"action":"save","peer":"gaming-pc","user":"alice","expires":"2026-11-28","host_key":"`+field(r, "check", "host_key").(string)+`"}`)
	f.node.SetPeers(nil)
	r = f.must(t, "")
	if m := r["machines"].([]any)[0]; field(m, "in_tailnet") != false || field(m, "os") != "windows" {
		t.Fatalf("machine: %v", m)
	}
	r = f.must(t, `{"action":"renew","machine":"gaming-pc","days":7}`)
	if field(r, "grant", "shell") != "powershell" {
		t.Fatalf("renewal: %v", r["grant"])
	}
}

// The Windows commands do the same in PowerShell, and the administrators'
// file ends with an ACL sshd accepts. Windows itself is not here: pwsh on
// Linux runs the same script, and icacls is a recorder. Skipped without pwsh.
func TestOwnMachinesWindowsCommands(t *testing.T) {
	pwsh, err := exec.LookPath("pwsh")
	if err != nil {
		t.Skip("pwsh not installed")
	}
	home, data, bin := t.TempDir(), t.TempDir(), t.TempDir()
	comment := "habitat:alice@habitat.example.org"
	acl := filepath.Join(bin, "acl")
	os.WriteFile(filepath.Join(bin, "icacls.exe"), []byte("#!/bin/sh\necho \"$@\" > "+acl+"\n"), 0700)
	run := func(cmd string) error {
		c := exec.Command(pwsh, "-NoProfile", "-NonInteractive", "-Command", cmd)
		c.Env = []string{"HOME=" + home, "ProgramData=" + data, "PATH=" + bin + ":/usr/bin:/bin"}
		out, err := c.CombinedOutput()
		if err != nil {
			t.Logf("%s", out)
		}
		return err
	}
	line := `restrict,from="100.101.22.7",expiry-time="20261128" ssh-ed25519 AAAAnew ` + comment
	other := "command=\"C:/Users/Järvi/x.ps1\" ssh-ed25519 AAAAother bob@laptop\nssh-ed25519 AAAAold " + comment + "\nssh-ed25519 AAAAx habitat:alice@habitat-example-org\n"
	kept := "command=\"C:/Users/Järvi/x.ps1\" ssh-ed25519 AAAAother bob@laptop\nssh-ed25519 AAAAx habitat:alice@habitat-example-org\n"
	for _, admin := range []bool{false, true} {
		keys := filepath.Join(home, ".ssh", "authorized_keys")
		if admin {
			keys = filepath.Join(data, "ssh", "administrators_authorized_keys")
		}
		// A first line goes into a directory that does not exist yet.
		if err := run(windowsInstallCommand(line, comment, admin)); err != nil {
			t.Fatal(err)
		}
		if b, _ := os.ReadFile(keys); strings.ReplaceAll(string(b), "\r", "") != line+"\n" {
			t.Fatalf("first install (admin %v): %q", admin, b)
		}
		// Other keys keep their bytes, and a BOM sshd would not read goes.
		os.WriteFile(keys, []byte("\xef\xbb\xbf"+other), 0600)
		if err := run(windowsInstallCommand(line, comment, admin)); err != nil {
			t.Fatal(err)
		}
		if b, _ := os.ReadFile(keys); strings.ReplaceAll(string(b), "\r", "") != kept+line+"\n" {
			t.Fatalf("install (admin %v): %q", admin, b)
		}
		if err := run(windowsRemoveCommand(comment, admin)); err != nil {
			t.Fatal(err)
		}
		if b, _ := os.ReadFile(keys); strings.ReplaceAll(string(b), "\r", "") != kept {
			t.Fatalf("remove (admin %v): %q", admin, b)
		}
		a, _ := os.ReadFile(acl)
		if admin != (strings.TrimSpace(string(a)) == keys+" /inheritance:r /grant *S-1-5-32-544:F /grant *S-1-5-18:F") {
			t.Fatalf("acl (admin %v): %q", admin, a)
		}
		// A file it cannot read stays as it is.
		os.Remove(keys)
		os.Mkdir(keys, 0700)
		os.WriteFile(filepath.Join(keys, "marker"), nil, 0600)
		if run(windowsRemoveCommand(comment, admin)) == nil || run(windowsInstallCommand(line, comment, admin)) == nil {
			t.Fatalf("a failed read was not a failure (admin %v)", admin)
		}
		if _, err := os.Stat(filepath.Join(keys, "marker")); err != nil {
			t.Fatal("authorized_keys replaced after a failed read")
		}
	}
	// Removing where there is no file is not an error.
	if err := os.RemoveAll(filepath.Join(home, ".ssh")); err != nil {
		t.Fatal(err)
	}
	if err := run(windowsRemoveCommand(comment, false)); err != nil {
		t.Fatal(err)
	}
}
