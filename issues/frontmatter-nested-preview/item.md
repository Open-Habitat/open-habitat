---
created: 2026-11-15
updated: 2026-11-15
type: improvement
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-15/frontmatter-nested
lane: frontmatter-impl
lane_seq: 1
collision: [web/src/components/frontmatter.ts]
preparation: ready
---

# Editor preview shows nested YAML front matter and YAML files

## Description

Jari 15.11.2026 accepted direction 1 **Sisäkkäin** of `proto-frontmatter-preview` round 1 (`design-system/prototypes/rounds/2026-11-15-frontmatter-preview/`) for every file now: YAML front matter in the editor preview shown fully open as a nested list (lists of objects as cards, string lists as chips or bullets, multi-line strings as quote blocks, empty values named, indentation stops growing after level four), and plain `.yaml`/`.yml` files get the same preview. The start page's own page-like rendering (direction 3) waits for `preview-renderer-registry`.
