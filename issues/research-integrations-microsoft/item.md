---
created: 2026-10-18
updated: 2026-10-18
type: task
reporter: jari
status: done
priority: high
epic: agent-integrations
preparation: ready
lane: unlaned
collision: [issues/research-integrations-microsoft]
closed: 2026-10-18
closed_by: worker
---

# Research: Outlook mail and calendar, Dropbox, skill visibility in Claude sessions

Second research round for `agent-integrations`, before its ADR. Read `issues/agent-integrations/item.md` (Jari's decisions of 2026-10-18: Google Drive and SharePoint first with their mail and calendars; read and write by default; the operator registers the OAuth applications host-wide while each person's tokens stay theirs; file sync runs continuously as the user) and `issues/research-integrations/report.md` (the first round, its recommended daemon-driven catalog of native integrations, and its "Not verified" list). Same recipe and audience as that report: plain language, sources, at least two options where there is a choice.

Questions:
1. **Outlook / Microsoft 365 mail and calendar.** No password route remains, so the route is Microsoft Graph through a registered Entra application. Which CLI or MCP server gives an agent mail and calendar (read and write), maintained and usable on Linux; which delegated scopes; how its login works on a headless server where the browser has to carry the device-code or redirect step; where it stores tokens (must be the user's own home); whether admin consent is needed in typical tenants.
2. **Dropbox** as one row: the Linux client or rclone, its own app identity, sync into the home.
3. **Do Claude sessions see Pi's skills and MCP tools?** Claude sessions run through pi-claude-bridge (ADR 0016). Determine from its source and Pi's docs whether skills in `~/.agents/skills/` and MCP servers in `~/.pi/agent/mcp.json` reach a Claude session, or only Claude Code's own `~/.claude/skills` and MCP config, i.e. whether the catalog must write in two places. Verify locally where possible.

Output: `issues/research-integrations-microsoft/report.md`. End with what the ADR should say for Microsoft mail/calendar and for skill placement, and what remains testable only in the prototype (headless login driving, real-tenant admin consent).
