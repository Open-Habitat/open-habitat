---
created: 2026-11-22
updated: 2026-11-22
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-icon-cannot-see
lane: unlaned
preparation: ready
closed: 2026-11-22
---

# Workspace icon suggestion says it cannot see the repository's own icon

## Description

When asking for a workspace icon, the suggestion helper can report that it cannot see the repository's own logo and offer unrelated alternatives even when a suitable local image exists. It must receive usable repository image content or an honest availability description, without substituting an unrequested other-workspace logo. Earlier explicitly requested other-workspace image selection must continue to work.

## Acceptance Criteria

- [x] Synthetic public SVG, assets PNG, README-referenced logo and no-logo repositories cover discovery and model input.
- [x] Repository image content reaches the tool-free helper under existing file-access and size restrictions.
- [x] Default requests reject other-workspace logos; explicitly requested images remain supported.
- [x] Focused Go, web, contracts and touched browser checks pass; independent review findings are assessed and fixed.

See result.md for decisions, evidence and deployment-check limits.
