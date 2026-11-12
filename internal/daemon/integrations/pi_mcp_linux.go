//go:build linux

package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/sys/unix"
)

// piMCPGrantSkill tells an agent what the chosen level is worth: the scopes
// a level requests are merged with whatever the server challenges for, so the
// connection can hold more than the person chose.
const piMCPGrantSkill = "The level the person chose is what the sign-in asked for, not a ceiling: Pi also accepts further scopes the server asks for, so the tools may be able to change more than the person meant. Go by what they asked you to do, not by what the tools allow, and when a tool answers with a request for a new sign-in or wider consent, pass that decision to the person instead of starting it."

// piMCP is a provider reached through Pi's own remote MCP OAuth. A connection
// is a named entry in Pi's mcp.json and its grant is Pi's mcp-auth.json state
// under that name; Habitat keeps no connection ledger or token of its own.
type piMCP struct {
	provider Provider
	// base is the first connection's native server name. A provider with
	// max > 1 names further connections base_2 … base_max, so each has its
	// own native credential identity (mcp__<name>|<url>).
	base string
	max  int
	url  string
	// read and write are the scopes each level requests. Pi merges them with
	// whatever the server challenges for, so they are never a ceiling.
	read, write string
	// known are the scopes whose meaning access understands. A grant holding
	// anything else earns neither a read-only nor a full-access label.
	known    string
	services []string
	access   func(service string, granted map[string]bool) Access
}

// piMCPNative serializes every change this daemon makes to Pi's one
// mcp.json, across Atlassian and Trello: a start rewrites the whole file, so
// an unserialized start beside another's start or removal would drop or
// resurrect that entry.
var piMCPNative sync.Mutex

func piMCPOf(p Provider) *piMCP {
	switch p {
	case Atlassian:
		return &atlassianMCP
	case Trello:
		return &trelloMCP
	}
	return nil
}

func validCatalogAddress(provider Provider, address string) bool {
	if m := piMCPOf(provider); m != nil {
		return m.owns(address)
	}
	return ValidAddress(address)
}

func (m *piMCP) owns(name string) bool {
	if name == m.base {
		return true
	}
	n, ok := strings.CutPrefix(name, m.base+"_")
	if !ok || m.max <= 1 {
		return false
	}
	i, err := strconv.Atoi(n)
	return err == nil && i >= 2 && i <= m.max && strconv.Itoa(i) == n
}

