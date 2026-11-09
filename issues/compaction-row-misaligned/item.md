---
created: 2026-11-09
updated: 2026-11-09
type: bug
reporter: jari
status: fixed
priority: normal
lane: unlaned
preparation: ready
closed: 2026-11-09
---

# Compaction progress row sits against the sidebar, not in the conversation column

## Description

Jari 9.11.2026, test server: the *Agentti tiivistää keskustelua* row shown in
the conversation while compacting (`compact-now-no-feedback`) has its left
edge flush against the left sidebar instead of on the line of the other feed
boxes; the notice that follows it (the compaction mark) is aligned correctly.
Same class as `restored-helpers-box-misaligned`: the row is mounted outside
the stream's horizontal margins. Fixing agreed behaviour; no prototype.

## Acceptance Criteria

- [x] The compaction progress row aligns with the column's other boxes at 1440 and 390.
- [x] A browser check of its left edge against a neighbouring box; touched specs green.
