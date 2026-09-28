---
created: 2026-09-28
updated: 2026-09-28
type: task
status: open
priority: normal
related: ['@bind-daemon-pi-runtime']
lane: pi-runtime-wiring
collision: [internal/core/, internal/cli/, internal/daemon/, systemd/]
---

# Share trusted Pi runtime across mapped daemons

## Description

## Goal
Make the newly pinned Pi/Node runtime usable by existing and future JIT Unix users without editing broker-created per-user daemon binding files. Those files are byte-verified by the root provisioning executor; adding pi_runtime to one file by hand breaks verification, while new users are born without it.

## Scope
Use one deployment-owned root-only/runtime-readable static Pi runtime path configuration, separate from per-UID broker identity bindings. No tokens, home, UID, browser data or second credential store. The mapped daemon reads and validates the root-owned selected runtime using the existing secure PiRuntimeConfig validation, then runs native Pi SDK under its own UID/HOME. No browser/gateway authority to change program path. Keep current per-user identity config and root broker byte equality unchanged. Missing/untrusted global runtime fails closed for Pi but leaves non-Pi SSH/native functions alone. Document the neutral package interface that Fleetrepo can install inert beside pilot.8 and use after the next release; preserve package verifier and neutral unit contract.

## Acceptance Criteria
- [ ] Existing broker-generated binding file and future JIT config remain byte-identical and verified while every mapped daemon uses the same root-owned pinned Pi executable path after operator installation.
- [ ] Missing/untrusted/wrong-version shared config fails closed; tests for root-owned/mapped UID, alternate home, symlink and unsafe modes without real credentials.
- [ ] ./scripts/ci-local.sh --clean --json, focused rootless-container and release verification pass on clean revision, with exact evidence/limits in result.md. No test-host mutation in this issue.

## Related
@bind-daemon-pi-runtime proved validation for a per-user config but not the existing live JIT binding compatibility. Fleetrepo will own the concrete static config and artifact install.
