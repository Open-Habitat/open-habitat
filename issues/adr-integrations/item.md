---
created: 2026-10-18
updated: 2026-10-18
type: task
reporter: jari
status: in-progress
priority: high
epic: agent-integrations
preparation: ready
lane: integrations
lane_seq: 1
collision: [docs/decisions/]
---

# ADR: integrations catalog (Proposed)

Draft the integrations ADR for `agent-integrations` with status **Proposed** (Jari has not yet accepted the catalog design; he decides architecture). Inputs: `issues/agent-integrations/item.md` (Jari's decisions of 2026-10-18: Google Drive and SharePoint first with mail and calendars; read and write by default; operator-registered OAuth applications host-wide, each person's tokens their own; continuous file sync as the user), `issues/research-integrations/report.md` (recommended daemon-driven catalog of native integrations) and `issues/research-integrations-microsoft/report.md` (Microsoft mail/calendar via a pinned MCP server and device-code login, tenant admin consent, Dropbox, Claude sessions seeing only Pi's `~/.agents/skills` and `~/.pi/agent/mcp.json`).

The ADR states the catalog design, where skills and MCP entries are written, how logins pass through the browser, continuous sync as the user (and what starts it at boot), the operator's role, and the agent-exposure warning in the UI; it lists what only the prototype can settle. Use the next free ADR number, add it to `docs/decisions/index.md` as Proposed. No product code.

## Reopen Notes — 2026-10-18

Reopened to apply Jari's decisions of 2026-10-18 (scope, personal-data skill, several accounts per provider, `~/cloud/` layout, boot start of syncing users' daemons) and mark ADR 0026 accepted.
