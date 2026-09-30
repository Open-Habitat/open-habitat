---
created: 2026-09-30
updated: 2026-09-30
type: task
reporter: jari
status: open
priority: high
related: ['@review-browser-design-v2', '@decide-account-display']
lane: design-v2
lane_seq: 3
collision: [design-system/, web/src/components/, web/src/components/Conversation.tsx, web/src/app/App.tsx]
blocked_by: ['@fit-conversation-v2', '@continue-ended-conversation']
---

# Fit the sidebar and account menu to browser design v2

## Goal

Fit the sidebar and account menu to v2 on the re-cut foundation: the
"⌂ Etusivu" row with the running count, compact workspace rows and status
marks, collapse to the 52 px strip, and at phone width the ☰ drawer (316 px,
scrim, focus return) replacing the stacked sidebar.

The account button shows the first name and opens a menu whose top shows the
signed-in email (@decide-account-display). If the browser contract does not
yet carry a trustworthy first name, show "Oma tili" and record the needed
contract change as a request; do not split an email address into a name.

## Acceptance Criteria

- [ ] Sidebar open, collapsed and phone-drawer states match the draft in both
  themes, with keyboard and screen-reader behaviour from the handoff.
- [ ] Account button and menu follow the account-display decision or the
  documented fallback.
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
