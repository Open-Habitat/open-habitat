//go:build linux

package daemon

import (
	"net/http"

	"github.com/Open-Habitat/open-habitat/internal/daemon/integrations"
	"github.com/Open-Habitat/open-habitat/internal/transport"
)

const AgentIntegrationLoginPath = "/agent/v1/integrations/login"
const AgentPiLoginPath = "/agent/v1/logins/pi"
const AgentClaudeLoginPath = "/agent/v1/logins/claude"

const AgentIntegrationsPath = "/agent/v1/integrations"
const AgentIntegrationAccountsPath = "/agent/v1/integrations/accounts"
const AgentCredentialsPath = "/agent/v1/credentials"
const AgentOpenAICredentialPath = "/agent/v1/credentials/openai"

func agentIntegrationRoutes(cfg transport.Config, pi *PiDevice, catalog *integrations.Catalog, claude *claudeLogin, onAuthenticated func()) map[string]http.Handler {
	routes := map[string]http.Handler{}
	if pi != nil {
		routes[AgentPiLoginPath] = (&piAttempt{device: pi}).handlerAt(cfg, transport.AgentPeer, onAuthenticated, AgentPiLoginPath, true)
		routes[AgentClaudeLoginPath] = claude.handlerAt(cfg, transport.AgentPeer, AgentClaudeLoginPath, true)
	}
	credentials := piCredentialsHandlerAt(cfg, transport.AgentPeer, pi, AgentCredentialsPath, AgentOpenAICredentialPath)
	routes[AgentCredentialsPath] = credentials
	routes[AgentOpenAICredentialPath] = credentials
	if catalog != nil {
		h := catalog.AgentHandler(transport.AgentPeer, AgentIntegrationsPath, AgentIntegrationAccountsPath, AgentIntegrationLoginPath)
		routes[AgentIntegrationsPath] = h
		routes[AgentIntegrationAccountsPath] = h
		routes[AgentIntegrationLoginPath] = h
	}
	return routes
}
