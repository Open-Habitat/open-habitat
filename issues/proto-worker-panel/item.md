---
created: 2026-10-26
updated: 2026-10-26
type: task
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-10-26/proto-worker-panel
lane: proto-worker-panel
lane_seq: 1
preparation: pending
---

# Prototype: the Workerit panel and its row details

## Description

Jari 2026-10-26 testatessa Workerit-paneelia (yläpalkin Workerit-siru, web/src/components/BackgroundStrip.tsx): selite 'odotetaan / ei odotusta: agentti ei herää, kun worker valmistuu' ei kuulu paneelin yläreunaan legendaksi. Tehdään yksi prototyyppikierros siitä, miltä Workerit-paneeli ja sen rivien yksityiskohdat (tila, odotus, ikä, profiili, landed/preserved, linkki workerin näkymään) voisivat näyttää.

Prototyyppikierros (design-system/prototypes/rounds/-menetelmä kuten aiemmat proto-*-kierrokset): 2–3 suuntaa tuotantokontekstissa, työpöytä ja puhelin, vaalea ja tumma, synteettinen data, julkaistu arvioitavaksi. Lähtökohta on nykyinen tuotanto ilman legendaa sekä proto-background-waits-kierroksen Pisteet-suunta, jonka Jari valitsi. Paneelin rivin pitää johtaa workerin omaan näkymään (worker-view-conversation on toteutuksessa samaan aikaan; Kehys-kehys ja keskustelunäkymä ovat proto-worker-view-issuessa). Jari valitsee; toteutus on myöhempi issue.
