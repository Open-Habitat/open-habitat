//go:build linux

package integrations

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"

	"golang.org/x/sys/unix"

	"github.com/open-habitat/open-habitat/internal/msmcp"
)

// An account's Microsoft tools are five entries in Pi's mcp.json, one per
// topic area (ADR 0039): ms-mail, ms-calendar, ms-contacts, ms-files and
// ms-admin for the first account, ms2-… for the second. Short names keep
// Pi from hashing the tool names, whose words are the search's strongest
// signal; the address goes in each entry's description. Every entry runs
// the product's relay, not a Microsoft server: the person's daemon owns
// the one Microsoft process and serves each entry only its area's tools.
//
// The entries carry the account's native configuration in their env, as
// the single entry of earlier releases did, and that is what makes them
// the account's: the token cache they name is the account's own
// (microsoftOwnsServer). The daemon reads its binding from there; the
// relay ignores it. A name is decided when the account is first
// registered and kept while its entries exist, so connecting or removing
// another account never renames this one.
const microsoftAreaPrefix = "ms"

// microsoftAllowedEnv carries the registration's --allowed-scopes, the
// tools its grant can run, to the daemon.
const microsoftAllowedEnv = "OH_MICROSOFT_ALLOWED_SCOPES"

// The pinned server's identity pins. A registration this release writes
// pins MSAL's immutable homeAccountId; one an earlier release wrote, or the
// name migration carried over, keeps the username it had until its next
// sign-in.
const (
	microsoftHomeEnv     = "MS365_MCP_EXPECTED_HOME_ACCOUNT_ID"
	microsoftUsernameEnv = "MS365_MCP_EXPECTED_USERNAME"
)

// microsoftPin is the one account a connection's native cache may serve:
// home, MSAL's homeAccountId, or for a connection signed in before
// immutable pins, username, the address it was signed in as. Exactly one
// is set.
type microsoftPin struct{ home, username string }

func (p microsoftPin) valid() bool {
	return (p.home != "") != (p.username != "") && len(p.home) <= 160 && !strings.ContainsAny(p.home, "\x00\r\n")
}

// env is the pin as the pinned server reads it.
func (p microsoftPin) env() map[string]string {
	if p.home != "" {
		return map[string]string{microsoftHomeEnv: p.home}
	}
	return map[string]string{microsoftUsernameEnv: p.username}
}

var microsoftAreaName = regexp.MustCompile(`^ms([0-9]*)-(mail|calendar|contacts|files|admin)$`)

// microsoftAreaEntryName is an account's entry for one area; index 1 is
// the plain prefix.
func microsoftAreaEntryName(index int, area string) string {
	if index <= 1 {
		return microsoftAreaPrefix + "-" + area
	}
	return microsoftAreaPrefix + strconv.Itoa(index) + "-" + area
}

// The single entry of releases before areas, and before that the
// hex-encoded one. Only the migration and removal still look for them.
const microsoftServerPrefix = "habitat-microsoft-"

func microsoftServerSlug(address string) string {
	var b strings.Builder
	dash := false
	for _, c := range address {
		switch {
		case c >= 'A' && c <= 'Z':
			c += 'a' - 'A'
			fallthrough
		case c >= 'a' && c <= 'z' || c >= '0' && c <= '9':
			if dash && b.Len() > 0 {
				b.WriteByte('-')
			}
			dash = false
			b.WriteRune(c)
		default:
			dash = true
		}
	}
	return b.String()
}

// microsoftOldServerNames are the names an earlier release may have given
// the account's single entry.
func microsoftOldServerNames(address string) []string {
	h := sha256.Sum256([]byte(address))
	plain := microsoftServerPrefix + microsoftServerSlug(address)
	return []string{plain, strings.TrimSuffix(plain, "-") + "-" + hex.EncodeToString(h[:3]), microsoftServerPrefix + hex.EncodeToString([]byte(address))}
}

