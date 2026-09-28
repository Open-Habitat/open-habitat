---
created: 2026-09-28
updated: 2026-09-28
type: task
status: open
priority: normal
related: ['@design-first-use-onboarding', '@gate-native-routes-on-pi', '@build-pi-onboarding-components']
lane: onboarding-wire
collision: [web/src/app/App.tsx, web/src/components/, contracts/v1/]
blocked_by: ['@build-pi-onboarding-components']
---

# Wire first-use Pi sign-in journey

## Description

## Goal
Connect the already-landed first-use Pi device-code production components to authenticated, session-bound gateway/daemon attempt and status endpoints. Show a real Pi-first onboarding step after web login, rather than a fake read-only shell or a browser-only condition.

## Scope
Browser derives its stage from server Pi status. Missing/unknown status shows first-use Pi code flow instead of leaking gated workspace/repository/history data; successful native usable status proceeds to workspace view (native GitHub readiness remains independently honest). Bind start/status/cancel, pending/retry and interrupted flow to current web session using existing same-origin Origin/CSRF conventions; clear old identity/attempt on logout, account switch, remap and stale tab. The browser never stores auth tokens, chooses UID/socket/provider, or declares itself connected from a callback. Use production component built by @build-pi-onboarding-components, not copied story UI. No new credential broker, fixture flag in production, or manual callback paste. This is a synthetic host-backed browser walking slice; separate Fleetrepo runtime installation and real OpenAI sign-in require consent and release preflight. Existing terminal Pi histories remain read-only and do not block fresh browser onboarding.

## Acceptance Criteria
- [ ] Authenticated browser shows Pi device instructions from the user daemon, recovers on expiry/failure/restart, blocks direct native routes pre-Pi, and enters workspace only when native Pi status is usable.
- [ ] Session switch, wrong attempt, stale cookie and cross-user cases clear old code and prevent leakage; no code in host URL or browser logs.
- [ ] Host-backed Playwright tests against synthetic provider and production bundle cover success, pending, error, stale and direct-route denial with truthful limits; snapshots/screenshots for Jari proportional to changed UI.
- [ ] ./scripts/ci-local.sh --clean --json passes on clean revision; report exact revision, tests and unverified live-host/provider facts in result.md.

## Boundaries
The already-landed backend slices from @gate-native-routes-on-pi are sufficient to start this frontend integration even though its operator runtime/live proof remains open. Do not mark the parent onboarding complete or deploy without the private release procedure.
