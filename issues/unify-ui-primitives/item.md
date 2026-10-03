---
created: 2026-10-03
updated: 2026-10-03
type: task
reporter: jari
status: open
priority: high
related: ['@consistent-control-feedback']
lane: ui-foundation
lane_seq: 10
collision: [web/src/components/, web/src/app/App.tsx, design-system/]
---

# Unify UI controls into state-aware primitives

## Why

[The investigation](../consistent-control-feedback/investigation.md) of Jari's
2 October 2026 observations found that interaction states belong to no
primitive's contract: `.ah-button` has no hover, pressed or focus-visible rule,
React Aria's `data-hovered`/`data-pressed`/`data-focus-visible` attributes are
never referenced, hover feedback exists only in four view-specific selectors
added by three different slices, controls are built in three different ways
(the `Button` primitive, raw `AriaButton` with hand-written classes, plain
`<button>`/`<a>` with bespoke classes), and eight ancestor selectors still
restyle `.ah-button` from outside although @recut-ui-foundation reported that
removed. Nothing in the catalog or the gate checks states, so nothing stops the
drift. Jari agreed on 3 October 2026 to the recommended structure: keep React
Aria Components, no library change, and make consistency the default result of
building a view.

This is phase a1 of the agreed path a1 → a2 → b (@design-control-states) →
c (@apply-control-state-design) → d (@design-pi-event-blocks). No designer
input is used here; the next design round should see a correctly built
component hierarchy.

## Scope

- Primitives under `web/src/components/primitives/`, each a React Aria
  component with its own CSS Module: `Button` (variants, sizes, `fill`),
  `IconButton`, `LinkRow` (navigation and list rows; React Aria `Link` with
  `RouterProvider` for react-router), `MenuItem`, `Toggle` (disclosure-style
  openers), `Field`. Module-scoped class names so a view selector cannot reach
  them.
- One interaction recipe (`interactive.css`) keyed on React Aria's state
  attributes and `aria-current`, parameterised by custom properties
  (`--ah-i-bg`, `--ah-i-bg-hover`, `--ah-i-bg-pressed`, `--ah-i-fg`,
  `--ah-i-fg-hover`, focus ring). Variants set values; state selectors live
  only in the recipe. Hover and pressed colours are provisional, derived from
  the current palette (`--ah-surface-2`, `--ah-accent-soft`), and marked for
  the designer to confirm in @design-control-states.
- Replace the eight ancestor overrides of `.ah-button` with props or
  variants; remove the file-wide `biome-ignore-all noDescendingSpecificity`.
  The `Menu`, `Dialog` and `AlertDialog` triggers and close buttons use the
  primitives instead of raw `AriaButton`.
- Demonstrate on Jari's examples: sidebar agent rows and workspace rows, the
  Päivitä control as an icon button, the account trigger and menu items, the
  return view list, the composer actions.
- Gate: a browser test over the lab views asserting that every `button`,
  `a[href]`, `[role=menuitem]` and `[role=option]` is a primitive
  (`data-ah-primitive`) and changes at least one computed style on hover and on
  focus-visible, in both themes. A source test that fails on raw `<button>`,
  `<a>` or `react-aria-components` imports outside the primitives directory.
- Storybook: an interaction-states story (primitive × state × theme).
- Tests that use `.ah-*` selectors, the lab snapshot and the `App.tsx` focus
  return are updated with the migration. Role- and name-based tests stay.

Out of scope: the remaining bespoke controls and row layouts (@migrate-bespoke-controls),
designer colours (@design-control-states), status meaning (@refine-agent-status).

## Acceptance Criteria

- [ ] Every control in the lab views is a primitive and reacts to hover, pressed and focus-visible in both themes; the gate asserts this.
- [ ] No ancestor selector targets a primitive; the file-wide lint suppression is gone.
- [ ] Changing one recipe value (for example `--ah-i-bg-hover`) changes every use of that variant at once, shown with before/after measurements like the investigation's table.
- [ ] Storybook shows the state matrix; TESTING.md checks pass.
