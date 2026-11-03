---
created: 2026-11-01
updated: 2026-11-03
type: feature
reporter: jari
status: open
priority: normal
lane: explain-mode
lane_seq: 1
related: ['@proto-conversation-header-actions-r5']
preparation: pending
---

# Explain mode: dim the screen and explain whatever the pointer is on

Jari 1.11. on `proto-conversation-header-actions-r5`: **riff 1 · Himmennys
ja kortti osoittimessa**, covering the **whole screen**, with **no keyboard
shortcut yet**. The prototype (`issues/proto-conversation-header-actions-r5/
prototypes/selitystila.html`, NOTES.md, result.md) is the specification,
with the earlier rounds for what the guide teaches (round 4's result.md:
names, panel vs one-off action, shortcuts, grey when empty, where controls
go when narrow or on a phone).

- Entry: the start-page strip's *Selitä nämä mulle* (round 3 riff 3) and
  ⋯ › *Selitä tämä näkymä*. The automatic first-use card is not built.
- In the mode the screen dims, hovering any part (header, rail, composer,
  panels, terminal, editor) shows its explanation at the pointer, a press
  pins the card with *Kokeile*; Esc, the close control or pressing Selitä
  again ends it. On a phone, tap instead of hover.
- Texts come from the same source as the agent's UI reference
  (`open-habitat-ui`) or the catalogs, both languages, so they cannot drift.

Ships as an experimental feature (Kokeelliset ominaisuudet), off by default.

## Jari 3.11.

Before building, a more precise prototype round on the real views: `proto-explain-mode-r6`. Round 5's page is built from `issues/proto-conversation-header-actions-r5/prototypes/build.py` (`selitystila.html`).
