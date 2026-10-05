---
created: 2026-09-21
updated: 2026-10-05
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 60
blocked_by: ['@build-agent-control']
collision: [docs/, AGENTS.md, design-system/]
preparation: reviewing
---

# Complete the accepted conversation and navigation experience

## Goal

Expand the working core into the full accepted conversation UI, using real adapter capabilities and the production component library.

## Context

Read [the delivery plan](../plan-v1-implementation/plan.md), [product goal](../../docs/product.md),
[architecture](../../docs/architecture.md), and the governing AGENTS.md files.
Use the installed workflow skills. Keep detailed work and evidence in this issue directory.
Follow ADR 0001: native histories/configuration, discovered directories, no parallel history,
workspace registry, credential broker or speculative cache. Desktop first, one server and Pi.

## Acceptance Criteria

- [ ] Complete compact tool groups, code copying, supported simple diffs, unknown-tool fallback and bounded long-output/history behavior.
- [x] Show every incoming agent message, including pending questions and unfamiliar message types, at least as safe text when no dedicated presentation exists.
- [ ] Complete interruption and queue/steering behavior against verified Pi capabilities; Pi-specific question dialogs are outside this task.
- [x] Preserve per-agent drafts, focus, reading position and route selection while events stream and agents change.
- [ ] Complete loading/empty/error/read-only, expired-login, stale status and uncertain-send/reconnect interactions across both design packages.
- [ ] Verify the agreed desktop/theme scope and component accessibility against real redacted Pi samples and a live disposable agent.
- [ ] Deliver a reviewable demonstration and record design corrections; process center, mobile and richer post-MVP tooling remain out of scope.

## Delivery and verification

Record exact inputs/revisions, commands, outcomes and remaining limits in this issue's
`result.md`. Update the owned durable documents; do not duplicate a task queue in TODO.md.
Run the applicable repository documentation checks. Product workers also run the exact
checks established by @plan-v1-implementation and verified by @build-app-foundation.
A failed or unavailable check is not a pass. Never close a human-review issue on the user's behalf.
Do not expand into the next issue after delivering this bounded task.

## Bounded planning handoff

Complete conversation, queue/steering and accessibility behavior against real
adapter capabilities. Queue clear returns only the texts actually removed, in
their original groups and order. Test native queue races, safe Markdown/code/diff
rendering, keyboard and screen-reader use, themes, zoom and reduced motion.
Keep long histories usable without losing focus, selection or reading position;
introduce buffering or virtualization only where the observed workload needs it.

Implement the title behavior specified in [the interface](../../docs/interfaces.md):
the source-ordered unique union of at most the first four and last four user
messages, automatic generation and title-adjacent manual regeneration. Test
unavailable capability, exclusion of concurrent title requests and failure that
preserves the previous title without blocking conversation.
The [implementation map](../plan-v1-implementation/implementation-briefs.md)
assigns the contract scenarios.


## Visual evidence

Provide proportionate browser evidence and screenshots in
`issues/complete-conversation-ui/visual-acceptance.md`, with the tested revision,
environment and relevant outcomes. Record Jari's visual verdict when given;
unreviewed appearance remains unreviewed. A pending screenshot verdict does not
block functional completion or independent downstream work.

Interactive and repeated behavior must use the shared production component implementation. Local composition may arrange one-off content but may not invent controls, state semantics, focus rules or styling. When this production slice replaces a canonical/root mock or static reference, remove the superseded root/canonical reference in the same accepted change; an original may remain only in its receiving issue as historical evidence.
