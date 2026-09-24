//go:build linux

package provision

import (
	"encoding/json"
	"os"
	"os/user"
	"path/filepath"
	"strings"
	"testing"
)

func TestProtocolRejectsUntrustedInput(t *testing.T) {
	good := `{"version":1,"operation":"ensure","provider":"github","id":"42","candidate":"alice"}`
	if _, err := ParseRequest([]byte(good)); err != nil {
		t.Fatal(err)
	}
	for _, input := range []string{
		`{"version":1,"operation":"ensure","provider":"github","id":"42","candidate":"alice","uid":500}`,
		`{"version":1,"operation":"ensure","provider":"github","id":"42","id":"43","candidate":"alice"}`,
		`{"version":1,"operation":"ensure","provider":"github","id":"042","candidate":"alice"}`,
		`{"version":1,"operation":"authorize","provider":"github","id":"42","candidate":"alice"}`,
		`{"version":1,"operation":"authorize","provider":"github","id":"42","candidate":""}`,
		`{"version":1,"operation":"ensure","provider":"github","id":"42","candidate":null}`,
		`{"version":1,"operation":"ensure","provider":"github","id":"42","candidate":"../root"}`,
		`{"version":1,"operation":"ensure","provider":"github","id":"42","candidate":"alice","token":"secret"}`,
		`{"version":1,"operation":"ensure","provider":"github","id":"42","candidate":"alice"}{} `,
		strings.Repeat(" ", MaxMessage+1),
	} {
		if _, err := ParseRequest([]byte(input)); err == nil {
			t.Errorf("accepted %q", input)
		}
	}
	for _, input := range []string{
		`{"version":1,"failure":"denied","route":{"uid":42,"username":"alice","socket":"/run/native-agent-host/users/alice/daemon.sock"}}`,
		`{"version":1,"route":{"uid":42,"uid":43,"username":"alice","socket":"/run/native-agent-host/users/alice/daemon.sock"},"generation":1,"epoch":1}`,
		`{"version":1,"route":{"uid":42,"username":"alice","socket":"/tmp/evil"},"generation":1,"epoch":1}`,
		`{"version":1,"failure":"magic"}`,
		`{"version":1,"failure":null,"route":{"uid":42,"username":"alice","socket":"/run/native-agent-host/users/alice/daemon.sock"},"generation":1,"epoch":1}`,
	} {
		if _, err := ParseReply([]byte(input)); err == nil {
			t.Errorf("accepted reply %q", input)
		}
	}
}
func fixture(t *testing.T) string {
	t.Helper()
	// Keep fixture ancestors private: a world-writable /tmp parent must not
	// be treated as trusted root state even when the leaf itself is 0700.
	account, err := user.Current()
	if err != nil {
		t.Fatal(err)
	}
	dir, err := os.MkdirTemp(account.HomeDir, "state-test-")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(dir) })
	if err = os.Chmod(dir, 0700); err != nil {
		t.Fatal(err)
	}
	put(t, dir, "allowlist.json", `{"version":1,"epoch":4,"ids":[{"id":"42"}]}`)
	put(t, dir, "bindings.json", `{"version":1,"generation":7,"bindings":[{"id":"42","uid":1001,"username":"alice"}]}`)
	abs, err := filepath.Abs(dir)
	if err != nil {
		t.Fatal(err)
	}
	return abs
}
func put(t *testing.T, dir, name, s string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, name), []byte(s), 0600); err != nil {
		t.Fatal(err)
	}
}
func request(op, id, name string) Request {
	return Request{Version: 1, Operation: op, Provider: "github", ID: id, Candidate: name}
}
func result(t *testing.T, dir string, r Request) Reply {
	t.Helper()
	return evaluate(dir, uint32(os.Getuid()), r)
}
func TestAuthorizationAndRename(t *testing.T) {
	dir := fixture(t)
	r := result(t, dir, request("authorize", "42", ""))
	if r.Route == nil || r.Route.UID != 1001 || r.Generation != 7 || r.Epoch != 4 {
		t.Fatal(r)
	}
	r = result(t, dir, request("ensure", "42", "renamed"))
	if r.Route == nil || r.Route.Username != "alice" {
		t.Fatal(r)
	}
	if result(t, dir, request("authorize", "43", "")).Failure != Denied {
		t.Fatal("unknown allowed")
	}
	put(t, dir, "allowlist.json", `{"version":1,"epoch":5,"ids":[]}`)
	if result(t, dir, request("authorize", "42", "")).Failure != Denied {
		t.Fatal("revoked allowed")
	}
}
func TestCorruptStateDenies(t *testing.T) {
	for _, tc := range []struct{ name, file, body string }{
		{"duplicate allow id", "allowlist.json", `{"version":1,"epoch":1,"ids":[{"id":"42"},{"id":"42"}]}`},
		{"malformed id", "allowlist.json", `{"version":1,"epoch":1,"ids":[{"id":"042"}]}`},
		{"extra key", "allowlist.json", `{"version":1,"epoch":1,"ids":[{"id":"42","uid":1}]}`},
		{"duplicate key", "allowlist.json", `{"version":1,"epoch":1,"epoch":2,"ids":[]}`},
		{"duplicate uid", "bindings.json", `{"version":1,"generation":1,"bindings":[{"id":"42","uid":1001,"username":"alice"},{"id":"43","uid":1001,"username":"bob"}]}`},
		{"route collision", "bindings.json", `{"version":1,"generation":1,"bindings":[{"id":"42","uid":1001,"username":"alice"},{"id":"43","uid":1002,"username":"alice"}]}`},
		{"duplicate binding", "bindings.json", `{"version":1,"generation":1,"bindings":[{"id":"42","uid":1001,"username":"alice"},{"id":"42","uid":1002,"username":"bob"}]}`},
		{"unsafe name", "bindings.json", `{"version":1,"generation":1,"bindings":[{"id":"42","uid":1001,"username":"../bob"}]}`},
		{"stale generation", "bindings.json", `{"version":1,"generation":0,"bindings":[]}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			dir := fixture(t)
			put(t, dir, tc.file, tc.body)
			if got := result(t, dir, request("authorize", "42", "")); got.Failure != StateUnavailable {
				t.Fatal(got)
			}
		})
	}
}
func TestUnsafeFilesDeny(t *testing.T) {
	for _, action := range []struct {
		name   string
		mutate func(*testing.T, string)
	}{
		{"missing", func(t *testing.T, d string) { os.Remove(filepath.Join(d, "allowlist.json")) }},
		{"writable", func(t *testing.T, d string) { os.Chmod(filepath.Join(d, "allowlist.json"), 0666) }},
		{"directory", func(t *testing.T, d string) { os.Chmod(d, 0755) }},
		{"symlink", func(t *testing.T, d string) {
			p := filepath.Join(d, "allowlist.json")
			os.Rename(p, p+".real")
			os.Symlink(p+".real", p)
		}},
		{"hardlink", func(t *testing.T, d string) { os.Link(filepath.Join(d, "allowlist.json"), filepath.Join(d, "alias")) }},
		{"oversize", func(t *testing.T, d string) { put(t, d, "allowlist.json", strings.Repeat(" ", MaxMessage+1)) }},
		{"pending", func(t *testing.T, d string) { put(t, d, "pending.json", `{}`) }},
	} {
		t.Run(action.name, func(t *testing.T) {
			d := fixture(t)
			action.mutate(t, d)
			if got := result(t, d, request("authorize", "42", "")); got.Failure != StateUnavailable {
				t.Fatal(got)
			}
		})
	}
	// An injected test owner cannot make a different owner appear trusted.
	d := fixture(t)
	link := d + "-link"
	if err := os.Symlink(d, link); err != nil {
		t.Fatal(err)
	}
	defer os.Remove(link)
	if got := result(t, link, request("authorize", "42", "")); got.Failure != StateUnavailable {
		t.Fatal(got)
	}
	if got := evaluate(d, uint32(os.Getuid()+1), request("authorize", "42", "")); got.Failure != StateUnavailable {
		t.Fatal(got)
	}
}
func TestAlternateAndNoNewUID(t *testing.T) {
	d := fixture(t)
	put(t, d, "allowlist.json", `{"version":1,"epoch":2,"ids":[{"id":"42"},{"id":"43","alternate":"alice"}]}`)
	if got := result(t, d, request("ensure", "43", "bob")); got.Failure != NameCollision {
		t.Fatal(got)
	}
	put(t, d, "allowlist.json", `{"version":1,"epoch":3,"ids":[{"id":"42"},{"id":"43","alternate":"carol"}]}`)
	if got := result(t, d, request("ensure", "43", "bob")); got.Failure != Denied || got.Route != nil {
		t.Fatal(got)
	}
	b, _ := json.Marshal(result(t, d, request("authorize", "42", "")))
	if _, err := ParseReply(b); err != nil {
		t.Fatal(err)
	}
}
