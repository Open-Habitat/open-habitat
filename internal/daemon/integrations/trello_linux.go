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
	return SkillAccount{Label: "Trello", Kinds: []string{"trello"}, Body: "Use the native Pi MCP server `" + address + "` for Trello boards and cards. Each Trello connection is its own native sign-in, and Trello's consent decided which Workspace or Workspaces it reaches: discover the signed-in member and the accessible Workspaces and boards with the server's own tools before acting, and do not assume a Workspace from the connection's name or the conversation. If the person has several Trello connections, use the one whose Workspace holds the board. Workspace and board permissions and the organization's Atlassian MCP policy still apply. The requested scopes are not a ceiling: inspect the actual grant after each sign-in or step-up. Never export credentials or initiate broader consent without the person's request." + accessSummary(services, map[string]string{"trello": "Trello cards"})}
}
