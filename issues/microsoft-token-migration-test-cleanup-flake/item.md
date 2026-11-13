---
created: 2026-11-13
updated: 2026-11-13
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: release gate flake observed by the pilot.29 release worker
source_ref: taskfleet:01m79j3eba3ds7pb39q5pe4zfa/gate-flake:TestMicrosoftConfigWithATokenPerRootMigratesAtStart
originating_run: 01m79j3eba3ds7pb39q5pe4zfa
originating_run_kind: spinoff
closed: 2026-11-13
---

# Microsoft token-migration test intermittently fails TempDir cleanup: sync still writing after teardown (gate flake)

## Description

`TestMicrosoftConfigWithATokenPerRootMigratesAtStart` (`internal/daemon/integrations/microsoft_token_linux_test.go`) fails intermittently after all its assertions pass:

```
testing.go:1617: TempDir RemoveAll cleanup: unlinkat /var/tmp/ohc.H5za38/TestMicrosoftConfigWithATokenPerRootMigratesAtStart1939256481/003: directory not empty
```

Observed in the second clean-gate attempt for the v0.1.0-pilot.29 release commit `43e56fcd92787addc016c9df8096c365473e663d` on Birch (arm64), 13.11.2026, failing `go test -race ./...`; everything else passed. Alone on idle Birch with `go test -race -count=300 -run '^TestMicrosoftConfigWithATokenPerRootMigratesAtStart$'` it failed 3/300, always the same cleanup error.

The test's deferred teardown (`cancel(); c.relay.cancelAll(); c.sync.stopAll()`) cancels the catalog but does not wait for the folder-sync goroutines it started (the test sets 20–80 ms resume timing) to exit, so a sync or resume step still writes into the test home while `t.TempDir` removes it. Likely a test-teardown race rather than a product defect, but if `stopAll` is meant to return only after the syncs have stopped, the product has the same gap at daemon shutdown. Not confirmed which.

Gate impact: together with `microsoft-removal-during-discovery-flake` the integrations package fails the clean gate roughly one run in 50.

## Fixed

Covered by `7f2f1cda0` (gate-failure fix run `01m79mf2ybkz1qpjbr18wj5ng3`, 13.11.2026); the pilot.29 clean gate on `c61479f15` passed.
