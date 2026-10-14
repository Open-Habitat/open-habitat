---
created: 2026-10-14
updated: 2026-10-14
type: bug
reporter: jari
status: open
priority: normal
lane: web
lane_seq: 26
collision: [web/]
---

# Open tool card flickers while later blocks stream

Jari, pilot.59 (2026-10-14): when a tool card (e.g. `write`) is expanded and the agent keeps working so that new blocks arrive, the open card flickers, as if it were being re-rendered or remounted on every update.

Find the cause with React profiling or a lab test (a changing key, a remount of the turn list, a re-created highlighted/diff body, or a layout shift from the follow-scroll) and fix it so that an existing card's DOM stays stable while later blocks append.

## Acceptance Criteria

- [ ] A lab test opens a write/edit card and streams further blocks. The open card's DOM node identity is preserved and its expanded state and scroll position stay put.
- [ ] No visible flicker in a lab recording of the same scenario. Note the method in result.md.
