---
created: 2026-10-24
updated: 2026-10-24
type: improvement
status: open
priority: normal
provenance: other
source_ref: taskfleet:01m5r2vy6bvn62cjb3tzngm2d2/wrap-up:go-notices
originating_run: 01m5r2vy6bvn62cjb3tzngm2d2
originating_run_kind: spinoff
lane: unlaned
collision: [release/manifest]
preparation: ready
---

# gog and rclone ship without transitive Go module licence notices

## Description

## Description

Observed by the gitea-runtime-qualification worker (run 01m5r2vy6bvn62cjb3tzngm2d2): tea now ships with a third-party notice generated from its embedded Go module list (scripts/go-binary-notices.py, verified against sum.golang.org), but gog and rclone in the integrations profile ship only their top-level licences, not the licences of their transitive Go modules. Generate their notices the same way so the shipped runtime's licence notices are complete.
