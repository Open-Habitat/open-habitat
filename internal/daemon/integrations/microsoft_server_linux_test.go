//go:build linux

package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"testing"

	"github.com/open-habitat/open-habitat/internal/msmcp"
)

// microsoftPlainServer is the single entry's readable name an earlier
// release gave an account registered alone.
func microsoftPlainServer(address string) string {
	return microsoftOldServerNames(address)[0]
}

// microsoftLegacyServerName is the hex-encoded name of releases before
// 12.11.2026.
func microsoftLegacyServerName(address string) string {
	return microsoftOldServerNames(address)[2]
}

// microsoftTestCache is the token cache path a registration of the account
// names, which is what makes the entry the account's.
func microsoftTestCache(env Env, address string) string {
	return filepath.Join(env.Home, microsoftMCPDir, address, ".token-cache.json")
}

// piServerName is Pi's own rule (pi-mcp config.js SERVER_NAME).
var piServerName = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)

func microsoftServerEntry(env Env, address string) json.RawMessage {
	raw, _ := json.Marshal(map[string]any{"command": "/x", "env": map[string]string{"MS365_MCP_TOKEN_CACHE_PATH": filepath.Join(env.Home, microsoftMCPDir, address, ".token-cache.json")}})
	return raw
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

func areaNames(index int) []string {
	var out []string
	for _, a := range msmcp.AreaNames() {
		out = append(out, microsoftAreaEntryName(index, a))
	}
	return out
}

func TestMicrosoftAreaEntryNames(t *testing.T) {
	if got := areaNames(1); !slices.Equal(got, []string{"ms-mail", "ms-calendar", "ms-contacts", "ms-files", "ms-admin"}) {
		t.Fatal(got)
	}
	if got := areaNames(2); got[3] != "ms2-files" {
		t.Fatal(got)
	}
	for _, n := range append(areaNames(1), areaNames(12)...) {
		if !piServerName.MatchString(n) || !microsoftAreaName.MatchString(n) {
			t.Errorf("%q", n)
		}
		// No Microsoft tool name is hashed under these servers but the one
		// long calendar upload tool (Pi hashes past 64 characters).
		for _, area := range msmcp.Areas {
			for _, tool := range area.Tools {
				if long := len("mcp__" + n + "__" + tool); long > 64 && tool != "create-calendar-event-attachment-upload-session" {
					t.Errorf("%s/%s hashed (%d)", n, tool, long)
				}
			}
		}
	}
}

// The first account gets ms-…, a second ms2-…; neither changes when the
// other comes or goes, a name Pi folds onto ours holds it, and another
// account's or an unproven entry is never taken over.
func TestMicrosoftAreaPrefixes(t *testing.T) {
	env := Env{Home: "/home/person"}
	first, second := "aino.virtanen@contoso.test", "ville@contoso.test"
	servers := map[string]json.RawMessage{}
	add := func(address string, index int) {
		for _, n := range areaNames(index) {
			servers[n] = microsoftServerEntry(env, address)
		}
	}
	if s := microsoftServerIn(env, servers, first); s.index != 1 || s.configured() {
		t.Fatalf("%+v", s)
	}
	add(first, 1)
	if s := microsoftServerIn(env, servers, second); s.index != 2 {
		t.Fatalf("second: %+v", s)
	}
	add(second, 2)
	for _, n := range areaNames(1) {
		delete(servers, n)
	}
	if s := microsoftServerIn(env, servers, second); s.index != 2 || len(s.areas) != 5 {
		t.Fatalf("second renamed after the first left: %+v", s)
	}
	if s := microsoftServerIn(env, servers, first); s.index != 1 {
		t.Fatalf("first did not get the free prefix back: %+v", s)
	}
	servers = map[string]json.RawMessage{"ms_files": json.RawMessage(`{"command":"/other"}`)}
	if s := microsoftServerIn(env, servers, first); s.index != 2 {
		t.Fatalf("folded name not respected: %+v", s)
	}
	servers = map[string]json.RawMessage{"ms-mail": json.RawMessage(`{"url":"https://other.example/mcp"}`), "ms-files": microsoftServerEntry(env, "someone@else.test")}
	if s := microsoftServerIn(env, servers, first); s.index != 2 || s.configured() {
		t.Fatalf("took over another entry: %+v", s)
	}
	// Old single entries are the account's by their cache too.
	servers = map[string]json.RawMessage{microsoftPlainServer(first): microsoftServerEntry(env, first), microsoftLegacyServerName(first): microsoftServerEntry(env, first), microsoftPlainServer(second): microsoftServerEntry(env, "x@y.test")}
	if s := microsoftServerIn(env, servers, first); len(s.old) != 2 || len(s.areas) != 0 {
		t.Fatalf("old entries: %+v", s)
	}
}

// microsoftRegister writes the five relay entries in one rewrite, keeping
// other servers and keys, and drops the account's entries of earlier forms.
func TestMicrosoftRegisterWritesAreas(t *testing.T) {
	env := microsoftEnv(t)
	address := "person@example.test"
	other := json.RawMessage(`{"url":"https://mcp.example.test"}`)
	writePiMCP(t, env, map[string]json.RawMessage{microsoftLegacyServerName(address): microsoftServerEntry(env, address), microsoftPlainServer(address): microsoftServerEntry(env, address), "mine": other})
	allowed := "User.Read Mail.ReadWrite Files.Read.All"
	if err := microsoftRegister(context.Background(), env, *env.Config.Microsoft, address, allowed); err != nil {
		t.Fatal(err)
	}
	root, servers := readPiMCP(t, env)
	if len(servers) != 6 || !sameJSON(servers["mine"], other) || !sameJSON(root["settings"], []byte(`{"kept":true}`)) {
		t.Fatalf("%s", root["mcpServers"])
	}
	for _, area := range msmcp.AreaNames() {
		var e struct {
			Command      string            `json:"command"`
			Args         []string          `json:"args"`
			Env          map[string]string `json:"env"`
			Description  string            `json:"description"`
			ToolExposure map[string]string `json:"toolExposure"`
		}
		if err := json.Unmarshal(servers["ms-"+area], &e); err != nil {
			t.Fatal(area, err)
		}
		if e.Command != env.Relay || !slices.Equal(e.Args, []string{"mcp-relay", "microsoft", "--account", address, "--area", area}) {
			t.Errorf("%s: %s %q", area, e.Command, e.Args)
		}
		if e.Env[microsoftAllowedEnv] != allowed || e.Env["MS365_MCP_TOKEN_CACHE_PATH"] != microsoftTestCache(env, address) || e.Env["MS365_MCP_EXPECTED_USERNAME"] != address || e.Env["MS365_MCP_CLIENT_ID"] != env.Config.Microsoft.ClientID {
			t.Errorf("%s env: %v", area, e.Env)
		}
		if !strings.Contains(e.Description, address) || len(e.ToolExposure) != len(msmcp.SignIn) || e.ToolExposure["logout"] != "hidden" {
			t.Errorf("%s: %q %v", area, e.Description, e.ToolExposure)
		}
	}
	if commands, _ := os.ReadFile(filepath.Join(env.Home, "pi-commands")); len(commands) != 0 {
		t.Fatalf("registration ran Pi:\n%s", commands)
	}
	// Without the relay path nothing is written.
	env.Relay = ""
	if err := microsoftRegister(context.Background(), env, *env.Config.Microsoft, address, allowed); err == nil {
		t.Fatal("registered without a relay")
	}
}

// An account registered as one entry by an earlier release (under any of
// its names) becomes the five areas at its next check: its own native
// environment, no new sign-in, no tenant contact, no Pi command.
func TestMicrosoftSingleEntryMigrates(t *testing.T) {
	for _, legacy := range []bool{false, true} {
		env := microsoftEnv(t)
		m := &microsoft{}
		address := "aino.virtanen@contoso.test"
		allowed := "User.Read Mail.ReadWrite Mail.Send Calendars.ReadWrite Contacts.ReadWrite Files.Read.All Sites.Read.All"
		name := microsoftPlainServer(address)
		if legacy {
			name = microsoftLegacyServerName(address)
		}
		entry, _ := json.Marshal(map[string]any{"command": "/ms365", "args": microsoftMCPArgs(allowed), "env": map[string]string{
			"MS365_MCP_CLIENT_ID": env.Config.Microsoft.ClientID, "MS365_MCP_TENANT_ID": testTenant, "MS365_MCP_TOKEN_CACHE_PATH": microsoftTestCache(env, address)}})
		other := json.RawMessage(`{"url":"https://mcp.example.test"}`)
		writePiMCP(t, env, map[string]json.RawMessage{name: entry, "mine": other})
		cache := filepath.Join(env.Home, microsoftMCPDir, address)
		os.MkdirAll(cache, 0700)
		os.WriteFile(filepath.Join(cache, ".token-cache.json"), []byte("native encrypted cache"), 0600)

		if ok, err := microsoftMCPConfigured(env, address); !ok || err != nil {
			t.Fatal("single entry not seen", err)
		}
		if !m.Misaligned(env, address) {
			t.Fatal("single entry not seen as needing a change")
		}
		cancelled, cancel := context.WithCancel(context.Background())
		cancel()
		if err := m.Align(cancelled, env, address, func() {}); err == nil {
			t.Fatal("cancelled migration reported success")
		}
		if _, servers := readPiMCP(t, env); servers[name] == nil || servers["ms-files"] != nil {
			t.Fatalf("cancelled migration changed mcp.json: %v", servers)
		}
		if err := m.Align(context.Background(), env, address, func() { t.Error("sync stopped") }); err != nil {
			t.Fatal(err)
		}
		root, servers := readPiMCP(t, env)
		if servers[name] != nil || len(servers) != 6 || !sameJSON(servers["mine"], other) || !sameJSON(root["settings"], []byte(`{"kept":true}`)) {
			t.Fatalf("migration: %s", root["mcpServers"])
		}
		b, err := microsoftBinding(env, address)
		if err != nil || !slices.Contains(b.Args, allowed) || !slices.Contains(b.Env, "MS365_MCP_TENANT_ID="+testTenant) {
			t.Fatalf("binding after migration: %+v %v", b, err)
		}
		if _, err := os.Stat(filepath.Join(env.Home, "mcp-checked")); err == nil {
			t.Fatal("the migration asked the tenant")
		}
		if data, _ := os.ReadFile(filepath.Join(cache, ".token-cache.json")); string(data) != "native encrypted cache" {
			t.Fatal("native token cache changed")
		}
		if m.Misaligned(env, address) {
			t.Fatal("migrated account still misaligned")
		}
		body := m.Skill(env, address).Body
		for _, want := range []string{"`ms-mail`", "`ms-files`", "`ms-admin`", `describeNamespace("ms-files")`, `searchTools(query, {namespace: "ms-files"})`, "a mail folder is not a file folder"} {
			if !strings.Contains(body, want) {
				t.Errorf("skill lacks %q:\n%s", want, body)
			}
		}
		if strings.Contains(body, name) {
			t.Fatalf("skill names the old entry:\n%s", body)
		}
		// Running again changes nothing.
		before, _ := os.ReadFile(filepath.Join(env.Home, ".pi/agent/mcp.json"))
		if err := m.Align(context.Background(), env, address, func() {}); err != nil {
			t.Fatal(err)
		}
		if after, _ := os.ReadFile(filepath.Join(env.Home, ".pi/agent/mcp.json")); !bytes.Equal(before, after) {
			t.Fatal("a repeated Align rewrote mcp.json")
		}
	}
}

// An earlier release's single entry without the file tools is not merely
// reshaped: what it may run is asked of the tenant first, and while the
// tenant cannot be asked, nothing is rewritten.
func TestMicrosoftOutdatedSingleEntryAsksTenant(t *testing.T) {
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
	if !m.Misaligned(env, address) {
		t.Fatal("outdated entry not misaligned")
	}
	if err := m.Align(context.Background(), env, address, func() {}); !errors.Is(err, ServerUnreachable) {
		t.Fatal(err)
	}
	if _, servers := readPiMCP(t, env); servers[microsoftLegacyServerName(address)] == nil || len(servers) != 1 {
		t.Fatalf("rewritten while the tenant was unreachable: %v", servers)
	}
	os.Remove(filepath.Join(env.Home, "mcp-status-result"))
	if err := m.Align(context.Background(), env, address, func() {}); err != nil {
		t.Fatal(err)
	}
	if _, servers := readPiMCP(t, env); servers["ms-files"] == nil || len(servers) != 5 {
		t.Fatalf("after the tenant answered: %v", servers)
	}
}

// The daemon's binding comes from the account's own entries: the native
// command with the entries' environment. It refuses an unknown account,
// entries that disagree, another cache, an unknown scope; a changed level
// is a different key.
func TestMicrosoftBinding(t *testing.T) {
	env := microsoftEnv(t)
	address := "person@example.test"
	if _, err := microsoftBinding(env, address); err == nil {
		t.Fatal("unregistered account bound")
	}
	if err := microsoftRegister(context.Background(), env, *env.Config.Microsoft, address, "User.Read Mail.Read"); err != nil {
		t.Fatal(err)
	}
	b, err := microsoftBinding(env, address)
	if err != nil {
		t.Fatal(err)
	}
	if b.Account != address || b.Path != env.Config.Tools["ms-365-mcp-server"] || !slices.Equal(b.Args, microsoftMCPArgs("User.Read Mail.Read")) || !slices.Contains(b.Env, "MS365_MCP_EXPECTED_USERNAME="+address) || !slices.Contains(b.Env, "HOME="+env.Home) {
		t.Fatalf("%+v", b)
	}
	if _, err := microsoftBinding(env, "someone@else.test"); err == nil {
		t.Fatal("another address bound")
	}
	if err := microsoftRegister(context.Background(), env, *env.Config.Microsoft, address, "User.Read Mail.ReadWrite"); err != nil {
		t.Fatal(err)
	}
	if c, err := microsoftBinding(env, address); err != nil || c.Key == b.Key {
		t.Fatal("a changed level kept the binding's key")
	}
	edit := func(area, key, value string) {
		root, servers := readPiMCP(t, env)
		var e map[string]any
		json.Unmarshal(servers["ms-"+area], &e)
		e["env"].(map[string]any)[key] = value
		servers["ms-"+area], _ = json.Marshal(e)
		root["mcpServers"], _ = json.Marshal(servers)
		data, _ := json.Marshal(root)
		os.WriteFile(filepath.Join(env.Home, ".pi/agent/mcp.json"), data, 0600)
	}
	edit("admin", microsoftAllowedEnv, "User.Read Mail.ReadWrite Mail.Send")
	if _, err := microsoftBinding(env, address); err == nil {
		t.Fatal("disagreeing entries bound")
	}
	for _, area := range msmcp.AreaNames() {
		edit(area, microsoftAllowedEnv, "User.Read Directory.ReadWrite.All")
	}
	if _, err := microsoftBinding(env, address); err == nil {
		t.Fatal("unknown scope bound")
	}
	for _, area := range msmcp.AreaNames() {
		edit(area, microsoftAllowedEnv, "User.Read")
		edit(area, "MS365_MCP_EXPECTED_USERNAME", "someone@else.test")
	}
	if _, err := microsoftBinding(env, address); err == nil {
		t.Fatal("another identity pin bound")
	}
}

// Removal takes every entry of the account in any form and leaves others.
func TestMicrosoftUnregister(t *testing.T) {
	env := microsoftEnv(t)
	address := "person@example.test"
	other := json.RawMessage(`{"url":"https://mcp.example.test"}`)
	if err := microsoftRegister(context.Background(), env, *env.Config.Microsoft, address, "User.Read"); err != nil {
		t.Fatal(err)
	}
	if err := microsoftRegister(context.Background(), env, *env.Config.Microsoft, "ville@example.test", "User.Read"); err != nil {
		t.Fatal(err)
	}
	root, servers := readPiMCP(t, env)
	servers["mine"] = other
	servers[microsoftLegacyServerName(address)] = microsoftServerEntry(env, address)
	root["mcpServers"], _ = json.Marshal(servers)
	data, _ := json.Marshal(root)
	os.WriteFile(filepath.Join(env.Home, ".pi/agent/mcp.json"), data, 0600)
	if err := microsoftUnregister(context.Background(), env, address); err != nil {
		t.Fatal(err)
	}
	_, servers = readPiMCP(t, env)
	if len(servers) != 6 || servers["ms2-files"] == nil || servers["mine"] == nil {
		t.Fatalf("%v", servers)
	}
}

// Repairing an account whose prefix is kept never overwrites a name, or a
// name Pi folds onto one, that another entry holds.
func TestMicrosoftRegisterKeepsForeignEntryUnderItsPrefix(t *testing.T) {
	address := "person@example.test"
	for _, foreignName := range []string{"ms-files", "ms_files"} {
		env := microsoftEnv(t)
		if err := microsoftRegister(context.Background(), env, *env.Config.Microsoft, address, "User.Read"); err != nil {
			t.Fatal(err)
		}
		root, servers := readPiMCP(t, env)
		foreign := json.RawMessage(`{"url":"https://mcp.example.test"}`)
		if foreignName == "ms-files" {
			servers["ms-files"] = foreign
		} else {
			delete(servers, "ms-files")
			servers["ms_files"] = foreign
		}
		root["mcpServers"], _ = json.Marshal(servers)
		data, _ := json.Marshal(root)
		os.WriteFile(filepath.Join(env.Home, ".pi/agent/mcp.json"), data, 0600)
		if err := microsoftRegister(context.Background(), env, *env.Config.Microsoft, address, "User.Read"); err == nil {
			t.Fatalf("%s: repair overwrote a foreign entry", foreignName)
		}
		if after, _ := os.ReadFile(filepath.Join(env.Home, ".pi/agent/mcp.json")); !bytes.Equal(after, data) {
			t.Fatalf("%s: refused repair still wrote", foreignName)
		}
	}
}
