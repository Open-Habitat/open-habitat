---
created: 2026-11-11
updated: 2026-11-11
type: feature
reporter: jari
status: done
priority: normal
related: ['@proto-turn-changes']
preparation: ready
lane: turn-changes
lane_seq: 1
closed: 2026-11-11
closed_by: claude
---

# What the agent changed in a turn (experimental)

## Description

Implement "what the agent changed in a turn" as Jari accepted it on
11.11.2026 in `proto-turn-changes` (round 2: Tiivis with the Aikajana button
on the collapsed line; the prototype is the specification:
`design-system/prototypes/rounds/2026-11-10-vuoron-muutokset-2/`).

- Behind an experimental feature (Settings › Kokeelliset ominaisuudet, own
  card), off by default.
- Under a finished turn's reply: one collapsed line *Muutokset · N tiedostoa
  +X −Y* with the timeline button; opening shows the file list in place
  (in the prototype it wrongly opened under the composer); a file row opens
  its whole change and *Avaa editorissa · rivi N*; the timeline replaces the
  list.
- Source: the turn's tool calls (edit/write diffs, files a command touched
  marked as such where known). The exact source from the rewind checkpoint
  and git is a later step.
- Finnish and English, desktop and phone, light and dark, a11y.

## Resolution

### 2026-11-11T08:15:00Z · @claude

Implemented behind the experimental feature turn-changes; result.md lists the evidence and Decisions for later review.
