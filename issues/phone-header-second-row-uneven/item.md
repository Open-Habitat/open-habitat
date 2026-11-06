---
created: 2026-11-02
updated: 2026-11-06
type: bug
reporter: jari
status: open
priority: high
lane: phone-layout-2
lane_seq: 1
preparation: ready
---

# Prototype: phone header second row as one consistent set

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

## Decision (Jari 2026-11-06)

Suunta **Alarivi** (`02`). Työpöytäratkaisuun ei kosketa. Tila näkyy
pelkkänä pisteenä. Seuraavaksi riffataan alarivin painikkeesta aukeavaa
valikkoa (kierros 4).

## Decision (Jari 2026-11-06, kierros 4)

**A Valikko**, mutta ilman tarpeettomia tekstejä siitä, mitä klikkaus tekee
(esim. "Näytä tiedot"): rivejä voi klikata. Malli jätetään rivistä pois
ennen ensimmäistä viestiä (kyllä). Seuraavaksi toteutus: puhelimen
yläpalkki yhdeksi riviksi Alarivi-suunnan (kierros 3, `02`) mukaan, tila
pelkkänä pisteenä, alarivin napautus avaa A-valikon; työpöytä ennallaan.
Toteuttaa seuraava sessio handoffin jälkeen.

## Acceptance Criteria

- [ ] The second header row is visually consistent (screenshots at DSF 2, phone 390/360 and desktop, light and dark) and carries no duplicate of the composer's model chip.
- [ ] Layout specs updated.

## Jari 2.11.: prototype first

Practically every UI change is prototyped first. This issue is now a
prototype round (one view: the conversation header's second row on phone
and desktop, three directions and a recommendation); implementation waits
for Jari's choice. The first run (`01m6eetncqnppee5prgdezk0xp`) was
cancelled before it changed product code.

## Decision (Jari 3.11.)

Direction 3, **one row**. The split between what is always visible and what
is in the ⋯ menu is not right yet (not by role); the next round prototypes
and riffs on that split: which items are always in the header, which go
into ⋯ and how ⋯ is grouped by role.

## Round 2 (3.11.)

`prototype-2/otsakkeen-jako.html` riffs on the split in three one-row
directions with ⋯ grouped by role; `result.md` has the item inventory, the
recommendation and the questions awaiting Jari's choice.

## Jari 3.11. on round 2: redo

Round 2 is to be redone. On the desktop the header shows the repository
name, Git, how much context is in use, the model name and the status (working,
waiting for you, …). All of these must remain available on a phone as well:
the phone must give the same information as the desktop in one way or
another (one row, but not by hiding these in ⋯). Round 3 riffs how the one
row carries all five on a phone.

## Round 3 (3.11.)

`prototype-3/otsakkeen-viisi.html` shows three ways the phone's one row
carries all five of the desktop's facts (workspace, Git, context, model,
status). `result.md` has the recommendation and the questions awaiting
Jari's choice.

## Round 4 (6.11.)

`prototype-4/alarivin-valikko.html` riffs what the chosen bottom row opens on
a phone, where it opens and how it closes: **A Valikko** (a menu under the
line), **B Alalaatikko** (the Git sheet carrying all five) and **C Omat
napit** (each part opens its own production place). `result.md` has the
recommendation and the questions awaiting Jari's choice.
