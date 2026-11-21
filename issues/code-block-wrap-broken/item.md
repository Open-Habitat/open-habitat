---
created: 2026-11-21
updated: 2026-11-21
type: bug
reporter: jari
status: fixed
priority: high
provenance: chat
source_ref: chat:2026-11-21/code-block-wrap-broken
lane: unlaned
lane_seq: 1
preparation: ready
closed: 2026-11-21
closed_by: claude
commits:
- hash: c650fd14
  summary: code block wrap fix
---

# Code block line-wrap toggle misbehaves: the button disappears on click, and wrap does not apply as expected (replies and nested blocks in Markdown preview)

## Description

Jari 21.11.2026 (test server): Markdown code blocks in an agent's reply misbehave, and so does a nested Markdown code block inside a Markdown file's editor preview. The line-wrap button does not work properly: when it is clicked it disappears. In other situations wrap does not actually behave as expected (long lines still overflow or wrap inconsistently). Likely related to the 17.11. change that made the turn Changes diff use the reply's code block (OutputBox rail, wrap toggle, views), which put the shared component in more places.
