---
created: 2026-10-28
updated: 2026-10-28
type: improvement
reporter: jari
status: open
priority: normal
lane: google-wizard
preparation: ready
provenance: chat
source_ref: chat:2026-10-28/google-wizard-agent-client
---

# Google setup wizard: tell the operator to mark the OAuth client as an AI-powered agent

Jari 2026-10-28: Google Cloud Consolen Create OAuth client ID -sivulla on uusi valinta 'Use this client for an AI-powered agent'. Googlen ohje (support.google.com/cloud/answer/15549257, Configure OAuth Clients for AI Agents): itseilmoitus, että asiakasohjelma edustaa käyttäjän puolesta toimivia agentteja; ei anna lisäoikeuksia; organisaation ylläpitäjä voi kohdistaa agenteille omia sääntöjä; osa Googlen MCP-palveluista (Workspace-työkalut) hyväksyy vain agentiksi merkityn asiakkaan. Open Habitatin Google-asiakasta käyttävät vain agentit, joten ohjeen client ID -vaiheeseen lisätään: valitse tämä ruutu, ja syy lyhyesti. Ohje on web/src/components/ServerIntegrations.tsx; docs/operations.md jos se kuvaa samat vaiheet.
