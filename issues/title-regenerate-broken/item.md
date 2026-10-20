---
created: 2026-10-20
updated: 2026-10-20
type: bug
reporter: jari
status: open
priority: normal
lane: header
lane_seq: 1
collision: [conversation-header]
---

# Regenerate title fails; its error shows in the wrong place and the spinner orbits off-centre

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20 (pilot.247): the conversation title's regenerate button fails immediately with a red 'Otsikkoa ei voitu generoida' notice that pops into the header instead of a sensible place. Daemon log: POST /api/v1/conversations/{id}/regenerate_title → 404 in 0 ms (08:11:00Z and 08:11:03Z) — the route or conversation id resolution is wrong. Also the arrow animation rotates around a point outside the button (orbits) instead of its own centre. Fix all three; errors belong in the product's normal notice place.
