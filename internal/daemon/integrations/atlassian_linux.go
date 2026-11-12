//go:build linux

package integrations

import "context"

const Atlassian Provider = "atlassian"
const atlassianServer = "open_habitat_atlassian"
const atlassianURL = "https://mcp.atlassian.com/v2/mcp"
const atlassianReadScopes = "read:me read:account offline_access read:jira:agent-interface search:jira:agent-interface read:confluence:agent-interface search:confluence:agent-interface"
const atlassianWriteScopes = atlassianReadScopes + " write:jira:agent-interface write:confluence:agent-interface"

var atlassianMCP = piMCP{
	provider: Atlassian, base: atlassianServer, max: 1, url: atlassianURL,
	read: atlassianReadScopes, write: atlassianWriteScopes, known: atlassianWriteScopes,
	services: []string{"jira", "confluence"},
	access: func(id string, granted map[string]bool) Access {
		if granted["write:"+id+":agent-interface"] {
			return AccessFull
		}
		if granted["read:"+id+":agent-interface"] || granted["search:"+id+":agent-interface"] {
			return AccessRead
		}
		return AccessNone
	},
}

type atlassian struct{}

func (*atlassian) Provider() Provider       { return Atlassian }
func (*atlassian) Login() LoginKind         { return PastedRedirect }
func (*atlassian) Services() []string       { return atlassianMCP.services }
func (*atlassian) Tools() []string          { return []string{"pi"} }
func (a *atlassian) Available(env Env) bool { return MissingTools(a, env) == nil }
func (*atlassian) Levels(Env) []LevelOption {
	return []LevelOption{{ID: LevelRead, Available: true}, {ID: LevelFull, Available: true}}
}
func (*atlassian) Accounts(env Env) ([]string, error) { return atlassianMCP.accounts(env) }
func (*atlassian) StartLogin(ctx context.Context, env Env, address string) (Login, error) {
	return atlassianMCP.startLogin(ctx, env, address, LevelRead)
}
func (*atlassian) StartLevelLogin(ctx context.Context, env Env, address string, level Level) (Login, error) {
	return atlassianMCP.startLogin(ctx, env, address, level)
}
func (*atlassian) Remove(ctx context.Context, env Env, address string) error {
	return atlassianMCP.remove(ctx, env, address)
}
func (a *atlassian) Check(ctx context.Context, env Env, address string) []Service {
	s, _ := a.CheckGrant(ctx, env, address)
	return s
}
func (*atlassian) CheckGrant(_ context.Context, env Env, address string) ([]Service, *Grant) {
	return atlassianMCP.checkGrant(env, address)
}
func (*atlassian) Level(_ Env, _ string, services []Service) Level {
	return atlassianMCP.level(services)
}
func (a *atlassian) Skill(env Env, address string) SkillAccount {
	services, _ := a.CheckGrant(context.Background(), env, address)
	return SkillAccount{Label: "Atlassian", Kinds: []string{"jira", "confluence"}, Body: "Jira issues and Confluence pages are reached through the Pi MCP server `" + atlassianServer + "`. The sign-in decided which Atlassian account and sites it reaches, and nothing here records them: ask the server's identity and accessible-resources tools before choosing a site, since a site named in the conversation may not be one this connection reaches. The organisation's policy and the person's project and page permissions apply as they do in the browser. " + piMCPGrantSkill + accessSummary(services, map[string]string{"jira": "Jira issues", "confluence": "Confluence pages"})}
}
