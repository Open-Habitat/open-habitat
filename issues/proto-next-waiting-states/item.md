---
created: 2026-10-31
updated: 2026-10-31
type: task
reporter: jari
status: done
priority: normal
lane: proto-next-waiting-states
lane_seq: 1
preparation: pending
closed: 2026-10-31
---

# Prototype: next-waiting row as a state machine

## Description

Jari 31.10.: the row that offers the next waiting agent (*Sillä aikaa ·
N odottaa sinua · Käy läpi*, and the Jono round behind it, experimental
`next-waiting-row`) does not work properly. Think about it more abstractly:
in which situation does it show what.

1. **The current behaviour as a state-machine graph**, read from the code
   (`web/src/app/NextWaitingDock.tsx`, `components/NextWaitingRow.tsx`,
   `components/NextWaitingQueue.tsx` and what feeds them): states, the
   events that move between them (this conversation's agent starts or
   stops working, asks something, another conversation starts or stops
   waiting, the person sends, opens another conversation, archives, starts
   or ends a round, reloads), what is shown in each, and where it goes
   wrong (Jari's screenshot in `next-waiting-no-return/attachments`; that
   issue's fixes may already be on main, include them).
2. **Alternative state machines** (2–3, on one axis), each as a graph plus a
   clickable prototype where Jari can fire the events and see what the row
   shows, in production conversation context, desktop and phone. Jari's
   starting points: the row is not a tracking tool; it is for the time this
   conversation's agent works; no automatic way back.

## Comments

### 2026-10-31 · Jari

Chose round 2 **Vuoron loppuun**; implementation is `next-waiting-on-send`.
