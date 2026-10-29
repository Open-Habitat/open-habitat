---
created: 2026-10-29
updated: 2026-10-29
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: pilot.14 clean gate run
source_ref: taskfleet:01m62ynpgv06yv7g72pe6r66pe/file-offer-tab-before-focus-returns
originating_run: 01m62ynpgv06yv7g72pe6r66pe
originating_run_kind: spinoff
closed: 2026-10-29
---

# agent-file-offers spec presses Tab before the preview hands focus back

## Description

The second pilot.14 clean gate on Birch (29.10. 06:38, main `f93e6846`) failed
`agent-file-offers.spec.ts:253` ("a package card downloads one zip…"): after
Escape closes the preview, the spec pressed Tab as soon as the dialog had
unmounted, before the dialog handed focus back to the row's preview button, so
under load Tab started from elsewhere and the download button was never
focused. It passed in the first gate of the same morning.
