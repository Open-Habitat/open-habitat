---
created: 2026-11-15
updated: 2026-11-15
type: task
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-15/renderer-registry
lane: renderer-registry
lane_seq: 1
preparation: ready
---

# Design: how special preview renderers are registered for particular files

## Description

Jari 15.11.2026: before the start page gets its own page-like preview (direction 3 of `proto-frontmatter-preview`), think through architecturally how a particular Markdown (or YAML) file is shown with its own renderer: how special renderers are registered and chosen.

## Decisions

### 2026-11-15T19:09:50Z · @jari

Jari 15.11.2026: selection by path, validity from the daemon (a check route is fine), repository/skill code never draws previews in the app, the special view opens first, recognised only in the editor, and only the start page now. A separate web/AGENTS.md rule is not needed. Asked whether the registry handles other types than Markdown front matter (JSON, YAML): the conductor's answer — the frame prepares input by file type (Markdown: front matter + body; YAML/JSON: the whole parsed document), so the contract is not Markdown-only; the generic nested preview also covers .json.
