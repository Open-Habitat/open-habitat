---
created: 2026-11-08
updated: 2026-11-14
type: feature
reporter: jari
status: done
priority: normal
lane: integration-levels-proto
lane_seq: 2
closed: 2026-11-08
preparation: ready
---

# Integration levels: four Entra apps set up in one guided flow

## Description

Implementation of Jari's decisions on `proto-integration-levels` (rounds 1–5,
6.–8.11.2026; read every Decision section in its item.md). The accepted
prototypes are the specification:

- levels: round 1 *Neljä tasoa* (new level *Kaikki paitsi postin lähetys* /
  `microsoft_nosend`, existing renamed *Luonnokset, muu vain luku*), round 2
  comparison table with ✕ Ei cells, open before setup and behind *Mitä tasot
  sallivat* after (and per round 5 always behind that button on the page);
- one guided flow for the four Entra apps: round 4 *Jokainen kokonaan* as a
  clicking path without Cloud Shell, one forward button (A1b5), real masked
  crops, *Kuva puuttuu* where no capture exists;
- start: round 5 *Rastit taulukossa* (`design-system/prototypes/rounds/2026-11-08-integraatiotasot-5/`
  direction 1): the table with a checkbox per missing level, set levels
  recognised from `GET /api/v1/server/integrations` and skipped, their
  provenance line above the table; the tenant reused from a saved section.

Host: add the `microsoft_nosend` level end to end (contracts, daemon/gateway
integration state, the Pi/M365 tool scope it grants) as round 4/5 host facts
describe; the provision broker does not change. New admin flow ships as an
experimental feature (Kokeelliset ominaisuudet) unless the existing setup
path can be replaced safely; record the choice.

## Acceptance Criteria

- [ ] Four levels with the new one usable end to end; table and flow as in the prototypes.
- [ ] Set levels skipped; only chosen levels walked; saves per app.
- [ ] Contracts regenerated; touched Go, web and browser specs green; screenshots; `KOKEILTAVAA.md` line.
