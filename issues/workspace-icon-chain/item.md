---
created: 2026-10-30
updated: 2026-10-30
type: feature
reporter: jari
status: open
priority: normal
lane: workspace-icons
lane_seq: 1
preparation: ready
---

# Workspace icons in the rail from the repo's own Open Habitat config (Lähdeketju)

## Description


## Description

Jari 30.10. valitsi `proto-workspace-icons`-prototyypistä **Lähdeketjun**
(`issues/proto-workspace-icons/prototypes/tyotilan-kuvake/`, result.md):
sivupalkki näyttää työtilan kuvakkeen keskustelun edessä ja *Käynnissä*-osion
toistuva työtilan otsikko poistuu. Muutos Jarin päätöksellä: kuvake luetaan
**repon omasta Open Habitat -konffista**, ei `.workmux.yaml`:sta eikä
git-excludatusta `.agent-host/workspace.json`:sta. Ketju: konffin kuvake →
repon logo → nimestä johdettu tunnus. Asettaminen repon etusivulla
prototyypataan erikseen (`proto-workspace-icon-setting`); tämä issue tekee
lukemisen ja näyttämisen.

## Acceptance Criteria

- [ ] Repon juureen commitoitava Open Habitat -konffi (oletus `.open-habitat.json`,
      kenttä `icon`), luetaan daemonin työtilalistaukseen; ei uutta tietovarastoa.
- [ ] Sivupalkki, kapea kaistale ja puhelin prototyypin Lähdeketjun mukaan,
      kokeellisen ominaisuuden takana; selainspec; KOKEILTAVAA-rivi.
