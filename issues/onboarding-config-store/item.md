---
created: 2026-10-24
updated: 2026-10-24
type: improvement
reporter: jari
status: done
priority: normal
provenance: other
provenance_detail: Implementation split of plan-site-onboarding-authority accepted by Jari 2026-10-24
source_ref: taskfleet:01m5p58hc8f6gyd5zad5gxx136/split:onboarding-config-store
originating_run: 01m5p58hc8f6gyd5zad5gxx136
originating_run_kind: spinoff
related: ['@plan-site-onboarding-authority', '@proto-admin-server-onboarding']
collision: [contracts/v1/, internal/gateway/administration, web/src/app/Settings]
preparation: ready
lane: site-onboarding
lane_seq: 1
closed: 2026-10-24
closed_by: worker
commits:
- hash: 1c07d70b
  summary: site onboarding configuration, admin CLI and Käyttöönotto tab
- hash: c701f170
  summary: keep an unresolved save visible and require integration required
---

# Site onboarding configuration: gateway store, admin onboarding CLI and the Käyttöönotto tab

## Description

Goal: the administrator edits the site's onboarding in Settings › *Käyttöönotto*, and root's agent does the same from the CLI. Both write one versioned configuration in gateway administration state.

Implements ADR 0030 "The onboarding configuration is gateway administration state" (`docs/decisions/adr-0030-site-onboarding-authority.md`; plan.md decision 1 and the "CLI surface" section of `issues/plan-site-onboarding-authority/plan.md`):

- `onboarding = {repositories: {mode: preselected|auto|skip, defaults[] (owner/repo, at most 20)}, integrations: [{provider, required}], ai_account: {offer: all|chatgpt|claude|openai_key|anthropic_key|deepseek_key|site_key}}` in `internal/gateway/administration.go` beside name and default quota, with the same writer lock, version and validation from the browser (session + admin + CSRF) and from root's control socket. `host apply` never touches it. `site_key` is rejected until the site-key issue adds the key (the invariant is `offer == site_key` exactly while a key is stored).
- Contract in `contracts/v1/` for the admin read/write, plus a person-side onboarding read that never includes `defaults`. The person-side read is what the route issues consume.
- `open-habitat admin onboarding show` and `admin onboarding update --file <path|-> --expected-version <n> [--dry-run]`, following the AI-first CLI canon (JSON envelope, `known_effects`, typed exit codes; `CONFORMANCE.md` row).
- Settings tab *Käyttöönotto* in the "Lista reittinä" form, with the fixed order GitHub → Repot → one row per integration → AI-tili. It includes the repository mode and default list, the integration list with required/optional, the AI offer, and "Näytä henkilön näkymä", the preview mode (full preview with the settings in a side panel).
- An integration whose catalog entry is not `Available` is shown to the administrator as not installed.

UI specification: `proto-admin-server-onboarding` rounds 2 (Lista reittinä), 3 (AI account, Kolme tapaa), 4 (preview mode, own tab) and 5 (Tapa ja lista), `design-system/prototypes/rounds/2026-10-23-palvelin-aloitus-{2,3,4,5}/`, and that issue's result.md.

Scheduling proposal (filed unlaned by run policy): lane `onboarding`, after `onboarding-ai-step-layout`; no blockers.

## Acceptance Criteria

- [ ] The configuration round-trips through browser and CLI with version conflicts, invalid names, too many defaults and an unknown provider rejected identically on both paths (Go tests on the administration store and the control socket).
- [ ] `host apply` leaves the configuration unchanged (test).
- [ ] The person-side read omits `defaults` (contract test).
- [ ] The Käyttöönotto tab and preview mode have a Storybook story and component tests; a browser spec covers editing and preview.
- [ ] `admin onboarding` has a `CONFORMANCE.md` row and `--dry-run` tests.
- [ ] Review: independent `/llm-review` (contract and gateway administration state change).

## Resolution

### 2026-10-24T05:49:56Z · @worker

Delivered: gateway store with one version and identical validation from browser and root control socket, admin onboarding show/update CLI, person-side read without defaults, Käyttöönotto tab with preview mode. Product decisions taken by judgement are under 'Päätöksiä myöhempään tarkistukseen' in result.md; the person's route reads the configuration in the follow-up issues.
