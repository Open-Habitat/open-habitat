---
created: 2026-09-21
updated: 2026-09-22
type: task
status: open
priority: normal
epic: native-agent-host-architecture
blocked_by: ['@review-mvp']
lane: post-mvp-design
lane_seq: 60
collision: [docs/, design-system/]
---

# Refine agent status visibility

## Goal

Revisit the agent-list status treatment after the first functional desktop version is in use.

## Context

Jari accepted the initial compact status-dot treatment for the first functional MVP and scheduled this as post-MVP design work. Begin by designing and reviewing the status treatment against observed use; do not treat the earlier whole-row suggestion as an implementation decision.

## Scope

This is post-v1 visual refinement. Preserve text or another non-color signal so status is never communicated only by color or hover.

## Acceptance Criteria

- [ ] Produce and review a concrete visual/interaction design before any implementation issue is activated.
- [ ] Evaluate the treatment against observed multi-agent use in the first functional version.
- [ ] Compare whole-row, label and other compact treatments in light and dark themes.
- [ ] Verify contrast, keyboard focus, reduced motion and non-color status communication.
- [ ] Record the selected treatment or close the issue if the existing presentation proves sufficient.
