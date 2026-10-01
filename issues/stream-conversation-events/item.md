---
created: 2026-09-30
updated: 2026-09-30
type: task
reporter: jari
status: done
priority: high
related: ['@review-browser-design-v2', '@build-agent-control']
lane: design-v2
lane_seq: 7
collision: [design-system/, web/src/components/, web/src/components/Conversation.tsx, web/src/app/App.tsx]
closed: 2026-09-30
closed_by: night-ui-worker
---

# Stream the conversation from the published event stream

## Goal

Make the browser conversation consume the published `/api/v1/events` stream
that @build-agent-control completed on the server side on 2026-09-30, so a
running turn streams live instead of waiting for status/history polling.

## Context

The consumption rules are in `issues/build-agent-control/result.md`, the last
"Browser request for night:ui" section, summarised by night:rest:

1. Render the snapshot's `live_tail` first, then open `?after=<event_cursor>`.
   Apply only the next sequence; a gap, 409 or invalidation means a new
   snapshot.
2. `assistant.delta` / `content_index`, `tool.started` / `tool.finished` /
   `tool_call_id`.
3. An assistant `history.entry` replaces the whole provisional turn tail.
4. `ring_truncated` → HTTP status/history fallback.

The stream is observation, not a command receipt: it never confirms that a
send was accepted and never triggers a resend. Keep status and history reads
as the fallback, and keep drafts, reading position, uncertain sends and the
continue gating from @continue-ended-conversation. Use the generated types in
`web/src/contracts/`; `contracts/` belongs to night:rest tonight.

## Acceptance Criteria

- [x] A running turn streams deltas and tool start/finish in the conversation
  view; the settled `history.entry` replaces the provisional tail without
  duplicates or flicker of the reading position.
- [x] Gap, 409, invalidation and `ring_truncated` recover through a fresh
  snapshot or HTTP fallback; no automatic resend or repost.
- [x] Browser tests against the synthetic host (real controller, fake Pi)
  cover streaming, a forced gap and reconnect.
## Shared context for every design-v2 slice

- Benchmark: [handoff](../../design-system/drafts/v2/handoff.md) and the
  drafts in `../../design-system/drafts/v2/vedokset/`; the
  [assessment](../review-browser-design-v2/assessment.md) explains the gaps
  and the [first reading](../review-browser-design-v2/first-read.md) the
  known behavioural differences.
- Provisional decisions for the night of 2026-09-30 (recorded on
  @review-browser-design-v2; Jari may overturn them): phone width is in scope,
  and the v2 sizing table is the source of the shared values.
- Agreed repository-chooser default: all repositories visible, time filtering
  is the user's choice (not the handoff's monthly default).
- Keep existing state handling, polling, session binding, drafts, reading
  position and uncertain-send honesty. Where the draft contradicts
  `docs/ui.md`, `docs/interfaces.md`, `design-system/production-v1.md` or the
  state machine, do not resolve it silently: record the deviation in this
  issue and follow the existing agreement.
- Only existing `--ah-*` colour tokens. Icons must not depend on the system
  font. Every new or changed component has a story in both themes.
- Evidence comes from the synthetic lab (`web/AGENTS.md`), never a real
  server. Redact anything personal from screenshots kept in the issue folder.
- Ownership tonight: this work may change `web/`, `design-system/`,
  `docs/ui.md` and `docs/design-system.md`. A needed change in `internal/`,
  `contracts/` or other docs is recorded in this issue as a request instead.
