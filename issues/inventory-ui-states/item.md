---
created: 2026-10-03
updated: 2026-10-03
type: task
reporter: jari
status: in-progress
priority: high
related: ['@design-control-states']
lane: design-tooling
lane_seq: 10
collision: [web/lab/]
---

# Inventory UI states and capture them as fragments

## Purpose

The designer only sees what the design package shows. Hand-picked captures
leave out states, and those omissions lead to designs based on an incomplete
picture of the product. The [design round](../../design-system/process.md)
needs a maintained inventory of the UI and repeatable captures from the
synthetic lab.

## Work

Keep the inventory under `web/lab/`. It describes the application's views and
user-visible states, including errors, uncertainty and relevant control states,
with desktop and phone presentations in both themes. Each entry connects the
state to the route, fixture and interactions that reproduce it, the region to
capture and its corresponding draft, where one exists. A state missing from
the lab remains visible as a coverage gap; the lab's current fixtures do not
define the extent of the product.

One command captures the inventory's reproducible states as offline HTML
fragments and matching screenshots. A fragment preserves the region's rendered
appearance, including the styles, fonts and layout context it needs to stand
alone. Full-page capture serves the round's focus views. `snapshot()` in
`web/lab/session.mjs` and `web/lab/shoot.mjs` provide the existing full-page
capture foundation; the fragment mechanism is an implementation choice.
Generated captures go in ignored output with an index identifying the source
commit and the states captured or missing.

The package shows gaps in both directions: implemented states without a draft
and draft states without an implemented counterpart. It also shows what changed
since the previous package's commit, connected to affected states and captures.
Git history supplies changed files; the inventory supplies their UI context.
Changes that cannot be mapped remain visible for the package author to resolve.
Shared tokens and other rendering inputs matter alongside `web/src` changes.

Integrate these outputs into the `design-package` skill and its assembler.
The assembler runs in its own worktree, reads the previous package's commit
from `design-system/rounds.md`, reconciles the inventory with the current code
(routes, stories, lab fixture scenarios) before capturing, and records the new
commit in `rounds.md` and the round's issue. The inventory is maintained by the
package assembler at that moment, not by each developer; Jari decided on
3 October 2026 that nothing checks it in the gate. The landmark comparison
belongs to @compare-draft-fidelity.

## Acceptance Criteria

- [ ] The inventory accounts for current application views and relevant states, including gaps in lab coverage, with desktop and phone presentations in both themes.
- [ ] One command captures every reproducible inventory state as offline HTML and a matching screenshot; the index records the source commit and any states it could not capture.
- [ ] Fragments retain the app's appearance when opened offline, and full-page captures remain available for focus views.
- [ ] The design package consumes the inventory, captures, draft gaps and changes since the previous package, with unresolved mappings visible.
