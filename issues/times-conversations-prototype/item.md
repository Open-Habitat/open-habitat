---
created: 2026-11-24
updated: 2026-11-25
type: feature
reporter: jari
status: open
priority: normal
lane: unlaned
preparation: ready
---

# Times in conversations (prototype)

## Question (Jari 24.11.2026)

Conversations and their messages show no times at all. How could time be shown, and
should it be visible? Its own prototype, separate from `agent-agent-message`.

## To explore

Per-message time (always, on hover/tap, only at gaps), day separators ("Tänään",
"Eilen", a date), relative vs. clock time, the person's time zone, long-running turns
(started/finished, duration), resumed conversations after days, phone, Explain mode, and
what the history already records per entry (timestamps in Pi's native session entries).

## Decisions

### 2026-11-24T19:56:56Z · @jari

Jari 24.11.2026 on round 1: B Kello (time on every message) with the day separators (Tänään, Eilen, …). Prototype next: the end row for long turns (C's "Valmis 17.03 · vuoro kesti 23 min") and riffs on where the time sits. The rail row age keeps its own language (elapsed time). Next action (approved): prototype round 2.

### 2026-11-25T18:08:10Z · @jari

Jari 25.11.2026 on round 2: A Otsake (time right after the name on both sides). Prototype further: when the turn duration is shown (every turn over 5 min vs. only multi-stage turns where the work row does not already say it), and whether/how a stopped long turn shows its duration. Next action (approved): prototype round 3 on those two.
