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
