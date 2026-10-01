---
created: 2026-10-01
updated: 2026-10-01
type: task
reporter: jari
status: open
priority: low
related: ['@architecture-built-on-caution']
lane: caution-removal
lane_seq: 80
blocked_by: ['@browser-state-rewrite']
---

# Slow the Pi onboarding poll

## Goal

Step 8 of the [architecture review](../../docs/reviews/architecture-review-2026-10.md) removal plan (row B15). `PiOnboarding.tsx` polls the attempt every 900 ms with a `/auth/session` read before each poll.

## Scope

- Poll every 2 s while an attempt is in flight; no session pre-read; a 401 from the attempt read leads to login.

## Acceptance Criteria

- [ ] `PiDeviceSignIn.test.tsx` and `first-use-ux.spec.ts` pass.
- [ ] Device-code login still completes in the lab fake Pi flow.
