---
created: 2026-11-25
updated: 2026-11-25
type: feature
reporter: jari
status: done
priority: normal
lane: unlaned
preparation: ready
closed: 2026-11-25
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

## Decisions

### 2026-11-25T18:14:53Z · @jari

Jari 25.11.2026 on round 1: none of the cards/fields/notices; nothing new in the interface. He only means that commands run in the terminal can use pbcopy and pbpaste: the commands exist on PATH in Habitat's terminal on every installation. Next action (approved): ship minimal pbcopy/pbpaste for the browser terminal with no new UI (pbcopy through the terminal's existing OSC 52 clipboard path; pbpaste from what the terminal can already provide, e.g. the tmux buffer), honest errors elsewhere.

## Resolution

### 2026-11-25T18:31:30Z · @issuectl

pbcopy and pbpaste ship in the core runtime's agent-bin for commands in a Habitat terminal, through tmux and OSC 52 with no new interface; result.md has the evidence and the decisions for later review.
