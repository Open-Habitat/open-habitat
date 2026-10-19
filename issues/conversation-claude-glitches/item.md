---
created: 2026-10-19
updated: 2026-10-19
type: bug
reporter: jari
status: fixed
priority: high
lane: conversation-view
lane_seq: 1
collision: [web/src/components/conversation]
preparation: ready
closed: 2026-10-19
commits:
- hash: 26c8e184
  summary: keep an empty new conversation calm, show Stop, fade only clipped text
---

# New conversation shows history error, stop missing, long message fades

Jari on the test server (pilot.231), 2026-10-19, conversations whose default model is `claude-opus-5-5` (via Pi):

1. **New conversation shows an error before anything is typed.** He pressed + (Uusi keskustelu) and, before writing anything, the view showed a red "Historiaa ei saada" box and a full-width **Tarkista keskustelun tila** button above the composer. A new, empty conversation must show neither. Find what history read failed for a not-yet-started conversation (look at the daemon log on the VM around 2026-10-19 06:44 UTC for `maintainer`; read-only).
2. **Stop button missing while the agent works.** While a Claude Opus 5.5 turn was running, the Stop control was not there ("stoppainike on nyt kadonnut jonnekin, kun se agentti työskentelee"). It must be available whenever a turn is in progress.
3. **Long own message: last line fades out.** His sent message of seven lines: the bubble's edge fade mask fades the bottom line so the 7th line is barely readable. A message bubble must show all of its text; if a long message is clamped, clamp at a line boundary with a clear expand, never fade the last visible line of a short-enough message.

Also from the same session (works, no action): two messages typed quickly became two dashed bubbles that joined into one bubble; sidebar home link, hover and pulsing mark work.

## Resolution

### 2026-10-19T08:26:05Z · @issuectl

Browser-side fixes for all three; root causes and Decisions for later review in result.md. Live check in KOKEILTAVAA.
