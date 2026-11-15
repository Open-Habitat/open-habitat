---
created: 2026-11-15
updated: 2026-11-15
type: improvement
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-15/terminal-copy-notices
lane: unlaned
lane_seq: 1
preparation: ready
---

# Remove the terminal's copy and send-to-conversation confirmations

## Description

Jari 15.11.2026: in the browser terminal, copying a selection shows a notice "Valinta kopioitiin leikepöydälle." and sending it to the conversation shows "Valinta lisättiin keskustelun kenttään. Lähetä, kun olet valmis." These confirm what the person just did and saw happen; they are needless noise and must be removed. Error notices (the browser refused the clipboard) stay.

Strings: `web/src/text/browserShell.tsx` `copied`, `sentToComposer` (and the English ones).
