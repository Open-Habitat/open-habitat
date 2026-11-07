---
created: 2026-11-07
updated: 2026-11-07
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: Observed focused browser test failure, reproduced on main
source_ref: taskfleet:01m6tg9xw5q2mc893bmzg5xbxm/test-failure:settings-search-server-key
originating_run: 01m6tg9xw5q2mc893bmzg5xbxm
originating_run_kind: spinoff
lane: settings-search-fix
lane_seq: 1
preparation: ready
closed: 2026-11-07
---

# Settings search browser test still expects server keys in personal results

## Description

## Description

After the server-settings area graduated, `web/tests/settings-search.spec.ts:98` still expects the personal settings search for keys to include `settings-result-row-site-key`. The personal search intentionally excludes server rows now, so the case fails before reaching the rest of its keyboard-navigation coverage and the integrated browser gate is red.

Observed with `./scripts/test-focused.sh --area browser --spec settings-search.spec.ts`, OH_PORT_BASE=15600, OH_BROWSER_WORKERS=2. Reproduced independently from an archive of local main after f9a116f72: 1 failed, 4 passed, identical missing row-site-key assertion. The worker's two changes are absent from that archive. Log: `/var/tmp/oh-settings-main-search.log`; disposable source: `/var/tmp/oh-settings-main.dwRF2S`.

Update the obsolete assertion to the approved separation of personal and server settings, preserving the remainder of the keyboard/search journey. This is a test expectation mismatch, not evidence that personal search should regain administrator results.

## Acceptance Criteria

- The settings search browser spec passes with server settings always separate, and retains keyboard navigation/focus coverage.
