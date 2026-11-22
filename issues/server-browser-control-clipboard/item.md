---
created: 2026-11-22
updated: 2026-11-22
type: improvement
reporter: jari
status: done
priority: normal
lane: server-browser-control
lane_seq: 1
preparation: reviewing
review_status: requested
closed: 2026-11-22
---

# Prototype: server browser control by clicking the canvas, and clipboard both ways

## Observed

Jari 22.11.2026 trying the experimental server browser (signing in to a real site): (1) taking control from the agent and giving it back was awkward — clicking the canvas should be enough to take control, perhaps with a warning when the agent is in the middle of something; (2) pasting into the browser window was not possible; the clipboard should work in both directions intuitively, or there should be another solution. Prototype it, with an architecture sketch for the clipboard.

## Decisions

### 2026-11-22T06:18:38Z · @jari

Jari 22.11.2026: the OpenAI-built round is unusable and is discarded; redo with a Claude worker.

### 2026-11-22T07:24:53Z · @jari

Jari 22.11.2026: direction 1 Kehys (canvas border shows who controls; turn and Done on a tab; Clipboard tab opens a popover). Security level accepted: no agent clipboard tool, host refuses CDP clipboard permission grants, remote clipboard cleared on give-back, passwords via 'Kirjoita näppäilyinä'; honest that a same-UID agent is not isolated. Not answered, so the round's recommended defaults stand: an idle agent's takeover click is delivered to the page; auto-return after 3 idle minutes when no agent request is open. Implemented as the accepted specification in server-browser-control-clipboard-impl.
