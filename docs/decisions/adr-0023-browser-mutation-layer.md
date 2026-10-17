# ADR 0023: One browser mutation layer with optimistic, pending and confirmed classes

**Status:** Accepted by Jari on 2026-10-16
([browser-mutation-layer](../../issues/browser-mutation-layer/item.md)). It
complements [ADR 0008](adr-0008-snappy-conversation-switching.md) and
[ADR 0009](adr-0009-conversation-state-ownership.md), which made reads fast;
this one is about writes.

Before this decision every browser action that changed something waited for
the host's reply and then reread the whole snapshot, and only that reread
changed the screen. Each feature also invented its own busy flag and its own
pending mask, so a new feature copied the nearest neighbour, usually the slow
one. Live, hiding a workspace took two to three seconds
([ui-responsiveness-review](../../issues/ui-responsiveness-review/analysis.md)).

## Decision

Every browser write goes through one client mutation layer
(`web/src/app/mutations.ts`). The layer names each command, gives it a client
command id, sends it, and reads its outcome in one way. What the person sees
while the host decides depends on who owns the fact the click changes:

| Class | Shown at once | Commands |
|---|---|---|
| Optimistic | The result, as normal; the host confirms in the background | workspace archive/restore, workspace rename, conversation archive/restore, Pi's default model, settings toggles, filters |
| Pending | The result dimmed and marked pending | send (Kupla odottaa), new conversation, new workspace and `git init`, closing an empty conversation, interrupting a turn |
| Confirmed | Only that the command is on its way: the control changes state and shows a local spinner | deletion, GitHub publish and clone, API keys and sign-ins, admin flags and quotas, the model catalog fetch, recap |

Optimistic commands are reversible and almost always succeed, and their fact
belongs to the person's own presentation state. Pending commands create
something or reach a process; the person needs to see that the click
registered, but nothing should be built on the result yet. Confirmed commands
destroy, authorize or spend, so nothing is presented before the host says so.

The rules that hold for every class:

- **Pending is steady.** A pending item is dimmed with a small mark. It does
  not blink.
- **Nothing is built on a pending item.** Its own controls wait or queue
  until it is confirmed. A second optimistic command on the same target
  queues behind the first and collapses to the latest.
- **Slow confirmation is said.** After about two seconds without an answer the
  item says that confirmation is taking long.
- **A refusal reverts in place with its reason** and keeps what the person
  typed, such as a draft.
- **Uncertain is not refused.** A transport loss or a 5xx keeps the item
  pending and checks the receipt (the next read, or a receipt endpoint where
  one exists). A typed 4xx, such as 409 or 429, is a definite refusal: the
  host said no, and nothing was written. A refusal code that itself says the
  outcome is unknown (`workspace_partial`) is uncertain.
- **Every pending item has a client command id**, and the overlay is keyed by
  it, so a late or repeated reply cannot apply twice or to a newer command.
- **The overlay is not a store.** It lives only in memory, per command, and is
  dropped on confirmation, on failure and on an identity change. The host's
  files remain the only record.

Confirmation does not come from rereading the snapshot. A mutation reply
carries the changed resource with its position on the event journal, and the
daemon publishes workspace changes on the journal as `workspace.changed`, so
other tabs converge without a snapshot read. The browser applies a reply or an
event as a patch, keeps the patch until a snapshot whose cursor has passed it
arrives, and re-applies it over an older snapshot that was already on its way.
That is the journal's own replay rule, applied to one more kind of fact. The
snapshot stays the read for startup and recovery.

## Consequences

- A new write is added by naming its command in the layer's table. A unit test
  fails when a source file outside the layer sends a write directly, so the
  next feature starts on the fast path instead of copying the slow one.
- The contract gains the workspace change resource
  (`contracts/v1/workspace-change.schema.json`), the reply of
  `POST /api/v1/workspaces` carries it, and `workspace.changed` is published
  for the first time.
- For an optimistic command the person can briefly see something the host
  later refuses. That is acceptable only because the command is reversible,
  the refusal is rare, and the revert is never silent.
- Creation still waits for a snapshot to show the new record, because only a
  native observation can describe a new workspace or conversation in full.
  Its pending presentation covers that wait.
