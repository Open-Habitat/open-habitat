---
created: 2026-09-27
updated: 2026-09-27
type: task
status: in-progress
priority: high
lane: auth-incident
collision: [internal/gateway/auth.go]
---

# Instrument OAuth callback rejection safely

## Description

From issues/investigate-first-login/analysis.md: live first login ended auth_error=invalid_request in Brave and Chrome; no binding or JIT account in subsequent read-only snapshot. Add bounded secret-safe structured callback rejection reason and server-owned attempt/correlation reference if practical without changing fail-closed OAuth behavior or exposing query/state/code/verifier/token/cookie/identity in logs or browser. Cover extra/duplicate/empty/malformed callback query, host/TLS and flow expiry with synthetic tests, including negative assertion for leaks. Do not relax accepted callback shape speculatively. Retain generic user error; integrate user-visible support reference only if secure and tests cover it. No live login, real credentials or deployment in worker. Run ./scripts/ci-local.sh --clean --json and proportionate security review. Investigate-first-login remains open until Jari retests on live installation.
