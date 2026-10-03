---
created: 2026-09-30
updated: 2026-10-03
type: task
reporter: jari
status: done
priority: high
related: ['@review-browser-design-v2', '@compare-v2-pairs']
lane: design-v2
lane_seq: 9
collision: [design-system/, web/src/components/, web/src/components/Conversation.tsx, web/src/app/App.tsx]
blocked_by: ['@stream-conversation-events', '@show-turn-receipts']
closed: 2026-10-01
closed_by: night-ui-worker
---

# Fit conversation header and composer density to v2

## Goal

Close fidelity gap G3 from [the v2 comparison](../compare-v2-pairs/index.md):
the conversation header takes several stacked lines and the transcript and
composer have much more vertical padding than the draft, so on 390 px the
composer and receipts can fall below the 844 px fold, while the draft keeps
the editor and actions within it.

Keep the recorded deviations I4/I5 (explicit status and control labels,
long-title access, selected send mode, uncertain-send and reading-position
behaviour). Update the affected pairs in `issues/compare-v2-pairs/` with its
capture command.

## Acceptance Criteria

- [x] Header, transcript and composer spacing match the draft's sizing at
  desktop and 390 px in both themes; the phone composer and its actions stay
  within the first viewport in the working, answered, rejected, outage and
  read-only states.
- [x] Focus, reading anchor and receipts are preserved; metric assertions
  extended for the new landmarks.
## Shared context for every design-v2 slice

- Benchmark: [handoff](https://github.com/maintainer/native-agent-host/blob/0d1a53160772be64daa00879536c8103bbd3d0e1/design-system/drafts/v2/handoff.md) and the
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

## Implementation notes

The v2 draft fits a single-line conversation title and omits the explicit control and status labels, send acceptance states and stale notice. Those changes would violate the agreed header and uncertain-send behavior. The fitted template retains the workspace link, expandable long title, both textual statuses, the selected working send mode, command receipts, reading anchor, and connection notice. On phones, shared spacing tokens shrink the header and stream; supplementary progress, queue, status controls and notices scroll with the transcript rather than pushing the composer below the viewport. Desktop header/column values remain the v2 sizing table's 13 × 24 and 22/24. No host or contract change is needed for this presentation slice.
