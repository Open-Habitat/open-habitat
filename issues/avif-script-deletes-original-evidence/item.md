---
created: 2026-11-08
updated: 2026-11-14
type: bug
status: open
priority: normal
provenance: conductor
source_ref: r68-avif-originals
lane: evidence-tools
lane_seq: 1
preparation: ready
---

# screenshots-to-avif.py converts and deletes original PNG evidence in an issue's evidence directory

## Description

Two prototype workers on 8.11.2026 (r68-levels, r68-levels5) ran scripts/screenshots-to-avif.py on issues/proto-integration-levels/evidence and it also converted Jari's committed originals jari-2026-11-08-cloud-shell-{1,2,3}.png and deleted the PNGs; both restored them from git by hand. Give the script an explicit file list or a prefix (e.g. --prefix r5-) and never touch files it did not create, so evidence originals are safe.
