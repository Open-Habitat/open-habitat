---
created: 2026-10-29
updated: 2026-10-29
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: pilot.14 clean gate run
source_ref: taskfleet:01m62ynpgv06yv7g72pe6r66pe/gate-pilot14-gofmt
originating_run: 01m62ynpgv06yv7g72pe6r66pe
originating_run_kind: spinoff
closed: 2026-10-29
---

# test/browser-host/soniox.go is not gofmt-clean, so the clean gate fails final-checks

## Description

The pilot.14 clean gate on Birch (29.10. 06:20, main `f6b5e9cb`) passed every
test phase but failed final-checks with "green gate changed the clean tree":
the gate's gofmt step rewrote `test/browser-host/soniox.go`, whose struct field
alignment from `e253d0d1` (speech input with Soniox) was not gofmt-clean.
`gofmt -l ./cmd ./internal ./test` lists only that file. Until it is formatted,
no clean gate on main can pass, so no gated release can be cut.
