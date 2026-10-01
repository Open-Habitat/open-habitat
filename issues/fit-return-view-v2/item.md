---
created: 2026-09-30
updated: 2026-10-01
type: task
reporter: jari
status: done
priority: high
related: ['@review-browser-design-v2', '@compare-v2-pairs']
lane: design-v2
lane_seq: 10
collision: [design-system/, web/src/components/, web/src/components/Conversation.tsx, web/src/app/App.tsx]
blocked_by: ['@fit-conversation-density-v2']
closed: 2026-10-01
closed_by: night-ui-worker
---

# Fit the return view hierarchy to v2

## Goal

Close fidelity gap G1 from [the v2 comparison](../compare-v2-pairs/index.md):
the return view adds a separate "Työtilat" introduction above "Jatka siitä,
mihin jäit" and shows independent cards instead of the draft's compact
grouped list ("Käynnissä" / "Viimeksi avatut"); on 390 px the introduction
uses much of the first screen.

Group only by what the host really knows (deviation I1): no invented running
state, counts or timestamps. Update the affected pairs in
`issues/compare-v2-pairs/`.

## Acceptance Criteria

- [x] Return view hierarchy and list density match the draft at desktop and
  390 px in both themes, without invented state.
- [x] Stories and pairs updated.
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

## Fit decisions and deviations

- Removed the separate “Työtilat” introduction; the return view has one main heading and compact bordered list rows. Only positively observed live processes go under “Käynnissä”; everything else goes under “Muut keskustelut”. Stale snapshots never claim a process is running. Group order retains the snapshot's order, not invented recency.
- I1: the draft's “Viimeksi avatut”, timestamps, working-stage detail and “Jatkettavissa” imply facts the current snapshot does not provide. The lab does not observe a live process, so its four paired captures show only “Muut keskustelut”; the live grouping is covered by component tests. The draft's one-click “Uusi keskustelu” would need a workspace choice; this view does not invent a target or a dead action. Users can start from a selected workspace. Existing native-history and browser-session routes remain intact.
- No change requested of `internal/`, `contracts/`, `scripts/` or `test/browser-host/`. If a real recency-ordered return list is desired later, the host/contract owner should supply a validated ordering/observed time; do not infer it from the current snapshot array position.
