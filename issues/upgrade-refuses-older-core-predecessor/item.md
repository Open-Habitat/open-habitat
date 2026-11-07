---
created: 2026-11-07
updated: 2026-11-07
type: bug
status: fixed
priority: high
provenance: other
provenance_detail: pilot.20 install
source_ref: taskfleet:01m6v4fwchjk9y365ebg4cn7t6/install:predecessor-core
originating_run: 01m6v4fwchjk9y365ebg4cn7t6
originating_run_kind: spinoff
closed: 2026-11-07
commits:
- hash: ff22165d7
  summary: RequireCoreRuntime of the target only
---

# pilot.20 cannot upgrade from pilot.19: the core agent-tool pins refuse the predecessor manifest

## Description

Observed 2026-11-07 when Fleetrepo's upgrade program installed v0.1.0-pilot.20 (run `01m6v8prd91cdpvh69s3awcb69`): on Northwind, Contoso and Birch alike, `host upgrade --dry-run` of the pilot.20 binary refused with `host_observation_unavailable`, so no pilot could upgrade from pilot.19.

Cause: `fe28f9e2` made the core's agent tools (Taskfleet, workmux, the `pi` launcher, the skills extension) part of `validRuntimeClosure`, which `AuthenticateRelease` applies to every manifest. An upgrade also authenticates the installed predecessor's manifest with the successor's code, and pilot.19's core has no agent tools, so the predecessor was refused as `invalid_release` (reproduced against pilot.19's published arm64 manifest). The CLI's catch-all then reported it as `host_observation_unavailable`, which hid the cause. The same block also pinned Node and the Pi packages' versions, so the next Pi bump would have refused every predecessor the same way.

Fix: the core pins are a requirement on the target release only, `AuthenticatedRelease.RequireCoreRuntime`, checked by `loadRelease` (apply and upgrade targets) and by `runtime-release manifest`, as `RequireIntegrationTools` already is for integrations. pilot.19's manifest now authenticates as a predecessor and is refused as a target.

pilot.20 is immutable and stays uninstallable from pilot.19; the fix ships as pilot.21 with pilot.19 as its predecessor.
