---
created: 2026-11-01
updated: 2026-11-01
type: task
reporter: jari
status: done
priority: normal
lane: proto-settings-breakpoints
lane_seq: 1
preparation: pending
closed: 2026-11-01
closed_by: conductor
---

# Prototype: settings breakpoints with an adjustable slider

Jari 30.10. and 1.11. (pilot.536, pilot.572, desktop narrowing the window): the settings' own sidebar goes away too late, so the content beside it narrows until it does not fit. At its narrowest while the settings menu still shows, the content column is about 300 px (Jari's screenshot: Account card name on two lines, email broken as *jari.mustonen@i / ki.fi*, texts a few words per line); the menu takes more room than the content. Current limits: `web/src/components/Settings.css` (`@media (max-width: 760px)` at lines 212, 293, 320 and 800 px at 372). Jari wants a prototype where the breakpoints can be adjusted (a slider or choices) and tried by him before a decision: the real settings pages in a resizable frame, with the breakpoint values as controls and the resulting layouts shown.

## Resolution

### 2026-11-01T16:07:35Z · @conductor

Jari 1.11.: answered; continued in the issues of the conductor's commit.