// config reads Pi's configuration. Ordinary native settings remain native;
// an entry under one of our names with another endpoint, or a name Pi would
// fold onto ours, is never adopted.
func (m *piMCP) config(env Env) (map[string]json.RawMessage, map[string]json.RawMessage, error) {
	fd, err := openHomeDir(env.Home, false, ".pi", "agent")
	if errors.Is(err, os.ErrNotExist) {
		return map[string]json.RawMessage{}, map[string]json.RawMessage{}, nil
	}
	if err != nil {
		return nil, nil, err
	}
	defer unix.Close(fd)
	data, err := readFileAt(fd, "mcp.json", 1<<20)
	if errors.Is(err, os.ErrNotExist) {
		return map[string]json.RawMessage{}, map[string]json.RawMessage{}, nil
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
	for name, raw := range servers {
		if folded := strings.ReplaceAll(name, "-", "_"); folded != name && m.owns(folded) {
			return nil, nil, ToolFailed
		}
		if !m.owns(name) {
			continue
		}
		var entry struct {
			URL string `json:"url"`
		}
		if json.Unmarshal(raw, &entry) != nil || entry.URL != m.url {
			return nil, nil, ToolFailed
		}
	}
	return root, servers, nil
}

func (m *piMCP) accounts(env Env) ([]string, error) {
	_, servers, err := m.config(env)
	if err != nil {
		return nil, err
	}
	var out []string
	for name := range servers {
		if m.owns(name) {
			out = append(out, name)
		}
	}
	sort.Strings(out)
	return out, nil
}

// free is the name a new connection gets: the first of ours with no
// native entry. A single-connection provider is already connected.
func (m *piMCP) free(servers map[string]json.RawMessage) (string, error) {
	if servers[m.base] == nil {
		return m.base, nil
	}
	if m.max <= 1 {
		return "", AlreadyConnected
	}
	for i := 2; i <= m.max; i++ {
		if name := m.base + "_" + strconv.Itoa(i); servers[name] == nil {
			return name, nil
		}
	}
	return "", ToolFailed
}

func (m *piMCP) startLogin(ctx context.Context, env Env, address string, level Level) (Login, error) {
	if address != "" && !m.owns(address) {
		return nil, AccountMismatch
	}
	server, created, named, err := m.configure(ctx, env, address, level)
	if err != nil {
		return nil, err
	}
	cleanup := func() {
		if created {
			m.cleanup(env, server)
		}
	}
	// Changing requested scopes does not stop Pi from silently refreshing
	// the old grant. Explicit choices must start fresh native authorization.
	fresh := level != "" || created
	if fresh && named {
		pi, ok := env.Tool("pi")
		if !ok {
			cleanup()
			return nil, ToolFailed
		}
		piMCPNative.Lock()
		_, err := env.run(ctx, Command{Path: pi, Args: []string{"mcp", "logout", server}}, nil)
		piMCPNative.Unlock()
		if err != nil {
			cleanup()
			return nil, ToolFailed
		}
	}
	native, err := startPiOAuth(ctx, env, server, fresh)
	if err != nil {
		cleanup()
		return nil, err
	}
	return &piMCPLogin{piOAuthLogin: native, m: m, env: env, created: created}, nil
}

// configure writes the connection's native entry with the level's scopes,
// choosing a free name for a new one. It reports the name, whether the entry
// is new, and whether Pi already holds a credential under it.
func (m *piMCP) configure(ctx context.Context, env Env, address string, level Level) (string, bool, bool, error) {
	piMCPNative.Lock()
	defer piMCPNative.Unlock()
	root, servers, err := m.config(env)
	if err != nil {
		return "", false, false, ToolFailed
	}
	server := address
	if server == "" {
		if server, err = m.free(servers); err != nil {
			return "", false, false, err
		}
	}
	named, legacy, err := m.credentialKeys(env, server)
	if err != nil || legacy {
		return "", false, false, ToolFailed
	}
	scope := m.read
	if level == LevelFull {
		scope = m.write
	} else if level != LevelRead && level != "" {
		return "", false, false, ToolFailed
	}
	if level == "" && servers[server] != nil {
		var e struct {
			OAuth struct {
				Scope string `json:"scope"`
			} `json:"oauth"`
		}
		_ = json.Unmarshal(servers[server], &e)
		scope = e.OAuth.Scope
	}
	entry := map[string]json.RawMessage{}
	oauth := map[string]json.RawMessage{}
	if raw := servers[server]; raw != nil {
		if json.Unmarshal(raw, &entry) != nil {
			return "", false, false, ToolFailed
		}
		if !piMCPOAuthEntry(entry) {
			return "", false, false, ToolFailed
		}
		if raw := entry["oauth"]; raw != nil && json.Unmarshal(raw, &oauth) != nil {
			return "", false, false, ToolFailed
		}
	}
	if oauth == nil {
		oauth = map[string]json.RawMessage{}
	}
	oauth["scope"], _ = json.Marshal(scope)
	entry["url"], _ = json.Marshal(m.url)
	entry["oauth"], _ = json.Marshal(oauth)
	created := servers[server] == nil
	servers[server], _ = json.Marshal(entry)
	root["mcpServers"], _ = json.Marshal(servers)
	data, _ := json.MarshalIndent(root, "", "  ")
	// A start cancelled while waiting here writes nothing.
	if ctx.Err() != nil {
		return "", false, false, ctx.Err()
	}
	fd, err := openHomeDir(env.Home, true, ".pi", "agent")
	if err != nil {
		return "", false, false, ToolFailed
	}
	err = writeFileAt(fd, "mcp.json", append(data, '\n'), 0600)
	unix.Close(fd)
	if err != nil {
		return "", false, false, ToolFailed
	}
	return server, created, named, nil
}

// Alternative authentication cannot be represented by Pi's OAuth store.
// Preserve it and refuse OAuth takeover, rather than erasing native settings.
func piMCPOAuthEntry(entry map[string]json.RawMessage) bool {
	for _, key := range []string{"auth", "headers", "command"} {
		if _, ok := entry[key]; ok {
			return false
		}
	}
	if raw, ok := entry["enabled"]; ok && string(raw) != "true" {
		return false
	}
	return true
}

type piMCPLogin struct {
	*piOAuthLogin
	m        *piMCP
	env      Env
	created  bool
	accepted atomic.Bool
	once     sync.Once
}

// Native is the connection's server name, known before consent: a removal
// of another connection must not fence this sign-in.
func (l *piMCPLogin) Native() string { return l.server }

func (l *piMCPLogin) Wait(ctx context.Context) (string, error) {
	address, err := l.piOAuthLogin.Wait(ctx)
	if err != nil {
		return "", err
	}
	l.accepted.Store(true)
	return address, nil
}
func (l *piMCPLogin) Cancel() {
	l.once.Do(func() {
		l.piOAuthLogin.Cancel()
		if l.created && !l.accepted.Load() {
			l.m.cleanup(l.env, l.server)
		}
	})
}
func (m *piMCP) cleanup(env Env, server string) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = m.remove(ctx, env, server)
}

