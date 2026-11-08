---
created: 2026-11-08
updated: 2026-11-08
type: task
reporter: jari
status: open
priority: normal
lane: view-versions
lane_seq: 1
preparation: ready
---

# Prototype: list of a conversation's views and files

## Description

Jari 8.11.2026: the views and files an agent offers in a conversation are hard
to find later; you scroll a long way up to see an old card. Before deciding
whether a new version updates the same card (`view-new-version-same-card`),
prototype a place where a conversation's assets (view offers and file offers)
are listed and easy to reach: what there is, newest first, opening one
without scrolling. Today the file panel already lists offered files; views
have no list.

Prototype round (`AGENTS-WORKFLOW.md`), one view: three directions (for
example a chip or header button with a count opening a list, a section in the
conversation's side panel shared with files, a rail-level row under the
conversation), 1440 and 390, light and dark.

## Decision (Jari 2026-11-08, kierros 1)

**1 Siru**, mutta riffataan sen paikkaa: olisiko siru parempi alhaalla
kirjoituskentän luona, siellä missä Workerit-siru ja muut taustatyön sirut
ovat. Kierros 2: siru alhaalla -riffit. Tarjouskorttien avautumispaikka
(`proto-offer-cards-consistent` kierros 2) sovitetaan tähän.
- [ ] round 2: riffs on the chip in the bottom strip beside Workers, view offer and questions for Jari
