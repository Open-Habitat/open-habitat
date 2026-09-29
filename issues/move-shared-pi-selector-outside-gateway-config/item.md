---
created: 2026-09-29
updated: 2026-09-29
type: bug
status: fixed
priority: normal
related: ['@share-trusted-pi-runtime']
lane: pi-runtime-wiring
collision: [internal/core/, docs/pi-runtime.md]
closed: 2026-09-29
commits:
- hash: c0ddbfcc42e8394c9c76e3ca13091df30446cf4c
  summary: Move selector to root-owned deployment tree
---

# Shared Pi selector conflicts with protected gateway configuration directory

## Description

## Observed effect
A guarded live test-host selector preflight refused before writing any selector receipt. Product SharedPiRuntimePath uses /etc/native-agent-host/pi-runtime.json. The already-installed /etc/native-agent-host directory protects gateway secrets and is root:gateway 0750: mapped daemon UIDs cannot traverse it. The root-owned shared selector cannot be installed there safely; widening that directory would expose or weaken the existing secret boundary. Product pilot.9 was not switched; pinned Pi runtime tree was independently installed/verified inert on pilot.8. No identities, addresses, digests or host receipts belong in this public issue.

## Goal
Use a deployment-owned shared selector path outside the gateway secret config subtree, e.g. /opt/native-agent-host/pi-runtime.json where existing root-owned installation tree is traversable by daemon UIDs. Keep config owner/mode/symlink validation, per-UID Pi auth, no broker binding edits and fail-closed missing selector. Document neutral interface and test real protected gateway directory versus readable selector using disposable rootless UIDs.

## Acceptance
- [ ] Distinct UID daemon can read one trusted root-owned selector while the protected gateway directory remains inaccessible; unsafe/symlink/writable modes still fail closed.
- [ ] Product clean CI and package verification pass on clean pushed revision; update Fleetrepo installer only after this path is fixed, then rebuild next pilot.9 artifact. No live service changes in this issue.
