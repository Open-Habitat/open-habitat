---
created: 2026-11-01
updated: 2026-11-01
type: task
reporter: jari
status: open
priority: normal
lane: proto-conversation-header-actions-r5
lane_seq: 1
related: ['@proto-conversation-header-actions-r4']
preparation: pending
---

# Prototype round 5: Selitä opens a hover-to-explain mode

Jari 1.11. on `proto-conversation-header-actions-r4`: pressing *Selitä nämä mulle* (the start-page strip from round 3) could put the screen into an **explain mode**: while it is on, moving the mouse over any component of the screen shows what it is and does, and the mode ends by Esc, a close control or pressing Selitä again. Riff on that mode: how the mode looks (dimmed screen, outlines, a mode bar), what the explanation looks like at the pointer, how a phone does it (tap instead of hover), whether it covers only the header or the whole screen (rail, composer, panels), and how it relates to round 4's facts (panel vs one-off, shortcuts). Baseline is round 4's riff 3 (tour); 2–3 riffs, desktop and phone, light and dark, Finnish texts, one line per riff at the top of the page. The texts can come from the generated UI reference (`open-habitat-ui`).