// microsoftOwnsServer says whether a Pi entry is this account's: its token
// cache is the account's own native cache. A readable name is lossy, so an
// entry under it without that proof is someone else's and is never
// adopted, replaced or removed.
func microsoftOwnsServer(env Env, raw json.RawMessage, address string) bool {
	var entry struct {
		Env map[string]string `json:"env"`
	}
	if raw == nil || json.Unmarshal(raw, &entry) != nil {
		return false
	}
	return entry.Env["MS365_MCP_TOKEN_CACHE_PATH"] == filepath.Join(env.Home, microsoftMCPDir, address, ".token-cache.json")
}

// microsoftPiServers is Pi's global mcp.json: the whole document and its
// servers, both empty when there is none.
func microsoftPiServers(env Env) (map[string]json.RawMessage, map[string]json.RawMessage, error) {
	empty := func() (map[string]json.RawMessage, map[string]json.RawMessage, error) {
		return map[string]json.RawMessage{}, map[string]json.RawMessage{}, nil
	}
	fd, err := openHomeDir(env.Home, false, ".pi", "agent")
	if errors.Is(err, os.ErrNotExist) {
		return empty()
	}
	if err != nil {
		return nil, nil, err
	}
	defer unix.Close(fd)
	data, err := readFileAt(fd, "mcp.json", 1<<20)
	if errors.Is(err, os.ErrNotExist) {
		return empty()
	}
	if err != nil {
		return nil, nil, err
	}
	var root map[string]json.RawMessage
	if json.Unmarshal(data, &root) != nil || root == nil {
		return nil, nil, ToolFailed
	}
	servers := map[string]json.RawMessage{}
	if raw, ok := root["mcpServers"]; ok && (json.Unmarshal(raw, &servers) != nil || servers == nil) {
		return nil, nil, ToolFailed
	}
	return root, servers, nil
}

// microsoftServer is where the account's registration stands.
type microsoftServer struct {
	// index is the account's area prefix number: the one its entries have,
	// or for a new registration the first whose five names are all free.
	// Zero when none is free.
	index int
	// areas are the account's area entries by area name.
	areas map[string]string
	// old are entries of the single-entry form, under any earlier name.
	old []string
}

// configured says whether any entry of the account exists.
func (s microsoftServer) configured() bool { return len(s.areas) > 0 || len(s.old) > 0 }

// filesOnly says whether the registration is the files area alone: the
// record of a sign-in whose mailbox probe found no mailbox in the
// organisation (microsoftProbeMailbox), as a B2B guest usually has none.
func (s microsoftServer) filesOnly() bool {
	return len(s.old) == 0 && len(s.areas) == 1 && s.areas["files"] != ""
}

// microsoftRegisteredAreas are the areas a registration writes: all five,
// or the files area alone for a connection without a mailbox.
func microsoftRegisteredAreas(filesOnly bool) []string {
	if filesOnly {
		return []string{"files"}
	}
	return msmcp.AreaNames()
}

// names are every entry of the account.
func (s microsoftServer) names() []string {
	out := slices.Clone(s.old)
	for _, n := range s.areas {
		out = append(out, n)
	}
	slices.Sort(out)
	return out
}

// folded is a name as Pi compares it: `-` and `_` share a namespace.
func folded(name string) string { return strings.ReplaceAll(name, "-", "_") }

func microsoftServerOf(env Env, address string) (microsoftServer, map[string]json.RawMessage, error) {
	_, servers, err := microsoftPiServers(env)
	if err != nil {
		return microsoftServer{}, nil, err
	}
	return microsoftServerIn(env, servers, address), servers, nil
}

