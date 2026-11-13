//go:build linux

package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// microsoftPlainServer is the readable name of an account registered alone.
func microsoftPlainServer(address string) string {
	plain, _ := microsoftServerNames(address)
	return plain
}

// microsoftTestCache is the token cache path a registration of the account
// names, which is what makes the entry the account's.
func microsoftTestCache(env Env, address string) string {
	return filepath.Join(env.Home, microsoftMCPDir, address, ".token-cache.json")
}

// piServerName is Pi's own rule (pi-mcp config.js SERVER_NAME).
var piServerName = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)

func TestMicrosoftServerNames(t *testing.T) {
	long := strings.Repeat("a.", 31) + "b@" + strings.Repeat("sub.", 40) + "example.com"
	for address, want := range map[string]string{
		"aino.virtanen@contoso.test":     "habitat-microsoft-aino-virtanen-contoso-test",
		"person@example.test":            "habitat-microsoft-person-example-test",
		"a+tag_x%y--z@mail.example.fi":   "habitat-microsoft-a-tag-x-y-z-mail-example-fi",
		"Aino.Virtanen@Contoso.TEST":     "habitat-microsoft-aino-virtanen-contoso-test",
		"jörö.ääkkönen@esimerkki.fi":     "habitat-microsoft-j-r-kk-nen-esimerkki-fi",
		"-.leading.and.trailing.-@x.fi.": "habitat-microsoft-leading-and-trailing-x-fi",
		long:                             microsoftServerPrefix + strings.Repeat("a-", 31) + "b-" + strings.Repeat("sub-", 40) + "example-com",
	} {
		plain, suffixed := microsoftServerNames(address)
		if plain != want {
			t.Errorf("%q: %q, want %q", address, plain, want)
		}
		if !piServerName.MatchString(plain) || !piServerName.MatchString(suffixed) {
			t.Errorf("%q: Pi would refuse %q or %q", address, plain, suffixed)
		}
		if !regexp.MustCompile(`^` + regexp.QuoteMeta(plain) + `-[0-9a-f]{6}$`).MatchString(suffixed) {
			t.Errorf("%q: suffixed %q", address, suffixed)
		}
		// The name never looks like the legacy one, so the two cannot meet.
		if plain == microsoftLegacyServerName(address) || suffixed == microsoftLegacyServerName(address) {
			t.Errorf("%q: readable name equals the legacy one", address)
		}
	}
	// The suffix is of the whole address: addresses sharing a slug differ.
	_, a := microsoftServerNames("aino.virtanen@contoso.test")
	_, b := microsoftServerNames("aino-virtanen@contoso.test")
	if a == b {
		t.Fatalf("colliding addresses share a suffixed name %q", a)
	}
}

func microsoftServerEntry(env Env, address string) json.RawMessage {
	raw, _ := json.Marshal(map[string]any{"command": "/x", "env": map[string]string{"MS365_MCP_TOKEN_CACHE_PATH": filepath.Join(env.Home, microsoftMCPDir, address, ".token-cache.json")}})
	return raw
}

// Two of the person's accounts whose addresses share a slug: the one
// registered first keeps the plain name, the other gets the suffixed one, and
// neither name changes when the other account comes or goes.
func TestMicrosoftServerNameCollision(t *testing.T) {
	env := Env{Home: "/home/person"}
	first, second := "aino.virtanen@contoso.test", "aino-virtanen@contoso.test"
	plain, _ := microsoftServerNames(first)
	_, suffixed := microsoftServerNames(second)
	servers := map[string]json.RawMessage{}
	resolve := func(address string) string {
		t.Helper()
		name, err := microsoftServerName(env, servers, address)
		if err != nil {
			t.Fatal(err)
		}
		return name
	}
	if got := resolve(first); got != plain {
		t.Fatalf("first account: %q", got)
	}
	servers[plain] = microsoftServerEntry(env, first)
	if got := resolve(second); got != suffixed {
		t.Fatalf("second account: %q", got)
	}
	servers[suffixed] = microsoftServerEntry(env, second)
	if resolve(first) != plain || resolve(second) != suffixed {
		t.Fatal("a name changed when another account was added")
	}
	delete(servers, plain)
	if resolve(second) != suffixed {
		t.Fatal("a name changed when another account was removed")
	}
	// A new registration of the first account takes the free plain name.
	if resolve(first) != plain {
		t.Fatal("plain name not reused")
	}

	// A name Pi folds onto ours holds it; so does an entry without this
	// account's cache, even one with no cache at all.
	servers = map[string]json.RawMessage{strings.ReplaceAll(plain, "-", "_"): json.RawMessage(`{"command":"/other"}`)}
	if got := resolve(first); got != microsoftServerNamesSuffixed(first) {
		t.Fatalf("folded name: %q", got)
	}
	servers = map[string]json.RawMessage{plain: json.RawMessage(`{"url":"https://other.example/mcp"}`)}
	if got := resolve(first); got != microsoftServerNamesSuffixed(first) {
		t.Fatalf("entry without cache adopted: %q", got)
	}
	servers = map[string]json.RawMessage{plain: microsoftServerEntry(env, "someone@else.test"), microsoftServerNamesSuffixed(first): microsoftServerEntry(env, "third@else.test")}
	if name, err := microsoftServerName(env, servers, first); err == nil {
		t.Fatalf("took over another entry: %q", name)
	}
}

