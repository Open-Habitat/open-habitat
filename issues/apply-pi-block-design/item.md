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

## Outcome

Replace the provisional conversation presentation with the agreed [Pi-block design](../../design-system/drafts/Pi-keskustelun%20lohkot.dc.html) and its [reconciled handoff](../design-pi-event-blocks/design-package/HANDOFF.md). Use shared production components and catalog stories/fixtures for every supported visible family. Keep the live and saved interpretations aligned; presentation is not another event or history store.

## Walking slice and boundaries

Begin with one mixed turn containing text, readable thinking, a tool call, progress, saved result and assistant continuation, with ordering and `toolCallId` preserved. No duplicate `LiveToolRow`/saved row. Expand a bounded result in place via revision-checked block reads; bash previews start at the tail, other tools at the head, with Alku/Loppu choice remembered by tool. Then extend the common renderer to user text/images, long messages (eight-line collapse), local `!`/`!!` commands, summaries, session markers, visible extension content, live questions, retry/error/queue and unknown blocks, in both themes and desktop/phone. Keep PI headings restrained and thinking readable without exposing encrypted or hidden material. Existing control-state design supplies controls and agent status.

Use only verified native data: settled means observed `agent_settled`, while model/usage/stop reason belong to their particular assistant message, including retries. Without a confirmed native record, resolved questions are not permanent history. Do not infer bash exit or native truncation metadata from text, expose `fullOutputPath` or raw diagnostic payloads, synthesize total line counts, or make new history caches. Native local-command exit metadata is separate. Do not implement adjacent-tool grouping or edit diffs in this issue; `edit` gets its safe arguments. Conditional draft examples remain conditional until their sources are verified and scoped separately.

`@compare-draft-fidelity` provides the comparison mechanism; `@apply-control-state-design` lands shared controls first. Produce matching synthetic draft/lab fixtures for content, state, theme and viewport, report missing and changed landmarks and controls, and keep paired images and measured differences in this issue. Link each visible block to its meaning, handler, draft and catalog example, and report any unavailable host fact as a gap rather than rendering an invented value. Check interaction and keyboard/focus/200%-zoom usability in the scoped views; verify one live→history native path, not just the prototype animation. Scope can be split into dependent implementation slices after the walking slice if needed; do not manufacture eight data-projection issues from the handoff alone.

## Acceptance Criteria

- [ ] One tool call, live progress and saved result occupy one stable, accessible visual use and mixed content retains native order across live and history without a second store.
- [ ] Supported visible families and significant normal/long/error/limited/unknown states use shared production renderers and catalog examples, with truthful boundaries for unavailable data and safe bounded full-result reads.
- [ ] User-message collapse, local-command distinction and per-tool preview choice implement Jari's four confirmed decisions; adjacent grouping and edit diff remain deferred.
- [ ] Corresponding draft/lab content, state, theme and viewport pairs document measured differences, missing coverage and the reconciled exceptions; scoped keyboard/zoom and native live→history checks are recorded.

## Tests Run

Not yet implemented.

## Implementation Notes

Preparation is ready for the bounded walking slice, not authorization to invent missing typed sources; after the comparison and shared-control blockers land, inspect current code and confirm which fixtures and native fields actually exist before widening coverage.
