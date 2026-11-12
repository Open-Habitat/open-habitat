//go:build linux

package integrations

import (
	"context"
	"strings"
)

const Trello Provider = "trello"
const trelloServer = "open_habitat_trello"
const trelloURL = "https://mcp.trello.com/v1"

// Trello's MCP advertises these scopes in its protected-resource metadata.
// Read asks for no write scope; write adds card, inbox and planner changes
// but not Workspace administration (write:organization:trello).
const trelloReadScopes = "read:me read:account offline_access read:board:trello read:organization:trello read:member:trello read:member.inbox:trello read:member.planner:trello"
const trelloWriteScopes = trelloReadScopes + " write:board:trello write:member.inbox:trello write:member.planner:trello"

// trelloMaxConnections bounds the native names, not Workspaces: whether one
// consent reaches one Workspace or several is Trello's choice at sign-in.
const trelloMaxConnections = 9

var trelloMCP = piMCP{
	provider: Trello, base: trelloServer, max: trelloMaxConnections, url: trelloURL,
	read: trelloReadScopes, write: trelloWriteScopes, known: trelloWriteScopes + " write:organization:trello",
	services: []string{"trello"},
	access: func(_ string, granted map[string]bool) Access {
		// Any granted write, even one Habitat did not ask for, rules out
		// calling the connection read-only.
		for s := range granted {
			if strings.HasPrefix(s, "write:") {
				return AccessFull
			}
		}
		if granted["read:board:trello"] {
			return AccessRead
		}
		return AccessNone
	},
}

type trello struct{}

func (*trello) Provider() Provider       { return Trello }
func (*trello) Login() LoginKind         { return PastedRedirect }
func (*trello) Services() []string       { return trelloMCP.services }
func (*trello) Tools() []string          { return []string{"pi"} }
func (t *trello) Available(env Env) bool { return MissingTools(t, env) == nil }
func (*trello) Levels(Env) []LevelOption {
	return []LevelOption{{ID: LevelRead, Available: true}, {ID: LevelFull, Available: true}}
}
func (*trello) Accounts(env Env) ([]string, error) { return trelloMCP.accounts(env) }
func (*trello) StartLogin(ctx context.Context, env Env, address string) (Login, error) {
	return trelloMCP.startLogin(ctx, env, address, LevelRead)
}
func (*trello) StartLevelLogin(ctx context.Context, env Env, address string, level Level) (Login, error) {
	return trelloMCP.startLogin(ctx, env, address, level)
}
func (*trello) Remove(ctx context.Context, env Env, address string) error {
	return trelloMCP.remove(ctx, env, address)
}
func (t *trello) Check(ctx context.Context, env Env, address string) []Service {
	s, _ := t.CheckGrant(ctx, env, address)
	return s
}
func (*trello) CheckGrant(_ context.Context, env Env, address string) ([]Service, *Grant) {
	return trelloMCP.checkGrant(env, address)
}
func (*trello) Level(_ Env, _ string, services []Service) Level {
	return trelloMCP.level(services)
}
func (t *trello) Skill(env Env, address string) SkillAccount {
	services, _ := t.CheckGrant(context.Background(), env, address)
	return SkillAccount{Label: "Trello", Kinds: []string{"trello"}, Body: "Trello boards and cards are reached through the Pi MCP server `" + address + "`. Each Trello connection is a sign-in of its own, and Trello's consent screen decided which Workspaces it reaches; the connection's name does not say. Ask the server for the signed-in member and the accessible Workspaces and boards before acting, and when the person has several Trello connections, use the one whose Workspace holds the board. Workspace and board permissions and the organisation's Atlassian MCP policy apply as they do in the browser. " + piMCPGrantSkill + accessSummary(services, map[string]string{"trello": "Trello cards"})}
}
