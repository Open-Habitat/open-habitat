---
created: 2026-10-25
updated: 2026-10-25
type: improvement
reporter: jari
status: done
priority: normal
lane: unlaned
collision: [web/src/components/agentPresentation.ts]
preparation: ready
closed: 2026-10-25
closed_by: claude
---

# One 'waiting on background work' state with its own status dot

## Description

Jari, 2026-10-25, watching the conductor in Habitat on Birch: the state
"odottaa prosessia" could be shown at the top of the conversation without the
process name. It should have its own status dot in the sidebar (and wherever
agent state dots appear). "Odottaa prosessia" and "odottaa spinoffia/workeria"
are really the same thing for the person, so one term should cover both.

Today `web/src/components/agentPresentation.ts` derives `waiting_process` and
`waiting_spinoff` ("Odottaa prosessia" / "Odottaa spinoffia"), and the
dots treat them like other states.

Conductor's choice (Jari may revisit): one activity, label **"Odottaa
taustatyötä"**, covering background processes and workers; "spinoff" in UI
copy becomes "worker" where it names Taskfleet runs (Jari's term). The
process names stay available in details (expanded work, tooltip), not in the
top status.

## Acceptance Criteria

- [x] One background-wait activity and label; shown in the conversation's top
  status without process names.
- [x] A distinct status dot for it from design tokens, used consistently in
  the sidebar, start page, rail and conversation; screenshots light/dark for
  Jari's review.
- [x] Tests at the presentation layer (state, not wording).

