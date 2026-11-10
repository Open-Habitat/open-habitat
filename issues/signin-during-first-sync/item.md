---
created: 2026-11-10
updated: 2026-11-10
type: bug
reporter: jari
status: fixed
priority: high
provenance: chat
source_ref: taskfleet:01m72a2pjq8ppye66vxcrg3wtd/contoso-atlassian-409
originating_run: 01m72a2pjq8ppye66vxcrg3wtd
originating_run_kind: spinoff
lane: signin-concurrency
lane_seq: 1
preparation: ready
closed: 2026-11-10
---

# Atlassian sign-in refused while another provider's first sync runs, and the dialog hides why

## Description

## Description

Jari 10.11.2026, Contoso pilot (pilot.25, amd64): a person's Jira and
Confluence sign-in (Settings › Data for agents, experimental
`atlassian-connect`) "failed at once again" after the pilot.25 wrapper fix
(`atlassian-login-pi-wrapper`). No `integration_login provider=atlassian`
event existed in the daemon journal.

## Cause (evidence from the pilot's journals, read only)

- The gateway's only 501 that day (`GET /api/{id}/{id}/{id}`, 08:02:41Z) had
  no signed-in user and came before the person's first sign-in to Habitat
  (08:24Z). It is unrelated to the Atlassian card.
- The person's two Atlassian starts are `POST /api/v1/integrations/login`
  → **409** in ≤1 ms at 08:33:36Z and 08:33:38Z, right after the experimental
  toggle (`PUT /api/v1/account/{id}`).
- At that moment the same person's Microsoft first synchronization was
  running: folders chosen 08:28:59Z, `integration_login provider=microsoft
  outcome=failed reason=quota_insufficient` only at 08:44:40Z.
- `Catalog.startLogin` refuses any start while the daemon's single login slot
  holds an attempt whose initial pass is running (`a.syncing &&
  !finished(a.state)`), so the answer was `409 attempt_active`. The handler
  logs nothing for a refused start, hence no Atlassian event.
- The browser turned the refusal into a failed view with the refusal text in
  `stage.error`, but `ConnectDialog` rendered `FailedStep` without it. The
  person saw only "Kirjautuminen ei onnistunut. Mitään ei yhdistetty." instead
  of "Kirjautuminen tai ensimmäinen synkronointi on kesken. Odota, että se
  päättyy." Every start refusal (`provider_unavailable`, `level_unavailable`,
  `account_missing`, `attempt_active`) was hidden the same way.

The Atlassian side was never reached: no Pi RPC child started, so none of the
*Live checks* in `issues/atlassian-trello-connect/item.md` (egress/allowlist,
loopback domain, Connectors/Rovo, scopes) failed or were exercised. Once the
Microsoft pass ended (08:44:40Z) the slot was free; no later Atlassian start
was attempted.

## Acceptance Criteria

- [x] A start refused before any attempt exists shows the host's reason in the
  sign-in dialog (synthetic reproduction: 409 `attempt_active`).
- [x] A refused start writes `integration_login outcome=refused phase=start
  reason=<code>`; `attempt_active` names the busy provider, its state and
  whether its first pass is running.
- [x] A sign-in that copies no files (Atlassian, mail, calendars) starts and
  finishes while another provider's first sync runs (Jari 10.11.); two
  file-copying sign-ins stay refused.

## Decisions

### 2026-11-10T13:04:46Z · @jari

Jari 10.11.: yes, a sign-in that copies no files (Atlassian, mail, calendars) may start while another provider's first sync runs; there is no reason to refuse it. Needed before pilot.26 so Confluence works on Contoso.
