---
created: 2026-10-23
updated: 2026-10-23
type: feature
reporter: jari
status: open
priority: normal
preparation: ready
lane: editor-tree
lane_seq: 3
collision: [web/src/components/editor-files]
---

# Editor: syntax highlighting by file type

## Description

Jari 2026-10-23: the CodeMirror 6 editor works (long files scroll), but he wants syntax highlighting. Add CodeMirror's own language support (`@codemirror/language` + the official `@codemirror/lang-*` packages, or `@codemirror/language-data` for lazy loading) chosen by file extension, with a highlight style that follows the design-system tokens in light and dark. Cover at least the languages in the Northwind and Open Habitat repos: TypeScript/JavaScript/JSX, Python, PHP, Go, Rust, JSON, YAML, TOML, Markdown, HTML, CSS, SQL, shell. Load languages lazily so the editor start is not slower. Unknown extensions stay plain.

## Acceptance Criteria

- [ ] Highlighting for the listed languages in light and dark; editor start time unchanged or better (measured); bundle grows only by lazily loaded chunks.
- [ ] Browser test asserts highlighted tokens for a few languages; screenshots desktop/390 px.
