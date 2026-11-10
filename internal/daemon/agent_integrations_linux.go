//go:build linux

package daemon

import (
	"net/http"

	"github.com/open-habitat/open-habitat/internal/daemon/integrations"
	"github.com/open-habitat/open-habitat/internal/transport"
)

const AgentIntegrationLoginPath = "/agent/v1/integrations/login"
const AgentPiLoginPath = "/agent/v1/logins/pi"
const AgentClaudeLoginPath = "/agent/v1/logins/claude"

const AgentIntegrationsPath = "/agent/v1/integrations"
const AgentIntegrationAccountsPath = "/agent/v1/integrations/accounts"
const AgentCredentialsPath = "/agent/v1/credentials"
const AgentGiteaPath = "/agent/v1/integrations/gitea"
const AgentGitLabPath = "/agent/v1/integrations/gitlab"
const AgentSpeechKeyPath = "/agent/v1/speech/key"
const AgentRecapSettingsPath = "/agent/v1/settings/recap"

func agentIntegrationRoutes(cfg transport.Config, pi *PiDevice, catalog *integrations.Catalog, claude *claudeLogin, speech *Speech, onAuthenticated func()) map[string]http.Handler {
	routes := map[string]http.Handler{}
	// The browser's own key and recap handlers; one dictation's temporary
	// key is the browser's alone and is not routed here.
	if speech != nil {
		routes[AgentSpeechKeyPath] = speech.keyHandlerAt(AgentSpeechKeyPath, transport.AgentPeer)
	}
	if pi != nil {
		routes[AgentRecapSettingsPath] = recapSettingsHandlerAt(cfg, transport.AgentPeer, pi, AgentRecapSettingsPath)
		routes[AgentPiLoginPath] = (&piAttempt{device: pi}).handlerAt(cfg, transport.AgentPeer, onAuthenticated, AgentPiLoginPath, true)
		routes[AgentClaudeLoginPath] = claude.handlerAt(cfg, transport.AgentPeer, AgentClaudeLoginPath, true)
	}
	credentials := piCredentialsHandlerAt(cfg, transport.AgentPeer, pi, AgentCredentialsPath)
	for _, path := range PiCredentialPaths(AgentCredentialsPath) {
		routes[path] = credentials
	}
	if catalog != nil {
		h := catalog.AgentHandler(transport.AgentPeer, AgentIntegrationsPath, AgentIntegrationAccountsPath, AgentIntegrationLoginPath, AgentGiteaPath, AgentGitLabPath)
		routes[AgentIntegrationsPath] = h
		routes[AgentGiteaPath] = h
		routes[AgentGitLabPath] = h
		routes[AgentIntegrationAccountsPath] = h
		routes[AgentIntegrationLoginPath] = h
	}
	return routes
}
