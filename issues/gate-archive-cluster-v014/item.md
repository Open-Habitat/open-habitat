---
created: 2026-11-21
updated: 2026-11-21
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: release gate run
source_ref: taskfleet:01m7zvhhzmbh3rcm00vqkf2k8y/gate-archive-cluster
originating_run: 01m7zvhhzmbh3rcm00vqkf2k8y
originating_run_kind: spinoff
closed: 2026-11-21
commits:
- hash: c263b654
  summary: archive specs run with an answering Taskfleet
- hash: edbfa428
  summary: quick-succession opens Hiljaiset on its device
- hash: 87cbd610
  summary: trash case reads the storage breakdown
- hash: 5767d136
  summary: a rail too short for its regions scrolls as a whole
---

# v0.1.4 gate: archive cluster of browser specs fails

## Description

The v0.1.4 clean gate on main failed in the archive cluster of browser specs,
deterministically when rerun alone at low load:

- archive-damaged-history.spec.ts:12 (all four sizes), native-history.spec.ts:81:
  the archive request never left the browser.
- archive-uncertain-refusal.spec.ts:12: the archive click did not leave the
  conversation for its workspace.
- rail-archive.spec.ts:133 and :330, next-waiting-row.spec.ts:342: the row stayed
  and no archive notice appeared.
- archive-quick-succession.spec.ts:18: the quiet rows were not visible.
- Lab: lab-workspace-page.spec.ts:457, lab-worktree-agent.spec.ts:23 (archive
  timeouts), lab-workspace-trash.spec.ts:49 (storage-usage bar missing),
  lab-foundation.spec.ts:8 (the 390 × 390 drawer does not scroll).

Decide per case whether the product regressed or the spec is outdated against
an agreed change, fix accordingly, and get every listed spec green three times
in a row.
