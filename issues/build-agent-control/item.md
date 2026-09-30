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

The target is that a user can start a Pi conversation in a workspace, send a
message, follow text and tool activity live, interrupt work and return after a
browser disconnect.
They can deliberately continue an ended browser conversation with its native
history.

The mapped user's daemon owns the Pi process. Pi runs tools, uses its native
configuration and writes its history; the host does not need a second history
store. The agreed interface uses HTTP for browser commands and Server-Sent
Events (SSE) for live updates. Closing the browser leaves Pi running. A slow
connection or a returning browser recovers current state and native history without losing track
of work. Drafts, editor focus and reading position survive updates and session
revalidation.

Sending needs an understandable outcome: pending, accepted, rejected or uncertain.
An uncertain send is not repeated automatically because the first one may have
reached Pi. Interruption likewise shows its actual result or remaining
uncertainty. The daemon owns its direct Pi child and systemd handles service
cleanup, but a detached tool can outlive an interrupted turn. That limit matters
when deciding whether work has stopped and another writer can safely start.
A per-conversation supervisor is outside the agreed scope.

Browser conversations have one writer in both test and production use. Existing
terminal histories are read-only; coordinating simultaneous browser and terminal
writers is outside this task. After a daemon restart, readable history does not
by itself mean that control is available. Each authenticated user can access
only their own history and control only their own conversations.

Incoming questions and unfamiliar content reach the browser at least as safe
text, so unsupported presentation does not hide what the agent said or asked.
Pi-specific answer and cancel dialog controls are outside the agreed scope.
@complete-conversation-ui owns rich presentation and queue controls; the
[implementation map](../plan-v1-implementation/implementation-briefs.md)
assigns the related contract scenarios.

Build on the existing daemon controller, gateway routes and production browser
components. The current browser polls conversation status over HTTP; SSE and
continuation of ended browser conversations are not implemented yet.
[result.md](result.md) records earlier implementation slices and
their evidence, not a current task list. Completion includes SSE, deliberate
continuation of ended browser conversations, and a demonstrated browser journey
against real Pi covering send, live response, interruption, ended-conversation
continuation and disconnect/reconnect.
[TESTING.md](../../TESTING.md) distinguishes browser behavior, real Pi with a
synthetic provider, real provider use and Unix-user isolation; the result should
make clear which of those the demonstration establishes.

The [interface specification](../../docs/interfaces.md) describes the agreed
contract. Buffering and limits serve observed responsiveness and recovery needs.
[visual-acceptance.md](visual-acceptance.md) holds browser evidence and Jari's
visual feedback; pending appearance review does not block functional work or
independent tasks.
