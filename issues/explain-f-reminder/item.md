---
created: 2026-11-22
updated: 2026-11-22
type: improvement
reporter: jari
status: testing
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-explain-f-reminder
lane: explain-reminder
lane_seq: 1
preparation: ready
---

# Prototype: how Explain mode tells that F reports a mistake

## Description

Jari 22.11.2026: riff how the 'press F to report' reminder is shown with the following
Explain card (A Vieressä): on every card it may be too much; alternatives such as only in the mode's bar.
Next action: a prototype round.

## Decisions

### 2026-11-22T15:27:54Z · @jari

Jari 22.11.2026 on round 1: A — the F hint only in the Explain mode bar, never on the card; riff its position in the bar (round 2). Clicking the bar hint must not open a report for the last pointed part (the whole top edge is full of hotspots, too hard); clicking may open a generic feedback report instead. (Question 4, 'three cards', applied only to direction B and is moot.)