func microsoftServerNamesSuffixed(address string) string {
	_, s := microsoftServerNames(address)
	return s
}

func sameJSON(a, b []byte) bool {
	var x, y bytes.Buffer
	return json.Compact(&x, a) == nil && json.Compact(&y, b) == nil && bytes.Equal(x.Bytes(), y.Bytes())
}

func writePiMCP(t *testing.T, env Env, servers map[string]json.RawMessage) {
	t.Helper()
	dir := filepath.Join(env.Home, ".pi", "agent")
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	data, _ := json.Marshal(map[string]any{"mcpServers": servers, "settings": map[string]any{"kept": true}})
	if err := os.WriteFile(filepath.Join(dir, "mcp.json"), data, 0600); err != nil {
		t.Fatal(err)
	}
}

func readPiMCP(t *testing.T, env Env) (map[string]json.RawMessage, map[string]json.RawMessage) {
	t.Helper()
	root, servers, err := microsoftPiServers(env)
	if err != nil {
		t.Fatal(err)
	}
	return root, servers
}

// An account registered under the hex-encoded name of earlier releases moves
// to the readable name at its next check, with no new sign-in: the entry and
// everything that holds its sign-in stay byte for byte.
func TestMicrosoftServerRename(t *testing.T) {
	env := microsoftEnv(t)
	m := &microsoft{}
	address := "aino.virtanen@contoso.test"
	legacy, readable := microsoftLegacyServerName(address), microsoftPlainServer(address)
	entry := json.RawMessage(`{"command":"/ms365","args":["--org-mode"],"env":{"MS365_MCP_TOKEN_CACHE_PATH":"` + filepath.Join(env.Home, microsoftMCPDir, address, ".token-cache.json") + `"},"toolExposure":{"send-mail":"off"}}`)
	other := json.RawMessage(`{"url":"https://mcp.example.test"}`)
	writePiMCP(t, env, map[string]json.RawMessage{legacy: entry, "mine": other})
	cache := filepath.Join(env.Home, microsoftMCPDir, address)
	os.MkdirAll(cache, 0700)
	os.WriteFile(filepath.Join(cache, ".token-cache.json"), []byte("native encrypted cache"), 0600)
	auth := []byte(`{"mcp__mine|https://mcp.example.test/":{"tokens":{"access_token":"a"}}}`)
	os.WriteFile(filepath.Join(env.Home, ".pi/agent/mcp-auth.json"), auth, 0600)

	// Until it is renamed, everything finds the account under the old name.
	if body := m.Skill(env, address).Body; !strings.Contains(body, "`"+legacy+"`") {
		t.Fatal(body)
	}
	if ok, err := microsoftMCPConfigured(env, address); !ok || err != nil {
		t.Fatal("legacy registration not seen", err)
	}
	if !m.Misaligned(env, address) {
		t.Fatal("legacy name not seen as needing a change")
	}

	// A cancelled rename writes nothing and the next one still runs.
	cancelled, cancel := context.WithCancel(context.Background())
	cancel()
	if err := m.Align(cancelled, env, address, func() {}); err == nil {
		t.Fatal("cancelled rename reported success")
	}
	if _, servers := readPiMCP(t, env); servers[legacy] == nil || servers[readable] != nil {
		t.Fatalf("cancelled rename changed mcp.json: %v", servers)
	}

	if err := m.Align(context.Background(), env, address, func() { t.Error("sync stopped") }); err != nil {
		t.Fatal(err)
	}
	root, servers := readPiMCP(t, env)
	if servers[legacy] != nil || !sameJSON(servers[readable], entry) || !sameJSON(servers["mine"], other) || len(servers) != 2 || !sameJSON(root["settings"], []byte(`{"kept":true}`)) {
		t.Fatalf("rename: %s", root["mcpServers"])
	}
	if data, _ := os.ReadFile(filepath.Join(env.Home, ".pi/agent/mcp-auth.json")); !bytes.Equal(data, auth) {
		t.Fatal("Pi's OAuth state changed")
	}
	if data, _ := os.ReadFile(filepath.Join(cache, ".token-cache.json")); string(data) != "native encrypted cache" {
		t.Fatal("native token cache changed")
	}
	if commands, _ := os.ReadFile(filepath.Join(env.Home, "pi-commands")); len(commands) != 0 {
		t.Fatalf("rename ran Pi:\n%s", commands)
	}
	if m.Misaligned(env, address) {
		t.Fatal("renamed account still misaligned")
	}
	if body := m.Skill(env, address).Body; !strings.Contains(body, "`"+readable+"`") || strings.Contains(body, legacy) {
		t.Fatal(body)
	}
	// Running again changes nothing.
	before, _ := os.ReadFile(filepath.Join(env.Home, ".pi/agent/mcp.json"))
	if err := microsoftRenameServer(context.Background(), env, address); err != nil {
		t.Fatal(err)
	}
	if after, _ := os.ReadFile(filepath.Join(env.Home, ".pi/agent/mcp.json")); !bytes.Equal(before, after) {
		t.Fatal("a repeated rename rewrote mcp.json")
	}
}

