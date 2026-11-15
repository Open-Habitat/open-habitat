---
created: 2026-11-15
updated: 2026-11-15
type: feature
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: chat:2026-11-15/start-page-renderer
lane: frontmatter-impl
lane_seq: 2
collision: [web/src/components/frontmatter.ts, contracts/v1/]
preparation: ready
closed: 2026-11-15
---

# Start page rendered as the page in the editor preview (renderer registry phase 1)

## Description

Phase 1 of `preview-renderer-registry` (Jari's decisions 15.11.2026 in that issue): a static in-bundle registry chosen by path from the workspace root, the start page (`.agents/start-page.md`) as its only entry, rendered as the page (direction 3 of `proto-frontmatter-preview`), validity from a daemon check route using the same parser as the saved page, special view first, editor only. The frame prepares renderer input by file type (Markdown front matter + body; YAML/JSON whole document). Also: the generic nested preview covers `.json`.

## Acceptance Criteria

- [x] Exact workspace-root registry entry, typed frame input and generic JSON preview.
- [x] Bounded daemon check reuses the saved-page parser and returns field problems through a validated contract.
- [x] Special preview first, plain/text alternatives, inert goal guides and invalid/unavailable fallback.
- [x] Focused contracts, daemon, gateway, web and browser checks pass; independent route review resolved. Evidence and live check are in result.md.
