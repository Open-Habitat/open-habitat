---
created: 2026-11-08
updated: 2026-11-08
type: task
reporter: jari
status: done
priority: normal
lane: explain-cards
lane_seq: 1
preparation: ready
closed: 2026-11-08
---

# Repository skill for writing Explain-mode cards with one consistent posture

## Description

Jari 8.11.2026: writing the ? view (Explain mode) cards should have its own
small repository skill built around a persona with a clear operating posture,
so every card is written the same way, tidily, by any worker. The rule that
every new control needs a card is in `web/AGENTS.md`; this skill is how the
card is written.

Write it with `/skill-creator` under `.pi/skills/explain-card/` (the
repository's skills live in `.pi/skills/`). It should carry:

- the persona and posture: a calm, plain-spoken guide who explains what the
  person sees and can do, never how it is implemented, in Jari's preferred
  short Finnish with the English counterparts; symbols named as the person
  sees them;
- the card shape actually used in `web/src/text/explainMode.ts` and how a
  part is found (`web/src/components/explainParts.ts`, test id or class, never
  position), read from the code rather than restated;
- what belongs in a card (what it is, what its states and marks mean, what a
  press does, where it leads) and what does not (internals, paths, file
  names), and standing rule text that would otherwise sit in a panel;
- checking: the catalog checks, the agent UI reference regeneration
  (`scripts/generate-ui-reference.py`), and looking at the card in the mode
  at 1440 and 390;
- a worked example from an existing good card.

Point `web/AGENTS.md`'s Explain-mode paragraph at the skill by name. Review
it with `/llm-skill-review`.

## Acceptance Criteria

- [x] `.pi/skills/explain-card/SKILL.md` exists, reviewed; `web/AGENTS.md` names it.
- [x] Used once to write the missing cards of `helpers-panel-explainer-text` (or that issue's worker uses it).
