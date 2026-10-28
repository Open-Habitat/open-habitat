---
created: 2026-10-28
updated: 2026-10-28
type: bug
reporter: conductor
status: open
priority: normal
preparation: ready
provenance: chat
source_ref: suite:2026-10-28/r30/lab-conversation
lane: gate-health
lane_seq: 99
---

# Lab spec clicks the header workspace link that the one-row header now folds into the menu

## Description

Lab suite on main 08ba2b28 (28.10. r30): tests/lab-conversation.spec.ts:500 'real controller creates and persists a fake-Pi turn' fails 3/3 alone: locator('main').getByTestId('conversation-workspace').click() waits for a hidden element (line 517). conversation-header-shorten (212f8f02) hides the workspace link first when the row runs out of space and moves it to the ⋯ menu. Fix the spec to reach the workspace the way a person now does (menu row or the sidebar), and check other specs for the same pattern. Confirm the product side: the workspace stays reachable from the menu at that width.
