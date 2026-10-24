---
created: 2026-10-24
updated: 2026-10-24
type: improvement
reporter: jari
status: open
priority: normal
provenance: other
provenance_detail: Implementation split of plan-site-onboarding-authority accepted by Jari 2026-10-24
source_ref: taskfleet:01m5p58hc8f6gyd5zad5gxx136/split:onboarding-signin-receipt
originating_run: 01m5p58hc8f6gyd5zad5gxx136
originating_run_kind: spinoff
related: ['@plan-site-onboarding-authority', '@proto-admin-server-onboarding']
blocked_by: ['@onboarding-default-repositories', '@site-ai-key', '@site-access-tab']
collision: [internal/gateway/administration, contracts/v1/, web/src/app/Settings]
preparation: ready
lane: site-onboarding
lane_seq: 6
---

# Sign-in receipt of default repositories and AI key in the admin user list

## Description

Goal: the administrator's user list shows, for each person, what their first sign-in did with the site's defaults, e.g. "Käyttöönotto 24.10.: 2/3 oletusrepoa · ei pääsyä: `northstar-demo/infra`".

Implements ADR 0030 "The administrator sees a sign-in receipt" (`docs/decisions/adr-0030-site-onboarding-authority.md`; plan.md decision 5, R3). The gateway stores per subject, in administration state, a fixed-shape record with the date: per site default `no_access|check_failed` (its own check) or `queued|already_present` (handoff reply), `unknown` for every daemon-side entry when the reply is missing or ambiguous, and `ai_key: seeded|not_offered|failed`. The record holds facts about the site's own configuration only. It is shown on the Käyttäjät ja pääsy rows and in `admin users list`. The wording says a clone started, not that it finished ("oletusrepoa" / "haussa", not "haettu"). The person never sees it. There is no new listener, home read or daemon query on the administrator's behalf. `internal/AGENTS.md` gains the receipt rule.

UI specification: `proto-admin-server-onboarding` rounds 5 and 6 (the admin-only outcome in the user list).

Scheduling proposal (filed unlaned by run policy): lane `site-admission`, after `site-access-tab`.

## Acceptance Criteria

- [ ] Go tests: receipt from each check and reply outcome, a lost reply giving `unknown`, and nothing written on later logins.
- [ ] Component tests and a story for the row text; `admin users list` JSON includes the receipt.
- [ ] The receipt is not readable through any person-side endpoint (test).
- [ ] Review: focused self-review plus `/llm-review` if the contract changes.
