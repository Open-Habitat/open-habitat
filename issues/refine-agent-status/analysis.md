# What agent states mean

The navigation draft called an unread answer *valmis* and changed it to
*odottaa* when the person opened the conversation. That made reading a reply
look like a change in what the agent was doing. Jari clarified the meanings
in the [5 October decision](item.md#decisions): visiting changes attention;
closing changes the agent's lifecycle.

## Agreed meanings

- **Työskentelee:** the agent is doing work.
- **Odottaa:** an open agent is waiting for the person's response. The
  conversation needs attention until the person visits it. Afterwards the
  agent still waits. The person can reply later or close the agent.
- **Valmis:** the agent has been closed and its conversation remains available
  to read. Finishing one turn does not make an agent *valmis*.

Agent activity, attention and browser access answer different questions. A
read-only conversation can still belong to a working agent. A send error can
occur alongside an agent's activity state.

The [navigation decisions](../align-navigation-design/item.md#decisions) also
establish that a new error needs attention until the person visits the
conversation. After that, the error remains visible on its row. Read-only
access stays in the design examples while the product supports it.

## Examples for the design round

Show working, waiting before and after a visit, and closed agents. Also show
read-only access, a send error, unreadable history and unknown agent status.
Include a waiting agent with an explicit Pi question; its response interaction
is covered by [Pi dialogs](../show-pi-dialogs/item.md).

The presentation should distinguish what the agent is doing from what needs
the person's attention. The [navigation draft](../../design-system/drafts/Navigaatio%20ja%20asetukset.dc.html)
provides examples; the shared [control-state design](../design-control-states/item.md)
settles their visual form. Send recovery follows the separate
[send-and-reconnect work](../recover-sends-after-disconnection/item.md).

## What implementation still needs to establish

Two questions remain: how to recognise deliberate closure, and how to remember
which replies, questions and errors the person has seen. Their technical
representation belongs to implementation. The presentation must also handle
missing information: process presence alone does not establish work, and loss
of contact does not establish closure or a crash.

Technical background from the 5 October source inspection:

- The [snapshot contract](../../contracts/v1/snapshot.schema.json) distinguishes
  process observation, browser control and history availability. Its
  `confirmed_exited` value does not explain why a process ended.
- The [managed stop handler](../../internal/daemon/conversation_linux.go)
  returns `termination_unknown`. Recognising deliberate closure needs more
  than mapping that response to *valmis*.
- The browser has reading-position and foreground/background information,
  but a shared way to track seen replies, questions and errors across views
  remains to be implemented. No particular marker data model is decided here.

[Presentation implementation](../apply-control-state-design/item.md) owns
mapping host facts and reading state into the agreed meanings.
