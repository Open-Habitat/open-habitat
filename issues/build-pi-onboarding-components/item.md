---
created: 2026-09-28
updated: 2026-09-28
type: task
status: done
priority: normal
related: ['@design-first-use-onboarding', '@gate-native-routes-on-pi']
lane: onboarding-ui
collision: [design-system/, web/src/components/]
closed: 2026-09-28
---

# Build first-use Pi sign-in UI components

## Description

## Goal
Build production React components for the first-use Pi ChatGPT subscription device-code step, ahead of route wiring. Jari wants to try a fresh account onboarding after web login; this slice provides its real user-visible controls/states, not a fake working sign-in.

## Scope
Present Pi-provided verification URI and user code, explain browser confirmation without asking the user to open a terminal, display pending/connected/expired/failed/unknown states, cancel/retry affordances and safe recovery. Compose from production shared components and Storybook, Finnish copy, keyboard and screen-reader usable. Inputs are typed redacted props and callbacks; no gateway fetch, authentication claims, credential storage, API-key login, host fixture in production, App.tsx/route changes, generated contract edits or native process in this slice. The gateway/daemon attempt contract is separately owned by @gate-native-routes-on-pi; bind it in a subsequent slice after it lands. Do not turn a screenshot into a review gate for unrelated technical work.

## Acceptance Criteria
- [x] Production component and Storybook stories show ready, pending, connected, expired, interrupted and unavailable states with code only from supplied props; no fake success.
- [x] Relevant component/keyboard/a11y tests cover code copy, opened provider link and cancellation/retry, with no code/token in host URL or logs.
- [x] Run ./scripts/ci-local.sh --clean --json and record exact revision, checks and evidence limits in result.md. This is visual/component evidence, NOT native/provider or authenticated browser integration.

## Follow-up
Route integration and fully server-gated first-use transition remain in @design-first-use-onboarding after @gate-native-routes-on-pi. Leave this issue done only for its own component acceptance, not the whole onboarding.

## Resolution

### 2026-09-28T18:31:35Z · @issuectl

Standalone Finnish Pi device-code presentation and synthetic Storybook states only; server binding and live sign-in remain in design-first-use-onboarding.