func microsoftServerIn(env Env, servers map[string]json.RawMessage, address string) microsoftServer {
	s := microsoftServer{areas: map[string]string{}}
	indexes := map[int]bool{}
	for name, raw := range servers {
		if !microsoftOwnsServer(env, raw, address) {
			continue
		}
		if m := microsoftAreaName.FindStringSubmatch(name); m != nil {
			i := 1
			if m[1] != "" {
				i, _ = strconv.Atoi(m[1])
			}
			if i >= 1 && microsoftAreaEntryName(i, m[2]) == name {
				indexes[i] = true
				s.areas[m[2]] = name
				continue
			}
		}
		s.old = append(s.old, name)
	}
	slices.Sort(s.old)
	// An account keeps the prefix its entries have. Entries under two
	// prefixes (a hand edit) settle on the lowest, and the next
	// registration drops the others.
	for i := 1; i < 100; i++ {
		if indexes[i] {
			s.index = i
			break
		}
	}
	if s.index > 0 {
		for area, name := range s.areas {
			if name != microsoftAreaEntryName(s.index, area) {
				delete(s.areas, area)
				s.old = append(s.old, name)
			}
		}
		slices.Sort(s.old)
		return s
	}
	taken := map[string]bool{}
	for name := range servers {
		taken[folded(name)] = true
	}
	for i := 1; i < 100; i++ {
		free := true
		for _, area := range msmcp.AreaNames() {
			free = free && !taken[folded(microsoftAreaEntryName(i, area))]
		}
		if free {
			s.index = i
			break
		}
	}
	return s
}

// microsoftAreaDescriptions are what Pi shows the agent beside each area's
// namespace: the account and what the area is for, so the agent picks one
// before it searches.
var microsoftAreaDescriptions = map[string]string{
	"mail":     "Outlook mail of %s: find, read and file messages and attachments, write drafts and replies, send.",
	"calendar": "Outlook calendar of %s: events, free/busy, invitations and replies.",
	"contacts": "Outlook contacts of %s: find, add and update people.",
	"files":    "OneDrive and SharePoint files of %s: search, browse and download; with a write grant, upload files, create folders, move, rename and copy. Deleting and sharing ask permission in Habitat's browser conversations.",
	"admin":    "Arranging the Outlook mailbox of %s: create, rename or delete mail folders, calendars and contact folders; calendar sharing; Focused Inbox. Only when the person asks to arrange the mailbox.",
}

// microsoftDescribed is how an entry's description names the connection:
// its address, and the organisation's name when the allowed list has one,
// so an agent choosing between ms-files and ms2-files of the same address
// reads which organisation each is. A relabel rewrites the entries at the
// next check (Align); an organisation without a label keeps the address.
func microsoftDescribed(env Env, key string) string {
	if org := microsoftOrganisationLabel(env, key); org != "" {
		return microsoftAddressOf(key) + " (" + org + ")"
	}
	return microsoftAddressOf(key)
}

// microsoftOrganisationLabel is the allowed list's name for the
// connection's organisation, "" when it has none.
func microsoftOrganisationLabel(env Env, key string) string {
	if tenant := microsoftTenantOf(key); tenant != "" {
		return env.microsoftTable().label(tenant)
	}
	return ""
}

// microsoftAreaEntry is one area's entry as this release writes it.
func microsoftAreaEntry(env Env, relay string, app MicrosoftApp, key, allowed string, pin microsoftPin, area string) map[string]any {
	rel := microsoftMCPDir + "/" + key
	hidden := map[string]string{}
	for _, t := range msmcp.SignIn {
		hidden[t] = "hidden"
	}
	vars := map[string]string{
		"MS365_MCP_CLIENT_ID": app.ClientID, "MS365_MCP_TENANT_ID": app.TenantID,
		"MS365_MCP_USE_KEYTAR": "false", "MS365_MCP_TOKEN_CACHE_PATH": filepath.Join(env.Home, rel, ".token-cache.json"),
		"MS365_MCP_SELECTED_ACCOUNT_PATH": filepath.Join(env.Home, rel, ".selected-account.json"),
		microsoftAllowedEnv:               allowed,
	}
	for k, v := range pin.env() {
		vars[k] = v
	}
	return map[string]any{
		"command":      relay,
		"args":         []string{"mcp-relay", "microsoft", "--account", key, "--area", area},
		"env":          vars,
		"description":  fmt.Sprintf(microsoftAreaDescriptions[area], microsoftDescribed(env, key)),
		"toolExposure": hidden,
	}
}

