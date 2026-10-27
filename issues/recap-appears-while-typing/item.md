---
created: 2026-10-27
updated: 2026-10-27
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: chat:2026-10-27/recap-appears-while-typing
lane: recap
lane_seq: 2
preparation: ready
closed: 2026-10-27
---

# Recap appears while the person is actively typing

## Description

Jari 2026-10-27 (Birch): 'Tulee liian herkästi. Kun mä oon kirjoittamassa pitkää viestiä tähän niin se tulee. Pitäisi huomata, että työskentelen tässä aktiivisesti.' The conversation recap (tilannekatsaus) is generated and shown while the person is writing a long message in the composer. Activity in the composer (typing, a non-empty draft, focus) and recent reading should count as the person being active and hold the recap back. (The earlier observation recap-card-not-shown was on the test server's pilot.421; check whether it still holds once this is understood.)

## Acceptance Criteria

- [x] No recap is generated or shown while the person is typing or has an unsent draft in this conversation; a browser test covers it
