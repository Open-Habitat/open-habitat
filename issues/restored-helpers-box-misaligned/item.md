---
created: 2026-11-08
updated: 2026-11-08
type: bug
reporter: jari
status: fixed
priority: normal
lane: unlaned
preparation: ready
closed: 2026-11-08
---

# Restored-from-archive helpers box sits against the sidebar, not in the conversation column

## Description

Jari 8.11.2026, test server: after restoring a conversation from the archive,
the box *Palautettu arkistosta · avustajat palasivat käynnistämättä* with its
helper rows (`web/src/components/HelperArchive.tsx`,
`web/src/app/HelperArchiveFlow.tsx`) has its left edge flush against the left
sidebar instead of on the same line as every other box in the conversation
column. Screenshot `evidence/`. It should be placed in (and width-capped by)
the conversation column like the other feed boxes and notices, at 1440 and
390. Fixing agreed behaviour; no prototype.

## Acceptance Criteria

- [x] The restored-helpers box aligns with the conversation column's other boxes at 1440 and 390.
- [x] Touched specs green; a check of its left edge against a neighbouring box.
