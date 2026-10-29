---
created: 2026-10-29
updated: 2026-10-29
type: feature
reporter: jari
status: open
priority: normal
lane: experimental
lane_seq: 0
collision: [web/src/app/settingsIndex.ts]
preparation: ready
---

# Kokeelliset ominaisuudet settings section (Esittely) and per-account switches

_Source: chat_

## Description

Implement the **Kokeelliset ominaisuudet** settings section from `proto-experimental-features`, direction **Esittely** (Jari 29.10.): a card per experimental feature with a picture and Missä / Mitä näkyy / Edellyttää, an on/off switch, off by default, saved per account, taking effect when the daemon confirms. Jari's change: drop the status message that changes with each click (too much detail and repetition).

Storage as the prototype result recommends: generalize the editor preference (`~/.config/open-habitat/editor.json`, daemon + gateway personalSetting relay) into one account preferences document, mind the gateway's PUT size cap. Provide the switch API that the three features use: `next-waiting-row-experimental`, `worker-row-sentence-experimental`, `terminal-watch-experimental` (their cards can say the feature is coming until each lands, or the card appears with the feature; decide and record). Settings search index gets the new rows.

## Acceptance Criteria

- [ ] Section with three feature cards and switches, persisted per account through the daemon.
- [ ] A small client API (`useExperimentalFeature(id)`) the features use.
- [ ] Contract, daemon and browser tests; KOKEILTAVAA line.
