---
created: 2026-10-26
updated: 2026-10-26
type: improvement
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-10-26/worker-panel-note
lane: unlaned
collision: [web/src/components/BackgroundStrip.tsx]
preparation: ready
---

# Workerit-paneelin selite 'Workerit ovat Taskfleetin ajoja; selain vain näyttää ne.' pois

## Description

Jari 2026-10-26 testatessa: Workerit-paneelin lopussa oleva teksti 'Workerit ovat Taskfleetin ajoja; selain vain näyttää ne.' (web/src/components/BackgroundStrip.tsx, .ah-bg-life) ei tarvitse näkyä käyttöliittymässä. Poista se ja siihen liittyvä tyyli, jos sitä ei muuten käytetä; päivitä testit ja storyt.
