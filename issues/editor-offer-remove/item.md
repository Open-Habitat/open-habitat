---
created: 2026-10-27
updated: 2026-10-27
type: improvement
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: kokeiltavaa:2026-10-26/editor-offer-remove
lane: offers
preparation: ready
---

# Remove the editor offer (Jari's decision)

## Description

Testihavainto, kirjattu KOKEILTAVAA.md:stä 2026-10-27:

Editoritarjous pois (0.0.0-pilot.421, 26.10.): keskustelun *Avaa editorissa* -kortti toimi, ja keskustelutta lähetetyt tarjoukset tulivat oikean alakulman kortteina, myös *Siirry työtilaan*. Jari ei pitänyt alakulman korteista ja päätti, että koko toiminnallisuus (`open-habitat agent editor offer`, kortit, agentin ohje) poistetaan: agentti kirjoittaa keskusteluun työtilan polun ja rivin (`web/src/components/BackgroundStrip.tsx:650`), joka jo avautuu editoriin (`habitat-seat-commands`, Jari).
