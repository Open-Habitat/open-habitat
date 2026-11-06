---
created: 2026-11-06
updated: 2026-11-06
type: task
reporter: jari
status: done
priority: normal
related: ['@proto-raise-quiet-to-your-turn']
preparation: pending
provenance: chat
source_ref: chat:2026-11-06/proto-quiet-transition-triggers
lane: quiet-triggers-proto
lane_seq: 1
closed: 2026-11-06
---

# Prototype: triggers between Your turn and Quiet

## Description

Jari 6.11.2026: keskustelut menevät liian helposti *Hiljaiset*-osioon.
Kun hän käy keskustelussa eikä vastaa siihen heti vaan siirtyy
kiireesti pois, keskustelu tippuu Hiljaisiin. Hän haluaa ideoita:

a) millaisia laukaisijoita voisi olla siirtymälle *Sinun vuorosi* →
   *Hiljaiset*, ja
b) siirtymälle *Hiljaiset* → *Sinun vuorosi*.

Selvitä ensin, miten siirtymä nyt päätetään (daemon ja selain; lähellä
`proto-raise-quiet-to-your-turn` ja Sinun vuorosi -logiikka), ja tee
vaihtoehdot visuaalisiksi prototyypiksi, jos mahdollista (esim. aikaraja,
vastaamisen tai lukemisen määritelmä, avaamisen kesto, eksplisiittinen
*Ei nyt*, paluu agentin uudesta viestistä tai ajasta). Prototyyppikierros
AGENTS-WORKFLOW.md:n mukaan.

## Decision (Jari 2026-11-06, kierros 1)

Lähtökohta **A Vastaus**: pysyy Sinun vuorosi -ryhmässä, kunnes vastaat.
Mietitään, mihin painike sijoitetaan, joka pudottaa keskustelun Hiljaisiin
(Ei nyt). Kierros 2 riffaa painikkeen paikkaa.

## Decision (Jari 2026-11-06, kierros 2)

*Ei nyt* **kentän rivin keskipaikalla** (A), noston toisena tilana.
Seuraavaksi toteutus yhdessä noston kanssa (`raise-to-your-turn-button`):
Sinun vuorosi pysyy, kunnes vastaat tai painat *Ei nyt*.

## Acceptance Criteria

- [ ] nykyinen sääntö kuvattu; kierros 1: vähintään kolme suuntaa laukaisijoista molempiin suuntiin, näkymätarjous ja kysymykset Jarille
