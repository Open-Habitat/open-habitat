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

# Tiivistä nyt shows nothing: no progress while compacting and no notice when done

## Description

Jari 8.11.2026 20:40, test server pilot.657, conversation
`pi:be649ddf-7886-4cf5-8fe0-cfcf37720401`: he chose *Tiivistä nyt…* from the
conversation's top context menu (`web/src/text/contextView.ts` `compact`,
daemon `internal/daemon/compaction_linux.go`) and nothing visible happened —
no progress indication while compacting, and no notice in the conversation
when it finished. He cannot tell whether it ran at all.

First establish whether compaction actually ran (daemon journal
`compaction` lines, Pi's session file gaining a compaction entry), then make
it visible: an in-progress state where the person pressed it and in the
conversation (as Pi's own compaction shows in a terminal), and a completion
(or failure with its reason) marker in the conversation history. If a
dialog follows the ellipsis and it never appeared, that is the defect.
Fixing agreed behaviour; no prototype unless a new surface is needed.

## Acceptance Criteria

- [ ] Pressing Tiivistä nyt shows progress at once; the conversation shows a compaction marker when done, or a failure with its reason; fi and en.
- [ ] Test reproducing the silent path; touched specs green.
