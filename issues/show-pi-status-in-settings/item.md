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

## Purpose

Show OpenAI alongside GitHub in account settings so the person can see the
state of Pi sign-in on this server and reach the existing Pi onboarding flow
when sign-in is missing.

## Context and scope

The status source is `/api/v1/onboarding/pi/status`, defined in
`contracts/v1/pi-status.schema.json` and consumed by `web/src/app/pi.ts`.
Its `usable`, `missing` and `unknown` states describe native credentials;
they provide neither an OpenAI account identity nor proof of a successful
provider request. Settings wording should reflect that distinction, with
uncertainty visible when status is unknown or cannot be fetched.

This completes the OpenAI entry split from @add-account-settings-ui. It
reuses native Pi sign-in; credential disconnection remains outside this
issue. @align-settings-design owns layout and visual comparisons, and
@account-profile-from-github owns the person's name, email and image.

## Acceptance Criteria

- [ ] Settings shows all three Pi states in terms the person can understand, without implying an OpenAI account identity or verified provider connection.
- [ ] Missing sign-in leads to the existing Pi onboarding flow; a status fetch failure leaves the connection visibly uncertain.
- [ ] Settings UI/browser tests cover the states, fetch failure and onboarding path.
