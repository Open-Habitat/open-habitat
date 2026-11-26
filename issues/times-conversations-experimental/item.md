---
created: 2026-11-26
updated: 2026-11-26
type: feature
reporter: jari
status: open
priority: normal
lane: conversation-history
lane_seq: 1
preparation: ready
---

# Times in conversations (experimental)

## Goal

Implement times in conversations as decided by Jari (issue `times-conversations-prototype`,
rounds 1–3, decisions 24.–26.11.2026), behind an experimental switch:

- Day separators in a conversation (Tänään, Eilen, weekday + date further back), in the
  browser's time zone.
- Time on every message, right after the name on both sides ("Sinä 16.40",
  "✓ Vastaus valmis 17.03"), copy button after it.
- Turn duration only on multi-stage turns over 5 minutes, appended to the final answer's
  header ("✓ Vastaus valmis 17.03 · vuoro kesti 48 min"); single-stage turns show none (the
  work row already says it). Durations round down to minutes; over an hour "1 t 12 min".
- Stopped and restart-cut turns follow the same rule; the stop row reads
  "Keskeytit 14.52" (and the restart variant likewise), without the middle dot.
- The rail row age keeps its own language (elapsed time).

Round 3's `result.md` "Decisions for later review" list the remaining details; host facts
say no new host data is needed (native entry timestamps already reach the browser).
