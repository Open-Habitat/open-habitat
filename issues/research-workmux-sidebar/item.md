---
created: 2026-10-28
updated: 2026-10-29
type: task
reporter: jari
status: done
priority: normal
lane: research-workmux-sidebar
preparation: pending
provenance: chat
source_ref: chat:2026-10-28/research-workmux-sidebar
closed: 2026-10-29
---

# Research: how raine/workmux implements its sidebar, ideas for ours

Jari 2026-10-28: analysoidaan, miten raine/workmux-projektin (github.com/raine/workmux; Taskfleetin käyttämä työkalu) sivupalkki on toteutettu, ja otetaan siitä ajatuksia Open Habitatin omaan sivupalkkiin (työtilat, keskustelut, workerit, tila). Tutkimus lukee lähdekoodin ja dokumentaation, kuvaa rakenteen, tilat ja vuorovaikutuksen, vertaa nykyiseen sivupalkkiimme (web/src/components/Navigation.tsx ym.) ja listaa siirrettävät ideat perusteluineen. Ideat jalostetaan yhdeksi tai useammaksi prototyyppikierrokseksi (design-system/prototypes -menetelmä), jotka tuodaan Jarille; research ja prototyypit samassa ajossa tai prototyyppi omana issuenaan.

## Decisions

### 2026-10-28T17:37:22Z · @jari

Jari 2026-10-28: Ryhmät, mutta mahtuisiko worker tiiviisti yhdelle riville, kun pelkkä pallo kertoo tilan. Lopussa on tosi hyvä idea: riffataan sitä vielä kerran siten, että mietitään miten se näytetään keskustelussa, jossa käyttäjä on parhaillaan (kun on vastannut yhdelle agentille, seuraava odottava näkyy). Riffikierros 3: tiivis Ryhmät-rivi ja Lopussa aktiivisessa keskustelussa.

### 2026-10-29T09:47:08Z · @jari

Jari 29.10. on round 3: compact Ryhmät row shows Aika (time since the last change), implementation sidebar-group-row-time. The "next waiting conversation" row at the end of the conversation: Työssä, as an experimental feature behind an on/off switch in a new Kokeelliset ominaisuudet settings section (prototype proto-experimental-features), implementation next-waiting-row-experimental.
