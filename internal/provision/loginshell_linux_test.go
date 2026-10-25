//go:build linux

package provision

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// shellHost is a fake NSS and usermod for two committed accounts: alice
// (subject 123) and bob (subject 456), both admitted by the operator.
type shellHost struct {
	t       *testing.T
	shell   map[string]string
	usermod []string
}

func (h *shellHost) run(_ context.Context, path string, args ...string) ([]byte, error) {
	uids := map[string]string{"alice": "32000", "bob": "32001"}
	names := map[string]string{"32000": "alice", "32001": "bob"}
	switch path {
	case getent:
		if len(args) != 2 {
			h.t.Fatal(args)
		}
		name := args[1]
		if n, ok := names[name]; ok {
			name = n
		}
		uid, ok := uids[name]
		if !ok {
			return nil, errors.New("unexpected lookup")
		}
		switch args[0] {
		case "passwd":
			return []byte(name + ":x:" + uid + ":" + uid + "::/home/" + name + ":" + h.shell[name] + "\n"), nil
		case "group":
			return []byte(name + ":x:" + uid + ":\n"), nil
		case "initgroups":
			return []byte(name + " \n"), nil
		}
	case usermod:
		if len(args) != 4 || args[0] != "--shell" || args[2] != "--" {
			h.t.Fatal(args)
		}
		h.usermod = append(h.usermod, args[3]+"="+args[1])
		h.shell[args[3]] = args[1]
		return nil, nil
	}
	h.t.Fatal("unexpected command", path, args)
	return nil, nil
}

func shellFixture(t *testing.T) (string, uint32, *shellHost, func(uint32, uint32) *LinuxHostExecutor) {
	t.Helper()
	p, owner, policy := installFixture(t)
	if _, e := initializeBroker(context.Background(), p, "broker", policy, []string{"123", "456"}, owner, nil); e != nil {
		t.Fatal(e)
	}
	dir := filepath.Join(p, "broker")
	for name, body := range map[string]string{
		"bindings.json": `{"version":1,"generation":2,"bindings":[{"id":"123","uid":32000,"username":"alice"},{"id":"456","uid":32001,"username":"bob"}]}`,
		"head.json":     `{"version":1,"epoch":1,"generation":2}`,
	} {
		if e := os.WriteFile(filepath.Join(dir, name), []byte(body), 0600); e != nil {
			t.Fatal(e)
		}
	}
	h := &shellHost{t: t, shell: map[string]string{"alice": nologin, "bob": nologin}}
	executor := func(uid, gid uint32) *LinuxHostExecutor {
		x := NewLinuxHostExecutor(uid, gid)
		x.run = h.run
		return x
	}
	return dir, owner, h, executor
}

// The broker's own view: the executor reads the published file.
func brokerView(dir string, owner uint32, h *shellHost) *LinuxHostExecutor {
	x := NewLinuxHostExecutor(31000, 31000)
	x.run = h.run
	x.shells = func() (loginShellFile, error) { return readLoginShells(dir, owner) }
	return x
}

var alice = ExecutorIdentity{provider: "github", id: "123", username: "alice", uid: 32000}
var bob = ExecutorIdentity{provider: "github", id: "456", username: "bob", uid: 32001}

func usable(string) error { return nil }

// noLoginShells is an installation without a declaration, for executor tests
// that run on hosts without the broker state directory.
func noLoginShells() (loginShellFile, error) {
	return loginShellFile{Version: 1, Subjects: []string{}}, nil
}

func TestLoginShellAbsentDeclarationKeepsNologin(t *testing.T) {
	dir, owner, h, executor := shellFixture(t)
	ctx := context.Background()
	x := brokerView(dir, owner, h)
	for _, i := range []ExecutorIdentity{alice, bob} {
		if e := x.identity(ctx, i); e != nil {
			t.Fatal("existing nologin account refused without a declaration", e)
		}
	}
	// An installation from before the declaration verifies as it is.
	if !loginShellsPublished(ctx, dir, owner, "", nil, executor) {
		t.Fatal("absent declaration is not the empty one")
	}
	if loginShellsPublished(ctx, dir, owner, "/bin/bash", []string{"123"}, executor) {
		t.Fatal("unpublished declaration reported published")
	}
	h.shell["alice"] = "/bin/bash"
	if x.identity(ctx, alice) == nil {
		t.Fatal("undeclared login shell accepted")
	}
}

