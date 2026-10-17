---
created: 2026-10-17
updated: 2026-10-17
type: task
reporter: jari
status: open
priority: high
epic: agent-integrations
lane: unlaned
collision: [issues/research-integrations]
preparation: ready
---

# Research: integrations, OpenClaw reuse and agent exposure

Research for `agent-integrations` (read `issues/agent-integrations/item.md` for Jari's words). Audience: Jari as product owner and the architecture decision that follows; write in English, plain language, with sources.

Questions:
1. **OpenClaw's integration model.** What integration points OpenClaw (the open-source personal agent, formerly Clawdbot/Moltbot) has: skills, plugins/extensions, connectors, MCP, their manifest/format and credential handling. To what extent can Open Habitat reuse them so that an integration written for OpenClaw works here automatically (same skill format, same CLI tools, same MCP servers), and where would our UI differ? Look at its repository and docs directly.
2. **Which integrations** a person running agents here would want first (SharePoint/OneDrive, Google Drive, Gmail, Google Calendar, Slack, Notion, …), and for each: the realistic implementation (native sync client such as rclone/onedrive into `~`, a CLI the agent calls, an MCP server, an API via the user's OAuth token), what data lands where, and the effort.
3. **How agents learn about integrations**: system-prompt additions, skills installed into the user's home (`~/.pi`, `~/.agents/skills`, `~/.claude/skills`) when an integration is added, AGENTS.md, MCP registration. What Pi supports natively.
4. **Security under the Unix-user boundary** (`CLAUDE.md`): credentials stay in the user's own native stores, no host credential broker; what the daemon may do as the user, and what must never cross users.

Present at least two architecture options with trade-offs and a recommendation. Do not write an ADR. Output: `issues/research-integrations/report.md`.
