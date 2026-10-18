---
created: 2026-10-18
updated: 2026-10-18
type: task
reporter: jari
status: open
priority: high
epic: agent-integrations
preparation: ready
lane: unlaned
collision: [issues/proto-integrations]
---

# Prototype: adding and managing integrations

Prototype round for `agent-integrations`: how a person adds, sees and removes an integration (Asetukset › Integraatiot or similar), on the catalog design in the Proposed integrations ADR (`adr-integrations` / `docs/decisions/`) and the two research reports (`issues/research-integrations/report.md`, `issues/research-integrations-microsoft/report.md`). Content: Google (Drive sync, Gmail, Calendar with one application), Microsoft (SharePoint/OneDrive sync, Outlook mail and calendar with device-code login and possible tenant admin consent), Dropbox; login passing through the browser; live status from the tool; sync state and quota; the plain warning that agents can read and act on connected data; removal.

Three directions on one named axis. Additionally, before the round, **exercise the open feasibility facts on this host in a disposable home** (never Jari's real accounts or tokens): can rclone / abraunegg onedrive / the chosen Microsoft MCP server / `gog` or `gws` run their login non-interactively from a daemon-like process with the URL or device code handed to a browser and the redirect or code returned? Record exactly what worked, with commands, in result.md under "Feasibility"; what needs a real account stays a stated gap.
