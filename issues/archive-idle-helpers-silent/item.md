---
created: 2026-11-08
updated: 2026-11-08
type: bug
reporter: jari
status: open
priority: normal
lane: unlaned
preparation: ready
---

# Archiving a conversation with idle helpers shows no helper notice

## Description

Jari 8.11.2026: when a conversation whose helpers are not running (grey, idle
between rounds) is archived, nothing about the helpers should be said; it
simply goes to the archive with them. The helper part of the archive notice
(`web/src/text/archiveNotice.ts`, `web/src/components/ArchiveNotice.tsx`,
`web/src/app/helpersArchive.ts`) was meant only for the case where a helper
is busy in a round at the moment of archiving. Today it always adds
*Avustajat arkistoitiin mukana …* and, for idle helpers, the unlanded and
unconfirmed-landing lines. Keep only the busy-round line (`helpersWorking`);
an idle helper's unlanded work stays safe on its branch and returns with the
conversation, so it needs no notice. Fixing agreed behaviour; no prototype.

## Acceptance Criteria

- [ ] Archiving with only idle helpers shows the ordinary archive notice with no helper lines; with a helper mid-round, one line says so; fi and en.
- [ ] Touched specs green.
