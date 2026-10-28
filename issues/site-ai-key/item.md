---
created: 2026-10-24
updated: 2026-10-28
type: improvement
reporter: jari
status: done
priority: normal
provenance: other
provenance_detail: Implementation split of plan-site-onboarding-authority accepted by Jari 2026-10-24
source_ref: taskfleet:01m5p58hc8f6gyd5zad5gxx136/split:site-ai-key
originating_run: 01m5p58hc8f6gyd5zad5gxx136
originating_run_kind: spinoff
closed_by: agent
closed: 2026-10-24
collision: [internal/gateway/administration, contracts/v1/, web/src/app/Settings, internal/daemon/pi]
preparation: ready
lane: site-onboarding
lane_seq: 5
---

# Site AI key: gateway-held key seeded once into a new person's Pi credentials

## Description

Goal: the administrator can give the site an AI API key so that new people skip the AI step. The key is copied once into each new person's own Pi credentials and never over a key they have.

Implements ADR 0030 "The gateway holds one persistent provider credential" and its authority change (`docs/decisions/adr-0030-site-onboarding-authority.md`; plan.md decision 3, K1, in `issues/plan-site-onboarding-authority/plan.md`):

- Storage: a separate gateway-UID `0600` file outside administration state, holding provider (`openai|anthropic|deepseek`) and key. Reads return provider, four-character suffix and `set_at` only. Never logged.
- Writing: Käyttöönotto's AI section ("Sivuston avain") and `open-habitat admin ai-key show|set --provider … --key-file -|delete --offer <offer>` with `--dry-run`. `set` makes `offer` `site_key` in the same operation, and `delete` requires the replacement offer. `CONFORMANCE.md` rows.
- Seeding: only in the handoff of the login whose `ensure` returned `created: true` (from `onboarding-default-repositories`). The daemon writes with a new seed-specific write-if-absent operation inside Pi's own file lock (`internal/daemon/pi_credentials_helper.mjs` `modify` keeps a present entry; the personal save path is not reused). The handoff reply reports `seeded|not_offered|failed`. Nothing retries; later logins never seed.
- The UI says the key's own account pays, joined people are not changed, and copies cannot be recalled.
- `internal/AGENTS.md`: amend "the host keeps no credential store" to name this single exception, with the rule from ADR 0030.

UI specification: `proto-admin-server-onboarding` round 3 (Kolme tapaa, Sivuston avain) and round 4.

Scheduling proposal (filed unlaned by run policy): lane `onboarding`, after `onboarding-ai-offer`.

## Acceptance Criteria

- [ ] The key never appears in logs, replies (beyond the suffix), administration state or contract examples (tests incl. the logging-policy test).
- [ ] The seed never overwrites a person's own key, also when a concurrent second login saves one first (helper test under the lock).
- [ ] No seed on a second login, after a failed handoff or after a broker restart.
- [ ] The person's AI step is skipped when the seed is usable and shows `all` when it failed (browser spec).
- [ ] Live check in `KOKEILTAVAA.md` with a real provider key on the test server.
- [ ] Review: independent `/llm-review` at high-risk level (new persistent credential, writes into the person's Pi credentials).
