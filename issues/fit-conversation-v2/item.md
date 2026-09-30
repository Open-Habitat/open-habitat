---
created: 2026-09-30
updated: 2026-09-30
type: task
reporter: jari
status: done
priority: high
related: ['@review-browser-design-v2', '@complete-conversation-ui']
lane: design-v2
lane_seq: 2
collision: [design-system/, web/src/components/, web/src/components/Conversation.tsx, web/src/app/App.tsx]
blocked_by: ['@recut-ui-foundation']
closed: 2026-09-30
closed_by: night-ui-worker
---

# Fit the conversation view to browser design v2

## Goal

Fit the conversation view to the v2 states on top of the re-cut foundation
from @recut-ui-foundation: empty, working, read-only, interruption and an
incoming question, including the top bar with the quiet "Tiedot ▾" details,
speaker labels with quiet copy, tool rows, "✓ Vuoro valmis … · odottaa
viestiäsi", "Viimeisimpään ↓", Keskeytä · Ohjaa · Lähetä without the radio
group, rejected and uncertain sends, and the disconnection banner.

Behaviour does not change: functional decisions live in
@complete-conversation-ui and earlier decisions (drafts survive, uncertain
results are shown, no forced scrolling). Steering controls appear only where
the adapter capability exists today.

## Acceptance Criteria

- [ ] Each listed conversation state matches the draft in layout, sizing and
  interaction state in both themes, at desktop and phone width.
- [ ] No view-specific overrides of shared primitives are introduced.
- [ ] Stories cover the states in both themes; existing role/name tests pass.
- [ ] Lab screenshots of the states are kept in this issue folder.
## Shared context for every design-v2 slice

- Benchmark: [handoff](../review-browser-design-v2/design/handoff.md) and the
  drafts in `../review-browser-design-v2/design/vedokset/`; the
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
