---
created: 2026-09-24
updated: 2026-09-24
type: task
status: open
priority: high
lane: auth-daemon
lane_seq: 10
collision: [internal/daemon/, internal/gateway/]
blocked_by: ['@dynamic-gateway-login', '@package-root-broker']
---

# Bind native gh handoff to provisioned UID

## Goal
Deliver one-use native gh credential handoff under the broker-assigned UID with independently verified numeric GitHub identity.

## Acceptance Criteria
- [ ] Use verified broker route and kernel socket peer UID; daemon independently checks root-owned numeric binding, serializes same-ID gh installation, verifies gh status/API user ID/HTTPS helper and denies mismatch. Never put token in broker, argv, env, logs, cookies or retry queue; discard on uncertainty/lost acknowledgement.
- [ ] Test mismatched binding, partial gh, duplicate/concurrent callbacks, lost acknowledgement and revocation between ensure/handoff/session using synthetic fixtures only. Preserve old accounts and running agents.
- [ ] Run `./scripts/ci-local.sh --clean --json` on clean committed tree and independent security review of final diff; record tested revision and limits in `result.md`. See `issues/prepare-login-pilot/plan.md`.
