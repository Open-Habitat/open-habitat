# ADR 0021: A resumed conversation is told what happened while its Pi was stopped

**Status:** Accepted by Jari on 16 October 2026 in
[taskfleet-pi-extension](../../issues/taskfleet-pi-extension/analysis.md)
("Miksi ei saisi? Totta kai."), implemented in
[spinoff-catch-up-on-resume](../../issues/spinoff-catch-up-on-resume/item.md)
and [processes-lost-on-restart-silent](../../issues/processes-lost-on-restart-silent/item.md).

A release restarts the daemon, and every browser conversation's Pi ends with
it. Its background processes, including the `taskfleet run wait` that would
have woken the agent when a spinoff finished, end too, and pi-processes
records nothing for those stops. Spinoffs run on in their own user units.
When the person next sends ([ADR 0020](adr-0020-resume-on-send.md)), the agent
continued as if nothing had happened: a process it had started was simply
gone, and a spinoff that finished later woke no one.

Open Habitat's companion Pi extension therefore adds one context message to
the first run after its Pi starts, when there is something to tell: which of
the conversation's processes were cut off when the earlier Pi stopped, which
of its spinoffs settled since the branch's last entry and how, and which
still-running spinoffs it had been waiting for, with the exact wait to start
again. The message does not start a turn (it rides on the person's message,
which already does) and never repeats what an earlier one said. Its sources
are the conversation's own Pi branch and the user's own Taskfleet records,
read inside the user's Pi as that user; Open Habitat stores nothing new. The
process tray shows the same cut-off processes, read from the same branch,
until the agent has been told.

This refines [ADR 0017](adr-0017-observe-taskfleet-spinoffs.md). Its "no
injected messages into the parent" kept the daemon from writing a
conversation, and that still holds: the daemon never writes into a
conversation. The message here is written by Pi itself through its extension
API, the same way pi-processes writes every exit notification.

The agent restarts the wait itself, with the `process` tool. Pi gives an
extension no way to start a pi-processes process outside a tool call, and a
second waiter inside the companion would duplicate pi-processes, which
Fleetrepo ADR 0011 rejected; pi-processes stays the only background-process
owner, and the restored wait is an ordinary, visible, stoppable process.
