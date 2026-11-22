---
created: 2026-11-22
updated: 2026-11-22
type: improvement
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-rail-space
lane: rail-space
lane_seq: 1
preparation: ready
---

# Prototype: the rail is cramped on a laptop screen — where should its fixed items go?

## Description

Jari (22.11.2026, from a laptop screenshot): on a smaller screen the rail is
cramped. The fixed top block (Etusivu, Tuotokset, the personal-browser card,
"Agentin käytössä") and the search box take roughly the top half of the rail,
so the conversation sections (Sinun vuorosi, Käynnissä) and the workspace list
get only a few rows each and scroll in tight separate boxes. He asks how the
space could be used better, and where each of these rail items could live
instead ("mihin ja minne näitä voisi laittaa").

Next action: a prototype round (one view: the rail at laptop height, e.g.
1440×800 and 1280×720 CSS px) showing distinct directions for relocating or
compacting the rail's fixed items so conversations and workspaces get the room.
Jari picks a direction; implementation waits for that.

## Decisions

### 2026-11-22T07:26:30Z · @jari

Jari 22.11.2026 on round 1: A Tiivis is the best, but better still if the rail adapts to the screen size. Small screen: the compact icon row of A. More room: the compact buttons first gain their labels as tiles (like C's tiles), and with ample room each gets its own row. On large screens Työtilat should also get more than its 3-row minimum when there is room. Round 2 prototypes this responsive rail.

### 2026-11-22T12:34:18Z · @jari

Jari 22.11.2026 on round 2: try C Suhteessa, refined with utility thresholds. Each list has a lower bound below which it is impractical and an upper bound beyond which more rows add little; the conversation list (Sinun vuorosi / Käynnissä / Hiljaiset, used far more) has different bounds than Työtilat. Example for Työtilat: with more than 6 workspaces a list under 6 rows is awkward, 10 rows is enough, beyond that scroll with visible up/down indicators. The conversation list needs a larger minimum (headers, the 'n above/below' chips). Allocation: first bring both lists to their working minimum; then to their 'enough' level; once both are there, grow the place buttons (icons → tiles → rows); when the buttons are at full size, grow both lists in a ratio. In effect a marginal-utility function per area, space going to the area with the largest marginal benefit at that height. From ui-structure round 2: height is the scarce resource and the rail may be wider.
