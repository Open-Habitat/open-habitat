---
created: 2026-11-03
updated: 2026-11-06
type: task
reporter: jari
status: open
priority: normal
lane: composer-popover-proto
lane_seq: 1
preparation: pending
---

# Prototype: where the composer's attach, command and file pickers open

## Description

Jari 3.11.: the composer's buttons (*Liitä*, *Komennot* `/`, *Tiedosto* `@`) open their list above the whole text field. When the field already holds more text and has grown tall, the button (at the bottom of the field) and the list that opens (above the top of the field) are far apart, which is disturbing. Riff how the list opens: anchored to its button (and then over the field, so writing pauses while it is open?), anchored above the field as today but nearer, inline inside the field, or another way; what happens to typing, focus, the caret and Esc in each; how it looks with a short and with a tall draft, on phone and desktop. Today first, then three directions visibly different on the default view, one line each at the top.

## Decision (Jari 2026-11-06)

Kierros 3 riffaa näillä:

- *Välilehdet*-suunnan esikatselu on tosi kiva: mukaan.
- *Muutetut* on kiva, mutta sen ei tarvitse olla oma välilehti, koska se
  on tiedoston tila. Näytetään se suoraan listassa jotenkin muuten.
- Kansiopuu on hyvä tiedostojen selaamiseen.

## Decision (Jari 2026-11-06, kierros 3)

Suunta **Puu**. Riffataan haku: miten käsitellään esimerkiksi `AGENTS.md`,
joka on monessa kansiossa (kierros 4).

## Acceptance Criteria

- [ ] A prototype round with today and three directions (short and tall draft, phone and desktop), a recommendation and at most three questions.

## Jari 3.11. on round 1

**Kentän sisällä** looks good. Round 2 riffs how it works in detail: the
file list (`@`) and the commands (`/`) must keep all of today's functionality
(search, folders, keyboard, selecting several, what is inserted), and no
intermediate dialog with a single button anywhere (today's flows that open a
one-button dialog before the real thing are wrong and go away).
