---
created: 2026-11-08
updated: 2026-11-08
type: task
reporter: jari
status: done
priority: normal
lane: at-file-list-proto
lane_seq: 1
preparation: pending
closed: 2026-11-08
---

# Prototype: typed @ opens the same file list as the file button

## Description

Jari 8.11.2026, test server: typing `@` and pressing the file button open a
slightly different file chooser, which feels odd to him; perhaps `@` should
open the same list as the button. Today, with *lists inside the field* on,
both open `FieldList` in the field, but the button's list has its own search
box that takes focus (`searchInput={open.place === "button"}` in
`web/src/components/composer/Composer.tsx`), while after a typed `@` the
characters typed in the message filter the list; check what else differs
(tree vs list mode, preview, which tab opens first) and with the feature off.

Prototype round (`AGENTS-WORKFLOW.md`), one view: today's two openings side by
side, then three directions, for example `@` opens exactly the button's list
and moves typing into its search box (the `@` stays in the text); the button
opens the typed-`@` form (writes `@` into the field and filters from there);
one shared list whose search lives in the field for both. Show what happens to
text typed after `@`, Esc, and choosing a file, 1440 and 390, light and dark.

## Acceptance Criteria

- [ ] round 1: today, three directions, view offer and questions for Jari

## Decision (Jari 2026-11-08, kierros 1)

**Yhteinen**: the file button writes `@` into the text and both openings give
the same list, with the button list's search line and keys; the search is the
`@` word in the text. Question 2 by recommendation (conductor): Tab marks, as
in the button list today. Question 3 does not apply. Implementation:
`at-file-list-shared`.
