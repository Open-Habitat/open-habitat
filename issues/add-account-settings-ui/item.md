---
created: 2026-09-27
updated: 2026-09-27
type: improvement
status: testing
priority: high
related: ['@design-first-use-onboarding', '@build-history-view']
lane: account-ui
collision: [web/src/app/App.tsx, design-system/]
---

# Add account shelf and GitHub settings view

## Goal

Make the everyday workspace chrome understandable: a compact account shelf in the bottom-left rail with a Settings entry, a GitHub integration settings page showing truthful native state, and no technical identity/logout caveat in default chrome.

## Context

Jari's real first-login feedback in @design-first-use-onboarding asks to remove `GitHub user <number>` from the bottom rail and the permanent `Web-uloskirjautuminen ei katkaise natiiveja GitHub-tunnuksia.` message; show GitHub status in Settings instead. `web/src/app/App.tsx` currently renders both and an unknown native GitHub warning even when a later daemon snapshot can provide verified state (pilot.8). The native disconnect/confirmation API is not yet implemented: do not fake it or remove credentials in browser code. @build-history-view remains in `testing` for Jari's independent visual verdict; this work cannot claim that view accepted.

## Acceptance Criteria

- [ ] Place a compact keyboard-accessible account/context shelf at the bottom of the left rail with Settings and web logout. In Settings, show accurate native GitHub connection state from snapshot (connected, missing, partial, unknown), without numeric IDs or raw auth metadata. Use shared production components, desktop-first layout; no new fixture behavior in production.
- [ ] Default chrome shows a humane name or neutral fallback (never `GitHub user <numeric ID>`). Remove routine web/native logout warning from rail; explain distinction contextually only where relevant in Settings. Preserve web logout behavior, identity clearing and failure handling.
- [ ] Include a clear but disabled native disconnect action with honest reason until the per-UID authenticated endpoint and fresh-auth confirmation are implemented; no fake success. If a usable backend already exists, use only verified contract behavior, not assumptions.
- [ ] Add focused component/browser tests for keyboard, focus, navigation, unknown/partial/error and user switch. Produce visual acceptance screenshots covering happy/unhappy states under this issue. Run full ./scripts/ci-local.sh --clean --json. Do not close @build-history-view or deploy a new release just from synthetic UI evidence.
