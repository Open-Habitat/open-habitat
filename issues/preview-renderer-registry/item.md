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
