---
created: 2026-10-30
updated: 2026-10-30
type: feature
reporter: jari
status: open
priority: normal
lane: composer-row
lane_seq: 1
preparation: ready
---

# Composer row: dictation as a listening bar (Palkki)

## Description


## Description

Jari 30.10. valitsi `proto-composer-actions`-kierroksen 2 suunnan **Palkki**
(`issues/proto-composer-actions/prototypes/toimintorivi-riff/`, result.md,
kierros 2): järjestys kierroksen 1 Ankkuroitu (apuvälineet | tyhjä |
Ohjaa, Stop, jakaja | Sanele, Lähetä); painettaessa rivin vasen osa muuttuu
kuuntelupalkiksi (×, piste, aika, teksti, aaltomuoto, "Enter valmis"), joka
peittää muut painikkeet, ja Saneleen paikka muuttuu Valmiiksi. Jaria
miellyttää, että palkki peittää painikkeet, joita ei pidä käyttää sanelun
aikana. Rivin painikkeet eivät hyppää levon, työn ja sanelun välillä.

## Acceptance Criteria

- [ ] Palkki prototyypin mukaan työpöydällä ja puhelimella, vaalea ja tumma,
      × peruu sanelun (kenttä palaa ennalleen); kierroksen 1 puhelinviat
      (28 px korkeus, Sanele Lähetä-painikkeen alla, Valmis Ohjaa-sirun päällä)
      korjattu.
- [ ] Kokeellisen ominaisuuden takana; selainspec; KOKEILTAVAA-rivi.
