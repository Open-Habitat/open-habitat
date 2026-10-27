---
created: 2026-10-27
updated: 2026-10-27
type: improvement
reporter: conductor
status: open
priority: low
provenance: other
provenance_detail: views-blank-and-birch-gap review
source_ref: taskfleet:01m5y4wwrqrdhpw976sbf6evjd/frame-src
lane: offers
lane_seq: 6
preparation: ready
---

# HTML view can navigate its own frame to a foreign origin (no frame-src on the app page)

## Description

Found during views-blank-and-birch-gap (2026-10-27), pre-existing: a view's document can navigate its own sandboxed frame to any foreign origin because the app page's CSP has no frame-src limiting frames to the view origins. The assessment rated it rare (low confidence). Fix would be a frame-src on the app page CSP that allows only the view host origins.

## Decisions

### 2026-10-27T12:59:39Z · @jari

Jari 2026-10-27: työhön (konduktorin suositus).
