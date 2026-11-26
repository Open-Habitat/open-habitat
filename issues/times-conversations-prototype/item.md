---
created: 2026-11-24
updated: 2026-11-26
type: feature
reporter: jari
status: done
priority: normal
lane: unlaned
preparation: pending
closed: 2026-11-26
closed_by: agent
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

### 2026-11-26T02:55:43Z · @jari

Jari 26.11.2026 on round 3: (1) B Vain uusi tieto (duration only on multi-stage turns over 5 min, where the work rows do not already show it); (2) stopped and restart-cut long turns get their duration by the same rule; (3) stop row grammar follows the header ("Keskeytit 14.52"). With earlier decisions (B Kello with day separators, A Otsake: time right after the name), the design is complete. Next action (approved): implement as an experimental feature (times-conversations-experimental).

## Resolution

### 2026-11-26T02:55:43Z · @agent

Prototype rounds 1–3 decided; implementation in times-conversations-experimental.
