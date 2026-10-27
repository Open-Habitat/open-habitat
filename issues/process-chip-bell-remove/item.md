---
created: 2026-10-27
updated: 2026-10-27
type: improvement
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: kokeiltavaa:2026-10-26/process-chip-bell-remove
lane: unlaned
collision: [web/src/components/BackgroundStrip.tsx]
preparation: ready
---

# Processes chip: remove the corner bell (Jari's decision)

## Description

Testihavainto, kirjattu KOKEILTAVAA.md:stä 2026-10-27:

Prosessit-sirun kulmamerkki on epäselvä (0.0.0-pilot.421, 26.10.): kun agentti odottaa prosessia, sirun oikeassa yläkulmassa on 10 px:n soittokello (ikoni `bell`) aksenttiympyrässä. Näin pienenä se näyttää kellotaululta, eikä sen merkitys aukea. Muualla (yläpalkki, sivupalkki, Workerit-siru) odotuksen merkkinä on jo ◉-rengas, jonka keskellä on piste. Prosessisirun soittokello on vanhaa Merkit-mallia (16.10.), Jarin päätös: soittokello pois. Se antaa vaikutelman, että jotain pitäisi katsoa, ja prosessisiru selittää jo itse itsensä. Koodissa `web/src/components/BackgroundStrip.tsx`, `facts.proc.bell` (Jari).