func TestLoginShellPublicationUpgradesAndReverts(t *testing.T) {
	dir, owner, h, executor := shellFixture(t)
	ctx := context.Background()
	if e := publishLoginShells(ctx, dir, owner, "/bin/bash", []string{"123"}, usable, executor); e != nil {
		t.Fatal(e)
	}
	if strings.Join(h.usermod, ",") != "alice=/bin/bash" || h.shell["bob"] != nologin {
		t.Fatal("publication changed the wrong accounts", h.usermod, h.shell)
	}
	b, e := os.ReadFile(filepath.Join(dir, loginShellState))
	if e != nil || string(b) != `{"version":1,"shell":"/bin/bash","subjects":["123"]}` {
		t.Fatal(string(b), e)
	}
	x := brokerView(dir, owner, h)
	if x.identity(ctx, alice) != nil || x.identity(ctx, bob) != nil {
		t.Fatal("broker refuses the published shells")
	}
	if !loginShellsPublished(ctx, dir, owner, "/bin/bash", []string{"123"}, executor) {
		t.Fatal("published declaration not reported")
	}
	// Repeating it changes nothing.
	h.usermod = nil
	if e := publishLoginShells(ctx, dir, owner, "/bin/bash", []string{"123"}, usable, executor); e != nil || h.usermod != nil {
		t.Fatal("repeat publication not idempotent", e, h.usermod)
	}
	// Removing the name returns the account to nologin.
	if e := publishLoginShells(ctx, dir, owner, "", nil, usable, executor); e != nil {
		t.Fatal(e)
	}
	if h.shell["alice"] != nologin || x.identity(ctx, alice) != nil || !loginShellsPublished(ctx, dir, owner, "", []string{}, executor) {
		t.Fatal("removed declaration left a login shell", h.shell)
	}
	if x.identity(ctx, bob) != nil {
		t.Fatal(bob)
	}
}

func TestLoginShellRefusesUndeclaredAccounts(t *testing.T) {
	dir, owner, h, executor := shellFixture(t)
	ctx := context.Background()
	if e := publishLoginShells(ctx, dir, owner, "/bin/bash", []string{"123"}, usable, executor); e != nil {
		t.Fatal(e)
	}
	x := brokerView(dir, owner, h)
	// A shell root set by hand for an account nobody declared is drift.
	h.shell["bob"] = "/bin/bash"
	if x.identity(ctx, bob) == nil {
		t.Fatal("undeclared account accepted with a login shell")
	}
	// Declaring alice's shell gives her no other shell either.
	h.shell["alice"] = "/usr/bin/zsh"
	if x.identity(ctx, alice) == nil {
		t.Fatal("declared account accepted with another shell")
	}
	// The next publication puts both back to what the declaration says.
	if e := publishLoginShells(ctx, dir, owner, "/bin/bash", []string{"123"}, usable, executor); e != nil {
		t.Fatal(e)
	}
	if h.shell["bob"] != nologin || h.shell["alice"] != "/bin/bash" {
		t.Fatal(h.shell)
	}
	before, _ := os.ReadFile(filepath.Join(dir, loginShellState))
	h.usermod = nil
	// A subject the operator has not admitted cannot be declared, nor can a
	// shell the host does not offer, nor a placeholder.
	for _, c := range []struct {
		shell    string
		subjects []string
		usable   func(string) error
	}{
		{"/bin/bash", []string{"789"}, usable},
		{"/bin/bash", []string{"123", "789"}, usable},
		{"/bin/bash", []string{"123"}, func(string) error { return ErrInvalid }},
		{"/usr/sbin/nologin", []string{"123"}, usable},
		{"/bin/bash", []string{}, usable},
		{"", []string{"123"}, usable},
		{"/bin/../bin/bash", []string{"123"}, usable},
		{"/bin/bash", []string{"0123"}, usable},
		{"/bin/bash", []string{"123", "123"}, usable},
	} {
		if e := publishLoginShells(ctx, dir, owner, c.shell, c.subjects, c.usable, executor); e == nil {
			t.Fatal("accepted", c.shell, c.subjects)
		}
	}
	after, _ := os.ReadFile(filepath.Join(dir, loginShellState))
	if string(after) != string(before) || h.usermod != nil {
		t.Fatal("a refused declaration changed state", string(after), h.usermod)
	}
}

