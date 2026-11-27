//go:build linux

package integrations

import (
	"github.com/open-habitat/open-habitat/internal/msmcp"

	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"testing"
	"time"
)

// These remain outside the approved surface, particularly batch, which could
// bypass the individual tools' scope and confirmation checks.
var microsoftExcludedFileTools = []string{
	"delete-drive-item-permission", "create-drive-item-preview", "graph-batch",
}

// The level's files grant is the one the server may request: write levels
// name the ReadWrite.All permissions they consented to, read levels the
// Read.All ones, never the narrow Files.Read the upstream metadata names.
func TestMicrosoftMCPArgsPerLevel(t *testing.T) {
	enabled := regexp.MustCompile(microsoftMCPTools)
	for level, files := range map[Level]string{
		LevelFull:   "Files.ReadWrite.All Sites.ReadWrite.All",
		LevelNoSend: "Files.ReadWrite.All Sites.ReadWrite.All",
		LevelDrafts: "Files.Read.All Sites.Read.All",
		LevelRead:   "Files.Read.All Sites.Read.All",
	} {
		consented := strings.Fields(microsoftLevelScopes[level])
		allowed := microsoftAllowed(microsoftGranted(consented))
		if !strings.HasSuffix(allowed, " "+files) {
			t.Errorf("%s: allowed %q lacks %q", level, allowed, files)
		}
		for _, s := range strings.Fields(allowed) {
			if !slices.Contains(consented, s) {
				t.Errorf("%s: allowed names %s, which the level's application does not hold", level, s)
			}
		}
		args := microsoftMCPArgs(allowed)
		if !slices.Equal(args, []string{"--org-mode", "--enabled-tools", microsoftMCPTools, "--allowed-scopes", allowed}) {
			t.Errorf("%s: %q", level, args)
		}
	}
	for _, name := range slices.Concat(microsoftOutlookTools, microsoftFileTools, microsoftFileWriteTools) {
		if !enabled.MatchString(name) {
			t.Errorf("%s not enabled", name)
		}
	}
	for _, name := range microsoftExcludedFileTools {
		if enabled.MatchString(name) {
			t.Errorf("write tool %s enabled", name)
		}
	}
	// A grant without files leaves the file tools to --allowed-scopes to hide.
	if got := microsoftAllowed(microsoftGranted([]string{"User.Read", "Mail.Read"})); got != "User.Read Mail.Read" {
		t.Error(got)
	}
}

// writeMicrosoftRegistration writes the account's Pi registration as an
// earlier or the current release would have.
func writeMicrosoftRegistration(t *testing.T, env Env, address string, args []string) {
	t.Helper()
	writeMicrosoftRegistrationAt(t, env, address, testTenant, args)
}

func writeMicrosoftRegistrationAt(t *testing.T, env Env, address, tenant string, args []string) {
	t.Helper()
	server := map[string]any{"mcpServers": map[string]any{microsoftPlainServer(address): map[string]any{
		"command": "/x", "args": args,
		"env": map[string]string{"MS365_MCP_CLIENT_ID": "00000000-0000-0000-0000-000000000001", "MS365_MCP_TENANT_ID": tenant, "MS365_MCP_TOKEN_CACHE_PATH": microsoftTestCache(env, address)},
	}}}
	data, _ := json.Marshal(server)
	if err := os.MkdirAll(filepath.Join(env.Home, ".pi/agent"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(env.Home, ".pi/agent/mcp.json"), data, 0600); err != nil {
		t.Fatal(err)
	}
}

// The skill tells the agent to search and fetch only when the registration
// offers the file tools: a files grant and the current tool list.
func TestMicrosoftSearchSkill(t *testing.T) {
	const address = "person@example.test"
	outlook := "User.Read Mail.ReadWrite Mail.Send Calendars.ReadWrite Contacts.ReadWrite"
	for _, tc := range []struct {
		name   string
		args   []string
		search bool
		write  bool
	}{
		{"files", microsoftMCPArgs(outlook + " Files.Read.All Sites.Read.All"), true, false},
		{"sites only", microsoftMCPArgs(outlook + " Sites.Read.All"), true, false},
		{"write files", microsoftMCPArgs(outlook + " Files.ReadWrite.All"), true, true},
		{"write sites", microsoftMCPArgs(outlook + " Sites.ReadWrite.All"), true, true},
		{"outlook only", microsoftMCPArgs(outlook), false, false},
		{"earlier release", []string{"--preset", "mail,calendar,contacts", "--allowed-scopes", outlook + " Files.ReadWrite.All"}, false, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			env := microsoftEnv(t)
			writeMicrosoftRegistration(t, env, address, tc.args)
			body := (&microsoft{}).Skill(env, address).Body
			for _, want := range []string{
				"Outlook mail, calendars, contacts and Microsoft 365 files are reached",
				"`search-query` with the entity type `driveItem`",
				"every SharePoint site and team, followed or not, and files shared with the person",
				"`download-bytes-to-file` (path `/drives/{driveId}/items/{itemId}/content`) to `~/cloud/microsoft-fetched/person@example.test/`",
				"A recursive grep or find over `~/cloud/` as a whole is the thing to avoid",
			} {
				if strings.Contains(body, want) != tc.search {
					t.Errorf("search %v, but %q in body:\n%s", tc.search, want, body)
				}
			}
			// The instructions must not offer unavailable writes or tell a
			// writable account that it must upload manually in the browser.
			for _, tool := range microsoftFileWriteTools {
				if strings.Contains(body, "`"+tool+"`") != tc.write {
					t.Errorf("%s: wrong write guidance for %s", tc.name, tool)
				}
			}
			// No library is synced here: nothing is said of synced folders,
			// and an account with the file tools is told none are copied.
			if strings.Contains(body, "None of this account's files are copied to this machine") != tc.search || strings.Contains(body, "synced") || strings.Contains(body, "~/cloud/onedrive") {
				t.Error(body)
			}
			if !tc.search && !strings.Contains(body, "Outlook mail, calendars and contacts are reached") {
				t.Error(body)
			}
			rendered := string(renderSkill([]SkillAccount{(&microsoft{}).Skill(env, address)}))
			if strings.Contains(rendered, "%!") {
				t.Fatal(rendered)
			}
		})
	}
}

