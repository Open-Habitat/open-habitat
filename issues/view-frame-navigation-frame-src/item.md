---
created: 2026-10-27
updated: 2026-10-27
type: improvement
reporter: conductor
status: untriaged
priority: normal
provenance: other
provenance_detail: views-blank-and-birch-gap review
source_ref: taskfleet:01m5y4wwrqrdhpw976sbf6evjd/frame-src
---

# HTML view can navigate its own frame to a foreign origin (no frame-src on the app page)

## Description

Found during views-blank-and-birch-gap (2026-10-27), pre-existing: a view's document can navigate its own sandboxed frame to any foreign origin because the app page's CSP has no frame-src limiting frames to the view origins. The assessment rated it rare (low confidence). Fix would be a frame-src on the app page CSP that allows only the view host origins.
