---
created: 2026-10-03
updated: 2026-10-03
type: task
reporter: jari
status: open
priority: high
related: ['@design-control-states']
lane: design-tooling
lane_seq: 10
collision: [web/lab/]
---

# Inventory UI states and capture them as fragments

## Purpose

The designer only sees what the design package shows. Today the package's
captures are chosen by hand per round, so states nobody remembered are missing,
and the designer's misunderstandings come from exactly those states. The
[design round](../../design-system/process.md) agreed with Jari on 3 October
2026 needs a versioned inventory of every view and state and one command that
captures all of them from the synthetic lab.

## Work

- A versioned state inventory under `web/lab/`: each view and state a person can
  reach, including error and uncertain states, phone and desktop, light and
  dark, with the lab route, fixture scenario and steps that produce it, and the
  DOM subtree that state concerns.
- One command that walks the inventory in the lab and saves each state as an
  offline HTML fragment (that subtree with its computed styles and fonts inlined
  so it opens alone and looks as in the app), plus a screenshot for human review,
  into an ignored output directory with an index recording the source commit.
  `web/lab/session.mjs` `snapshot()` and `shoot.mjs` are the starting point;
  full-page capture remains available for focus views.
- A gap report: inventory states without a draft in `design-system/drafts/`,
  and draft states without an inventory entry. A change report: commits touching
  `web/src` since a given commit, joined to the inventory states they affect.
- The `design-package` skill uses the inventory, fragments, gap and change
  reports instead of hand-picked captures, and its instructions carry the
  standing requirement that new UI work adds its states to the inventory.

## Acceptance Criteria

- [ ] The inventory covers every route and state the current lab can reach, and the capture command produces a fragment and screenshot for each in both themes and widths.
- [ ] Fragments open offline and match the app's rendering of that subtree; the index records the source commit.
- [ ] Gap and change reports are generated from the inventory and git history; the design-package skill consumes them.