// A registration an earlier release wrote follows the current tool list with
// the tenant's current grant; an outage leaves it to the next check, and a
// refused grant keeps its Outlook scopes until the next sign-in.
func TestMicrosoftOutdatedRegistrationAligns(t *testing.T) {
	const address = testName
	outlook := "User.Read Mail.ReadWrite Mail.Send Calendars.ReadWrite Contacts.ReadWrite"
	for _, tc := range []struct {
		name, reply, allowed, tenant string
		err                          error
	}{
		{"granted", `{"state":"ok","scopes":["openid","User.Read","Mail.ReadWrite","Mail.Send","Calendars.ReadWrite","Contacts.ReadWrite","Files.ReadWrite.All","Sites.ReadWrite.All"]}`, outlook + " Files.ReadWrite.All Sites.ReadWrite.All", testTenant, nil},
		{"read files", `{"state":"ok","scopes":["User.Read","Mail.Read","Files.Read.All","Sites.Read.All"]}`, "User.Read Mail.Read Files.Read.All Sites.Read.All", testTenant, nil},
		{"refused", `{"state":"refused"}`, outlook, testTenant, nil},
		{"unreachable", `{"state":"unreachable"}`, "", testTenant, ServerUnreachable},
	} {
		t.Run(tc.name, func(t *testing.T) {
			env := microsoftEnv(t)
			m := &microsoft{}
			writeMicrosoftRegistrationAt(t, env, address, tc.tenant, []string{"--preset", "mail,calendar,contacts", "--allowed-scopes", outlook})
			cache := filepath.Join(env.Home, microsoftMCPDir, address)
			if err := os.MkdirAll(cache, 0700); err != nil {
				t.Fatal(err)
			}
			os.WriteFile(filepath.Join(cache, ".token-cache.json"), []byte("native"), 0600)
			os.WriteFile(filepath.Join(env.Home, "mcp-status-result"), []byte(tc.reply), 0600)
			if !m.Misaligned(env, address) {
				t.Fatal("earlier registration not seen")
			}
			before, _ := os.ReadFile(filepath.Join(env.Home, ".pi/agent/mcp.json"))
			if err := m.Align(context.Background(), env, address, func() { t.Error("sync stopped") }); !errors.Is(err, tc.err) {
				t.Fatal(err)
			}
			if tc.err != nil {
				if after, _ := os.ReadFile(filepath.Join(env.Home, ".pi/agent/mcp.json")); string(after) != string(before) || !m.Misaligned(env, address) {
					t.Fatalf("registered during an outage:\n%s", after)
				}
				return
			}
			if _, registered := registeredEntry(t, env, address); registered[microsoftAllowedEnv] != tc.allowed {
				t.Fatalf("registration: %v", registered)
			}
			if b, err := microsoftBinding(env, address); err != nil || !slices.Equal(b.Args, microsoftMCPArgs(tc.allowed)) {
				t.Fatalf("binding: %+v %v", b, err)
			}
			if m.Misaligned(env, address) {
				t.Fatal("still misaligned")
			}
		})
	}
	// A current single entry only changes form (TestMicrosoftSingleEntryMigrates);
	// current area entries are left alone.
	env := microsoftEnv(t)
	writeMicrosoftRegistration(t, env, address, microsoftMCPArgs(outlook+" Files.Read.All"))
	if n, err := microsoftReadNative(env, address); err != nil || n.mcpOutdated() || !n.mcpReshape {
		t.Fatalf("current single entry: %+v %v", n, err)
	}
	if err := microsoftRegister(context.Background(), env, *env.Config.Microsoft, address, outlook+" Files.Read.All", microsoftPin{username: microsoftAddressOf(address)}); err != nil {
		t.Fatal(err)
	}
	if (&microsoft{}).Misaligned(env, address) {
		t.Fatal("current registration misaligned")
	}
}

