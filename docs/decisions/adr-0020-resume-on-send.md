# ADR 0020: A stopped browser conversation resumes when the person sends

**Status:** Accepted by Jari on 16 October 2026 in
[lazy-resume-on-send](../../issues/lazy-resume-on-send/item.md) and
[proto-queued-send](../../issues/proto-queued-send/item.md#decisions).

Releases restart the daemon, which ends every browser conversation's Pi. An
explicit "continue" step after each release made ordinary conversations look
read-only. Keeping Pi alive across daemon restarts was rejected as too
complicated. Instead, a browser conversation without a running Pi opens as its
readable native history with a usable field, and Pi starts when the person
sends a message. Opening, reading or reconnecting never starts Pi.

The same rule covers a conversation that is still being created. Messages sent
before Pi runs are held by the daemon, in order, under the browser's command
IDs, and Pi receives them joined into one prompt. Stop before Pi runs returns
exactly the held texts; a failed start keeps them for a retry. The daemon owns
the held messages because it owns Pi and the receipts; the browser trusts its
held list and receipts and never resends a message whose outcome is unknown.

This refines [ADR 0003](adr-0003-host-stack.md)'s deliberate continuation:
the person's send is now the deliberate act, and the start still requires the
same ownership proof that the previous work has ended. Held messages live only
in daemon memory, like receipts, not in a new store; a daemon restart loses
them and the browser shows them as uncertain. Terminal history has no browser
origin and stays read-only, as in [ADR 0001](adr-0001-unix-native-agent-host.md).

## Amendment: typing wakes a resting conversation (2026-10-27)

**Status:** Accepted by Jari on 27 October 2026 in
[proto-wake-stopped-agent](../../issues/proto-wake-stopped-agent/item.md#decisions)
(rounds 1 and 2, Kortti); implemented by
[wake-stopped-agent](../../issues/wake-stopped-agent/item.md).

The person's first typed character in a resting conversation is now also a
deliberate act: it starts Pi without a turn (a wake), so the agent is ready
when the message is sent. The wake is a new idempotent operation on the
existing continue route: a Pi that is already running or starting is the
answer, never a conflict, a second child or a turn. It requires the same
ownership proof as any start. Opening, reading and reconnecting still start
nothing, there is no countdown on opening and no automatic wake when
background work settles. A woken Pi that receives no message stops again as
an idle Pi.

Before anything starts, the conversation shows Habitat's own report of the
rest (the card): when and why Pi stopped, the processes cut off with it, the
conversation's Taskfleet runs that settled and were not yet reported with
Taskfleet's own summaries, and the runs still working. The daemon keeps the
stop time and cause in memory with the conversation's handle, like receipts;
a conversation without a handle has rested since the daemon started. The
first message carries the same report to the agent (the companion's
catch-up, ADR 0017 as amended), which then stays in history as the rest's
marker.
