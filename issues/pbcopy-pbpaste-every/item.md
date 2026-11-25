---
created: 2026-11-25
updated: 2026-11-25
type: feature
reporter: jari
status: open
priority: normal
lane: unlaned
preparation: ready
---

# pbcopy/pbpaste on every installation, bridged to the person's browser clipboard

## Observed (Jari 25.11.2026)

`pbpaste` is missing on the agent host; Jari expects it on every installation. Agents (and
scripts, skills, instructions written on a Mac) reach for `pbpaste`/`pbcopy` to read or put
text on the person's clipboard. On a Habitat server there is no system clipboard: the
person's clipboard is in their browser.

## To design

- `pbcopy`: put stdin text on the person's clipboard. Feasible through the browser (a
  one-click "Kopioi" card or notice, or writing directly when the conversation is open and
  the browser allows `navigator.clipboard.writeText` from a user gesture).
- `pbpaste`: read the person's clipboard. Browsers allow `navigator.clipboard.readText` only
  with permission and focus, so this needs the person's action (a "Liitä agentille" control,
  or the pasted text arriving as an attachment) and must never read silently.
- Ship both as commands on PATH for agents and terminals (the runtime's `agent-bin`), with
  honest errors when no browser is present, and the agent guide naming them.
- Security: clipboard contents may be secrets; reading needs the person's explicit consent
  every time, and the text goes to the model provider.