func TestLoginShellPublishedChecksAccounts(t *testing.T) {
	dir, owner, h, executor := shellFixture(t)
	ctx := context.Background()
	if e := publishLoginShells(ctx, dir, owner, "/bin/bash", []string{"123"}, usable, executor); e != nil {
		t.Fatal(e)
	}
	// The file alone is not enough: an account changed since is reported.
	h.shell["alice"] = nologin
	if loginShellsPublished(ctx, dir, owner, "/bin/bash", []string{"123"}, executor) {
		t.Fatal("account drift reported as published")
	}
}

func TestLoginShellUnreadableDeclarationRefusesEveryAccount(t *testing.T) {
	dir, owner, h, _ := shellFixture(t)
	ctx := context.Background()
	x := brokerView(dir, owner, h)
	for _, body := range []string{
		`{"version":1,"shell":"/bin/bash","subjects":["123"],"extra":1}`,
		`{"version":2,"shell":"/bin/bash","subjects":["123"]}`,
		`{"version":1,"shell":"/bin/bash","subjects":["456","123"]}`,
		`{"version":1,"shell":"/bin/bash","subjects":[]}`,
		`{"version":1,"shell":"/bin/sh -c x","subjects":["123"]}`,
		`{"version":1,"shell":"","subjects":null}`,
		`not json`,
	} {
		if e := os.WriteFile(filepath.Join(dir, loginShellState), []byte(body), 0600); e != nil {
			t.Fatal(e)
		}
		if x.identity(ctx, bob) == nil {
			t.Fatal("malformed declaration accepted", body)
		}
	}
	if e := os.WriteFile(filepath.Join(dir, loginShellState), []byte(`{"version":1,"shell":"","subjects":[]}`), 0644); e != nil {
		t.Fatal(e)
	}
	if e := os.Chmod(filepath.Join(dir, loginShellState), 0644); e != nil {
		t.Fatal(e)
	}
	if x.identity(ctx, bob) == nil {
		t.Fatal("readable-by-others declaration accepted")
	}
}

func TestValidLoginShell(t *testing.T) {
	for _, s := range []string{"/bin/bash", "/usr/bin/zsh", "/usr/local/bin/fish", "/opt/fish-3.7/bin/fish"} {
		if !ValidLoginShell(s) {
			t.Error("refused", s)
		}
	}
	for _, s := range []string{"", "bash", "/", "/bin/", "//bin/bash", "/bin/./bash", "/bin/../bash", "/usr/sbin/nologin", "/sbin/nologin", "/bin/false", "/bin/ba sh", "/bin/ba:sh", "/bin/bash\n", "/" + strings.Repeat("a", 128)} {
		if ValidLoginShell(s) {
			t.Error("accepted", s)
		}
	}
}

