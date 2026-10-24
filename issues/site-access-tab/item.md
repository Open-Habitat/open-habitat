---
created: 2026-10-24
updated: 2026-10-24
type: improvement
reporter: jari
status: open
priority: normal
provenance: other
provenance_detail: Implementation split of plan-site-onboarding-authority accepted by Jari 2026-10-24
source_ref: taskfleet:01m5p58hc8f6gyd5zad5gxx136/split:site-access-tab
originating_run: 01m5p58hc8f6gyd5zad5gxx136
originating_run_kind: spinoff
related: ['@plan-site-onboarding-authority', '@proto-admin-server-onboarding']
blocked_by: ['@runtime-admission-broker']
collision: [web/src/app/Settings, contracts/v1/]
preparation: ready
lane: site-admission
lane_seq: 2
---

# Settings › Käyttäjät ja pääsy: one list of allowed GitHub accounts with add, remove and restore

## Description

Goal: Settings › *Käyttäjät ja pääsy* is one list where the administrator adds, removes and restores people by GitHub account. Each change is shown as waiting for the server until the broker confirms it.

Implements the browser side of ADR 0030 "Admission has two sources" (`docs/decisions/adr-0030-site-onboarding-authority.md`) on top of `runtime-admission-broker`:

- The "Yksi lista" form: one row per person with state *Ei vielä kirjautunut / Käyttäjä / Ylläpitäjä / Pääsy poistettu*. The administrator role and last-seen come from the gateway. GitHub usernames are shown at normal list size (Jari's r6 fix).
- Adding: type a login → GitHub check showing name and numeric id → confirm. A duplicate is reported under the field. The row is "odottaa palvelinta" until the broker replies and "tila epävarma" with a refresh action on an uncertain reply.
- Removing ends sign-in and sessions. The row stays as *Pääsy poistettu* with a restore action, and the text says the Unix account and files stay (removal via CLI). `operator`-source rows, administrators included, have no remove action.
- `runtime_admission: false`: adding is disabled with the reason. `admission: "any"`: the tab says access is open and disables adding and removal.
- The existing browser administrator-role control is removed.

UI specification: `proto-admin-server-onboarding` round 6 (Yksi lista), `design-system/prototypes/rounds/2026-10-24-palvelin-aloitus-6/`, and that issue's result.md, section Kierros 6.

Scheduling proposal (filed unlaned by run policy): lane `site-admission`, seq 2.

## Acceptance Criteria

- [ ] Component tests and Storybook stories for every row state, pending, uncertain, switch off and open mode.
- [ ] A browser spec adds, removes and restores a person against a fake broker, and the role control is gone.
- [ ] Live check in `KOKEILTAVAA.md` on the test server (`runtime_admission: true`).
- [ ] Review: focused self-review plus `/llm-review` if the contract changes.