func (m *piMCP) remove(ctx context.Context, env Env, address string) error {
	if !m.owns(address) {
		return AccountMismatch
	}
	piMCPNative.Lock()
	defer piMCPNative.Unlock()
	if _, _, err := m.config(env); err != nil {
		return ToolFailed
	}
	pi, ok := env.Tool("pi")
	if !ok {
		return ToolFailed
	}
	named, _, err := m.credentialKeys(env, address)
	if err != nil {
		return ToolFailed
	}
	// Logout is Pi's own credential deletion, not a token copy or revocation
	// broker. Do not let it fall back to an ambiguous legacy URL-only key.
	if named {
		if _, err := env.run(ctx, Command{Path: pi, Args: []string{"mcp", "logout", address}}, nil); err != nil {
			return ToolFailed
		}
	}
	if _, err := env.run(ctx, Command{Path: pi, Args: []string{"mcp", "remove", address}}, nil); err != nil {
		return ToolFailed
	}
	return nil
}

// credentialKeys says whether Pi holds state under this connection's exact
// name + URL key, and whether an older URL-only key for the endpoint exists.
func (m *piMCP) credentialKeys(env Env, server string) (bool, bool, error) {
	states, err := m.states(env)
	if err != nil || states == nil {
		return false, false, err
	}
	_, named := states["mcp__"+server+"|"+m.url]
	_, legacy := states[m.url]
	return named, legacy, nil
}

// states is Pi's mcp-auth.json, nil when there is none.
func (m *piMCP) states(env Env) (map[string]json.RawMessage, error) {
	fd, err := openHomeDir(env.Home, false, ".pi", "agent")
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	defer unix.Close(fd)
	data, err := readFileAt(fd, "mcp-auth.json", 1<<20)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var states map[string]json.RawMessage
	if json.Unmarshal(data, &states) != nil || states == nil {
		return nil, ToolFailed
	}
	return states, nil
}

func (m *piMCP) checkGrant(env Env, address string) ([]Service, *Grant) {
	services := make([]Service, len(m.services))
	for i, id := range m.services {
		services[i] = Service{ID: id, State: StateUnknown}
	}
	expired := func() ([]Service, *Grant) {
		for i := range services {
			services[i].State = StateLoginExpired
		}
		return services, nil
	}
	if !m.owns(address) {
		return services, nil
	}
	_, servers, err := m.config(env)
	if err != nil {
		return services, nil
	}
	var entry map[string]json.RawMessage
	if json.Unmarshal(servers[address], &entry) != nil || !piMCPOAuthEntry(entry) {
		return services, nil
	}
	var configured struct {
		OAuth struct {
			Scope string `json:"scope"`
		} `json:"oauth"`
	}
	if json.Unmarshal(servers[address], &configured) != nil {
		return services, nil
	}
	states, err := m.states(env)
	if err != nil {
		return services, nil
	}
	// Decode only the exact name + URL key. Another native connection,
	// including the legacy URL-only key, is not proof of this one's grant.
	raw, ok := states["mcp__"+address+"|"+m.url]
	if !ok {
		return expired()
	}
	var s struct {
		Tokens struct {
			Access  string `json:"access_token"`
			Scope   string `json:"scope"`
			Refresh string `json:"refresh_token"`
		} `json:"tokens"`
		Expires int64 `json:"tokensExpireAt"`
	}
	if json.Unmarshal(raw, &s) != nil {
		return services, nil
	}
	if s.Tokens.Access == "" {
		return expired()
	}
	// A status read never starts Pi or refreshes a credential. An expired
	// access token with a refresh token has an unverified, not rejected, grant.
	state := StateOK
	if s.Expires > 0 && s.Expires <= time.Now().UnixMilli() {
		state = StateUnknown
		if s.Tokens.Refresh == "" {
			state = StateLoginExpired
		}
	}
	granted := scopeSet(strings.Fields(s.Tokens.Scope), func(s string) string { return s })
	if len(granted) == 0 {
		return services, nil
	}
	known := scopeSet(strings.Fields(m.known), func(s string) string { return s })
	understood := true
	for _, scope := range strings.Fields(s.Tokens.Scope) {
		if !known[scope] {
			understood = false
		}
	}
	for i := range services {
		services[i].State = state
		// Unknown permissions earn neither a read-only nor a full-access claim.
		if !understood {
			continue
		}
		services[i].Access = m.access(services[i].ID, granted)
		if services[i].Access == AccessNone {
			services[i].State = StateUnknown
		}
	}
	return services, grantOf(granted, strings.Fields(configured.OAuth.Scope), nil)
}

func (m *piMCP) level(services []Service) Level {
	if len(services) != len(m.services) || len(services) == 0 {
		return ""
	}
	for _, want := range []struct {
		access Access
		level  Level
	}{{AccessRead, LevelRead}, {AccessFull, LevelFull}} {
		all := true
		for _, s := range services {
			all = all && s.Access == want.access
		}
		if all {
			return want.level
		}
	}
	return ""
}
