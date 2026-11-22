---
created: 2026-11-22
updated: 2026-11-22
type: bug
status: in-progress
priority: high
provenance: other
provenance_detail: release gate run
source_ref: taskfleet:01m82e01grgq9bmh8e66k87ytf/gate1
originating_run: 01m82e01grgq9bmh8e66k87ytf
originating_run_kind: spinoff
---

# Release gate red on main: seven browser tests after rail default and graduations

## Description

The clean gate on main `bfe7d14a0` failed with seven browser tests that also fail when rerun alone with two workers on an idle host, so they are deterministic, not load flakes. All touch areas changed by the last landings (adaptive rail made default, sounds and agent instructions graduated, place close controls).

Ordinary suite:
- `browser-editor.spec.ts:523` the account menu stays reachable beside an open editor — strict mode violation: `getByTestId('navigation-open')` resolves to 2 elements (one in `workspace-navigation`, one `ah-navigation-open` with "1 odottaa sinua").
- `first-use-ux.spec.ts:177` slow status read does not delay the device-code start — `heading` + `workspaces-title` never appears.
- `github-stream.spec.ts:34` continue starts clones in the background — same `workspaces-title` heading missing.
- `site-ai-key.spec.ts:94` a person seeded with the site key walks the route without the AI step — same `workspaces-title` heading missing.

Lab suite:
- `lab-english-url-paths.spec.ts:13` English settings links — the list now contains `/settings/sounds` between appearance and editor (sounds graduated; expectation probably stale).
- `lab-sidebar-default.spec.ts:8` saved default reaches workspace without reload — `workspace-actions` has 6 buttons, test expects 7.
- `lab-workspace-icons.spec.ts:44` the rail shows each workspace's icon by default — the running row has no `workspace-icon-button`.

Also seen once in the gate under load and not reproduced in three isolated runs: Go `internal/daemon/integrations` `TestMicrosoftDaemonStartFollowsTheTenant` ("start did not follow the tenant") and, in one isolated run, `TestWaitingAccountDoesNotBlockOthers` TempDir cleanup "directory not empty".
