---
created: 2026-11-17
updated: 2026-11-17
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: chat:2026-11-17/editor-preview-first
lane: unlaned
lane_seq: 1
preparation: ready
closed: 2026-11-17
---

# Editor opens files in preview mode first, not edit mode

## Description

Jari 17.11.2026: in the editor, the preview mode should be the default that opens first, not the edit mode. Applies to files that have a preview (Markdown, front matter / YAML previews, the repository start page). Jari asked for this exact change, so it is built directly without a prototype.

## Acceptance Criteria

- [x] Previewable files open in preview on desktop and phone; source-only files still open as text.
- [x] The existing edit control switches to source, and explicit view choices survive while the file stays open.
- [x] Line links reveal, select and focus the source line; the decision is recorded in result.md.
- [x] Initial-view unit tests, affected browser specs repeated three times, and fast web checks pass.
