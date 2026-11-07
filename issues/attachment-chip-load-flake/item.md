---
created: 2026-11-07
updated: 2026-11-07
type: bug
reporter: conductor
status: fixed
priority: normal
preparation: ready
lane: attachment-flake
lane_seq: 1
closed: 2026-11-07
---

# Attachment chip does not appear under full-suite load (attachment-documents PDF case)

## Description

The clean gate on e8ab27522 (2026-11-07, Birch, ordinary browser suite at full
parallelism) failed one case:
`tests/attachment-documents.spec.ts:208` › a PDF with an embedded font draws its
pages in a browser without the newest built-ins — the attachment chip never
appeared in the composer within 30 s (`attachment-chip` count 0). The same spec
passed twice in a row by name on the same tree (`browser-focused.py --spec
attachment-documents.spec.ts`, `OH_BROWSER_WORKERS=2`). All other 564 ordinary
and 170 lab cases and all Go packages passed. Likely a load-sensitive wait in
the upload → chip path; find what the chip waits on under load.

## Acceptance Criteria

- [ ] cause found and fixed (product or spec), case stable under the full suite
