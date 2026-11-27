---
created: 2026-11-26
updated: 2026-11-27
type: feature
reporter: jari
status: done
priority: normal
lane: unlaned
preparation: pending
closed: 2026-11-27
closed_by: agent
---

# Reply to a view or file card (prototype)

## Question (Jari 26.11.2026)

The reply button (experimental `reply-to-message`: ↩ in an agent message's corner, a quote
in the composer, the agent sees what was replied to) should also exist on the offer blocks:
view cards and file cards ("Ajat keskustelussa – prototyyppi, kierros 3 · Näkymä · 7,5 Mt").
Replying to a prototype card is how Jari answers its questions. Prototype it.

## Decisions

### 2026-11-27T07:16:03Z · @jari

Jari 27.11.2026 on round 1: C Tiedostoon asti (↩ always visible in the card corner like on agent messages, and its own ↩ on every file row of a multi-file offer). The quote shows the title only (not kind and size). The block the agent receives may be in English. Next action (approved): implement behind the reply-to-message experimental switch.

## Resolution

### 2026-11-27T07:16:03Z · @agent

Prototype round 1 decided; implementation in reply-view-file-impl.