// A re-registration stopped between adding the readable name and removing
// the legacy one leaves both; the next check keeps the newer readable entry.
func TestMicrosoftServerRenameResumes(t *testing.T) {
	env := microsoftEnv(t)
	m := &microsoft{}
	address := "person@example.test"
	legacy, readable := microsoftLegacyServerName(address), microsoftPlainServer(address)
	newer := microsoftServerEntry(env, address)
	writePiMCP(t, env, map[string]json.RawMessage{legacy: json.RawMessage(`{"command":"/old"}`), readable: newer})
	if !m.Misaligned(env, address) {
		t.Fatal("leftover legacy entry not seen")
	}
	if err := m.Align(context.Background(), env, address, func() {}); err != nil {
		t.Fatal(err)
	}
	if _, servers := readPiMCP(t, env); servers[legacy] != nil || !sameJSON(servers[readable], newer) || len(servers) != 1 {
		t.Fatalf("%v", servers)
	}

	// Removing the account removes every name it has.
	writePiMCP(t, env, map[string]json.RawMessage{legacy: json.RawMessage(`{"command":"/old"}`), readable: newer})
	if err := m.Remove(context.Background(), env, address); err != nil {
		t.Fatal(err)
	}
	commands, _ := os.ReadFile(filepath.Join(env.Home, "pi-commands"))
	if !strings.Contains(string(commands), "remove\n"+readable+"\n") || !strings.Contains(string(commands), "remove\n"+legacy+"\n") {
		t.Fatalf("remove:\n%s", commands)
	}
}

// Registering an account still under the legacy name writes the readable
// name and drops the legacy one.
func TestMicrosoftRegisterReplacesLegacyName(t *testing.T) {
	env := microsoftEnv(t)
	address := "person@example.test"
	legacy := microsoftLegacyServerName(address)
	writePiMCP(t, env, map[string]json.RawMessage{legacy: json.RawMessage(`{"command":"/old"}`)})
	if err := microsoftRegister(context.Background(), env, *env.Config.Microsoft, address, microsoftMCPScopes); err != nil {
		t.Fatal(err)
	}
	commands, _ := os.ReadFile(filepath.Join(env.Home, "pi-commands"))
	if !strings.HasPrefix(string(commands), "mcp\nadd\n"+microsoftPlainServer(address)+"\n") || !strings.Contains(string(commands), "mcp\nremove\n"+legacy+"\n") {
		t.Fatalf("register:\n%s", commands)
	}
}

