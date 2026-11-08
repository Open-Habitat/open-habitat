---
created: 2026-11-08
updated: 2026-11-08
type: task
reporter: jari
status: done
priority: normal
lane: explain-cards
lane_seq: 3
blocked_by: ['@helpers-panel-explainer-text']
preparation: ready
closed: 2026-11-08
---

# Audit and complete Explain-mode coverage across the whole interface

## Description

Jari 8.11.2026, test server: Explain mode has large gaps. On a repository's
(workspace's) front page almost nothing was explained, though there would be
plenty to explain. Jari wants its own piece of work that first carefully
inventories everything the interface contains and what is explained, then
completes the coverage: in general every own chip or component should have an
explanation.

1. Inventory: every view (home, workspace front page, conversation, worker
   and helper views, settings sections, sign-in and error pages, dialogs and
   panels) at 1440 and 390, every control, chip, strip, row type and status
   mark, against the cards in `web/src/text/explainMode.ts` and parts in
   `web/src/components/explainParts.ts`. A table in `result.md`: view,
   element, card yes/no, decision (card, deliberately none and why).
2. Write the missing cards with `.pi/skills/explain-card/SKILL.md`, fi and en,
   and regenerate the agent UI reference.
3. A check that keeps coverage from regressing where practical (for example a
   test that lists the interactive test ids of a view and fails on an
   unexplained one, with an explicit allow-list).

## Acceptance Criteria

- [x] Inventory table in result.md covering every view.
- [x] Every chip, component and control has a card or a recorded reason for none; fi and en.
- [x] Regression check in place; touched specs green; screenshots of the mode on the workspace front page at 1440 and 390.
