---
created: 2026-11-13
updated: 2026-11-13
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: release gate flake observed by the pilot.29 release worker
source_ref: taskfleet:01m79j3eba3ds7pb39q5pe4zfa/gate-flake:TestMicrosoftRemovalFencesAnAttemptBeforeItsIdentityIsPublished
originating_run: 01m79j3eba3ds7pb39q5pe4zfa
originating_run_kind: spinoff
---

# Microsoft account removal during files_discovery intermittently answers 503 (gate flake)

## Description

`TestMicrosoftRemovalFencesAnAttemptBeforeItsIdentityIsPublished` (`internal/daemon/integrations/microsoft_linux_test.go`) fails intermittently: the account removal (`DELETE` on the accounts path) issued while a Microsoft login is in `files_discovery` answers 503 `native_unavailable` instead of 200 (line 1037).

Observed in the clean gate for the v0.1.0-pilot.29 release commit `43e56fcd92787addc016c9df8096c365473e663d` on Birch (arm64), 13.11.2026; it failed the gate's `go test -race ./...`. All other suites passed.

Rate, measured alone on idle Birch with `go test -race -run '^TestMicrosoftRemovalFencesAnAttemptBeforeItsIdentityIsPublished$'`:

- `139351178` (yesterday's gated commit): 0/300
- `892a18522` (readable Microsoft MCP server names, ownership by token cache): 1/300
- `43e56fcd9` (release commit, also contains `f02df75d3` sharing the mcp.json lock): 2/300, plus 1 failure in an earlier `-count=20` run

So it appears with the readable-names work (`d5c7d7203`..`f02df75d3`). `microsoft.Remove` first resolves the server via `microsoftServerOf(env, address)` and returns its error unchanged; a plausible cause is that this read of Pi's `mcp.json` (or the token-cache ownership check) races with the in-flight login's writer and returns an error that the handler maps to `native_unavailable`. Not confirmed.

Product impact if the race is real: removing a Microsoft account at the instant a login is publishing could fail once with "request could not be completed"; a retry would succeed. Gate impact: the clean gate fails roughly one run in 150 on this test alone.

## Fixed

Covered by `5122e58f3` (gate-failure fix run `01m79mf2ybkz1qpjbr18wj5ng3`, 13.11.2026); the pilot.29 clean gate on `c61479f15` passed.
