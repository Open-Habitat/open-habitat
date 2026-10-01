---
created: 2026-09-30
updated: 2026-10-01
type: task
reporter: jari
status: done
priority: high
related: ['@review-browser-design-v2', '@compare-v2-pairs']
lane: design-v2
lane_seq: 11
collision: [design-system/, web/src/components/, web/src/components/Conversation.tsx, web/src/app/App.tsx]
blocked_by: ['@fit-return-view-v2']
closed: 2026-10-01
closed_by: agent
---

# Fit settings, account menu and drawer density to v2

## Goal

Close fidelity gap G2 from [the v2 comparison](../compare-v2-pairs/index.md):
settings use large separated headings and vertical theme radios instead of
the draft's compact bordered rows and horizontal segmented theme choice; the
account menu uses tall rows instead of the compact popover; the phone drawer
shows verbose per-agent status lines and filter controls unlike the draft.

Keep honest statuses and the identity/capability deviations I2/I3 ("Oma
tili", no unverified OpenAI row, session-scoped logout). The theme control
stays accessible (`radiogroup`). Update the affected pairs in
`issues/compare-v2-pairs/`.

## Acceptance Criteria

- [x] Settings, account menu and drawer density match the draft at desktop
  and 390 px in both themes, with honest statuses.
- [x] Stories and pairs updated.
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

## Resolution

### 2026-10-01T02:09:25Z · @agent

Fitted G2 on desktop and phone in light/dark synthetic lab; accessible theme controls and honest statuses preserved; committed clean gate passed.
