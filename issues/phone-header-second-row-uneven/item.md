---
created: 2026-11-02
updated: 2026-11-02
type: bug
reporter: jari
status: open
priority: high
lane: phone-layout-2
lane_seq: 1
preparation: ready
---

# Phone header: second-row controls look scattered and mismatched

## Description

Jari 2.11. (iPhone, Brave, new conversation): the conversation header's
second row looks like controls dropped in at random. The status dot,
worktree/"↑ 1" and the model name "Opus 5.5" are plain text with uneven
gaps, while the next two controls (the recap/list button and the
"H↻" button) sit in large outlined boxes of a different size and style; the
row does not read as one set. The model is also shown twice: in the header
row and in the composer's "Opus 5.5 · Medium" chip.

Make the row one consistent set (same control height, style and spacing,
aligned to the first row's icons), decide what belongs there on a phone
(drop the duplicate model if the composer chip carries it), and check the
same row on desktop and at 390/360 px. Follows `phone-header-too-tall`
(the earlier fix of the five-layer header): keep its height gains.

Also in the same screenshot: the empty new conversation says "Luo
aloitussivu kirjoittamalla viestikenttään /open-habitat-start-page." —
the `ui-text-no-internals` rule applies (plain invitation, no command name);
leave that text to that issue's worker if it has already changed it.

## Acceptance Criteria

- [ ] The second header row is visually consistent (screenshots at DSF 2, phone 390/360 and desktop, light and dark) and carries no duplicate of the composer's model chip.
- [ ] Layout specs updated.
