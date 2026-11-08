---
created: 2026-11-08
updated: 2026-11-08
type: bug
reporter: jari
status: fixed
priority: normal
lane: unlaned
preparation: ready
closed: 2026-11-08
---

# Queued steer message should sit next to the composer, the next-waiting strip above it

## Description

Jari 8.11.2026, test server: with a queued steering message waiting for the
agent and, at the same time, the green *Seuraava odottava keskustelu* strip
(another conversation waits for you), the two sit the wrong way round. The
queued steer message belongs to this conversation's composer and should be
directly above the message field; the green next-waiting strip is about
another conversation and should be above the queued message (further from
the field). Jari asked for this exact order, so no prototype. Check the order
of all strips above the composer (queued messages, next waiting, warnings,
workers) for the same principle: the closer to the field, the more it belongs
to what you are typing.

## Acceptance Criteria

- [x] Queued steer directly above the field; next-waiting strip above it; 1440 and 390.
- [x] Touched specs green.
