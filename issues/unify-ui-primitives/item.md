---
created: 2026-10-03
updated: 2026-10-03
type: task
reporter: jari
status: in-progress
priority: high
related: ['@consistent-control-feedback']
lane: ui-foundation
lane_seq: 10
collision: [web/src/components/, web/src/app/App.tsx, design-system/, web/src/app/]
---

# Unify UI controls into state-aware primitives

## Purpose

Buttons, menus and navigation rows give uneven feedback because each view
supplies its own interaction styles. The
[investigation](../consistent-control-feedback/investigation.md) traces this to
missing states in the shared components and view styles that override them.
A new view should inherit consistent feedback by using the shared controls.

Jari approved keeping React Aria Components on 3 October 2026. Build the shared
controls on that foundation, with their own CSS Modules and a common interaction
style recipe. Components own their appearance and state feedback; views choose
variants and arrange them. This lets a shared change reach every use without
repairing each view separately.

## Work

Provide shared buttons, icon buttons, navigation and list links, menu items,
disclosure controls and fields. Use the interaction state supplied by React
Aria to show hover, pressed, keyboard focus, selection or current location,
disabled and pending states where they apply. Keep the controls' native meaning,
keyboard behavior and focus handling when composing them into menus and dialogs.
Component APIs and the organisation of the common styles are implementation
choices; the investigation provides a starting point.

Move existing shared buttons, menu and dialog triggers and close buttons onto
this foundation. Replace view-level button style overrides with supported
variants or layout in the containing view, and remove the file-wide specificity
lint suppression that accompanied those overrides. CSS Modules give styles
local names; the ownership rule also applies to selectors that could still
reach a control through its element type or an ancestor.

Demonstrate the foundation on the sidebar agent and workspace rows, Päivitä as
an icon button, the account trigger and menu, the return-view list and composer
actions. Use provisional values from the existing palette for missing states
and identify them in the catalog for @design-control-states. That design round
supplies the finished appearance.

Show the shared controls and their relevant states in Storybook in both themes.
Automated browser checks should catch missing interaction feedback, and source
checks should catch controls bypassing the shared foundation. Check meaningful
state feedback and keyboard focus according to each control's behavior: a
change in any computed style alone is weak evidence, and disabled controls do
not have the same interaction behavior as enabled ones. A shared style change
should be demonstrably reflected across its uses.

## Work boundary

This issue establishes the foundation and migrates the examples above.
@migrate-bespoke-controls completes the remaining controls and shared row
layouts, including the composer and jump-to-latest layout repairs. The checks
introduced here cover the migrated surface and expand to the whole UI in that
issue; completing this first step does not require the second step's migration.
Agent-state meaning belongs to @refine-agent-status, and the finished interaction
styles are designed in @design-control-states and applied in
@apply-control-state-design.

## Acceptance Criteria

- [x] The shared controls and migrated examples show consistent, appropriate interaction feedback in both themes, including visible keyboard focus.
- [x] Migrated controls own their styles; view-level button overrides and the file-wide specificity suppression are removed.
- [x] A change to the common style recipe reaches its uses across views; Storybook and automated checks demonstrate the states and catch regressions on the migrated surface.
- [x] The provisional design values and the controls remaining for @migrate-bespoke-controls are identifiable for the next work.