// microsoftAreasCurrent says whether the account has its area entries (all
// five, or the files area alone when filesOnly) exactly as this release
// writes them, and nothing of an earlier form.
func microsoftAreasCurrent(env Env, servers map[string]json.RawMessage, s microsoftServer, app MicrosoftApp, key, allowed string, pin microsoftPin, filesOnly bool) bool {
	if len(s.old) > 0 || len(s.areas) != len(microsoftRegisteredAreas(filesOnly)) || env.Relay == "" {
		return false
	}
	for _, area := range microsoftRegisteredAreas(filesOnly) {
		if s.areas[area] == "" {
			return false
		}
	}
	for area, name := range s.areas {
		want, _ := json.Marshal(microsoftAreaEntry(env, env.Relay, app, key, allowed, pin, area))
		if !sameEntry(servers[name], want) {
			return false
		}
	}
	return true
}

func sameEntry(a, b []byte) bool {
	var x, y any
	if json.Unmarshal(a, &x) != nil || json.Unmarshal(b, &y) != nil {
		return false
	}
	ja, _ := json.Marshal(x)
	jb, _ := json.Marshal(y)
	return string(ja) == string(jb)
}

// piMCPWriteHook lets a test fail a write of mcp.json before it happens
// or report one that happened as failed (an uncertain write); nil in the
// product. kind is "register" or "unregister".
var piMCPWriteHook func(env Env, kind string, written bool) error

// writePiServers rewrites mcp.json at once with servers, keeping every
// other key of the document. The caller holds piMCPNative.
func writePiServers(ctx context.Context, env Env, kind string, root, servers map[string]json.RawMessage) error {
	root["mcpServers"], _ = json.Marshal(servers)
	data, _ := json.MarshalIndent(root, "", "  ")
	if ctx.Err() != nil {
		return ctx.Err()
	}
	if piMCPWriteHook != nil {
		if err := piMCPWriteHook(env, kind, false); err != nil {
			return err
		}
	}
	fd, err := openHomeDir(env.Home, true, ".pi", "agent")
	if err != nil {
		return err
	}
	defer unix.Close(fd)
	if err := writeFileAt(fd, "mcp.json", append(data, '\n'), 0600); err != nil {
		return err
	}
	if piMCPWriteHook != nil {
		return piMCPWriteHook(env, kind, true)
	}
	return nil
}

// microsoftRegister writes, or replaces, the account's area entries with the
// current application's environment and pin, and removes any entry of an
// earlier form, in one atomic rewrite of mcp.json. filesOnly writes the
// files area alone, for a connection without a mailbox: an agent offered
// mail tools that can only fail is worse off than one offered none. The
// prefix stays the one chosen for five, so the connection gains its other
// areas under the same names once a sign-in finds a mailbox.
func microsoftRegister(ctx context.Context, env Env, app MicrosoftApp, address, allowed string, pin microsoftPin, filesOnly bool) error {
	if env.Relay == "" || !filepath.IsAbs(env.Relay) || !validMicrosoftAccount(address) || !pin.valid() {
		return ToolFailed
	}
	if _, ok := env.Tool("ms-365-mcp-server"); !ok {
		return ToolFailed
	}
	// Pi's mcp.json is one file: Atlassian and Trello rewrite it whole from
	// what they read, so no change may run beside theirs, and the name is
	// chosen from the file as it is now.
	piMCPNative.Lock()
	defer piMCPNative.Unlock()
	root, servers, err := microsoftPiServers(env)
	if err != nil {
		return err
	}
	s := microsoftServerIn(env, servers, address)
	if s.index == 0 {
		return ToolFailed
	}
	// A kept prefix is checked again: any of the names written, or a name
	// Pi folds onto one of them, that is not the account's own is never
	// overwritten.
	for _, area := range microsoftRegisteredAreas(filesOnly) {
		want := microsoftAreaEntryName(s.index, area)
		for name, raw := range servers {
			if folded(name) == folded(want) && !microsoftOwnsServer(env, raw, address) {
				return ToolFailed
			}
		}
	}
	for _, name := range s.names() {
		delete(servers, name)
	}
	for _, area := range microsoftRegisteredAreas(filesOnly) {
		servers[microsoftAreaEntryName(s.index, area)], _ = json.Marshal(microsoftAreaEntry(env, env.Relay, app, address, allowed, pin, area))
	}
	return writePiServers(ctx, env, "register", root, servers)
}

