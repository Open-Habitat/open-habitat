---
created: 2026-10-01
updated: 2026-10-02
type: task
reporter: jari
status: done
priority: low
related: ['@architecture-built-on-caution']
lane: caution-removal
lane_seq: 80
blocked_by: ['@browser-state-rewrite']
closed: 2026-10-02
closed_by: claude
---

# Slow the Pi onboarding poll

## Goal

Step 8 of the [architecture review](../../docs/reviews/architecture-review-2026-10.md) removal plan (row B15). `PiOnboarding.tsx` polls the attempt every 900 ms with a `/auth/session` read before each poll.

## Scope

- Use a slower poll, starting at 2 s, while an attempt is in flight; no session pre-read; a 401 from the attempt read leads to login.

## Result to establish

Device-code progress remains understandable and the fake-Pi login flow still
completes. Each attempt poll makes one attempt request without a session
pre-read; a 401 from that request leads to login. Polling stops when the attempt
ends or the view closes. `PiDeviceSignIn.test.tsx` and
`first-use-ux.spec.ts` are the existing coverage.

Test selection and the final gate follow [TESTING.md](../../TESTING.md).

## Acceptance Criteria

- [x] Polls make one attempt read every two seconds without a session pre-read, preserve login and session-switch safety, and stop when the attempt ends or the view closes.
- [x] Fake-Pi first-use flows, focused tests and the clean CI gate pass on the final product tree; see [result](result.md).

## Resolution

Reduced the in-flight device attempt poll to two seconds with no per-poll session read. Focus checks session changes independently and holds already-running reads until verification, so an old-session reply cannot restore a code. The synthetic first-use browser journeys and final clean gate passed; evidence and earlier gate retries are recorded in [result.md](result.md).
