---
created: 2026-11-21
updated: 2026-11-21
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: taskfleet spinoff for the v0.1.4 release gate
source_ref: taskfleet:01m7zvhjemz5vfkqwnq3bz38wq/gate-fix-experimental-graduation
originating_run: 01m7zvhjemz5vfkqwnq3bz38wq
originating_run_kind: spinoff
closed: 2026-11-21
commits:
- hash: f401bbb6
  summary: 'test(web): count attention sound among the experiments; sweep Äänet with it on'
- hash: 7b614d3e
  summary: 'test(web): read the graduated context view; look through the composer hold'
- hash: 72d3eb3b
  summary: 'test(web): helpers have their chip without a switch'
- hash: 42cac641
  summary: 'feat(web): explain cards for Agentin käytössä and Hiljaiset''s workspace tiles'
- hash: e2e6f4ce
  summary: 'fix(web): a folded Hiljaiset counts its rows at their drawn height'
---

# Gate fix: experimental-graduation fallout in browser specs

## Description

The v0.1.4 clean gate on main failed in specs touched by the graduation of
twelve experimental features and by the changes that landed with it
(attention sound as a new experiment, the permission question in the
composer's place, helpers and explain mode graduated). The failing ordinary
specs failed again when rerun alone at low load, so they are deterministic:

- settings-experimental: five experiment cards where the spec expects four.
- en-shell-editor and context-ring: the context page no longer has the
  technical figures ("What it is made of", `context-total`, turn and part
  tables); the context view replaced them for everyone.
- context-ring @compaction-spacing: "Missing notice neighbours".
- named-workers: the helpers chip is present where the spec expects none.
- settings-width-sweep `aanet`: the Äänet section heading is hidden.
- lab-explain-coverage (lab): controls without an explain card, e.g.
  `rail-resources` in the rail's home row.

For each case decide whether the product regressed or the spec is outdated
against an agreed change, and fix accordingly.

## Resolution

### 2026-11-21T20:44:33Z · @issuectl

Fixed; see result.md.
