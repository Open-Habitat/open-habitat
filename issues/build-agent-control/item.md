---
created: 2026-09-20
updated: 2026-10-03
type: task
status: in-progress
priority: normal
epic: native-agent-host-architecture
lane: agent-control
lane_seq: 50
collision: [AGENTS.md, internal/daemon/, docs/interfaces.md, internal/gateway/, contracts/v1/, web/src/app/, web/src/components/]
commits:
- hash: de00aba1219f6af692f54fb6646db88a6577dad3
  summary: Mark agent control in progress
- hash: 0201340bd3932731ae478fe4010758f7b49cc688
  summary: Route browser turn interruption to Pi abort rather than terminating session
- hash: 4277fa9dd8c3777bb49916732724fc194c790dce
  summary: Preserve Pi process on slow abort and reconcile interruption receipts
- hash: a94e2796e686f9676847ab5dfe98210660ba98ad
  summary: Restore rootless Pi controller fixture activation and record scope
---

# Complete native Pi conversation control

## Purpose

A person can start a Pi conversation in a workspace, send a message, follow the
response and tool activity, interrupt a turn and return after a browser
disconnect. They can deliberately continue an ended browser conversation using
its native history. These actions should form one working experience, with an
understandable outcome even when a connection fails.

The person's daemon runs Pi as their Unix user. Pi uses that user's native
configuration and writes its own history. Browser commands use HTTP and live
updates use the shared SSE stream. Closing the browser leaves Pi running;
returning recovers current state and history while preserving drafts, focus
and reading position.

## Command outcomes and ownership

Sending distinguishes pending, accepted, rejected and uncertain outcomes.
An uncertain send is not repeated automatically because it may already have
reached Pi. Interruption and continuation likewise show their actual outcome
or remaining uncertainty. Continuing a conversation does not establish how an
earlier uncertain command ended.

The daemon admits one browser writer to a conversation. Existing terminal
histories remain read-only; taking over a terminal session or coordinating
simultaneous terminal and browser writers is outside this work. After a daemon
restart, readable history alone does not establish control: continuation needs
the browser-origin and ownership checks described in the
[interface specification](../../docs/interfaces.md). Each person can read and
control only their own conversations.

The daemon owns its direct Pi child and systemd handles service cleanup.
A detached tool can outlive an interrupted turn, so interruption does not promise
that every tool process has stopped. A separate per-conversation supervisor is
outside the agreed architecture.

## Current implementation and remaining work

The implementation already has create, send and interrupt paths, a shared
snapshot/SSE journal, and explicit continuation of ended browser conversations
in both the daemon and browser. [Earlier implementation results](result.md)
record the slices and their evidence. [The shared browser stream result](../one-browser-event-stream/result.md)
records the later replay and recovery work; its browser evidence is synthetic.
The existence of these paths does not establish the complete real-Pi journey.

Complete and demonstrate the rendered browser journey against the pinned real
Pi with a synthetic provider: create, send, live response and tool activity,
interrupt, reconnect without duplicate submission, and end, deliberately
continue and send again using the same native history. Repair gaps found across
the daemon, contracts and browser. Distinguish recovered state from an uncertain
prior outcome, and verify that read-only terminal history stays read-only.

[TESTING.md](../../TESTING.md) defines the checks and what each proves. Record
the tested revision, outcomes and remaining gaps in the result. Installed-host
and real-account acceptance belong to @verify-live-pi-journey, which uses this
implementation and records failures that require further fixes here.

## Related work

@carry-typed-pi-events owns preserving Pi's structured content through the
contracts and browser. @design-pi-event-blocks owns its finished presentation;
@complete-conversation-ui covers the broader conversation experience and queue
controls. This issue owns the working control path across those components.

Incoming questions and unfamiliar content remain visible through a safe,
readable presentation. Pi-specific answer and cancel dialog controls are outside
the agreed scope. [Existing visual evidence](visual-acceptance.md) records earlier
screenshots and feedback; new UI changes use the shared production components
and receive proportionate visual evidence under the project's normal workflow.
