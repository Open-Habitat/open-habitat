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
preparation: ready
---

# Show native Pi sign-in state in account settings

## Purpose

Show OpenAI alongside GitHub in account settings so the person can understand
the state of Pi sign-in on this server. Keep the existing onboarding route for
missing or uncertain sign-in.

## Context and scope

The status source is `/api/v1/onboarding/pi/status`, defined in
`contracts/v1/pi-status.schema.json` and consumed by `web/src/app/pi.ts`.
Its `usable`, `missing` and `unknown` states describe native credentials;
they provide neither an OpenAI account identity nor proof of a successful
provider request. Settings wording should reflect that distinction, with
uncertainty visible when status is unknown or cannot be fetched.

On first load, `web/src/app/App.tsx` checks Pi before rendering settings. A
missing or uncertain status opens the existing Pi onboarding view instead;
a direct `/settings` URL does not bypass that gate. The settings entry can
still show a later missing/unknown result while the page is open, and offer
the existing sign-in flow when sign-in is missing. Do not loosen the initial
Pi gate just to make every settings state reachable on a fresh visit.

This completes the OpenAI entry split from @add-account-settings-ui. It
reuses native Pi sign-in; credential disconnection remains outside this
issue. @align-settings-design owns layout and visual comparisons, and
@account-profile-from-github owns the person's name, email and image.

## Acceptance Criteria

- [ ] Settings shows all three Pi states in terms the person can understand, without implying an OpenAI account identity or verified provider connection.
- [ ] An initial missing or uncertain Pi status continues to open onboarding, including for direct `/settings` visits; settings does not bypass the existing gate.
- [ ] On an already open settings view, a missing status can reach the existing Pi sign-in flow; an unknown status or fetch failure is visibly uncertain rather than connected.
- [ ] Component and browser tests cover the settings states, fetch failure and the initial gate/onboarding path.
