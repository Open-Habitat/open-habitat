---
created: 2026-09-30
updated: 2026-10-03
type: task
reporter: jari
status: done
priority: high
related: ['@build-agent-control', '@fit-conversation-v2']
lane: design-v2
lane_seq: 2
collision: [design-system/, web/src/components/, web/src/components/Conversation.tsx, web/src/app/App.tsx]
blocked_by: ['@fit-conversation-v2']
closed: 2026-09-30
closed_by: night-ui-worker
---

# Continue an ended browser conversation from the UI

## Goal

Give an ended browser-owned conversation an explicit way to continue, on top
of the server route that @build-agent-control landed on 2026-09-30, using the
v2 conversation presentation from @fit-conversation-v2.

## Context

The contract is in `issues/build-agent-control/result.md`, section "Ended
browser conversation continuation" → "Browser request for night:ui":

- `POST /api/v1/conversations/{session-id}/continue` with CSRF and no body,
  only after the conversation has ended and only for browser-owned ones.
- Success returns `{agent_id, workspace_id, state:"idle",
  prior_outcome:"uncertain"}`; then re-read status and history and let the
  person decide whether to send a new prompt. Never resend an uncertain prior
  prompt, and never POST continue again automatically (a 503 after the write
  is uncertain too: re-read status).
- Show `writer_conflict` (active or unproven writer), `read_only_history`
  (terminal history that cannot be controlled) and `control_uncertain`
  (not yet safe to continue) honestly. Existing terminal history stays
  read-only.
- Do not treat the private status stream as the published `/api/v1/events`
  contract; on stream failure or a 409 cursor error read status and history.

Use the generated browser contract types in `web/src/contracts/` if the route
is there; they are generated from `contracts/v1/`, which belongs to the
night:rest conductor tonight. If a type is missing, record the request here
and in `issues/night-2026-09-30/ui-status.md` rather than editing
`contracts/`.

## Acceptance Criteria

- [x] An ended browser-owned conversation offers a quiet continue action in
  the read-only composer area; terminal/foreign histories do not.
- [x] Success, the three refusal states, network failure and an uncertain 503
  each have an honest presentation with no automatic retry or resend.
- [x] Role/name tests cover the states against the synthetic host; stories in
  both themes; lab screenshots in this issue folder.
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
