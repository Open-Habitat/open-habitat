---
created: 2026-10-31
updated: 2026-10-31
type: improvement
reporter: jari
status: done
priority: normal
lane: rail-icons-no-grouping
lane_seq: 1
preparation: ready
closed: 2026-10-31
---

# Rail with workspace icons: no per-workspace folds under Hiljaiset

## Description

Jari 31.10. 19.18 (Birch pilot.17, screenshot
`attachments/hiljaiset-deutschpad.png`): with workspace icons on, the rail's
*Hiljaiset · yli tunnin* section still shows a per-workspace fold
(`› d deutschpad 1`). Jari: there should be no grouping when icons are in
use. Each row already carries its workspace icon, so the workspace fold is
a step that hides the conversation behind its workspace name.

Today (`web/src/components/Navigation.tsx`, `NowSections` / the grouped
list): with icons the live groups already drop their heading, but quiet
conversations are still folded per workspace, both the dormant section
(`rail-fold-dormant-*`) and the "N hiljaista" fold inside a live group
(`rail-fold-quiet-*`).

## Acceptance Criteria

- [x] With icons on, quiet conversations appear as ordinary rows (each with
      its icon) under the *Hiljaiset · yli tunnin* rule, not inside
      workspace folds; whether the quiet section itself folds as one is
      decided and recorded under Decisions for later review.
- [x] Without icons the current grouping stays as it is.
- [x] Browser spec for both; KOKEILTAVAA line.

## Comments
