---
created: 2026-11-12
updated: 2026-11-12
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: chat:2026-11-12/md-frontmatter
lane: unlaned
preparation: ready
closed: 2026-11-12
---

# Markdown preview renders YAML frontmatter as rule and running text

## Description

Jari 12.11.2026 on Birch: in Habitat's clean Markdown preview (the file
offer card / file panel opened on `personal-data-after.md`, a Pi skill file),
the leading YAML frontmatter (`---` … `---` with `name:` and a long
`description:`) does not render properly: it comes out as a horizontal rule
and running text instead of being recognised as metadata. Skill files,
AGENTS-style docs and issue files all start with frontmatter, so this is
common.

Expected: a leading frontmatter block is recognised and shown as tidy
metadata (e.g. a compact key–value block or a quiet code block), and the
document body renders as usual. Applies to every Markdown preview in the
product (file offers, file panel, attachment previews, editor-link previews
if they render Markdown).
