---
created: 2026-10-16
updated: 2026-10-16
type: bug
reporter: jari
status: open
priority: normal
lane: web
collision: [web/src/app/, web/src/components/]
preparation: ready
lane_seq: 3
---

# Workspace page + icon sits at the bottom of its button

Jari on the test server, 2026-10-16 ~18:40 local: on the workspace page, the + icon is not vertically centred in its button; it sits at the button's bottom edge. Same family as the composer send arrow in `composer-and-new-conversation` point 2. Fix the shared cause (icon box/line-height in the icon button), not each instance, and check every icon button.

## Acceptance Criteria
- [ ] + and other icon buttons are optically centred; paired lab screenshots desktop and phone, light and dark.
