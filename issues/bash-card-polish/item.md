---
created: 2026-10-21
updated: 2026-10-21
type: bug
reporter: jari
status: open
priority: normal
lane: unlaned
preparation: ready
---

# Bash card polish: icon artifact, exit text, align with the bash tool block

## Description

Jari 2026-10-21 on the test server: (1) the card's open/close control shows an extra small triangle next to the chevron/terminal icon (screenshot: '>' with a stray little corner glyph); (2) 'paluuarvo 0' should read 'Valmis' for success (show the code only on failure); (3) overall the ! command card should take more after the agent's bash tool block in the conversation (same visual language for command, output disclosure and status). Fix in production; reuse the tool block's components/tokens rather than a parallel style.
