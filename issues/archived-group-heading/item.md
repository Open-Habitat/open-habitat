---
created: 2026-10-17
updated: 2026-10-17
type: bug
reporter: jari
status: open
priority: normal
lane: web
collision: [web/src/app/, web/src/components/]
preparation: ready
---

# Arkistoidut group heading shows a count and looks like a button

Jari, 2026-10-17 ~07.00 on pilot.207: the sidebar's archived group (from `archive-workspace-restore`) is titled "Arkistoidut 2". The 2 is a count and is not needed, and the group does not look good: it reads as a button whose label is "Arkistoidut 2". Make it a quiet section heading consistent with the sidebar's other groups (Huomio ensin / Ryhmät decisions in `design-system/design.md`), without the count, clearly a collapsible group rather than a button.

## Acceptance Criteria
- [ ] Heading without count, styled like the sidebar's other group headings (paired screenshots light/dark, desktop/phone).
