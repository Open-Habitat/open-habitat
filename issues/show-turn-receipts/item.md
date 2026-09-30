---
created: 2026-09-30
updated: 2026-09-30
type: task
reporter: jari
status: in-progress
priority: high
related: ['@build-agent-control', '@stream-conversation-events']
lane: design-v2
lane_seq: 8
collision: [design-system/, web/src/components/, web/src/components/Conversation.tsx, web/src/app/App.tsx]
---

# Show turn and send receipts in the conversation

## Goal

Show the host's new turn and send observations in the v2 conversation view,
now that @build-agent-control has published them (night:rest round 7, gate
green at `73b9c7b`, run `01m3t3jyvsa3e9w2p5w24jbgf0`):

- the turn-settled marker and timestamp → the draft's
  "✓ Vuoro valmis HH.MM · odottaa viestiäsi" row, only when settled;
- the per-send receipt `pending | accepted | rejected | uncertain` → the
  draft's placement under the message (dashed bubble and "? Ei tiedossa,
  vastaanottiko Pi viestin… Kopioi teksti" for uncertain), never an
  automatic resend;
- an incoming question as validated safe text only. A normal message does
  not answer Pi's extension dialog, so offer no reply control; say so
  honestly (the dialog decision is Jari's).

The field names and rules are in `issues/build-agent-control/result.md`, the
last "Browser request for night:ui" section. Update deviation I4 in
`issues/compare-v2-pairs/index.md` and the affected pairs.

## Acceptance Criteria

- [ ] Settled, accepted, rejected, uncertain and pending states render per the
  draft in both themes at desktop and 390 px, backed only by host fields.
- [ ] Question text renders safely without a reply affordance.
- [ ] Browser tests against the synthetic host cover each receipt state; no
  resend on any of them.
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
