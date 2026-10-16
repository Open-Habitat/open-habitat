---
created: 2026-10-16
updated: 2026-10-16
type: bug
reporter: jari
status: open
priority: high
lane: web
collision: [web/src/app/, web/src/components/]
preparation: ready
---

# Opening from home lands mid-conversation; empty 'Laajennuksen viesti' card

Jari on the test server, 2026-10-16:
1. "Avasin chatin etusivulta painamalla projektin kuvauksen 'Avaa'-painiketta, niin ei auennut lopussa vaan se piti skrollata alas." (In short: opening a conversation from the home page card's "Avaa" did not open at the end; he had to scroll down.) A conversation opened from anywhere must open at its latest content.
2. "Vastaukseen tulee tällainen 'Laajennuksen viesti' -teksti" (screenshot `laajennuksen-viesti.png`; in short: an empty card titled "Laajennuksen viesti" appears above the conversation). It sits above "SINÄ Moi" in a fresh conversation with gpt-6.1-sol. It is probably a Pi extension's custom message (for example from pi-claude-bridge, recap or processes) rendered as a bare card. Find which extension emits it and what it carries. Render known extension messages meaningfully, and hide or quietly fold ones that carry nothing for the reader.

## Acceptance Criteria
- [ ] Opening from the home card, the sidebar and the workspace page lands at the end; browser test.
- [ ] The empty "Laajennuksen viesti" card no longer appears; the cause and the rule for extension messages are in result.md; test with the real message shape.
