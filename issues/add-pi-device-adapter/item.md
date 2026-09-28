---
created: 2026-09-28
updated: 2026-09-28
type: feature
status: in-progress
priority: high
related: ['@design-first-use-onboarding']
lane: pi-auth-adapter
collision: [internal/daemon/, web/package.json]
originating_run: 01m3k7ak85b90d2gb3ry7xbg5m
originating_run_kind: spinoff
---

# Add native Pi device-code daemon adapter

## Goal

Implement a daemon-owned, per-mapped-UID native Pi OpenAI Codex **device-code** sign-in adapter for first-use onboarding, without exposing native credentials to gateway or browser.

## Context

Jari approved Pi's built-in ChatGPT subscription device-code browser login for v1 in @design-first-use-onboarding. Users will not open Pi's TUI: the daemon as their Unix UID invokes native `ModelRuntime.login("openai-codex", "oauth", interaction)`, selects device_code in Pi's native login prompt, forwards only Pi's verification URL/code and safe progress to browser via later gateway contract. Pi itself polls/exchanges/stores/refreshes under that UID. Pi 0.85.1 is currently pinned by @prove-pi-browser-auth; guest Pi packaging is a separate Fleetrepo prerequisite. Do not use the manual-only patch prototype for this path. Gateway must never read auth.json or exchange tokens.

## Acceptance Criteria

- [ ] Create a bounded Node helper using Pi's supported runtime/API in a disposable testable package/runtime shape, invoked by mapped daemon under its own UID with strictly framed/redacted IPC; no shell interpolation or shared credential process. Pin/verify Pi version and availability, process lifecycle and credential directory. No global Pi install from source.
- [ ] Native login selects device_code, presents only Pi's native verification URI/user code, and retains Pi's own polling/exchange/auth storage. One active operation per mapped UID, session/attempt ownership and deadline; cancellation/daemon crash/partial credential write become explicit unknown/recheck, never false connected or blind retry. Credential-bearing native errors/stderr never escape helper.
- [ ] Native status for `openai-codex` OAuth (not API-key `openai`) distinguishes missing/usable/unknown and validates local native credential safely; use Pi API rather than parsing secrets into gateway. Preserve existing terminal Pi auth and other providers.
- [ ] Synthetic tests with disposable homes and two actual disposable UIDs where available, mock provider responses and no real OpenAI request. Cover state, wrong UID, attempt reuse, timeout/abort, process crash, browser disconnect, concurrent terminal logout/login, token non-disclosure in logs/responses. Run ./scripts/ci-local.sh --clean --json. Record exact evidence, limits and independent security review; do not deploy or use real user's Pi credentials.

## Boundaries

This is a walking slice for daemon/Node native Pi adapter; gateway server-side gate, generated browser contract and wizard are separate dependent issues. Jari's approved device-code UX does not approve any alternate credential store or a gateway token broker. If official Pi API cannot be used safely without an unapproved architecture change, stop and report rather than improvise.

## Decisions

### 2026-09-28T12:29:49Z · @jari

2026-09-28 scope decision: deliver the daemon-coordinated Pi-native device-code login under the mapped UID. Pi owns auth.json and OAuth; no host-managed credential file writes or Pi-in-Go substitution for this slice. Independent terminal Pi sign-in/logout during web onboarding is not a v1 workflow; its last-writer-wins race is not a blocking acceptance criterion. Do not promise cross-process revocation. Keep bounded operation lifetime and ordinary process cleanup so daemon restart/disconnect cannot yield a false connected state; rely on Pi-native status recheck. Protect Unix UID separation and do not leak credentials into IPC/logs. Prior review findings about the experimental helper remain evidence to avoid concrete leaks and stuck children, not a mandate for a new credential framework.
