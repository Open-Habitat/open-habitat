---
created: 2026-10-03
updated: 2026-10-04
type: task
reporter: jari
status: in-progress
priority: high
related: ['@consistent-control-feedback', '@composer-footer-layout', '@latest-control-obscured']
lane: ui-foundation
lane_seq: 20
collision: [web/src/components/, web/src/app/App.tsx]
blocked_by: ['@unify-ui-primitives']
---

# Migrate bespoke controls and row layouts to primitives

## Why

Phase a2 of the path agreed with Jari on 3 October 2026
([investigation](../consistent-control-feedback/investigation.md)). After
@unify-ui-primitives the remaining hand-built controls and the row layouts
still produce the spacing defects Jari reported: the composer's Lähetä button
and the Enter hint are separate blocks in markup, the jump-to-latest control
is a sticky box with a negative margin that collides with the composer, and
every `Button` is wrapped in an `ah-control` span whose alignment differs from
neighbouring raw elements.

## Scope

- Migrate the remaining bespoke controls to the primitives: the Tiedot
  toggle, workspace disclosure chevron, tool-row opener, queue link, mobile
  toolbar and close, rail home row, read-only footer link, tabs.
- `ActionRow` (buttons and hint on one baseline, blocked-state reason on its
  own line) and `ListRow` (indicator | content | trailing) as shared layout
  primitives; the composer footer, return list, sidebar rows and settings rows
  use them.
- The jump-to-latest control becomes a floating variant placed by
  `ConversationFrame`, not a sticky hack.
- Closes @composer-footer-layout and @latest-control-obscured through the
  shared structure; verify both at the reported viewport and zoom.

## Acceptance Criteria

- [ ] No raw `<button>`, `<a>` or `AriaButton` remains outside the primitives directory; the source test from @unify-ui-primitives passes without exceptions.
- [ ] Lähetä and the Enter hint share one row; the jump control is fully visible above the composer; the completed-turn line has intentional spacing. Lab pairs in this issue folder.
- [ ] @composer-footer-layout and @latest-control-obscured are closed with reference to this issue; TESTING.md checks pass.
