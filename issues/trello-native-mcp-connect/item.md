---
created: 2026-11-09
updated: 2026-11-09
type: feature
status: untriaged
priority: normal
provenance: chat
source_ref: taskfleet:01m6zrt6cgp2vbbxjx6d60j9h4/trello-followup
originating_run: 01m6zrt6cgp2vbbxjx6d60j9h4
originating_run_kind: spinoff
---

# Finish Trello native MCP connections after the Atlassian rollout slice

## Description

## Description

Finish the Trello portion of `atlassian-trello-connect` after the Jira/Confluence implementation. This is explicitly deferred from the 9 November rollout implementation so the Atlassian integration can be tested before Jari and Aino's 10 November rollout. There is still no production Trello card or native connection adapter.

The qualification in `issues/atlassian-trello-connect/item.md` established that Pi 1.3 discovers OAuth and registers a client at `https://mcp.trello.com/v1`; there is no evidence requiring a REST token fallback. No account consent or live Workspace access was performed. The current Trello getting-started documentation allows multiple Workspaces in consent, while troubleshooting still says one; do not enforce one Workspace per connection without checking actual consent behavior.

Reuse the per-person native Pi MCP login relay, keeping credentials only in Pi's native store. Each named connection needs its own native identity. Do not generalize the Atlassian-only authorization-host allowlist without qualifying Trello's actual authorization endpoint and callback. Offer read versus write only when the granted scopes enforce that distinction, re-read the native grant after every sign-in/step-up, and treat unknown scopes as unknown rather than read-only. Preserve other native MCP entries and credentials when connecting, cancelling or removing.

## Acceptance Criteria

- Experimental Trello account/Workspace card, with truthful grant and sign-in states and multiple native named connections where supported.
- Full administrator request shown for copying; Habitat sends nothing.
- Native RPC pasted-callback, failure/cancellation/reconnect/disconnect and separate-connection fixtures, with no second credential store.
- personal-data describes Trello cards, account and Workspace discovery; Explain cards in Finnish and English.
- Record live checks for Workspace selection cardinality, actual granted scopes, read-only write denial, revocation and isolation; do not claim live qualification from fixtures.
