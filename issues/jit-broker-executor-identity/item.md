---
created: 2026-09-24
updated: 2026-09-24
type: bug
status: in-progress
priority: high
lane: auth-jit
lane_seq: 47
collision: [internal/provision/]
blocked_by: ['@jit-broker-handler-context']
---

# Bind broker executor steps to verified GitHub subject

## Bug
Review of landed broker `Writer.Handle` found the future Linux executor cannot safely bind a daemon config to the verified GitHub subject: `HostExecutor.Step(ctx, phase, name, uid)` and `Verify(ctx, name, uid)` receive only Unix name/UID, **not** the immutable canonical GitHub numeric ID from authenticated `/user` / root ledger. A real executor would have to omit provider-subject verification or infer it from mutable state/caller input. ADR 0004 requires the daemon's root-owned config to bind the exact numeric subject; fix before any root executor implementation or guest service. Nothing deployed.

## Acceptance Criteria
- [x] Pass a typed immutable provider identity (provider `github`, canonical positive numeric ID, Unix name and assigned UID) from the writer's already-authorized allowlist/ledger into `HostExecutor.Step` and `Verify`. Existing-binding Verify must use ledger ID even if the GitHub handle changed. No unverified caller path/UID may be substituted; ledger writes use this same subject. Keep `Available` host collision checks intact.
- [x] Hermetic tests capture every Step and Verify identity for new/existing/revoked/renamed user and prove no phase receives a different ID, failed/corrupt state denies. Do not write the Linux executor yet or change service/gateway/deploy.
- [x] Full Go fmt/vet/race/gen drift checks; no guest/Fleetrepo/cloud changes.