// The pinned Pi accepts the readable names, registers under them, and reads
// a renamed mcp.json as its own.
func TestMicrosoftServerNamesPinnedPi(t *testing.T) {
	cli, err := filepath.Abs(filepath.Join("..", "pi-device-test", "node_modules", "@earendil-works", "pi-coding-agent", "dist", "bundle", "cli.js"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(cli); err != nil {
		t.Skip("pinned Pi test dependency not installed")
	}
	node, err := exec.LookPath("node")
	if err != nil {
		t.Skip("node not installed")
	}
	pi := filepath.Join(t.TempDir(), "pi")
	if err := os.WriteFile(pi, []byte("#!/bin/sh\nPI_OFFLINE=1 exec "+node+" "+cli+" \"$@\"\n"), 0700); err != nil {
		t.Fatal(err)
	}
	env := microsoftEnv(t)
	env.Config.Tools["pi"] = pi
	first, second := "aino.virtanen@contoso.test", "aino-virtanen@contoso.test"
	for _, address := range []string{first, second} {
		if err := microsoftRegister(context.Background(), env, *env.Config.Microsoft, address, microsoftMCPScopes); err != nil {
			t.Fatalf("%s: real Pi refused the registration: %v", address, err)
		}
	}
	_, servers := readPiMCP(t, env)
	if servers[microsoftPlainServer(first)] == nil || servers[microsoftServerNamesSuffixed(second)] == nil || len(servers) != 2 {
		t.Fatalf("registered names: %v", servers)
	}
	// Pi's own registration is a legacy one too: rename it and let Pi
	// remove it under the readable name.
	third := "jörö@example.test"
	legacy := microsoftLegacyServerName("person@example.test")
	cmd := exec.Command(pi, "mcp", "add", legacy, "--env", "MS365_MCP_TOKEN_CACHE_PATH="+filepath.Join(env.Home, microsoftMCPDir, "person@example.test", ".token-cache.json"), "--", "/x")
	cmd.Env = []string{"HOME=" + env.Home, "PATH=/usr/bin:/bin"}
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("%v %s", err, out)
	}
	if err := microsoftRenameServer(context.Background(), env, "person@example.test"); err != nil {
		t.Fatal(err)
	}
	m := &microsoft{}
	if err := m.Remove(context.Background(), env, "person@example.test"); err != nil {
		t.Fatalf("Pi did not remove the renamed entry: %v", err)
	}
	if _, servers := readPiMCP(t, env); len(servers) != 2 {
		t.Fatalf("after removal: %v", servers)
	}
	cmd = exec.Command(pi, "mcp", "add", microsoftPlainServer(third), "--", "/x")
	cmd.Env = []string{"HOME=" + env.Home, "PATH=/usr/bin:/bin"}
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("non-ASCII address's name refused: %v %s", err, out)
	}
}

// A legacy registration that is also outdated is renamed in an Align of its
// own, which succeeds so the catalog rewrites the skill, even when the
// tenant cannot be asked; the outdated arguments wait for the next check.
func TestMicrosoftServerRenameIsItsOwnStep(t *testing.T) {
	const address = "person@example.test"
	env := microsoftEnv(t)
	m := &microsoft{}
	outlook := "User.Read Mail.ReadWrite"
	writeMicrosoftRegistrationAt(t, env, address, testTenant, []string{"--preset", "mail,calendar,contacts", "--allowed-scopes", outlook})
	_, servers := readPiMCP(t, env)
	writePiMCP(t, env, map[string]json.RawMessage{microsoftLegacyServerName(address): servers[microsoftPlainServer(address)]})
	cache := filepath.Join(env.Home, microsoftMCPDir, address)
	os.MkdirAll(cache, 0700)
	os.WriteFile(filepath.Join(cache, ".token-cache.json"), []byte("native"), 0600)
	os.WriteFile(filepath.Join(env.Home, "mcp-status-result"), []byte(`{"state":"unreachable"}`), 0600)
	if err := m.Align(context.Background(), env, address, func() {}); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(env.Home, "mcp-checked")); err == nil {
		t.Fatal("the rename's Align went on to ask the tenant")
	}
	if _, servers := readPiMCP(t, env); servers[microsoftPlainServer(address)] == nil || len(servers) != 1 {
		t.Fatalf("%v", servers)
	}
	if !m.Misaligned(env, address) {
		t.Fatal("outdated registration forgotten after the rename")
	}
	if err := m.Align(context.Background(), env, address, func() {}); !errors.Is(err, ServerUnreachable) {
		t.Fatal(err)
	}
}
