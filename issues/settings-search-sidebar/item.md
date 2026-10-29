---
created: 2026-10-29
updated: 2026-10-29
type: feature
reporter: jari
status: done
priority: normal
lane: settings
lane_seq: 2
collision: [web/src/app/Settings.tsx]
preparation: ready
closed: 2026-10-29
---

# Settings search in the sidebar

_Source: chat_

## Description

Implement `proto-settings-search` as chosen (Jari 29.10.): **Sivupalkissa**. Hits replace the section list in the settings sidebar with a preview on the right (macOS-like), using production's existing jump-to-row; a static search index and row ids for every setting row (today only seven have one); `/` focuses search and arrow keys move through hits.

## Acceptance Criteria

- [x] Every settings row is findable and jumps to its row; Finnish synonyms where natural.
- [x] Keyboard: `/`, arrows, Enter, Esc.
- [x] Browser spec; KOKEILTAVAA line.
