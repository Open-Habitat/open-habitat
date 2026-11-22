---
created: 2026-11-22
updated: 2026-11-22
type: bug
reporter: jari
status: fixed
priority: high
provenance: chat
source_ref: habitat:pi-current/2026-11-22-sharepoint-write
lane: unlaned
preparation: ready
closed: 2026-11-22
commits:
- hash: e7a2adab1
  summary: enable consented Microsoft file writes without library sync
---

# SharePoint libraries are read-only for the agent although the person can write

## Description

A pilot installation's user (v0.1.4, 22.11.2026): "Open Habitat has forbidden
agents from writing to SharePoint, although the permissions exist." The agent
answered that the Microsoft 365 connection only lets it search, browse and
download files, and that saving to SharePoint is possible only through the
browser. The installation has all three Microsoft levels registered (full,
drafts, read). The person has write rights to the SharePoint library.
Next action: analyse why writes are refused (level, consented scopes, the
sharepoint access rule, one-way mirror, the agent's skill text) and what the
person or admin sees; then fix.
