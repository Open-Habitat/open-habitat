---
created: 2026-09-21
updated: 2026-09-21
type: task
status: deferred
priority: normal
epic: native-agent-host-architecture
blocked_by: ['@verify-v1-resilience']
---

# Refine agent status visibility

## Goal

Revisit the agent-list status treatment after the first functional desktop version is in use.

## Context

Jari accepted the initial compact status-dot treatment for the first functional MVP and suggested evaluating a whole-row background treatment for waiting and working states afterward.

## Scope

This is post-v1 visual refinement. Preserve text or another non-color signal so status is never communicated only by color or hover.

## Acceptance Criteria

- [ ] Evaluate the treatment against observed multi-agent use in the first functional version.
- [ ] Compare whole-row, label and other compact treatments in light and dark themes.
- [ ] Verify contrast, keyboard focus, reduced motion and non-color status communication.
- [ ] Record the selected treatment or close the issue if the existing presentation proves sufficient.
