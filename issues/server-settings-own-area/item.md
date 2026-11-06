---
created: 2026-11-06
updated: 2026-11-06
type: feature
reporter: jari
status: open
priority: normal
related: ['@proto-server-settings-overview']
preparation: ready
provenance: chat
source_ref: chat:2026-11-06/server-settings-own-area
lane: server-settings
lane_seq: 1
---

# Server settings as their own area in Settings (experimental)

## Description

Jari 6.11.2026: prototyypin `proto-server-settings-overview` suunta **B
Oma alue** toteutetaan. Palvelimen ylläpito on asetuksissa oma alueensa:
sen lista sisältää vain palvelinosiot (pääsy, integraatiot, levytila ym.),
ylhäällä paluu *‹ Omat asetukset*, puhelimessa osiot välilehtirivinä.
Henkilön omat asetukset pysyvät ennallaan. Lähde:
`design-system/prototypes/rounds/2026-11-06-palvelimen-asetukset/` ja
issuen `proto-server-settings-overview` result.md. Kokeellisena
ominaisuutena (AGENTS-WORKFLOW.md), ellei Jari toisin sano. Jos
toteutuksessa tulee kysyttävää, se riffataan prototyyppinä.

## Acceptance Criteria

- [ ] B toteutettu kokeellisena ominaisuutena; ylläpitäjä näkee kaikki palvelinosiot ilman vierittämistä 1440×900:ssa ja puhelimessa välilehtinä; testit reitityksestä ja paluusta
