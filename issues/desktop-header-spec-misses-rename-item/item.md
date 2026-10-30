---
created: 2026-10-30
updated: 2026-10-30
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: clean gate for v0.1.0-pilot.16 on Birch
source_ref: taskfleet:01m662333cwnnfr5ar9mchfgd6/gate:desktop-header-spec-misses-rename-item
originating_run: 01m662333cwnnfr5ar9mchfgd6
originating_run_kind: spinoff
closed: 2026-10-30
---

# lab-desktop-header spec expects only the workspace in the header menu, which now also holds Nimeä uudelleen

## Description

The pilot.16 clean gate's lab-desktop-header.spec.ts (1024px) expected the conversation menu to hold one item (workspace); conversation naming (0de51bd9) added a rename item that is always in the menu. The product is right; the spec is stale. Deterministic.
