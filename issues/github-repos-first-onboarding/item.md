---
created: 2026-09-29
updated: 2026-09-29
type: feature
status: open
priority: high
lane: github-first-onboarding
collision: [internal/gateway/, internal/daemon/, web/src/app/App.tsx, web/src/app/PiOnboarding.tsx]
---

# Choose GitHub repositories before Pi sign-in

## Goal and decision (Jari, 2026-09-29)
After browser/GitHub login, the **first onboarding step** is a tidy list of this mapped Unix user's checkoutable GitHub repositories. The user chooses which to check out into `~/src`. Only then does ChatGPT/Pi device-code sign-in run before normal workspaces, native history or agent control open. This supersedes the earlier Pi-before-repository-browsing order recorded in @design-first-use-onboarding; it does not permit agent/history/workspace data to bypass the Pi gate.

## Current gap
Pilot.9 sends authenticated users straight to Pi first-use. No repository picker or native GitHub list/import backend exists; the `@connect-github-workspaces` and `@manage-workspace-lifecycle` tasks are still open. Simply changing a heading or route cannot make the chooser real. Preserve native gh/Git as the authority, per-UID homes and socket boundary, no repo registry or gateway credential broker.

## Delivery slices
1. A narrow pre-Pi native gh repository listing contract, authenticated by gateway broker mapping, executed by the mapped UID and bounded/paginated. No paths, tokens or credential output; explicitly scoped to onboarding GitHub repo metadata, not existing Pi-gated workspace/history/agent endpoints. Test distinct UIDs and forged browser identity.
2. Selection and checked repository import under the mapped UID's safe `~/src`, with exact owner/repo confirmation, duplicate destination and partial clone handling. No automatic retry on uncertain mutations, no fabricated clone success. Reuse or narrow the existing lifecycle/clone design; no parallel store.
3. Production first-use GitHub chooser screen shown before the Pi card, recovering from reload/partially imported repos; on completion the Pi gate remains mandatory. Cover empty/denied/partial states and focus/reading position with synthetic browser tests. Keep normal existing users' workspaces protected by Pi until usable.

## Acceptance
- [ ] A fresh authenticated GitHub user can list and select their own checkoutable repositories before Pi login, clone selected refs safely, then proceed to Pi login; existing histories/agent routes remain Pi gated.
- [ ] Failure and returning-user behavior remain honest with native gh/filesystem as truth, across distinct UID fixtures; no credential leakage or raw GitHub error text.
- [ ] Full clean CI, release verification, visual evidence and the exact test-server release/paluu operator before a live claim. A consented user performs any real provider login.

## Related
@design-first-use-onboarding, @connect-github-workspaces, @manage-workspace-lifecycle, @fix-pi-onboarding-poll-starvation
