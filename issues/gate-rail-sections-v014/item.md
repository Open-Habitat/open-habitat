---
created: 2026-11-21
updated: 2026-11-21
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: release gate run
source_ref: taskfleet:01m7zvhjyjnv15aq3q8p847cvm/gate-rail-sections
originating_run: 01m7zvhjyjnv15aq3q8p847cvm
originating_run_kind: spinoff
closed: 2026-11-21
commits:
- hash: d2c74050
  summary: 'fix(web): a short window scrolls the rail as a whole'
- hash: b64b7059
  summary: 'test(web): rail-section specs open Hiljaiset on their device'
---

# Gate v0.1.4: rail-section specs fail after the rail scroll region and graduation

## Description

The v0.1.4 clean gate failed deterministically on rail specs after the
day's rail changes: `next-waiting-row.spec.ts:99` and `:215`,
`rail-section-filter.spec.ts:109`, `rail-turn-returns.spec.ts:52` and
`settings-close.spec.ts:200` (ordinary), and `lab-foundation.spec.ts:8`
(lab, the same root cause as settings-close). They also failed on a focused
rerun at low load.

Decide for each whether the product regressed or the spec is outdated
against an agreed change (rail scroll region, Hiljaiset folding by itself in
a crowd, graduated rail links, the agent choosing its rail section). Then fix
the product or update the spec.

## Resolution

### 2026-11-21T20:21:14Z · @issuectl

Short-window rail fixed in product; two specs updated to the agreed auto-fold; next-waiting-row archive step belongs to the archive cluster's answering-Taskfleet fixture. See result.md.
