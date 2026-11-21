---
created: 2026-11-16
updated: 2026-11-21
type: improvement
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-16/rail-scroll-region
lane: rail-scroll
lane_seq: 1
preparation: ready
---

# Rail scrolls as a whole, so the conversation sections scroll out of sight; the workspace section should scroll instead

## Description

Jari 16.11.2026 (staging installation, after a reboot): the rail looked as if every Sinun vuorosi / Käynnissä conversation had vanished, including the current one; only Hiljaiset and Työtilat (24) were visible. In fact the whole left rail had been scrolled down. The scrolling region is wrong: the conversation sections should stay in sight and the workspace section itself should be the part that scrolls, not the whole rail. Next action (Jari): prototypes of the rail in a crowded situation, many conversations in each section and many repositories.

## Decisions

### 2026-11-21T05:09:51Z · @jari

Jari 21.11.2026: direction 1 Työtilat; the edge chips telling that something is above / below (section name and count) are especially good. Go to implementation. Not answered explicitly, conductor takes the round's recommendations: Työtilat floor three rows in a crowd; Hiljaiset folds itself when the rail is crowded (record as Decisions for later review).
