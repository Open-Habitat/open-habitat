---
created: 2026-10-24
updated: 2026-10-24
type: improvement
reporter: jari
status: done
priority: normal
provenance: other
provenance_detail: Implementation split of plan-site-onboarding-authority accepted by Jari 2026-10-24
source_ref: taskfleet:01m5p58hc8f6gyd5zad5gxx136/split:onboarding-integration-steps
originating_run: 01m5p58hc8f6gyd5zad5gxx136
originating_run_kind: spinoff
related: ['@plan-site-onboarding-authority', '@proto-admin-server-onboarding']
blocked_by: ['@onboarding-config-store']
collision: [web/src/app/GitHubOnboarding]
preparation: ready
lane: site-onboarding
lane_seq: 3
closed: 2026-10-24
---

# Onboarding integration steps from the site configuration (required/optional)

## Description

Goal: the person's route has one step per integration the site added, in the configured order. A required integration has no skip action.

Implements ADR 0030's `integrations: [{provider, required}]` (`docs/decisions/adr-0030-site-onboarding-authority.md`; plan.md decision 1). The route reads the person-side onboarding read from `onboarding-config-store`. Each configured integration becomes its own step between Repot and AI-tili, using the existing per-provider onboarding step (`GoogleOnboarding` from `onboarding-route-map`) and the integrations catalog (ADR 0026). `required: true` removes the skip action only and gates no workspace access. An integration that is not `Available` is left off the route. With no configured integrations the route has no integration steps; today's always-on Google step is replaced by configuration.

UI specification: `proto-admin-server-onboarding` round 2 (integrations "very good and clear as is") and the route frame of `proto-onboarding-person` r2 (Kartta).

Scheduling proposal (filed unlaned by run policy): lane `onboarding`, after `onboarding-default-repositories`.

## Acceptance Criteria

- [ ] Component tests for zero, one optional, one required and one unavailable integration; a browser spec walks the route with a required and an optional step.
- [ ] The preview in Käyttöönotto shows the same steps (shared component).
- [ ] Review: focused self-review (presentation over an existing read).