// The pinned server, with the build's scope patch, offers writes only for
// writable grants and reads at every file level; it requests only
// the permissions the level's application holds; and its Outlook tools are
// the same as the presets an earlier release enabled. Set
// OH_TEST_MICROSOFT_RUNTIME to a built integrations payload's runtime/.
func TestMicrosoftMCPToolsPinnedServer(t *testing.T) {
	runtime := os.Getenv("OH_TEST_MICROSOFT_RUNTIME")
	if runtime == "" {
		t.Skip("OH_TEST_MICROSOFT_RUNTIME not set")
	}
	node := filepath.Join(runtime, "bin/node")
	server := filepath.Join(runtime, "bin/ms-365-mcp-server")
	home := t.TempDir()
	env := []string{"HOME=" + home, "PATH=/usr/bin:/bin", "MS365_MCP_CLIENT_ID=00000000-0000-0000-0000-000000000001", "MS365_MCP_TENANT_ID=" + testTenant,
		"MS365_MCP_USE_KEYTAR=false", "MS365_MCP_TOKEN_CACHE_PATH=" + filepath.Join(home, ".token-cache.json"), "MS365_MCP_SELECTED_ACCOUNT_PATH=" + filepath.Join(home, ".selected-account.json")}

	fixture := exec.Command(node, "testdata/microsoft-file-writes.mjs", runtime, microsoftMCPTools)
	fixture.Env = env
	if out, err := fixture.CombinedOutput(); err != nil {
		t.Fatalf("pinned write adapters: %v\n%s", err, out)
	}

	presets := exec.Command(node, "--input-type=module", "-e", fmt.Sprintf("import {getCombinedPresetPattern} from %q; console.log(getCombinedPresetPattern(['mail','calendar','contacts']))",
		filepath.Join(runtime, "node_modules/@softeria/ms-365-mcp-server/dist/tool-categories.js")))
	presets.Env = env
	out, err := presets.Output()
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, group := range regexp.MustCompile(`\^\(\?:([^)]*)\)\$`).FindAllStringSubmatch(string(out), -1) {
		for _, n := range strings.Split(group[1], "|") {
			if !slices.Contains(names, n) {
				names = append(names, n)
			}
		}
	}
	if !slices.Equal(names, microsoftOutlookTools) {
		t.Fatalf("the pinned presets changed; review microsoftOutlookTools:\n%q", names)
	}

	tools := func(args []string, refused ...string) []string {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		cmd := exec.CommandContext(ctx, server, args...)
		cmd.Env = env
		stdin, _ := cmd.StdinPipe()
		stdout, _ := cmd.StdoutPipe()
		if err := cmd.Start(); err != nil {
			t.Fatal(err)
		}
		defer func() { stdin.Close(); _ = cmd.Wait() }()
		fmt.Fprintln(stdin, `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}`)
		fmt.Fprintln(stdin, `{"jsonrpc":"2.0","method":"notifications/initialized"}`)
		fmt.Fprintln(stdin, `{"jsonrpc":"2.0","id":2,"method":"tools/list"}`)
		lines := bufio.NewScanner(stdout)
		lines.Buffer(nil, 16<<20)
		for lines.Scan() {
			var reply struct {
				ID     int `json:"id"`
				Result struct {
					Tools []struct {
						Name string `json:"name"`
					} `json:"tools"`
				} `json:"result"`
			}
			if json.Unmarshal(lines.Bytes(), &reply) == nil && reply.ID == 2 {
				var out []string
				for _, tool := range reply.Result.Tools {
					out = append(out, tool.Name)
				}
				slices.Sort(out)
				for _, name := range refused {
					call, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": map[string]any{"name": name, "arguments": map[string]any{"driveId": "drive-A", "driveItemId": "item-B", "body": map[string]any{}}}})
					fmt.Fprintln(stdin, string(call))
					var denied struct {
						ID     int `json:"id"`
						Result struct {
							IsError bool `json:"isError"`
							Content []struct {
								Text string `json:"text"`
							} `json:"content"`
						} `json:"result"`
					}
					for lines.Scan() {
						if json.Unmarshal(lines.Bytes(), &denied) == nil && denied.ID == 3 {
							break
						}
					}
					if denied.ID != 3 || !denied.Result.IsError || len(denied.Result.Content) != 1 || !strings.Contains(denied.Result.Content[0].Text, "Tool "+name+" not found") {
						t.Fatalf("%s: unavailable tool did not refuse dispatch: %s", name, lines.Text())
					}
				}
				return out
			}
		}
		t.Fatal("no tools/list reply", args)
		return nil
	}
	// Either broad write grant suffices; neither a read-only nor an absent
	// files grant exposes any mutator, regardless of the application name.
	for _, scopes := range []string{"Files.ReadWrite.All", "Sites.ReadWrite.All", "Files.Read.All Sites.Read.All", "User.Read"} {
		want := strings.Contains(scopes, "ReadWrite")
		var refused []string
		if !want {
			refused = microsoftFileWriteTools
		}
		offered := tools(microsoftMCPArgs(scopes), refused...)
		for _, name := range microsoftFileWriteTools {
			if slices.Contains(offered, name) != want {
				t.Errorf("%s: unexpected availability of %s", scopes, name)
			}
		}
	}
	for _, level := range microsoftLevels {
		consented := strings.Fields(microsoftLevelScopes[level])
		allowed := microsoftAllowed(microsoftGranted(consented))
		offered := tools(microsoftMCPArgs(allowed))
		for _, name := range microsoftFileTools {
			if !slices.Contains(offered, name) {
				t.Errorf("%s: %s not offered", level, name)
			}
		}
		for _, name := range microsoftFileWriteTools {
			want := level == LevelFull || level == LevelNoSend
			if slices.Contains(offered, name) != want {
				t.Errorf("%s: write tool %s offered = %v, want %v", level, name, !want, want)
			}
		}
		for _, name := range microsoftExcludedFileTools {
			if slices.Contains(offered, name) {
				t.Errorf("%s: excluded tool %s offered", level, name)
			}
		}
		// Every tool the account's level offers sits in an area (ADR 0039);
		// only the sign-in tools are in none.
		for _, name := range offered {
			placed := slices.Contains(msmcp.SignIn, name)
			for _, area := range msmcp.Areas {
				placed = placed || slices.Contains(area.Tools, name)
			}
			if !placed {
				t.Errorf("%s: %s is in no Microsoft area", level, name)
			}
		}

		// The Outlook surface is what the earlier preset arguments gave, plus
		// two reads: organisation mode adds free/busy (get-schedule), and the
		// scope-free get-download-url fails without a files grant.
		outlook := microsoftAllowed(microsoftGranted(slices.DeleteFunc(slices.Clone(consented), func(s string) bool { return strings.HasPrefix(s, "Files.") || strings.HasPrefix(s, "Sites.") })))
		before := append(tools([]string{"--preset", "mail,calendar,contacts", "--allowed-scopes", outlook}), "get-download-url", "get-schedule")
		slices.Sort(before)
		if now := tools(microsoftMCPArgs(outlook)); !slices.Equal(before, now) {
			t.Errorf("%s: Outlook tools changed:\n%q\n%q", level, before, now)
		}

		cmd := exec.Command(server, append(microsoftMCPArgs(allowed), "--list-permissions")...)
		cmd.Env = env
		data, err := cmd.Output()
		if err != nil {
			t.Fatal(err)
		}
		var permissions struct {
			Effective []string `json:"effectivePermissions"`
		}
		if err := json.Unmarshal(data, &permissions); err != nil {
			t.Fatal(err, string(data))
		}
		for _, s := range permissions.Effective {
			if !slices.Contains(consented, s) {
				t.Errorf("%s: the server would request %s, which the level's application does not hold", level, s)
			}
		}
		if !slices.ContainsFunc(permissions.Effective, func(s string) bool { return strings.HasPrefix(s, "Files.") }) {
			t.Errorf("%s: no files permission requested: %q", level, permissions.Effective)
		}
	}
}
