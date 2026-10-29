---
created: 2026-10-28
updated: 2026-10-29
type: task
reporter: jari
status: done
priority: normal
lane: proto-recap-settings
preparation: pending
provenance: chat
source_ref: chat:2026-10-28/proto-recap-settings
closed: 2026-10-29
---

# Prototype: a settings section for the conversation recap

Jari 2026-10-28: tilannekatsaukselle (kortti, joka ilmestyy keskusteluun kolmen minuutin hiljaisuuden jälkeen) voisi olla oma kohta asetuksissa. Prototyyppikierros (design-system/prototypes -menetelmä: 2–3 suuntaa yhdellä akselilla, tuotantokonteksti Asetukset, työpöytä ja puhelin, vaalea ja tumma, synteettinen data, yksi offline-tiedosto): mitä henkilö voi säätää (päällä/pois, viive, malli: nykyinen käytäntö Sonnet/Luna keskiluokka eikä koskaan Fable/Opus, recap-model-spends-fable), missä kohdassa asetuksia, ja miten säätö näkyy keskustelussa. Kirjaa result.md:hen host-faktat (internal/daemon/recap-extension.mjs, background-model.mjs). Jari valitsee; toteutus on myöhempi issue.

## Decisions

### 2026-10-28T17:37:22Z · @jari

Jari 2026-10-28: tilannekatsaukselle oma osio asetuksissa. Teksti 'Lasketaan viimeisestä viestistä ... pisin viive on 5 min' on väärin ja tarpeeton, pois. Viive säädettävä vapaasti (ei kiinteät 1/3/5 min). Osioon myös katsauksen pituusparametrit: tokenimäärät ja viestimäärät. Mallivalitsin samanlainen kuin muualla, mieluiten yhteinen mallinvalinnan standardikomponentti. Riffikierros 2.

### 2026-10-29T09:47:08Z · @jari

Jari 29.10. on round 2: Tasot is very good, take it. Changes: the delay scale should be closer to logarithmic so different users find sensible times (short and long). "Kun pyydän" becomes an always-present button at the top (conversation header), not a mode. Automatic stays always on, because the home page does not work properly without recaps, so the mode setting goes away (no Ei koskaan). Implementation: recap-settings-levels.
