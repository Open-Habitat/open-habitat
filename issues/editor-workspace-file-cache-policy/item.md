---
created: 2026-11-14
updated: 2026-11-21
type: improvement
status: open
priority: normal
provenance: other
source_ref: taskfleet:01m7dcawvbxwfkc1dnza89rwrv/file-cache-proposal
originating_run: 01m7dcawvbxwfkc1dnza89rwrv
originating_run_kind: spinoff
lane: unlaned
lane_seq: 1
preparation: ready
---

# Consider disabling workspace file caching in the browser editor

## Description

Consider enabling code-server's optional `--disable-file-cache` for the workspace editor. The 4.145.2 research identified upstream support for avoiding workspace-file persistence in webview Cache Storage and sending `Cache-Control: no-store` for remote workspace resources, while leaving extension resources cached. This is a separate product policy choice, not part of the runtime pin update.

Browser persistence of workspace contents matters on shared or reused browser profiles. Decide whether reducing that persistence is worth the performance/offline trade-off; do not change the daemon's flags merely as part of a version bump.

Before implementation, verify the tagged upstream behavior and exercise the real workbench's resource headers, webviews, reload and logout. Record the policy decision and add targeted coverage if enabled. No observed cross-user access or security-boundary bypass is claimed.

Background: issues/runtime-pin-code-server-4-145-2/research.md (retained in git history after completion).