// Real useradd, usermod, getent and /etc/shells as root in the disposable
// container of scripts/test-host-initialization-uids.sh.
func TestLoginShellNativeAccounts(t *testing.T) {
	if os.Getenv("HOST_INIT_UID_CONTAINER") != "1" || os.Geteuid() != 0 {
		t.Skip("requires the disposable root container")
	}
	ctx := context.Background()
	p, owner, policy := installFixture(t)
	if _, e := initializeBroker(ctx, p, "broker", policy, []string{"123", "456"}, owner, nil); e != nil {
		t.Fatal(e)
	}
	dir := filepath.Join(p, "broker")
	for _, a := range []struct{ name, uid string }{{"alice", "32000"}, {"bob", "32001"}} {
		for _, c := range [][]string{{groupadd, "--gid", a.uid, "--", a.name}, {useradd, "--no-create-home", "--no-user-group", "--gid", a.uid, "--uid", a.uid, "--home-dir", "/home/" + a.name, "--shell", nologin, "--", a.name}} {
			if out, e := exec.Command(c[0], c[1:]...).CombinedOutput(); e != nil {
				t.Fatal(c, e, string(out))
			}
		}
	}
	for name, body := range map[string]string{
		"bindings.json": `{"version":1,"generation":2,"bindings":[{"id":"123","uid":32000,"username":"alice"},{"id":"456","uid":32001,"username":"bob"}]}`,
		"head.json":     `{"version":1,"epoch":1,"generation":2}`,
	} {
		if e := os.WriteFile(filepath.Join(dir, name), []byte(body), 0600); e != nil {
			t.Fatal(e)
		}
	}
	shellOf := func(name string) string {
		out, e := exec.Command(getent, "passwd", name).Output()
		if e != nil {
			t.Fatal(e)
		}
		f := strings.Split(strings.TrimSpace(string(out)), ":")
		return f[len(f)-1]
	}
	if usableShell("/bin/bash") != nil || usableShell("/usr/bin/bash") != nil {
		t.Fatal("Ubuntu's bash refused")
	}
	for _, s := range []string{"/bin/zsh", "/usr/bin/env", "/usr/sbin/nologin"} {
		if usableShell(s) == nil {
			t.Fatal("unlisted or absent shell accepted", s)
		}
	}
	if e := publishLoginShells(ctx, dir, owner, "/bin/bash", []string{"123"}, usableShell, NewLinuxHostExecutor); e != nil {
		t.Fatal(e)
	}
	if shellOf("alice") != "/bin/bash" || shellOf("bob") != nologin {
		t.Fatal(shellOf("alice"), shellOf("bob"))
	}
	if !loginShellsPublished(ctx, dir, owner, "/bin/bash", []string{"123"}, NewLinuxHostExecutor) {
		t.Fatal("published declaration not verified")
	}
	x := NewLinuxHostExecutor(31000, 31000)
	x.shells = func() (loginShellFile, error) { return readLoginShells(dir, owner) }
	if x.identity(ctx, alice) != nil || x.identity(ctx, bob) != nil {
		t.Fatal("broker refuses the published accounts")
	}
	if out, e := exec.Command(usermod, "--shell", "/bin/bash", "--", "bob").CombinedOutput(); e != nil {
		t.Fatal(e, string(out))
	}
	if x.identity(ctx, bob) == nil || loginShellsPublished(ctx, dir, owner, "/bin/bash", []string{"123"}, NewLinuxHostExecutor) {
		t.Fatal("undeclared login shell accepted")
	}
	if e := publishLoginShells(ctx, dir, owner, "", nil, usableShell, NewLinuxHostExecutor); e != nil {
		t.Fatal(e)
	}
	if shellOf("alice") != nologin || shellOf("bob") != nologin || x.identity(ctx, alice) != nil || x.identity(ctx, bob) != nil {
		t.Fatal("removed declaration left a login shell", shellOf("alice"), shellOf("bob"))
	}
}

// Verification runs inside the writer's transaction, whose pending journal
// stays in the state directory while the account is created.
func TestLoginShellReadDuringPendingTransaction(t *testing.T) {
	dir, owner, h, executor := shellFixture(t)
	ctx := context.Background()
	if e := publishLoginShells(ctx, dir, owner, "/bin/bash", []string{"123"}, usable, executor); e != nil {
		t.Fatal(e)
	}
	if e := os.WriteFile(filepath.Join(dir, "pending.json"), []byte(`{}`), 0600); e != nil {
		t.Fatal(e)
	}
	x := brokerView(dir, owner, h)
	if shell, e := x.loginShell("123"); e != nil || shell != "/bin/bash" {
		t.Fatal("declaration unreadable during a transaction", shell, e)
	}
	if x.identity(ctx, alice) != nil || x.identity(ctx, bob) != nil {
		t.Fatal("accounts refused during a transaction")
	}
}

func TestLoginShellTrustedPath(t *testing.T) {
	for _, s := range []string{"/bin/bash", "/usr/bin/bash", "/bin/sh"} {
		if _, e := os.Lstat(s); e == nil && trustedPath(s, 0) != nil {
			t.Error("root's shell refused", s)
		}
	}
	// A directory or link the test user owns is not root's.
	d := t.TempDir()
	exe := filepath.Join(d, "sh")
	if e := os.WriteFile(exe, []byte("#!/bin/sh\n"), 0755); e != nil {
		t.Fatal(e)
	}
	link := filepath.Join(d, "link")
	if e := os.Symlink("/bin/bash", link); e != nil {
		t.Fatal(e)
	}
	for _, s := range []string{exe, link, "/nonexistent/bash", "/etc"} {
		if trustedPath(s, 0) == nil {
			t.Error("untrusted shell path accepted", s)
		}
	}
}
