---
created: 2026-09-20
updated: 2026-09-30
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: agent-control
lane_seq: 50
collision: [docs/, AGENTS.md, design-system/, internal/daemon/, web/src/components/Conversation.tsx]
---

# Connect v1 conversation controls to Pi

## Goal

A user can start a Pi conversation in a workspace, send a message, follow the
response and tool activity, interrupt work and return after a browser disconnect.
They can deliberately continue an ended browser conversation with its native
history.

## How this fits the native system

The mapped user's daemon owns the Pi process. Pi runs tools, uses its native
configuration and writes its history. Browser commands travel over HTTP and live
updates over Server-Sent Events (SSE).

Browser conversations have one writer in both test and production use. Existing
terminal histories are read-only; this task does not coordinate simultaneous
writers across browser and terminal processes. After a restart, readable history
and available control are separate facts.

Interruption is best effort: the daemon owns its direct Pi child, while systemd
handles service cleanup. A detached tool can outlive an interrupted turn. Show
that uncertainty so the user does not mistake unresolved work for a stopped
conversation or start a competing writer. A per-conversation supervisor is not
needed for this scope.

Incoming questions and unfamiliar content reach the browser as safe text, so an
unsupported dialog does not hide what the agent asked. Pi-specific answer and
cancel dialog controls are outside the agreed scope. @complete-conversation-ui
owns rich presentation and queue controls.

## What completion looks like

- [ ] A message has an understandable pending, accepted, rejected or uncertain outcome; an uncertain send is not repeated automatically.
- [ ] Text and tool activity arrive live through SSE, and a slow or disconnected browser recovers the current state without silently losing track of work.
- [ ] Closing the browser leaves Pi running. Returning shows current state and native history; an ended browser conversation can be deliberately continued.
- [ ] Interruption shows its actual result or remaining uncertainty, including the limits of control after daemon restart.
- [ ] Drafts, editor focus and reading position survive live updates and session revalidation.
- [ ] Each authenticated user controls only their own conversations and accesses only their own native history.
- [ ] The browser journey is demonstrated against real Pi: send, live response, interruption, ended-conversation continuation and disconnect/reconnect.

## Starting from the existing implementation

Build on the daemon controller, gateway routes and production browser components.
[result.md](result.md) records intermediate implementations and tests at specific
revisions. Compare its old gap descriptions with current code, especially after
the later UI work. SSE and ended-conversation continuation remain explicit
completion outcomes, not reasons to rebuild the parts already working.

The [implementation map](../plan-v1-implementation/implementation-briefs.md)
assigns related work; [TESTING.md](../../TESTING.md) defines project checks.
Keep the contract consistent with behavior and choose buffering or limits from
concrete needs and observations. Browser tests, real Pi tests and Unix-user
isolation tests answer different questions; record which were exercised and
whether the provider was synthetic or real.

[visual-acceptance.md](visual-acceptance.md) holds browser evidence and Jari's
visual feedback. Unreviewed appearance stays visible as such, while functional
work and independent tasks can proceed.
