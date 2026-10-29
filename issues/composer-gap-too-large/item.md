---
created: 2026-10-29
updated: 2026-10-29
type: bug
reporter: jari
status: fixed
priority: normal
lane: ui-polish
lane_seq: 13
preparation: ready
closed: 2026-10-29
---

# Too much empty space between the last message and the composer

_Source: chat_

## Description

From KOKEILTAVAA.md (test server testing):

Keskustelun viimeisen viestin ja kirjoituskentän väliin jää liikaa tyhjää (Jari 29.10., pilot.511, työpöytä): kun vieritys on lopussa, viimeisen viestin ja kirjoituskentän väliin jää Jarin mielestä tarpeettoman paljon tyhjää tilaa. Sama väli näkyy myös agentin työn aikana: *Näytä työ › Agentti työskentelee · Vastaa · 0:14* -rivin ja kentän (*Ohjaa agenttia… · ⌥+Enter: työn jälkeen*) välissä on noin rivin korkuinen tyhjä alue (kuvakaappaus 29.10. 21.02). Vieritys itse toimi hyvin. Vertaa korjaukseen *Ei tyhjää tilaa live-rivin alla* (`conversation-scroll-overshoot-bounce`).
