---
created: 2026-10-24
updated: 2026-10-24
type: improvement
reporter: jari
status: open
priority: normal
provenance: other
provenance_detail: Implementation split of plan-site-onboarding-authority accepted by Jari 2026-10-24
source_ref: taskfleet:01m5p58hc8f6gyd5zad5gxx136/split:onboarding-default-repositories
originating_run: 01m5p58hc8f6gyd5zad5gxx136
originating_run_kind: spinoff
related: ['@plan-site-onboarding-authority', '@proto-admin-server-onboarding']
blocked_by: ['@onboarding-config-store']
collision: [internal/provision, contracts/v1/, web/src/app/GitHubOnboarding]
preparation: ready
lane: site-onboarding
lane_seq: 2
---

# Onboarding repositories by site mode: one-time default import after a gateway access check, locked chooser rows

## Description

Goal: a new person's repositories step follows the site's mode. The site's default repositories they can read are fetched for them once with their own GitHub identity, and defaults they cannot read never reach them.

Implements ADR 0030 "Default repositories are imported once" (`docs/decisions/adr-0030-site-onboarding-authority.md`; plan.md decisions 1 and 4 in `issues/plan-site-onboarding-authority/plan.md`):

- Broker: `ensure`'s reply gains `created: true` only in the call that created the binding (survives broker restart; never twice per binding). The site-key issue reuses it.
- Gateway: in the binding-creating login, use the person's transient token for one read-only `GET /repos/{owner}/{repo}` per default (concurrent, at most 20, short deadline). `no_access`/`check_failed` defaults are dropped for this person and kept for the receipt issue. The token is never persisted, logged or returned. The gateway puts the plan `{mode, readable defaults}` into the first-login handoff and puts the same filtered subset on the person's repository-list request in `preselected`/`auto` mode, never from browser fields.
- Daemon: for each received default, skip it if a matching workspace exists (`already_present`), otherwise enqueue an ordinary clone job (ADR 0024). The handoff reply reports `queued|already_present` per default.
- Browser: `GitHubRepoChooser` gains the `locked` prop for forced selections (auto mode); `preselected` preselects; `skip` with defaults imports without a chooser, and the route's Repot row names the fetched repositories with progress. `skip` without defaults removes Repot from the route.
- `internal/AGENTS.md` gains the default-import rule.

UI specification: `proto-admin-server-onboarding` round 5 (Tapa ja lista, names on the route) and round 6's locked-chooser carry-over, `design-system/prototypes/rounds/2026-10-23-palvelin-aloitus-5/` and `2026-10-24-palvelin-aloitus-6/`.

Scheduling proposal (filed unlaned by run policy): lane `onboarding`, after `onboarding-config-store`.

## Acceptance Criteria

- [ ] `created: true` appears once per binding, also across a failed handoff and a broker restart, so the plan is not replayed on a second login (broker tests).
- [ ] An inaccessible default never appears in the person's handoff, repository-list reply or UI. This is a VM test with two real UIDs, not a same-UID mock.
- [ ] A deleted default workspace is not re-imported on a later login (test).
- [ ] `GitHubRepoChooser` `locked` has a story and tests; a browser spec covers all three modes and skip-without-defaults.
- [ ] Live check in `KOKEILTAVAA.md`.
- [ ] Review: independent `/llm-review` at high-risk level (token use, broker reply, daemon input).
