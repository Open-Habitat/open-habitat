---
created: 2026-10-05
updated: 2026-10-05
type: task
reporter: jari
status: open
priority: high
related: ['@design-pi-event-blocks']
preparation: ready
lane: ui-foundation
lane_seq: 40
collision: [web/src/components/, web/lab/]
blocked_by: ['@design-pi-event-blocks', '@compare-draft-fidelity', '@apply-control-state-design']
---

# Apply the Pi conversation-block design

## Purpose

Make Pi conversations readable through the agreed [block design](../../design-system/drafts/Pi-keskustelun%20lohkot.dc.html). Live activity and saved history should tell the same story: text, readable thinking and tools retain their native order, and a tool call, progress and result form one stable, accessible use joined by `toolCallId`.

The [reconciled handoff](../design-pi-event-blocks/design-package/HANDOFF.md) records Jari's four product decisions and the draft's factual limits. Long user messages collapse to eight lines; bash previews start at the tail and other tools at the head, remembering Alku/Loppu per tool. Adjacent-tool grouping and edit diffs are deferred; `edit` shows safe arguments. These decisions, together with [design.md](../../design-system/design.md), define the intended behaviour.

## Scope and starting point

The agreed next action is a bounded working slice: a mixed turn with text, readable thinking, a tool call, progress, saved result and assistant continuation, including expansion through revision-checked bounded block reads. This exercises the central live-to-history relationship before wider coverage. @apply-control-state-design supplies shared controls and agent status; @compare-draft-fidelity supplies the comparison mechanism.

The full rendering goal covers the supported visible families in the [Pi catalogue](../catalog-pi-events/analysis.md): user text/images, assistant content, tools, local `!`/`!!` commands, summaries, session markers, visible extension content, live questions, recovery, queues and unknown content. Shared production renderers and catalog examples make each block's meaning, handler and design discoverable. Actual implementation gaps can justify dependent slices; the handoff's proposed APIs are not an approved projection backlog.

## Native meaning

Pi remains the source of history. The handoff explains why resolved questions lack a confirmed history record, why `agent_settled` differs from an assistant finishing, and why model, usage and stop reason belong to individual messages, including retries. It also distinguishes typed local-command metadata from bash output text. These distinctions prevent a plausible-looking UI from making false claims.

Conditional draft examples need verified sources and separate scope before becoming features. Missing facts remain documented gaps. Readable thinking stays available; encrypted or hidden content and raw diagnostics do not become conversation blocks. Full-result access uses bounded block reads rather than exposing `fullOutputPath` or creating another history store.

## Acceptance Criteria

- [ ] Mixed content preserves native order across live and history; each tool call, progress and saved result remains one accessible visual use with bounded expansion.
- [ ] Supported families and their normal, long, error, limited and unknown states share production renderers and discoverable catalog examples, preserving the handoff's product decisions and factual limits.
- [ ] Matching draft/lab content and states in both themes at desktop and phone widths have paired captures and measured differences in this issue, with coverage gaps and reconciled exceptions visible through the [design comparison process](../../design-system/process.md).
- [ ] Scoped interaction, keyboard/focus and 200%-zoom checks, plus a native live-to-history path, demonstrate behaviour beyond the draft's simulated animation.
