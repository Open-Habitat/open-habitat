---
created: 2026-10-24
updated: 2026-10-24
type: improvement
reporter: jari
status: untriaged
priority: normal
provenance: other
provenance_detail: Implementation split of plan-site-onboarding-authority accepted by Jari 2026-10-24
source_ref: taskfleet:01m5p58hc8f6gyd5zad5gxx136/split:runtime-admission-broker
originating_run: 01m5p58hc8f6gyd5zad5gxx136
originating_run_kind: spinoff
related: ['@plan-site-onboarding-authority', '@proto-admin-server-onboarding']
collision: [internal/provision, internal/gateway/administration, contracts/v1/]
preparation: ready
---

# Runtime admission: broker admit/withdraw, runtime_admission switch, withdrawal order and admin access CLI

## Description

Goal: the browser administrator can admit and withdraw people without `site.json`, while root keeps its own admission source and an off switch.

Implements ADR 0030 "Admission has two sources, both owned by the broker" and the first two authority changes (`docs/decisions/adr-0030-site-onboarding-authority.md`; plan.md decision 2 in `issues/plan-site-onboarding-authority/plan.md`):

- Broker (`internal/provision`): durable `operator` and `site_admin` sources, effective admission is their union. New gateway-socket operations `admit {id, login_hint, actor}` (idempotent on id, refused while the switch is off, capped at 256 runtime entries), `withdraw` (idempotent, works while the switch is off) and a read-only list `{id, source, state, username?, login_hint, actor, at}`. `withdraw` is refused for every `operator` id. A withdrawn id that was never bound is deleted. A withdrawn bound id stays and `authorize`/`ensure` deny it.
- `site.json` `identities.runtime_admission: true|false` (default false). `host apply` converges only `operator`, and `host plan` lists runtime entries as information. Fleetrepo's test site sets it true (Fleetrepo change in its own repo).
- Gateway: GitHub login → numeric id lookup through the public users API as the OAuth app (organisations and unknown names rejected; no person's token). Withdrawal order: durable per-subject deny in administration state (login callback and session lookup refuse it), then `RevokeSubject` while the broker still authorizes, then `withdraw`. Restore removes leftover session records, then `admit`, then clears the deny only after a confirmed reply. An uncertain reply is surfaced as uncertain and never retried automatically.
- Remove the browser administrator-role write (`changeRoleFor` from the browser API); the control-socket `role` operation stays for `host apply`.
- `open-habitat admin access list|lookup|add|remove` per the plan's CLI surface (`add` takes only `--github-id`, and its dry-run says "restore to <username>" when bound; `remove` on an `operator` id is a usage error naming `site.json`). `CONFORMANCE.md` rows.
- `internal/AGENTS.md` gains the admission rules from ADR 0030's last section.

No UI here; the tab is `site-access-tab`.

Scheduling proposal (filed unlaned by run policy): lane `site-admission`, seq 1; no blockers. Collides with `onboarding-default-repositories` on `internal/provision`.

## Acceptance Criteria

- [ ] `host apply` neither removes runtime entries nor lets the gateway withdraw operator entries; with the switch off, `admit` is refused even from the gateway UID (broker tests).
- [ ] Withdrawal racing a login, a token handoff and an open terminal/editor relay; a gateway or broker restart at each durable step stays closed; restore returns the same UID; a never-bound withdrawal leaves nothing (Go tests, plus a VM test with two real UIDs).
- [ ] The browser API rejects administrator-role writes (test).
- [ ] `admin access` commands have `--dry-run`, typed exit codes and `CONFORMANCE.md` rows.
- [ ] Review: independent `/llm-review` at high-risk level (broker protocol, sessions and the admission authority change).
