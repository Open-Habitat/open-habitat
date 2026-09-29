---
created: 2026-09-20
updated: 2026-09-28
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

A user can work with Pi from the browser: start a conversation in a workspace,
send a message, watch the response and tool activity as they happen, and return
after a browser disconnect. They can also continue an ended browser conversation
with its existing native history.

## Scope

The mapped user's daemon owns the Pi process. Pi executes tools, uses its native
configuration and writes its own history. The browser sends commands over HTTP
and receives live updates through Server-Sent Events (SSE).

Browser conversations have one writer. The test system is operated so the same
conversation is not controlled simultaneously from the browser and SSH/tmux or
independent clients. Prior terminal histories are read-only; terminal takeover
and cross-process writer coordination are outside this task.

Interruption is best effort. The daemon owns the direct Pi child and bounds its
writes and shutdown waits; systemd handles service cleanup on daemon stop or
crash. A detached native tool may outlive an individual interruption. Show
uncertain termination honestly and do not start another writer into unresolved
work. A per-conversation cgroup or separate supervisor is not required.

Pi-specific interactive question dialogs and their response/cancellation protocol
are outside this task. Ordinary conversation continues through user messages.
@complete-conversation-ui owns the remaining rich presentation and queue controls.

## Acceptance Criteria

- [ ] The user starts a Pi conversation in a selected workspace, sends a message and sees whether it is pending, accepted, rejected or uncertain.
- [ ] Response text and tool activity arrive through SSE while Pi works. A slow or disconnected browser can recover the current state without silently losing track of the work.
- [ ] Closing the browser leaves Pi running. On return, the user sees the conversation's current state and native history; an uncertain message is never sent again automatically.
- [ ] The user deliberately continues an ended browser conversation with the same native history. After a daemon restart, the UI distinguishes readable history from available control and does not claim unresolved work has stopped.
- [ ] The user can request interruption and see its actual outcome or remaining uncertainty.
- [ ] Drafts, editor focus and reading position survive live updates and session revalidation. Reopening a conversation shows Pi's native history.
- [ ] Each authenticated user can control only their own conversations; browser input cannot select another Unix user's processes, sockets or history.
- [ ] The browser journey is demonstrated against real Pi, including send, live response, interruption, ended-conversation continuation and disconnect/reconnect.

## Planning handoff

Build on the existing daemon controller, gateway routes and production browser
components. Complete SSE and ended-conversation continuation, and verify the
whole browser journey. Keep the browser/host contract and its generated types
in sync with the implementation.

The [implementation briefs](../plan-v1-implementation/implementation-briefs.md)
map this work to Y4–Y5. Use this issue's scope for agent control; older numeric
buffer limits and test-command proposals are not additional acceptance criteria.

Verify browser behavior, real Pi behavior and Unix-user isolation at the layers
that exercise them. Record the tested revision and limits of each result,
including whether the provider was synthetic or real. Use disposable fixtures;
a real provider login requires the person's participation.
Run `./scripts/ci-local.sh --clean --json` before landing.

Provide proportionate screenshots and browser evidence in `visual-acceptance.md`.
Record Jari's visual verdict when given; unreviewed appearance stays unreviewed,
but a screenshot verdict is not a prerequisite for completing functional work
or proceeding with independent work.
