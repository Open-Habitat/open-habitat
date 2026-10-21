//go:build linux

package daemon

import (
	"net/http"

	"github.com/Open-Habitat/open-habitat/internal/daemon/integrations"
	"github.com/Open-Habitat/open-habitat/internal/transport"
)

const AgentIntegrationsPath = "/agent/v1/integrations"
const AgentIntegrationAccountsPath = "/agent/v1/integrations/accounts"
const AgentCredentialsPath = "/agent/v1/credentials"
const AgentOpenAICredentialPath = "/agent/v1/credentials/openai"

func agentIntegrationRoutes(cfg transport.Config, pi *PiDevice, catalog *integrations.Catalog) map[string]http.Handler {
	routes := map[string]http.Handler{}
	credentials := piCredentialsHandlerAt(cfg, transport.AgentPeer, pi, AgentCredentialsPath, AgentOpenAICredentialPath)
	routes[AgentCredentialsPath] = credentials
	routes[AgentOpenAICredentialPath] = credentials
	if catalog != nil {
		h := catalog.AgentHandler(transport.AgentPeer, AgentIntegrationsPath, AgentIntegrationAccountsPath)
		routes[AgentIntegrationsPath] = h
		routes[AgentIntegrationAccountsPath] = h
	}
	return routes
}
