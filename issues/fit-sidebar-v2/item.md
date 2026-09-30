---
created: 2026-09-30
updated: 2026-09-30
type: task
reporter: jari
status: in-progress
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

- [x] Sidebar open, collapsed and phone-drawer states match the draft in both
  themes, with keyboard and screen-reader behaviour from the handoff.
- [x] Account button and menu follow the account-display decision or the
  documented fallback.
- [x] Stories in both themes; lab screenshots in this issue folder.
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

## Implementation decisions and contract request

The validated browser snapshot carries `identity.display_name` (which may be a provider login/subject) and `auth.native_github.state`, but neither a verified first name nor the signed-in email. The `/auth/session` browser model supplies session binding/CSRF, not those display fields. **Request for a future contract decision:** add display-only verified first name and authenticated email to the browser snapshot/session view model, with explicit provenance and no role in Unix identity or routing. Until then the rail button, menu heading and settings show **Oma tili** with an initials-free avatar; no email is guessed from a login.

The `Etusivu` badge counts only snapshot agents whose process is explicitly `daemon_managed_live` or `terminal_observed_live`, and is omitted for stale snapshots; unknown/not-observed processes do not become “running”. No host aggregate running count exists, so this is a count of host-reported live agents, not of all Taskfleet jobs or browser tabs.

Draft deviations: navigation remains native links (including Back/history and route current state), not button-only rows; connection and read-only text remain explicit under the existing accessibility agreement. The existing rail filter and refresh stay available. The draft's collapsed `+` workspace picker cannot be implemented honestly without a currently available create/chooser intent in this rail; request a separate product/contract design for that action rather than inserting a nonfunctional control. Theme remains available as existing menu items rather than an invented radio state machine. These follow `production-v1.md` and the recut component map.
