---
created: 2026-09-28
updated: 2026-09-28
type: task
status: open
priority: normal
related: ['@design-first-use-onboarding', '@add-pi-device-adapter']
lane: gateway-pi-gate
collision: [internal/gateway/, internal/daemon/, contracts/v1/, docs/]
blocked_by: ['@add-pi-device-adapter']
---

# Gate native browser routes on Pi sign-in

## Description

## Goal
Implement the already agreed gateway→mapped-user-daemon authority boundary for first-use Pi sign-in. No new credential broker: Pi owns OpenAI Codex OAuth under the mapped UID. After authenticated web login, require a usable native Pi subscription status before exposing browser workspace, repository, history or agent routes; return a recoverable onboarding-required/unknown state instead of native data.

## Scope
Add the minimal generated browser/host contract and authenticated per-session Pi device-code start/status/cancel routing using the existing mapped UDS. Never trust browser-provided UID, socket, provider or auth state. Show only Pi-generated verification URI/user code and redacted state; gateway neither reads credentials nor exchanges tokens. Protect start/cancel with existing session, Origin and CSRF; status and every gated native read/command route reauthorize mapping. No permanent onboarding database or speculative cache. Web wizard, repo list/import and live agent control are separate later slices. Existing SSH/tmux access stays native and unaffected. The first version creates new browser-owned Pi sessions; existing unrelated terminal histories remain read-only until ownership is independently known.

## Acceptance Criteria
- [ ] Native data and commands fail closed before Pi sign-in, including direct URL/stale tab, missing daemon/unknown credential and cross-user attempts, without leaking native names or credentials.
- [ ] One mapped UID device-code operation per owning web session can start, report safe progress, cancel best-effort and recover honestly after interruption; no browser credential handling.
- [ ] Generated Go/TS contract, deterministic per-UID synthetic tests, and host-backed browser tests where relevant; ./scripts/ci-local.sh --clean --json passes. Security review of final auth boundary and explicit evidence limits in result.md.
- [ ] No live provider login or test-host deployment in this implementation issue; real consented browser proof follows installation procedure.

## Architecture
Use existing gateway/daemon/broker authority in AGENTS.md and accepted Pi-native device-code decision in @design-first-use-onboarding. This task implements that contract, not a new architecture approval gate. Retain unchanged native terminal history behavior.
