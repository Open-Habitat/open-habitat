---
created: 2026-10-24
updated: 2026-10-24
type: improvement
reporter: jari
status: done
priority: normal
provenance: other
provenance_detail: Implementation split of plan-site-onboarding-authority accepted by Jari 2026-10-24
source_ref: taskfleet:01m5p58hc8f6gyd5zad5gxx136/split:onboarding-ai-offer
originating_run: 01m5p58hc8f6gyd5zad5gxx136
originating_run_kind: spinoff
related: ['@plan-site-onboarding-authority', '@proto-admin-server-onboarding']
blocked_by: ['@onboarding-config-store', '@onboarding-ai-step-layout']
collision: [web/src/app/GitHubOnboarding]
preparation: ready
lane: site-onboarding
lane_seq: 4
closed: 2026-10-24
closed_by: claude
---

# Onboarding AI step offers the site's configured option

## Description

Goal: the person's AI step offers what the site chose. With `offer: all` they get every option. With a default they get that one option plus "› Käytä muuta AI-palvelua", which reveals the rest.

Implements ADR 0030's `ai_account.offer` for the person's step (`docs/decisions/adr-0030-site-onboarding-authority.md`; plan.md decision 1). It builds on the "Ehdotus ja lista" layout of `onboarding-ai-step-layout`. The offer comes from the person-side onboarding read, and the Käyttöönotto preview renders the same step. `site_key` is handled by `site-ai-key`: the step is skipped by native Pi credential status.

UI specification: `proto-admin-server-onboarding` rounds 3 (Kolme tapaa) and 4 (Ehdotus ja lista inside the preview mode), `design-system/prototypes/rounds/2026-10-23-palvelin-aloitus-{3,4}/`.

Scheduling proposal (filed unlaned by run policy): lane `onboarding`, after `onboarding-integration-steps`.

## Acceptance Criteria

- [x] Stories and component tests for `all` and each of the five defaults, including revealing the others.
- [x] A browser spec covers a default offer and switching to another service.
- [x] Review: focused self-review.
