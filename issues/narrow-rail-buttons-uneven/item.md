---
created: 2026-11-01
updated: 2026-11-01
type: bug
reporter: jari
status: open
priority: normal
lane: narrow-rail-buttons-uneven
lane_seq: 1
preparation: ready
---

# Narrow rail (editor open) buttons are inconsistent

Jari 30.10. (pilot.536): in the narrow rail beside the editor the hover area's grey width and the content centring vary from button to button. The avatar sits at the left edge with extra grey to its right. The folder icon is smaller than the icon above it. The Home button's grey area is very narrow and a little taller than the others. All need the same hit-area size, centring and icon size (`account-button-hidden-with-editor`; styles in the `.ah-rail-collapsed` rules of `web/src/components/components.css` and `Controls.module.css`). Screenshots at device scale factor 2 before and after.
