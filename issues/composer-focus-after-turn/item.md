---
created: 2026-10-20
updated: 2026-10-20
type: bug
reporter: jari
status: open
priority: normal
lane: composer
lane_seq: 2
collision: [web/src/components/composer]
---

# Composer loses focus when the agent finishes a turn

_Source: chat:ville-test-2026-10-20_

## Description

Ville (2026-10-20, pilot.237) was typing a new message while the agent worked; when the agent finished and he continued typing, focus had moved away from the 'Kirjoita Pi:lle' field. A turn finishing must never take focus from the composer (or anything the person is typing in). Done: browser test typing across a turn end keeps focus and text.