// microsoftUnregister removes every entry of the account, in any form, in
// one rewrite. Entries that are not the account's stay untouched.
func microsoftUnregister(ctx context.Context, env Env, address string) error {
	piMCPNative.Lock()
	defer piMCPNative.Unlock()
	root, servers, err := microsoftPiServers(env)
	if err != nil {
		return err
	}
	s := microsoftServerIn(env, servers, address)
	if !s.configured() {
		return nil
	}
	for _, name := range s.names() {
		delete(servers, name)
	}
	return writePiServers(ctx, env, "unregister", root, servers)
}

// microsoftBinding is the daemon's binding for an account: the native
// server's command built from the account's own entries, never from what
// a relay sends. All five entries must agree, so a hand-edited entry
// cannot make one area run under another configuration, and they must name
// the connection's own tenant, pin and an application the operator has at
// that tenant now: a removed tenant's tools stop at the next call.
func microsoftBinding(env Env, account string) (msmcp.Binding, error) {
	if !validMicrosoftAccount(account) {
		return msmcp.Binding{}, AccountMismatch
	}
	_, servers, err := microsoftPiServers(env)
	if err != nil {
		return msmcp.Binding{}, err
	}
	s := microsoftServerIn(env, servers, account)
	if len(s.areas) == 0 && ValidAddress(account) {
		// A conversation started before its connection got its name runs
		// a relay naming the bare address. It reaches the one connection
		// of that address, and nothing when there are several.
		if named := microsoftNamedOf(env, servers, account); len(named) == 1 {
			account = named[0]
			s = microsoftServerIn(env, servers, account)
		}
	}
	if len(s.areas) == 0 {
		return msmcp.Binding{}, AccountMismatch
	}
	var first map[string]string
	for _, name := range s.areas {
		var e struct {
			Env map[string]string `json:"env"`
		}
		if json.Unmarshal(servers[name], &e) != nil {
			return msmcp.Binding{}, ToolFailed
		}
		if first == nil {
			first = e.Env
		} else if !sameEnv(first, e.Env) {
			return msmcp.Binding{}, ToolFailed
		}
	}
	rel := microsoftMCPDir + "/" + account
	pin := microsoftPin{home: first[microsoftHomeEnv], username: first[microsoftUsernameEnv]}
	if !pin.valid() || (pin.username != "" && pin.username != microsoftAddressOf(account)) || first["MS365_MCP_TOKEN_CACHE_PATH"] != filepath.Join(env.Home, rel, ".token-cache.json") || first["MS365_MCP_SELECTED_ACCOUNT_PATH"] != filepath.Join(env.Home, rel, ".selected-account.json") {
		return msmcp.Binding{}, AccountMismatch
	}
	app := MicrosoftApp{ClientID: first["MS365_MCP_CLIENT_ID"], TenantID: first["MS365_MCP_TENANT_ID"]}
	allowed := first[microsoftAllowedEnv]
	if !microsoftAllowedValid(allowed) || app.ClientID == "" || app.TenantID == "" {
		return msmcp.Binding{}, ToolFailed
	}
	if tenant := microsoftTenantOf(account); tenant != "" && !strings.EqualFold(tenant, app.TenantID) {
		return msmcp.Binding{}, AccountMismatch
	}
	if _, _, reason, ok := microsoftAccountApp(env, account, microsoftNative{mcpClient: app.ClientID, mcpTenant: app.TenantID}); !ok || reason != "" {
		return msmcp.Binding{}, AccountMismatch
	}
	cmd, ok := microsoftMCPCommand(env, app, rel, allowed, pin)
	if !ok {
		return msmcp.Binding{}, ToolFailed
	}
	full := append(append([]string{"HOME=" + env.Home, "PATH=/usr/bin:/bin", "LANG=C.UTF-8"}, cmd.Env...), extraToolEnv...)
	key, _ := json.Marshal([]any{account, cmd.Path, cmd.Args, cmd.Env})
	return msmcp.Binding{Account: account, Key: string(key), Path: cmd.Path, Args: cmd.Args, Env: full, Dir: env.Home}, nil
}

