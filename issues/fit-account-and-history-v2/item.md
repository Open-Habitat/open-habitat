---
created: 2026-09-30
updated: 2026-09-30
type: task
reporter: jari
status: in-progress
priority: high
related: ['@review-browser-design-v2', '@add-account-settings-ui']
lane: design-v2
lane_seq: 5
collision: [design-system/, web/src/components/, web/src/components/Conversation.tsx, web/src/app/App.tsx]
blocked_by: ['@fit-sidebar-v2']
---

# Fit account settings and history to browser design v2

## Goal

Fit account settings (sections Tili · Yhteydet tällä palvelimella · Ulkoasu ·
Istunto) and the history/return view ("Jatka siitä, mihin jäit") to v2 on the
re-cut foundation. The OpenAI row appears only if it reflects Pi's real state;
the running indicator shows only what the host really knows.

## Acceptance Criteria

- [ ] Settings and history views match the draft in both themes and at phone
  width, without invented state.
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
