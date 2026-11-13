---
created: 2026-11-12
updated: 2026-11-13
type: feature
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: chat:2026-11-12/m365-agent-search
lane: m365-search
lane_seq: 1
preparation: ready
closed: 2026-11-13
---

# Agents search and fetch Microsoft 365 files (read/search tools first)

## Description

Jari 12.11.2026 (decision in `cloud-files-on-demand`): agents find Microsoft
365 files by search instead of a full local copy. Expose Graph search and
single-file fetch to agents through the shipped MS 365 MCP server, read and
search tools first (`search-query`, `search-onedrive-files`,
`list-folder-files`, `get-drive-item`, `download-bytes-to-file`,
`get-download-url`, per research §Recommendation 1). This reaches every site
and team the person can access, including ones not followed, communication
sites, subsites, items shared by link and teams joined later
(`m365-discovery-all-accessible-sites`).

The agent text (personal-data skill / host context) says: search first,
fetch the files you need into the person's home, then grep within what was
fetched; avoid broad greps over cloud folders. Edits go to fetched files
within the account's level. **Jari proofreads every agent instruction text
before it reaches the pilots**: put the exact new text in `agent-text.md` in
this issue for him.

### 2026-11-13 · @jari

Agent text proofread and approved for the pilot release.
