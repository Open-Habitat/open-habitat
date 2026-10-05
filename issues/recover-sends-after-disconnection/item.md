---
created: 2026-10-05
updated: 2026-10-05
type: task
reporter: jari
status: open
priority: normal
related: ['@align-navigation-design', '@rethink-project-docs']
lane: agent-control
collision: [web/src/app/App.tsx, web/src/components/Conversation.tsx, docs/]
preparation: ready
---

# Recover message sends after a server disconnection

## Purpose

A connection failure must not leave the person guessing whether their message
was sent or manually inspecting history before they can continue. Block new
sends while server connectivity is unavailable, then check the earlier send's
outcome automatically before enabling another send. A broken event stream
alone does not establish that the server cannot accept writes.

This implements Jari's 5 October decision in @align-navigation-design and
[the usage flows](../../docs/ui.md). During the architecture reading Jari
asked for a concrete implementation issue; both parts belong to the same
send-and-recover interaction.

## Current behavior

Source inspection on 5 October 2026 found that
`web/src/app/ConversationActions.tsx` checks conversation state, pending work
and authentication before sending, but has no server-connectivity condition.
A failed send retains its command ID and text and displays uncertainty with
an instruction to check state and native history.

`useConversation.ts` already looks up the receipt during refresh and when
reopening a conversation with an outstanding send. Status events also trigger
refresh. `conversationJournal.ts` reconnects the event stream, but opening it
again does not itself request the outstanding send receipt. Recovery therefore
can depend on a later event or user action. This is source evidence, not a
new live-server reproduction.

## Work

Make server connectivity, event-stream availability and the outcome of an
outstanding send work together in the browser. Preserve readable content,
the person's text and reading position during recovery. Show a short send
error when the reply is lost, and automatically check the original command's
receipt when connectivity returns. Never resend that command automatically
or describe an unknown outcome as a confirmed rejection. An unavailable
receipt after daemon restart still cannot prove the message was rejected.

Use the existing daemon receipt contract. Keep navigation and settings layout
in @align-navigation-design; this issue owns the sending and recovery behavior
and its feedback. Update the current-behavior description in
[events and recovery](../../docs/architecture/events-and-recovery.md) when
implemented.

## Acceptance Criteria

- [ ] Loss of server connectivity blocks new sends while preserving the text; loss of only the event stream does not falsely establish a server outage.
- [ ] After a lost reply, recovery checks the original send outcome automatically before allowing a new send, without requiring a manual history check or issuing a duplicate send.
- [ ] Accepted, rejected and still-unknown outcomes produce accurate, concise feedback; a missing receipt is not presented as rejection.

## Verification

Exercise a lost accepted reply, a server connection outage followed by recovery
without a new conversation event, and an SSE-only failure while HTTP writes
still work. Also cover a daemon restart that loses the receipt. Assert both
the visible recovery and the number of send requests, so a second execution
cannot be hidden behind successful-looking feedback.
