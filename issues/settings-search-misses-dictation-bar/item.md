---
created: 2026-10-30
updated: 2026-10-30
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: clean gate for v0.1.0-pilot.16 on Birch
source_ref: taskfleet:01m662333cwnnfr5ar9mchfgd6/gate:settings-search-misses-dictation-bar
originating_run: 01m662333cwnnfr5ar9mchfgd6
originating_run_kind: spinoff
closed: 2026-10-30
---

# Settings search index lacks the Sanelupalkki experimental card

## Description

The pilot.16 clean gate's settings-search.spec.ts:39 found the Kokeelliset ominaisuudet row composer-dictation-bar drawn on the page but absent from web/src/app/settingsIndex.ts, so settings search cannot find Sanelupalkki. Added by 47889fb6 without an index row. Deterministic.
