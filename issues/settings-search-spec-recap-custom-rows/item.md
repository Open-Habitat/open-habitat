---
created: 2026-10-29
updated: 2026-10-29
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: agent test run
source_ref: taskfleet:01m63y2324hs9yb1p9ym2btx17/spec-failure:settings-search-recap-messages
originating_run: 01m63y2324hs9yb1p9ym2btx17
originating_run_kind: spinoff
lane: gate-health
preparation: ready
lane_seq: 140
closed: 2026-10-29
---

# settings-search spec: recap-messages row not found after choosing Oma (fails on main)

## Description

`web/tests/settings-search.spec.ts:39` ("every index row is on its section's page and every page row is in the index") fails on main at ba2a660e, reproduced three times on Birch with `OH_BROWSER_WORKERS=2 OH_PORT_BASE=7400 ./scripts/test-focused.sh --area browser --spec settings-search.spec.ts`. It also fails in a clean detached worktree of that commit.

Symptom: after the test clicks Tilannekatsaus › Oma (`recap-level` › `segment-custom`), it waits for `.s-main [data-settings-row="recap-messages"]` and times out after 5 s with "element(s) not found". `recap-messages` is an index row (`web/src/app/settingsIndex.ts`, `within: "recap-level"`), and `RecapSettings.tsx` draws it only when the level is custom. So the Oma click does not open the number rows in the synthetic host, or the rows render under another id.

The other three tests in the spec pass. Found while running touched specs for `experimental-features-section`, which does not change the recap section.
