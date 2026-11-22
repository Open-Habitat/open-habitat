---
created: 2026-11-22
updated: 2026-11-22
type: feature
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-server-browser-visit-data
lane: server-browser-log
lane_seq: 2
preparation: ready
---

# Server browser: CLI results carry page url/title and downloads for the visit record

## Description

Data side of the accepted browser visit record (`server-browser-agent-visit-log`,
Jari 22.11.2026): the record is derived from native history, so the agent's
browser CLI results (`open-habitat agent browser goto/click/download/...`) must
carry what the record needs: page url (without query/fragment where shown) and
title after navigation, download file names and target folder. Plus a web-side
derivation from a turn's tool calls, like TurnChangesSource. The card's look
waits for `server-browser-entry-points` round 3.
