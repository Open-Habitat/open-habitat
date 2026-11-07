---
created: 2026-11-07
updated: 2026-11-07
type: improvement
reporter: jari
status: done
priority: normal
preparation: ready
lane: graduate
lane_seq: 5
closed: 2026-11-07
---

# Graduate Työtilan kuvake from experimental

## Description

Kirjattu testikoneelta (KOKEILTAVAA.md, testiopas 7.11.2026):

Työtilan kuvake pois kokeellisista (Jari 1.11., pilot.572): Jarin tuomio kokeilun jälkeen on, että ominaisuus on valmis ja siitä tehdään tavallinen ominaisuus: poista *Työtilan kuvake* -kokeiluvalinta (Kokeelliset ominaisuudet -kortti ja asetushaku) ja jätä kuvakeketju, valitsin ja ehdotukset aina päälle (`workspace-icon-polish`, `workspace-icon-chain`). Kokeilussa kuvake vaihtui open-habitat-työtilalle (commit `Työtilan kuvake: 🏕️ (open-habitat)` 17:13:06Z, vain `.open-habitat.yaml`), mutta Jari ei nähnyt ilmoituksessa *Kumoa*-toimintoa; se ei haitannut häntä. *Kumoa* luvataan vain, kun aiempi kuvake vaihdetaan toiseen; tässä edellinen oli automaattinen favicon ilman `icon`-riviä, joten tarkista, kuuluuko *Kumoa* myös silloin.

## Acceptance Criteria

- [ ] havainto korjattu; testi rajapinnassa
