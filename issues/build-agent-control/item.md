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

## What is already implemented

Create, send, interrupt, shared SSE updates and explicit continuation of ended
browser conversations have daemon and browser implementations. The recorded
results do not identify a specific missing control feature. They leave a gap in
integration coverage:

- Browser tests use a fake Pi child (`test/browser-host/`,
  `web/tests/browser-conversation.spec.ts`). They exercise rendered UI and
  recovery, but cannot show that the same behavior works with Pi itself.
- The real-Pi fixture (`scripts/test-real-pi-controller.sh`,
  `test/real-pi-controller.py`) uses a synthetic provider and exercises the
  controller through HTTP/SSE with distinct Unix users. It does not render the
  browser. Its recorded live-stream proof covers text, not a native tool call.

[Earlier results](result.md) record those separate slices.
[The shared browser stream result](../one-browser-event-stream/result.md)
adds synthetic browser replay and recovery evidence.

## Remaining work

- [ ] **Connect the browser test to real Pi.** Provide a repeatable disposable
  test environment in which the production browser reaches the gateway, daemon
  and pinned Pi, with a synthetic provider and synthetic home. The current
  browser and real-Pi fixtures are starting points; their separate passes do
  not cover this path. The provider scenario needs to produce a real Pi tool
  call as well as streamed text.
- [ ] **Exercise that complete path.** Show create and send; text and tool
  progress while Pi works; interruption; browser disconnect and reconnect
  during a turn; and ending, deliberately continuing and sending again in the
  same native session. Check that recovered history replaces provisional
  content without duplication, uncertain commands are not resent, and terminal
  history remains read-only. Verify that the person's draft, focus and reading
  position survive the relevant updates and return.
- [ ] **Fix observed failures and record the result.** A failure becomes a
  specific daemon, contract or browser repair, followed by the affected checks.
  Record the tested revision and outcomes, including any scenario still not
  demonstrated. There is no separate unnamed feature backlog in this issue.

[TESTING.md](../../TESTING.md) defines the checks for the resulting changes.
Installed-host and real-account acceptance remain in @verify-live-pi-journey;
this repeatable integration test uses no real account or provider credentials.

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
