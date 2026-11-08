---
created: 2026-11-08
updated: 2026-11-08
type: task
reporter: jari
status: open
priority: normal
lane: archive-proto
lane_seq: 1
preparation: ready
---

# Design and prototype: the workspace's conversation archive from scratch

## Description

Jari 8.11.2026, test server pilot.657, the workspace front page's *Arkisto*
section (screenshot `evidence/`): ugly and not working — a pile of
underlined title links each with a large *Palauta näkyviin* button, buttons
overlapping each other, archived helpers' status blocks (*testiavustaja ·
Avustaja · 1 kierros · odottaa pääagenttia · Yhdistämistä ei ole
vahvistettu · Avaa haara*) mixed in between conversations, no dates, no
order, no way to find anything. Jari wants this part of the interface
prototyped again from the beginning so it is tidy and meets real needs.

Prototype round per `AGENTS-WORKFLOW.md`. Start from what a person does with
archived conversations (find one again by title, content, date or what it
produced; look at it read-only; restore it; know whether its helpers or
workers left anything; clean up), and from the facts the host has for them
(native Pi history, titles, dates, recap, helper/worker runs,
`archive-idle-helpers-silent`, `helpers-across-conversations`). Where the
archive lives (front page section, its own view, the rail) is part of the
design. Three directions, 1440 and 390, light and dark, built from
realistic rows like Jari's.

## Acceptance Criteria

- [ ] Prototype round 1 with view offer, directions and questions for Jari.
