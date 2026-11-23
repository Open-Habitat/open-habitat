---
created: 2026-11-23
updated: 2026-11-23
type: feature
reporter: jari
status: testing
priority: normal
provenance: chat
source_ref: chat:2026-11-23:sounds-active-device
lane: sounds-device
lane_seq: 1
preparation: ready
---

# Sounds play only on the device the person is using (last input wins)

## Description

Jari 23.11.2026: with Habitat open on a desktop and a laptop, attention sounds play on both, also on the machine he is not using. Agreed design (Jari: 'mennään tällä'): every open Habitat tab reports to the server whether it is visible and when it last had keyboard, pointer or touch input (on change only, not continuously). The server treats the tab with the freshest input as the active device and only that one plays the sound. If no device has had input in about 5 minutes, all open devices play as today, so nothing is missed. Not used: the Idle Detection API (Chrome-only, needs a permission) and visibility alone. The same active-device signal can later steer notifications.
