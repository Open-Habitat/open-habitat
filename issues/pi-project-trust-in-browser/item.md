---
created: 2026-11-10
updated: 2026-11-10
type: bug
reporter: jari
status: untriaged
priority: normal
provenance: other
provenance_detail: Jari 10.11.2026, Contoso pilot
source_ref: conversation:jari-2026-11-10/project-trust
---

# Repository skills and Pi project resources are silently skipped in Habitat: no way to grant Pi's project trust

## Description

## Description

Jari 10.11.2026, Contoso pilot: a skill committed in a workspace repository
(`.agents/skills/<name>/SKILL.md`) does not appear for a person's agent in
that workspace.

Cause, checked on the server and in Pi 1.3.0's docs (`docs/security.md`,
"Understand project trust"): project `.agents/skills`, `.pi/skills`,
`.pi/extensions`, `.pi/settings.json`, `.pi/mcp.json` and the like are
protected by Pi's **project trust**. Habitat runs Pi in RPC mode, which
cannot show Pi's trust prompt; with no saved decision in
`~/.pi/agent/trust.json` and `defaultProjectTrust` at its default `ask`, Pi
silently skips every protected project resource. The affected person had no
`trust.json` at all. Maintainers who also use Pi in a terminal have saved
decisions there (for example `~/src` trusted), so for them the same
repository works, which hides the gap. The composer's `/` list (Pi's
`get_commands`) is filtered by the same trust, so the skill is missing there
too.

Effect: every browser-only person loses all repository-provided skills,
prompts, project MCP servers and extensions, with nothing telling them why.

Direction to design with Jari: the browser shows that a workspace has
project resources Pi skipped, and offers to trust that workspace (or all of
`~/src`); the choice is written to Pi's own `~/.pi/agent/trust.json` as Pi's
`/trust` would, so there is no Habitat-owned trust store. Explain in the
person's language that trust lets the repository's extensions run code as
them. Open questions: per workspace vs. `~/src`; whether a clone made
through Habitat's own onboarding (default repositories chosen by the
administrator) is trusted automatically; how the agent itself may grant it
(`open-habitat agent` command) when the person asks.

Workaround today: the person asks their agent to add the workspace path (or
`~/src`) with value `true` to `~/.pi/agent/trust.json`, then starts a new
conversation.
