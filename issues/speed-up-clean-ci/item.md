---
created: 2026-09-29
updated: 2026-09-29
type: improvement
reporter: jari
status: open
priority: normal
lane: build-tooling
collision: [scripts/ci-local.sh]
---

# Speed up clean CI gate

## Problem
The full `./scripts/ci-local.sh --clean --json` gate repeatedly takes minutes during otherwise small changes; a recent clean run on Alder finished in 203 seconds. Security and release workers report "The final clean-tree gate is still running" and sometimes run it several times (for example a pre-review gate and a final committed-tree gate). Waiting on mandatory evidence dominates short work and slows Jari's feedback loop. The existing gate intentionally exercises pinned tools, offline dependency reinstall, browser tests, race tests, guest self-test and deterministic packaging; a speedup must not weaken the release claim.

## Goal
Measure the current clean gate by phase and make it meaningfully faster on repeated committed-tree runs without hiding a failing step, accepting dirty trees, silently skipping an integration/security check, changing the binary/fixture packaging contract or installing tools persistently on the machine.

## Suggested investigation
- Produce a reproducible baseline and per-phase wall/cpu/IO/network breakdown on a disposable cache and a warm cache, including concurrent-run contention; compare at the same revision and hardware. Separate downloading/install churn, Go cold-cache behavior, Playwright startup/build, guest tests and duplicate packaging.
- Explore safe reuse or relocation of verified immutable dependencies and smarter stage concurrency without cross-run races or non-hermetic CI. Preserve the offline npm proof, pinned issuectl/Pi dependencies, source-version/package reproducibility and exact `--clean --json` contract. A quicker focused development command may complement, never impersonate, the full green gate.
- Verify with repeated clean committed-tree runs, a changed-lockfile and changed-source negative test, failure propagation, disk-backed TMPDIR and identical release artifacts. Document cold and warm timing, host conditions, variance and what still takes time. Ensure no tests run against real credentials/homes or a live host.

## Scope
`native-agent-host` scripts and their CI-facing docs; no change to test-server state. Coordinate with running security/release work rather than changing the gate beneath an active worker's validation.
