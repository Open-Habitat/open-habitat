---
created: 2026-09-24
updated: 2026-09-24
type: feature
status: in-progress
priority: high
lane: auth-jit
lane_seq: 40
collision: [internal/provision/]
blocked_by: ['@implement-jit-broker-uds']
---

# Implement serialized first-login provisioning journal core

## Goal
Continue ADR 0004 after strict broker state and UDS transport: implement the root-only **serialized planning/journal state machine** for first-login account creation, with injected Linux executor operations. This is an inert app-repo slice: no public gateway path, no guest operation and no real `useradd` or systemd activation yet.

## Acceptance Criteria
- [x] Root-only host-wide lock around allowlist+ledger reads and publication; re-read current allowlist before every authorization and again before committing; allowlist epoch & ledger generation durable monotonic semantics. Reject denied/revoked subject, duplicate ID, collisions in proposed name/UID/pool, unsafe candidate and existing unrelated alice/bob, including renamed GitHub handle preserving existing binding. UID selected only by reviewed server-side range, never browser/request.
- [x] Before first mutation write/fsync a root-owned exclusive pending journal with canonical numeric ID, name, UID, phase. Use injected narrow account/home/socket/config/unit executor for phase transitions; never trust unverified provider/profile data or hand broker an OAuth token. Publish ledger only after verified executor succeeds, using atomic fsync+rename+directory fsync. Partial failures, stale pending, unsafe root path, concurrent same/different IDs, crash/restart and changed allowlist fail closed without automatic delete/retry. On ensure of committed binding, require executor drift verification before returning route. Test both policy and writer protocol semantics without touching host NSS or running commands.
- [x] This slice does not expose a runnable root service/CLI or allow real callback route yet. Document exact next seam for reviewed Linux executor and Fleetrepo service/allowlist; leave nil/default transport handler denied. Full Go fmt/vet/race/generated drift and issue checks, no guest/credentials/cloud write; keep old static gateway untouched.

## Tests Run

- [x] `go fmt ./...`
- [x] `go vet ./...`
- [x] `go test -race ./...` (including hermetic writer phase, concurrency, policy and crash-state tests)
- [x] `go generate ./internal/contracts` and `./scripts/check-generated.sh`
- [x] `issuectl doctor --json` (no blockers) and `git diff --check`

## Implementation Notes

See [result.md](result.md). The root service, Linux executor, Fleetrepo declarations and live first-login integration are explicitly not implemented by this inert slice. No host, guest or credentials were touched.
