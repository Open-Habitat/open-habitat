---
created: 2026-09-27
updated: 2026-09-27
type: bug
status: in-progress
priority: high
related: ['@design-first-use-onboarding']
lane: provisioning
collision: [internal/provision/]
---

# Provision src before first workspace view

## Goal

Ensure every newly provisioned mapped Unix user's `~/src` exists safely before successful first login or workspace listing, without turning filesystem source errors into empty lists.

## Context

Jari saw `~/src puuttuu` on the first real login. This is an onboarding/provisioning defect, independent of the broader Pi subscription and GitHub import design in @design-first-use-onboarding. `internal/provision/executor_linux.go` handles JIT account/home steps; `internal/daemon/discovery_linux.go` deliberately distinguishes missing `src` from empty. Keep the gateway out of user homes and retain the daemon's honest error semantics for later deletion or permissions failure.

## Acceptance Criteria

- [ ] At first provisioning, create `src` as an ordinary directory with the mapped UID's safe owner/mode. Do not traverse symlinks or adopt arbitrary existing destinations; define safe idempotent retry for partially created home/src under existing JIT recovery policy, fail closed on tampering.
- [ ] Do not create paths in real user homes from tests. Prove success, repeat, wrong owner/mode, symlink/replacement, crash/partial-step and per-UID separation using synthetic fixtures/isolated Linux test environment.
- [ ] Demonstrate that successful first login can no longer reach the `source absent` state for a freshly provisioned account; retain source absent for unexpected post-provision disappearance.
- [ ] Run ./scripts/ci-local.sh --clean --json and relevant narrower tests; record results in result.md. Do not touch live host or credentials; live deployment follows separately through Fleetrepo.
