---
created: 2026-10-29
updated: 2026-10-29
type: feature
reporter: jari
status: open
priority: normal
lane: settings
lane_seq: 1
collision: [web/src/app/Settings.tsx]
preparation: ready
---

# Tilannekatsaus settings: levels, logarithmic delay, recap-now button

_Source: chat_

## Description

Implement `proto-recap-settings` round 2 as a Tilannekatsaus settings section in the **Tasot** direction (Lyhyt / Tavallinen / Perusteellinen / Oma, the chosen level's numbers shown, any change moves to Oma) with Jari's 29.10. changes:

- The delay scale is closer to logarithmic, so both short and long delays are sensible choices for different people (within the bounds the prototype gives: Pi's 10-minute stop above, presence cadence below).
- Recaps are always automatic; the mode setting (Automaattisesti / Kun pyydän / Ei koskaan) goes away, because the home page does not work properly without them.
- "Kun pyydän" becomes an always-present button at the top of the conversation (header) that makes a recap now.
- One shared model picker in the section and in Tekoäly › Oletusmalli, as in the prototype.

Storage and host facts as `proto-recap-settings/result.md` proposes (Pi settings `openHabitat.recap`).

## Acceptance Criteria

- [ ] Section with Tasot, logarithmic delay, shared model picker; the extension reads the stored values.
- [ ] Recap-now button in the conversation header.
- [ ] Contract, daemon and browser tests; KOKEILTAVAA line.
