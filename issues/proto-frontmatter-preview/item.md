---
created: 2026-11-15
updated: 2026-11-15
type: improvement
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-15/frontmatter-preview
lane: frontmatter-proto
lane_seq: 1
preparation: pending
---

# Preview renders nested YAML front matter poorly

## Description

Jari 15.11.2026: the editor's preview mode for a Markdown file with YAML front matter does not render nested structures well. Example: a repository's start page `.agents/start-page.md` is almost entirely YAML front matter (`title`, `goals` as a list of objects with `steps` lists and a multi-line `prompt`) and a one-line Markdown body. Showing a few levels, or handling lists, would help.

Also to consider (Jari): should the start page become a plain YAML file when it has (almost) no Markdown content?

Code: `web/src/components/frontmatter.ts`, `MarkdownRenderer.tsx`, `editorPreview.ts`.

## Decisions

### 2026-11-15T18:52:51Z · @jari

Jari 15.11.2026: as recommended, but build direction 1 Sisäkkäin (generic nested preview, also .yml) now; direction 3 (the start page rendered as a page) waits for an architecture design of how special renderers are registered for particular Markdown files. Implementation: frontmatter-nested-preview; design: preview-renderer-registry.
