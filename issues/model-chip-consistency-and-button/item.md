---
created: 2026-10-23
updated: 2026-10-23
type: bug
reporter: jari
status: open
priority: normal
preparation: ready
lane: conversation-header
lane_seq: 3
collision: [web/src/components/conversation-header]
---

# Model chip: same design in composer and header; Valitse visible as a button

## Description

Jari 2026-10-23 14:05 after `model-picker-declutter`: the model chip/"tablet" in the conversation's lower area (composer) should have the same look and text as the one in the header — the header one is designed better; use one component for both. The "Valitse" button is still white on a light background and only looks like a button on hover: give it the standard primary button styling in its resting state (check tokens in light and dark).

## Acceptance Criteria

- [ ] One model chip component with the header's design in both places; Valitse is a visible primary button without hover; screenshots light/dark, desktop/390 px; browser test.
