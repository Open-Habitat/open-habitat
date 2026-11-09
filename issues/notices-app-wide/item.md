---
created: 2026-11-09
updated: 2026-11-09
type: improvement
reporter: jari
status: done
priority: normal
lane: notices
lane_seq: 3
blocked_by: ['@notices-composer-stack']
preparation: ready
closed: 2026-11-09
---

# Notices as one system: the rest of the app (connection, archive, page boxes, timers) on the shared warning

## Description

Second step of `proto-notices-one-system` (Jari 9.11.2026, direction A):
after `notices-composer-stack`, move the rest of the app's notices onto the
same four kinds of the shared warning, per the round's inventory
(`issues/proto-notices-one-system/result.md`, *Muualla sovelluksessa*):
`ConnectionBanner`, `ArchiveNotice` (no timer on errors), the page boxes in
`App.tsx`, and the toasts that report errors. Toasts remain only for
acknowledgements (*Kopioitu*). Settings form field errors are out of scope
(a separate unification). No experimental flag; no new host data.

## Acceptance Criteria

- [x] Each listed surface uses the shared warning with one of the four kinds; no error expires on a timer.
- [x] Touched specs and fast web checks green; screenshots of each surface before/after in the issue.
