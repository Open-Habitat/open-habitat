---
created: 2026-11-08
updated: 2026-11-08
type: feature
reporter: jari
status: done
priority: normal
lane: markdown-preview-proto
lane_seq: 2
blocked_by: ['@proto-markdown-block-preview']
preparation: ready
closed: 2026-11-08
---

# Markdown code block previews in place

## Description

Implementation of Jari's decision on `proto-markdown-block-preview` (round 2,
**1 Paikallaan**, 8.11.2026). The prototype is the specification:
`design-system/prototypes/rounds/2026-11-06-md-lohkon-esikatselu-2/` and
`issues/proto-markdown-block-preview/evidence/r2-1-*`. An eye button in a
`markdown`/`md` code block's action column (own group under copy) switches the
block to rendered in place and back; questions 2 and 3 follow the round's
recommendation in `result.md`. New feature: experimental (Settings ›
Kokeelliset ominaisuudet), off by default.

## Acceptance Criteria

- [x] Opt-in eye action switches md/markdown blocks in place and back, below copy.
- [x] Long previews expand; copying preserves source; source-only actions are hidden in preview.
- [x] Finnish/English catalogs, experimental card, focused checks and synthetic visual evidence are included.
