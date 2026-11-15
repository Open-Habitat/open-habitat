---
created: 2026-11-15
updated: 2026-11-15
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: chat:2026-11-15/terminal-copy-notices
lane: unlaned
lane_seq: 1
preparation: ready
closed: 2026-11-15
---

# Remove the terminal's copy and send-to-conversation confirmations

## Description

Jari 15.11.2026: in the browser terminal, copying a selection shows a notice "Valinta kopioitiin leikepöydälle." and sending it to the conversation shows "Valinta lisättiin keskustelun kenttään. Lähetä, kun olet valmis." These confirm what the person just did and saw happen; they are needless noise and must be removed. Error notices (the browser refused the clipboard) stay.

Strings: `web/src/text/browserShell.tsx` `copied`, `sentToComposer` (and the English ones).

## Acceptance Criteria

- [x] Terminal copying and sending to the composer show no success confirmation; clipboard errors remain visible.
- [x] Dead Finnish/English strings, obsolete Explain text and generated skill references are cleaned up.
- [x] Browser regression tests verify clipboard contents, silent success, visible failure and composer insertion.
- [x] Other UI success confirmations are listed without changing them in `result.md`.
