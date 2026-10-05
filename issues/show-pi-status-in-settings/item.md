---
created: 2026-10-05
updated: 2026-10-05
type: improvement
status: open
priority: normal
related: ['@add-account-settings-ui', '@align-settings-design']
lane: account-ui
lane_seq: 30
collision: [web/src/components/]
---

# Show native Pi sign-in state in account settings

## Goal

Show the state of this server's native Pi/OpenAI sign-in alongside GitHub in account settings, without presenting credential presence as a live provider check.

## Work

Read the existing `/api/v1/onboarding/pi/status` contract (`usable`, `missing`, `unknown`), and display a comprehensible OpenAI entry for each state. Do not claim the OpenAI account identity, a verified live connection, or successful requests: none is available in the current contract. For missing sign-in, use the existing Pi onboarding flow rather than a second credential flow. Handle status fetch failure conservatively and cover the states in settings UI/browser tests. Coordinate presentation with @align-settings-design, which owns the layout and visual comparison. No native credential disconnect is part of this work.

This is the remaining connection-state work split from @add-account-settings-ui after Jari confirmed the existing account/settings UI had been viewed and tested. @account-profile-from-github owns the person-facing name, email and image separately.

## Acceptance Criteria

- [ ] Settings describes usable, missing and unknown native Pi sign-in states without claiming a live provider verification or an account identity.
- [ ] Missing sign-in can reach the existing Pi onboarding path, and failure to read status does not look connected.
- [ ] Settings tests cover these states and the onboarding path.
