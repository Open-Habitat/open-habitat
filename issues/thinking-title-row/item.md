---
created: 2026-10-16
updated: 2026-10-16
type: bug
reporter: jari
status: fixed
priority: high
lane: web
collision: [web/src/components/]
preparation: ready
closed: 2026-10-16
---

# Thinking block title missing; should sit on the Ajattelu row

Jari on the test server, 2026-10-16 (screenshots `ajattelu-suljettu.png` and `ajattelu-auki.png`). With the turn's work opened, the collapsed thinking block shows only "Ajattelu", and its one-line title (here "Interpreting extension messages", the model's reasoning summary heading) has disappeared from the default view. When the thinking is opened, the title appears as a separate bold heading inside the body. Jari: the title should be shown on the same row as the "Ajattelu" label, both collapsed and expanded, for example "Ajattelu · Interpreting extension messages", and it should not be repeated as a heading in the body.

Check `design-system/design.md` and the draft `design-system/drafts/Agentin vuoro.proto.html` (grep only) for the agreed thinking row, and find where the title stopped being shown (git log on the thinking block in `web/src/components/`). The title comes from the reasoning text's leading bold heading (`**…**`). Keep the full text unchanged otherwise.

## Acceptance Criteria
- [x] Collapsed and expanded thinking show "Ajattelu" plus the title on one row; the body no longer repeats the heading; several thinking blocks in one turn each show their own title.
- [x] Browser or component test covering both states; lab screenshots before and after.
