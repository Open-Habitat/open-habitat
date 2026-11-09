//go:build linux

package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/sys/unix"
)

const Atlassian Provider = "atlassian"
const atlassianServer = "open_habitat_atlassian"
const atlassianURL = "https://mcp.atlassian.com/v2/mcp"
const atlassianReadScopes = "read:me read:account offline_access read:jira:agent-interface search:jira:agent-interface read:confluence:agent-interface search:confluence:agent-interface"
const atlassianWriteScopes = atlassianReadScopes + " write:jira:agent-interface write:confluence:agent-interface"

func validCatalogAddress(provider Provider, address string) bool {
	if provider == Atlassian {
		return address == atlassianServer
	}
	return ValidAddress(address)
}

type atlassian struct{}

func (*atlassian) Provider() Provider       { return Atlassian }
func (*atlassian) Login() LoginKind         { return PastedRedirect }
func (*atlassian) Services() []string       { return []string{"jira", "confluence"} }
func (*atlassian) Tools() []string          { return []string{"pi"} }
func (a *atlassian) Available(env Env) bool { return MissingTools(a, env) == nil }
func (*atlassian) Levels(Env) []LevelOption {
	return []LevelOption{{ID: LevelRead, Available: true}, {ID: LevelFull, Available: true}}
}

// This is Pi's configuration, not a Habitat connection ledger. Ordinary
// native settings remain native; a colliding endpoint is never adopted.
func atlassianConfig(env Env) (map[string]json.RawMessage, map[string]json.RawMessage, error) {
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
	for name := range servers {
		if name != atlassianServer && strings.ReplaceAll(name, "-", "_") == atlassianServer {
			return nil, nil, ToolFailed
		}
	}
	if raw, ok := servers[atlassianServer]; ok {
		var entry struct {
			URL   string `json:"url"`
			OAuth struct {
				Scope string `json:"scope"`
			} `json:"oauth"`
		}
		if json.Unmarshal(raw, &entry) != nil || entry.URL != atlassianURL {
			return nil, nil, ToolFailed
		}
	}
	return root, servers, nil
}
func (*atlassian) Accounts(env Env) ([]string, error) {
	_, servers, err := atlassianConfig(env)
	if err != nil {
		return nil, err
	}
	if _, ok := servers[atlassianServer]; ok {
		return []string{atlassianServer}, nil
	}
	return nil, nil
}
func (*atlassian) StartLogin(ctx context.Context, env Env, address string) (Login, error) {
	return (&atlassian{}).StartLevelLogin(ctx, env, address, LevelRead)
}
func (*atlassian) StartLevelLogin(ctx context.Context, env Env, address string, level Level) (Login, error) {
	if address != "" && address != atlassianServer {
		return nil, AccountMismatch
	}
	root, servers, err := atlassianConfig(env)
	if err != nil {
		return nil, ToolFailed
	}
	if address == "" && servers[atlassianServer] != nil {
		return nil, AlreadyConnected
	}
	named, legacy, err := atlassianCredentialKeys(env)
	if err != nil || legacy {
		return nil, ToolFailed
	}
	scope := atlassianReadScopes
	if level == LevelFull {
		scope = atlassianWriteScopes
	} else if level != LevelRead && level != "" {
		return nil, ToolFailed
	}
	if level == "" && servers[atlassianServer] != nil {
		var e struct {
			OAuth struct {
				Scope string `json:"scope"`
			} `json:"oauth"`
		}
		_ = json.Unmarshal(servers[atlassianServer], &e)
		scope = e.OAuth.Scope
	}
	entry := map[string]json.RawMessage{}
	oauth := map[string]json.RawMessage{}
	if raw := servers[atlassianServer]; raw != nil {
		if json.Unmarshal(raw, &entry) != nil {
			return nil, ToolFailed
		}
		if !atlassianOAuthEntry(entry) {
			return nil, ToolFailed
		}
		if raw := entry["oauth"]; raw != nil && json.Unmarshal(raw, &oauth) != nil {
			return nil, ToolFailed
		}
	}
	if oauth == nil {
		oauth = map[string]json.RawMessage{}
	}
	oauth["scope"], _ = json.Marshal(scope)
	entry["url"], _ = json.Marshal(atlassianURL)
	entry["oauth"], _ = json.Marshal(oauth)
	created := servers[atlassianServer] == nil
	servers[atlassianServer], _ = json.Marshal(entry)
	root["mcpServers"], _ = json.Marshal(servers)
	data, _ := json.MarshalIndent(root, "", "  ")
	fd, err := openHomeDir(env.Home, true, ".pi", "agent")
	if err != nil {
		return nil, ToolFailed
	}
	err = writeFileAt(fd, "mcp.json", append(data, '\n'), 0600)
	unix.Close(fd)
	if err != nil {
		return nil, ToolFailed
	}
	cleanup := func() {
		if created {
			atlassianCleanup(env)
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
		if _, err := env.run(ctx, Command{Path: pi, Args: []string{"mcp", "logout", atlassianServer}}, nil); err != nil {
			cleanup()
			return nil, ToolFailed
		}
	}
	native, err := startPiOAuth(ctx, env, atlassianServer, fresh)
	if err != nil {
		cleanup()
		return nil, err
	}
	return &atlassianLogin{piOAuthLogin: native, env: env, created: created}, nil
}

// Alternative authentication cannot be represented by Pi's OAuth store.
// Preserve it and refuse OAuth takeover, rather than erasing native settings.
func atlassianOAuthEntry(entry map[string]json.RawMessage) bool {
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

type atlassianLogin struct {
	*piOAuthLogin
	env      Env
	created  bool
	accepted atomic.Bool
	once     sync.Once
}

func (l *atlassianLogin) Wait(ctx context.Context) (string, error) {
	address, err := l.piOAuthLogin.Wait(ctx)
	if err != nil {
		return "", err
	}
	l.accepted.Store(true)
	return address, nil
}
func (l *atlassianLogin) Cancel() {
	l.once.Do(func() {
		l.piOAuthLogin.Cancel()
		if l.created && !l.accepted.Load() {
			atlassianCleanup(l.env)
		}
	})
}
func atlassianCleanup(env Env) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = (&atlassian{}).Remove(ctx, env, atlassianServer)
}

func (*atlassian) Remove(ctx context.Context, env Env, address string) error {
	if address != atlassianServer {
		return AccountMismatch
	}
	if _, _, err := atlassianConfig(env); err != nil {
		return ToolFailed
	}
	pi, ok := env.Tool("pi")
	if !ok {
		return ToolFailed
	}
	named, _, err := atlassianCredentialKeys(env)
	if err != nil {
		return ToolFailed
	}
	// Logout is Pi's own credential deletion, not a token copy or revocation
	// broker. Do not let it fall back to an ambiguous legacy URL-only key.
	if named {
		if _, err := env.run(ctx, Command{Path: pi, Args: []string{"mcp", "logout", atlassianServer}}, nil); err != nil {
			return ToolFailed
		}
	}
	if _, err := env.run(ctx, Command{Path: pi, Args: []string{"mcp", "remove", atlassianServer}}, nil); err != nil {
		return ToolFailed
	}
	return nil
}
func atlassianCredentialKeys(env Env) (bool, bool, error) {
	fd, err := openHomeDir(env.Home, false, ".pi", "agent")
	if errors.Is(err, os.ErrNotExist) {
		return false, false, nil
	}
	if err != nil {
		return false, false, err
	}
	defer unix.Close(fd)
	data, err := readFileAt(fd, "mcp-auth.json", 1<<20)
	if errors.Is(err, os.ErrNotExist) {
		return false, false, nil
	}
	if err != nil {
		return false, false, err
	}
	var states map[string]json.RawMessage
	if json.Unmarshal(data, &states) != nil || states == nil {
		return false, false, ToolFailed
	}
	_, named := states["mcp__"+atlassianServer+"|"+atlassianURL]
	_, legacy := states[atlassianURL]
	return named, legacy, nil
}

func (a *atlassian) Check(ctx context.Context, env Env, address string) []Service {
	s, _ := a.CheckGrant(ctx, env, address)
	return s
}
func (*atlassian) CheckGrant(_ context.Context, env Env, address string) ([]Service, *Grant) {
	services := []Service{{ID: "jira", State: StateUnknown}, {ID: "confluence", State: StateUnknown}}
	if address != atlassianServer {
		return services, nil
	}
	_, servers, err := atlassianConfig(env)
	if err != nil {
		return services, nil
	}
	var entry map[string]json.RawMessage
	if json.Unmarshal(servers[atlassianServer], &entry) != nil || !atlassianOAuthEntry(entry) {
		return services, nil
	}
	var configured struct {
		OAuth struct {
			Scope string `json:"scope"`
		} `json:"oauth"`
	}
	if json.Unmarshal(servers[atlassianServer], &configured) != nil {
		return services, nil
	}
	fd, err := openHomeDir(env.Home, false, ".pi", "agent")
	if err != nil {
		return services, nil
	}
	defer unix.Close(fd)
	data, err := readFileAt(fd, "mcp-auth.json", 1<<20)
	if errors.Is(err, os.ErrNotExist) {
		for i := range services {
			services[i].State = StateLoginExpired
		}
		return services, nil
	}
	if err != nil {
		return services, nil
	}
	// Decode only the exact name + URL key. Another native account, including
	// the legacy URL-only key, is not proof of this connection's grant.
	var states map[string]json.RawMessage
	if json.Unmarshal(data, &states) != nil {
		return services, nil
	}
	var s struct {
		Tokens struct {
			Access  string `json:"access_token"`
			Scope   string `json:"scope"`
			Refresh string `json:"refresh_token"`
		} `json:"tokens"`
		Expires int64 `json:"tokensExpireAt"`
	}
	raw, ok := states["mcp__"+atlassianServer+"|"+atlassianURL]
	if !ok {
		for i := range services {
			services[i].State = StateLoginExpired
		}
		return services, nil
	}
	if json.Unmarshal(raw, &s) != nil {
		return services, nil
	}
	if s.Tokens.Access == "" {
		for i := range services {
			services[i].State = StateLoginExpired
		}
		return services, nil
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
	known := scopeSet(strings.Fields(atlassianWriteScopes), func(s string) string { return s })
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
		if granted["write:"+services[i].ID+":agent-interface"] {
			services[i].Access = AccessFull
		} else if granted["read:"+services[i].ID+":agent-interface"] || granted["search:"+services[i].ID+":agent-interface"] {
			services[i].Access = AccessRead
		} else {
			services[i].Access = AccessNone
			services[i].State = StateUnknown
		}
	}
	return services, grantOf(granted, strings.Fields(configured.OAuth.Scope), nil)
}
func (*atlassian) Level(_ Env, _ string, services []Service) Level {
	if len(services) != 2 {
		return ""
	}
	if services[0].Access == AccessRead && services[1].Access == AccessRead {
		return LevelRead
	}
	if services[0].Access == AccessFull && services[1].Access == AccessFull {
		return LevelFull
	}
	return ""
}
func (a *atlassian) Skill(env Env, address string) SkillAccount {
	services, _ := a.CheckGrant(context.Background(), env, address)
	return SkillAccount{Label: "Atlassian", Kinds: []string{"jira", "confluence"}, Body: "Use the native Pi MCP server `" + atlassianServer + "` for Jira issues and Confluence pages. Discover the signed-in account and accessible sites with the server's identity and accessible-resource tools before choosing a site; do not assume a tenant from a conversation. Organization policy and project/page permissions still apply. The requested scopes are not a ceiling: inspect the actual grant after each sign-in or step-up. Never export credentials or initiate broader consent without the person's request." + accessSummary(services, map[string]string{"jira": "Jira issues", "confluence": "Confluence pages"})}
}
