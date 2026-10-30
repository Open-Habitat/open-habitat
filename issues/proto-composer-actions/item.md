---
created: 2026-10-30
updated: 2026-10-30
type: feature
reporter: jari
status: done
priority: normal
lane: proto-composer-actions
lane_seq: 1
preparation: pending
closed: 2026-10-30
---

# Prototype: composer action row order and look

## Description

## Description

Jari 2026-10-30 06.12, Birch (pilot.15), työpöytä, tumma teema, agentti
työssä; kuvakaappaus `attachments/birch-2026-10-30-0612.png` (DSF 2). Kentän
alla oleva painikerivi: vasemmalla *Liitä · / Komennot · @ Tiedosto*,
oikealla *Sanele · ↳ Ohjaa ⇄ · ■ (pysäytä) · ↑ (lähetä)*.

- **Sanele pomppii**: painike siirtyy, kun agentti alkaa tai lopettaa
  työskentelyn (oikean reunan painikkeiden määrä tai leveys vaihtuu).
- **Epäjohdonmukainen ilme**: *Liitä*-painikkeella on täytetty tausta,
  *Komennoilla* ja *Tiedostolla* ei. *Ohjaa* on ääriviivallinen pilleri ja
  erottuu muista. Jarista erottuvuus on itse asiassa aika kiva, mutta
  painikkeiden järjestys ja ilme kannattaa prototyypata ja hakea erilaisia
  käytettävyyden suuntia.

Yksi näkymä: keskustelun kirjoituskentän toimintorivi levossa ja agentin
työn aikana (työpöytä ja puhelin, vaalea ja tumma).

## Acceptance Criteria

- [ ] 2–3 suuntaa, joissa rivin painikkeet eivät hyppää tilasta toiseen.
- [ ] NOTES.md Jarille ja result.md suosituksineen; tuotantokoodi ennallaan.

## Decisions

### 2026-10-30T08:40:08Z · @jari

Jari 30.10.: kierros 2:sta Palkki. Hyvä, että palkki peittää muut painikkeet, joita ei pidä käyttää sanelun aikana. Toteutus: composer-dictation-bar.
