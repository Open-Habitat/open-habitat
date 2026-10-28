---
created: 2026-10-28
updated: 2026-10-28
type: bug
reporter: jari
status: open
priority: normal
lane: conversation-scroll
preparation: ready
provenance: chat
source_ref: chat:2026-10-28/live-row-gap-above-composer
---

# Large empty gap between the live 'agent working' row and the chip above the composer

Jari 2026-10-28 (testikone, pilot.456, kuvakaappaus liitteenä): kun agentti työskentelee, live-rivin (Näytä työ › Agentti työskentelee · Ajattelee · 0:56) ja kentän yläpuolisen sirun (haara- ja tilasiru) välissä on paljon tyhjää tilaa, noin 50 px. Epäilty syy: conversation-scroll-overshoot-bounce-korjaus (fed44107) varaa keskustelun loppuun tyhjän ::after-tilan, jotta live-rivin kutistuminen ei pomputa näkymää (2 s pito ja 240 ms liuku). Tila näyttää jäävän pysyväksi live-työn aikana. Tyhjää tilaa ei saa jäädä live-rivin ja sirun väliin, eikä pomppukorjaus saa palata rikki.
