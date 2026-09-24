---
created: 2026-09-24
updated: 2026-09-24
type: task
status: open
priority: high
lane: auth-guest
lane_seq: 10
collision: [scripts/vm-test.sh]
blocked_by: ['@native-gh-jit-handoff', '@implement-linux-executor']
---

# Prove JIT two-user isolation in private guest

## Goal
Add a separately reviewed private-guest scenario demonstrating the integrated first-login path with two newly allocated, distinct Linux UIDs and synthetic GitHub identities; do not use real people or deploy.

## Acceptance Criteria
- [ ] Prove systemd root broker/kernel peers, cross-UID home/socket/route denial, first login/rerun/rename/concurrency, revocation of new and existing sessions, gh failure, partial journal, drift and reboot ACL restoration. Keep `two-user-routing` baseline separate and do not claim it proves JIT.
- [ ] Use reviewed Fleetrepo guest declarations and exact app archive/revision; no fixture/provider bypass exposed to a network. Capture expected/observed redacted receipts and limits in `result.md`.
- [ ] Run `./scripts/ci-local.sh --clean --json`, `./scripts/vm-test.sh two-user-routing --json` and new private-guest scenario on clean committed tree. Independent security review after final diff; no host deployment. See `issues/prepare-login-pilot/plan.md`.
