---
created: 2026-11-03
updated: 2026-11-03
type: task
reporter: jari
status: open
priority: normal
lane: explain-mode
lane_seq: 0
preparation: ready
---

# Prototype: explain mode in detail, on the real views (round 6)

## Description

Jari 3.11.: where did the explain mode go? Status: Jari chose round 5's riff
1 (*Himmennys ja kortti osoittimessa*, whole screen, no shortcut) on 1.11.
and `explain-mode` was filed ready, but it was never started; nothing of it
is built. Before building, Jari wants a more precise prototype round.

Round 6 takes riff 1 further, on the real current views (built from the
production components, after the latest header and composer changes), not a
mock: how the mode is entered (the start page strip *Selitä nämä mulle*, ⋯ ›
*Selitä tämä näkymä*, and where it is found once the strip is gone), every
area it explains (header, rail, composer and its lists, panels, terminal,
editor, settings), what each card says (texts from the same source as the
agent's UI reference, both languages), pinning and *Kokeile*, phone (tap),
and how it ends. Three directions on the details that remain open, one line
each at the top, plus the recommendation; interactive.

## Acceptance Criteria

- [ ] A prototype round on the real views with three directions, phone and desktop, a recommendation and at most three questions.