// microsoftNamedOf are the named connections with entries whose address is
// address.
func microsoftNamedOf(env Env, servers map[string]json.RawMessage, address string) []string {
	prefix := filepath.Join(env.Home, microsoftMCPDir) + "/"
	seen := map[string]bool{}
	var out []string
	for _, raw := range servers {
		var e struct {
			Env map[string]string `json:"env"`
		}
		if json.Unmarshal(raw, &e) != nil {
			continue
		}
		rest, ok := strings.CutPrefix(e.Env["MS365_MCP_TOKEN_CACHE_PATH"], prefix)
		key, file, _ := strings.Cut(rest, "/")
		if !ok || file != ".token-cache.json" || !validMicrosoftName(key) || microsoftAddressOf(key) != address || seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, key)
	}
	slices.Sort(out)
	return out
}

// microsoftRenameEntries points every entry of the bare address's
// registration at the connection's name in one rewrite of mcp.json: the
// cache paths and an area entry's --account change, nothing else does, so
// the entries keep their names, application, grant and pin.
func microsoftRenameEntries(ctx context.Context, env Env, address, name string) error {
	piMCPNative.Lock()
	defer piMCPNative.Unlock()
	root, servers, err := microsoftPiServers(env)
	if err != nil {
		return err
	}
	s := microsoftServerIn(env, servers, address)
	if !s.configured() {
		return nil
	}
	from, to := filepath.Join(env.Home, microsoftMCPDir, address), filepath.Join(env.Home, microsoftMCPDir, name)
	for _, entry := range s.names() {
		var e map[string]json.RawMessage
		if json.Unmarshal(servers[entry], &e) != nil {
			return ToolFailed
		}
		var vars map[string]string
		if json.Unmarshal(e["env"], &vars) != nil {
			return ToolFailed
		}
		for _, k := range []string{"MS365_MCP_TOKEN_CACHE_PATH", "MS365_MCP_SELECTED_ACCOUNT_PATH"} {
			if rest, ok := strings.CutPrefix(vars[k], from+"/"); ok {
				vars[k] = to + "/" + rest
			}
		}
		e["env"], _ = json.Marshal(vars)
		var args []string
		if raw, ok := e["args"]; ok && json.Unmarshal(raw, &args) == nil {
			for i := range args {
				if i > 0 && args[i-1] == "--account" && args[i] == address {
					args[i] = name
				}
			}
			e["args"], _ = json.Marshal(args)
		}
		servers[entry], _ = json.Marshal(e)
	}
	return writePiServers(ctx, env, "register", root, servers)
}

func sameEnv(a, b map[string]string) bool {
	if len(a) != len(b) {
		return false
	}
	for k, v := range a {
		if w, ok := b[k]; !ok || w != v {
			return false
		}
	}
	return true
}

// microsoftAllowedValid admits only the scopes microsoftAllowed writes.
func microsoftAllowedValid(allowed string) bool {
	known := map[string]bool{"User.Read": true}
	for _, s := range []string{"Mail.ReadWrite", "Mail.Read", "Mail.Send", "Calendars.ReadWrite", "Calendars.Read", "Contacts.ReadWrite", "Contacts.Read", "Files.ReadWrite.All", "Files.Read.All", "Sites.ReadWrite.All", "Sites.Read.All"} {
		known[s] = true
	}
	fields := strings.Fields(allowed)
	if len(fields) == 0 {
		return false
	}
	for _, f := range fields {
		if !known[f] {
			return false
		}
	}
	return true
}
