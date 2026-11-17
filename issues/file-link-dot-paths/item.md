---
created: 2026-11-17
updated: 2026-11-17
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-17/file-link-dot-paths
lane: unlaned
lane_seq: 1
preparation: ready
---

# File references whose path starts with a dot (.agents/…) are not turned into editor links

## Description

Jari 17.11.2026 (a pilot installation, v0.1.3): in an agent reply, `AGENTS.md` became a clickable file link, but `.agents/skills/create-presentation/SKILL.md` stayed plain inline code. Probably the reply's file-link detection rejects paths whose first segment starts with '.' (hidden directories such as .agents, .github, .pi, .claude). Dot-prefixed workspace-relative paths are common in repositories and should link like any other existing file in the workspace (still never linking '..' escapes outside the workspace).
