---
created: 2026-10-02
updated: 2026-10-02
type: task
reporter: jari
status: open
priority: high
related: ['@incremental-history-during-turn']
lane: client-history
lane_seq: 10
---

# Design snappy conversation switching from a browser-held event stream

## Jari's request (2026-10-02, verbatim intent)

The target is an extremely tight user experience. Switching between
conversations (tabs) should make no server round trips. As discussed earlier,
the server streams the messages/events of *all* of the person's conversations
to the browser, which sorts them into the ones it needs and ignores the rest.
The browser keeps a history of all those conversations, but lightly.

Snappy means: a conversation that was just looked at appears *snap* when
clicked. Occasionally something takes time, but those are *individual
events*. Legitimate spinners:

- scrolling far back in time in a conversation, while older history is
  fetched from the server;
- opening a conversation not looked at for, say, two days.

Think through properly what happens and where: on page load, on tab switch,
during a running turn, on reconnect/gap, on scroll-back, for a cold
conversation, on identity change, across tabs/devices of the same Unix user.
Decide what is removed from the current model (per-conversation status +
history fetch on every open, per-conversation EventSource, remount keyed on
conversation id).

## What the design must deliver

- Options and ideation (several designers/models), with one recommendation
  and the reasoning, recorded as an ADR draft for Jari's decision. This moves
  state into the browser, which touches the project principle against
  parallel history stores and speculative caches (`CLAUDE.md`,
  `docs/architecture.md` "a cache needs a measured performance need"); the ADR
  must say why this is a view of native truth and not a second source, how it
  is bounded, invalidated and reset (identity change, gap,
  `snapshot.invalidated`), and what stays authoritative on the daemon.
- Numerical simulations with stated assumptions: network traffic of an
  all-conversations stream (idle, typical, heavy multi-agent use; deltas vs
  entries), browser memory/storage (in-memory vs IndexedDB; per-conversation
  window size; eviction), browser CPU (event parsing/sorting/rendering per
  second), daemon/gateway cost of fan-out. Jari expects it is not heavy; the
  simulation should confirm or refute that with numbers.
- Latency budget per interaction (switch to a recent conversation, cold
  open, scroll-back, send) and how the design meets "snap" (e.g. render from
  memory within one frame), measured or modelled.
- Implementation slices as follow-up issues once Jari accepts.

Related: @incremental-history-during-turn (current refresh re-reads history
from the first page during a turn), @browser-state-rewrite (just landed),
@daemon-drop-status-stream (events journal is the only push channel).
