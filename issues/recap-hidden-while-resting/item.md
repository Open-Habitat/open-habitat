---
created: 2026-10-29
updated: 2026-10-29
type: bug
reporter: jari
status: open
priority: normal
lane: recap
lane_seq: 1
preparation: ready
---

# Recap appears only after the agent wakes

_Source: chat_

## Description

From KOKEILTAVAA.md (test server testing):

Tilannekatsaus näkyy levon jälkeen vasta, kun agentti herää (Jari 29.10., pilot.511): katsaus syntyi 17:48 UTC (Pi:n istuntoon `custom`-merkintänä `conversation-recap`). Daemon käynnistyi päivityksessä uudelleen 18:20, ja Pi oli levossa. Kun Jari avasi keskustelun, katsausta ei näkynyt. Se ilmestyi vasta, kun kirjoittaminen herätti Pi:n (Pi käynnistyi 18:58:06). Katsaus on siis natiivihistoriassa, mutta selain saa sen luultavasti vain elävän Pi-istunnon kautta eikä levossa olevan keskustelun historiasta. Aloita luvusta `agent recap show`, `internal/daemon/recap_linux.go` ja `internal/gateway/snapshot_linux.go` (`wake-stopped-agent`, `recap-card-labels`).
