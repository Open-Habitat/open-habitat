---
created: 2026-10-29
updated: 2026-10-29
type: bug
reporter: jari
status: open
priority: normal
lane: settings-polish
lane_seq: 3
preparation: ready
---

# Editor Cmd+E is taken by the browser

_Source: chat_

## Description

From KOKEILTAVAA.md (test server testing):

Editorin Cmd+E jää selaimelle (Jari 29.10., pilot.508, Mac): Cmd+E ei vaihtanut tekstin ja esikatselun välillä, vaan selain avasi oman sivupalkkinsa. Selain oli muu kuin Brave (selain tarkentuu). Editori kuuntelee näppäintä `keydown`-tapahtumana editorielementillä (`previewKey`, `web/src/components/BrowserEditor.tsx`). Jos selain varaa Cmd+E:n itselleen, sivu ei saa tapahtumaa lainkaan, joten tarvitaan toinen yhdistelmä tai rinnakkainen yhdistelmä. Esc palasi esikatselusta tekstiin oikeaan kohtaan, ja Tallenna-ikonin täyttyminen sekä Cmd+S esikatselusta toimivat (`editor-full-preview-icons`).
