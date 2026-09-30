---
created: 2026-09-30
updated: 2026-09-30
type: task
reporter: jari
status: in-progress
priority: high
related: ['@review-browser-design-v2']
lane: design-v2
lane_seq: 6
collision: [design-system/, web/src/components/, web/src/components/Conversation.tsx, web/src/app/App.tsx]
blocked_by: ['@fit-account-and-history-v2']
---

# Compare browser design v2 drafts with the lab in pairs

## Goal

Produce side-by-side pairs of every v2 draft state and the lab rendering,
both themes and the widths in scope, redacted, in this issue folder, so Jari
can review fidelity. Route the drafts' font requests to the bundled fonts so
the comparison does not depend on a CDN. No pixel diff against the draft, and
no image baselines until Jari accepts the views.

## Acceptance Criteria

- [x] A pair exists for each draft state covered by the fit slices, in both
  themes and scoped widths, with a short index of remaining differences.
- [x] The capture is reproducible from a documented command.

[Pair index, classified differences and reproduction command](index.md). Onboarding
is excluded as agreed; the designer supplied no phone settings/rejected-only
state or desktop drawer frame, so those are not fabricated as draft pairs. The
index records intentional deviations and the host/contract requests owned by
the fitted slices; the remaining presentation gaps are proposed as follow-ups,
not changed in this run.
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

## Comments

### 2026-09-30T18:49:20Z · @night-ui

Onboarding blocker removed for the night: fit-onboarding-v2 waits on show-large-clone-progress, which waits on Jari's clone-quota authority decision. Tonight's pairs cover the fitted slices; onboarding pairs follow when that slice lands.
