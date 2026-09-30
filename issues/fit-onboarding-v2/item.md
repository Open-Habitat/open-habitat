---
created: 2026-09-30
updated: 2026-09-30
type: task
reporter: jari
status: open
priority: high
related: ['@review-browser-design-v2', '@design-first-use-onboarding']
lane: design-v2
lane_seq: 4
collision: [design-system/, web/src/components/, web/src/components/Conversation.tsx, web/src/app/App.tsx, web/src/app/GitHubOnboarding.tsx]
blocked_by: ['@fit-sidebar-v2', '@show-large-clone-progress']
---

# Fit onboarding to browser design v2

## Goal

Fit onboarding to v2: the shared frame (product name and server above the
card, step indicator 1 GitHub → 2 Repot → 3 OpenAI, next step below), compact
repository rows as whole-row choices, the code display and the confirmation
for abandoning onboarding. All repositories are visible by default and time
filtering is the user's choice. An uncertain fetch result stays visible
(honest behaviour wins over the draft's removal of partial/uncertain states;
record the deviation).

Waits for @show-large-clone-progress, which changes `GitHubOnboarding.tsx`.

## Acceptance Criteria

- [ ] Sign-in, repository and OpenAI steps match the draft in both themes and
  at phone width, with the agreed repository default.
- [ ] State-machine changes, if any, are recorded with the reason.
- [ ] Stories in both themes; lab screenshots in this issue folder.
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
