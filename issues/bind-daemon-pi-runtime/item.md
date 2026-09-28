---
created: 2026-09-28
updated: 2026-09-28
type: task
status: open
priority: normal
related: ['@gate-native-routes-on-pi']
lane: pi-runtime-wiring
collision: [internal/daemon/, internal/cli/, systemd/]
---

# Bind daemon Pi runtime to packaged installation

## Description

## Goal
Make the daemon consume a trusted, version-pinned Pi/Node runtime location supplied by the deployment rather than its currently hard-coded absent /usr/bin/node and /opt/native-agent-host/pi/... paths. Fleetrepo has an offline, root-owned guest Pi 0.85.1/Node 22.21.1 operator, but it installs to a versioned guest-pi-* release and does not register global binaries. The browser onboarding gate otherwise remains unknown on the live test host.

## Scope
Keep product portable and authority boundaries unchanged: root-owned deployment configuration (or a documented neutral package path) selects Node executable, Pi public SDK entry and manifest; never accept browser or gateway fields as paths and never install Pi from source/global npm. The daemon as the mapped UID runs Pi native API against its own HOME, validates availability and pinned version and fails closed on missing/unsafe runtime. Coordinate exact declared artifact paths with Fleetrepo infra/native-agent-host-test/GUEST-PI-RUNTIME.md; Fleetrepo deployment script itself is separate. Preserve fixture/packaging exclusion and ability to test with disposable homes.

## Acceptance Criteria
- [ ] A packaged daemon can find an operator-installed pinned Pi/Node without modifying global /usr/bin, and cannot silently use an untrusted user-writable runtime or version.
- [ ] Missing or mismatched package returns redacted unknown/unavailable, not a gate bypass or token disclosure; test synthetic runtime paths and malicious substitutions.
- [ ] ./scripts/ci-local.sh --clean --json, focused daemon runtime tests and release archive verifier pass on clean committed revision. Record exact limits in result.md; no host deployment or real OAuth.

## Related
The installed runtime and upgrade preflight belong in private Fleetrepo; @wire-first-use-pi-journey provides browser flow, @gate-native-routes-on-pi provides server gate.
