---
created: 2026-11-08
updated: 2026-11-08
type: task
reporter: jari
status: open
priority: normal
lane: shares-proto
lane_seq: 1
preparation: pending
---

# Design and prototype: an own place for shared views and files

## Description

Jari 8.11.2026, test server pilot.657 (screenshot `evidence/`): the shares —
views and files with their own address, public or private (*Näkymien ja
tiedostojen osoitteet*) — sit as a cramped block on Settings' *Tili* page,
beside sign-out and the Git identity. They deserve their own, more sensible
place: perhaps their own Settings section, perhaps the home page (alkulehti),
listing what has been shared and what was shared before. The rows should
have well-designed buttons (open, copy link, make public/private with its
duration, delete), and a preview of each share.

Prototype round per `AGENTS-WORKFLOW.md`: where shares live and what that
view looks like. Directions should differ in place (own Settings section vs
home page vs another sensible spot) and in how a row presents itself
(preview thumbnail, kind, public/private state and expiry, conversation it
came from, actions). Include past (expired, made private, deleted-address)
shares. 1440 and 390, light and dark, built from realistic rows like Jari's
(*Testikierros 7.11. – tilanne* public until 7.12.2026, *Myyntitaulukko
(testi)*, *Testinäkymä – tarjouskortit*, *Testiraportti /var/tmp:stä*, plus
file, image and folder offers now that `public-file-offers` landed).

## Acceptance Criteria

- [ ] Prototype round 1 with view offer, directions and questions for Jari.
