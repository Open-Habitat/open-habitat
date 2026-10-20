---
created: 2026-10-20
updated: 2026-10-20
type: bug
reporter: jari
status: fixed
priority: normal
lane: onboarding
lane_seq: 2
collision: [onboarding]
closed: 2026-10-20
---

# OpenAI / Claude sign-in view is confusing; the Claude box overflows the window

_Source: chat:ville-test-2026-10-20_

## Description

Ville (2026-10-20, pilot.237) signed in with his Claude subscription through onboarding 'Claude (Pi)'. The OpenAI/Claude sign-in view was confusing, and the Claude part had partly gone outside the window. Rework the layout so the chosen provider's steps are clear and nothing overflows at desktop or phone widths, light and dark. Done: lab captures of both providers at desktop and phone widths.

## Acceptance Criteria

- [x] Chosen provider has clear instructions inside the onboarding card.
- [x] Both providers remain usable without horizontal overflow at desktop and phone widths, light and dark.
- [x] Before/after synthetic lab AVIF and offline HTML pairs cover both providers in all four viewport/theme combinations.

## Result

See [verification and capture matrix](result.md).
