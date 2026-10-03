---
created: 2026-09-30
updated: 2026-10-03
type: task
reporter: jari
status: done
priority: high
related: ['@review-browser-design-v2', '@add-account-settings-ui']
lane: design-v2
lane_seq: 5
collision: [design-system/, web/src/components/, web/src/components/Conversation.tsx, web/src/app/App.tsx]
blocked_by: ['@fit-sidebar-v2']
closed: 2026-09-30
closed_by: night-ui-worker
---

# Fit account settings and history to browser design v2

## Goal

Fit account settings (sections Tili · Yhteydet tällä palvelimella · Ulkoasu ·
Istunto) and the history/return view ("Jatka siitä, mihin jäit") to v2 on the
re-cut foundation. The OpenAI row appears only if it reflects Pi's real state;
the running indicator shows only what the host really knows.

## Acceptance Criteria

- [x] Settings and history views match the draft in both themes and at phone
  width, without invented state.
- [x] Stories in both themes; lab screenshots in this issue folder.
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

## Implementation decisions and host request

- Kept the verified-identity fallback **Oma tili**; the snapshot does not supply a verified personal name or email. The draft's full name, email and avatar are not displayed.
- The snapshot supplies `auth.native_github.state` but no verified OpenAI/Pi credential-connection field. **Request for the host/contract owner:** expose a user-scoped, validated Pi connection status (including unknown/unavailable) if an OpenAI connection row is wanted. Do not infer it from onboarding, process activity or a browser session. Until then, omit that row and any fake reconnect action.
- Return rows use observed `process` values only (`daemon_managed_live` or `terminal_observed_live`) for a running indicator; `not_observed`, stale and unknown are not called running. The native history and browser-session routes are preserved. The draft's always-on progress stages and timestamps are omitted because the snapshot does not provide them.
- Kept account logout scoped to browser session; native GitHub credentials are not revoked. No change to reading position, draft or command reconciliation.

## Synthetic visual evidence

Captured from the synthetic lab at `NAH_PORT_BASE=21000`, using only invented fixture identities and workspaces. Every screenshot has a same-basename offline HTML snapshot beside it; no personal account information or real host was captured. Settings: [light desktop](settings-light-1440.avif), [dark desktop](settings-dark-1440.avif), [light 390 px](settings-light-390.avif), [dark 390 px](settings-dark-390.avif). Return view: [light desktop](workspaces-light-1440.avif), [dark desktop](workspaces-dark-1440.avif), [light 390 px](workspaces-light-390.avif), [dark 390 px](workspaces-dark-390.avif). Phone captures use a 390 × 1100 viewport to show all four settings sections; desktop uses 1440 × 900. The lab fixtures do not contain a verified Pi/OpenAI connection or a positively observed live process, so those particular marks are covered by component tests and are not presented as screenshot evidence.
