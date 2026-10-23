---
created: 2026-10-23
updated: 2026-10-23
type: task
reporter: jari
status: in-progress
priority: normal
related: ['@proto-site-onboarding-and-invites']
preparation: pending
lane: plan-site-onboarding-authority
lane_seq: 1
---

# Plan: where site onboarding config lives, its CLI, and who may invite

## Description

Jari 2026-10-23 (see `proto-site-onboarding-and-invites`, the parent request): A planning document (ADR proposal, not accepted) for Jari: where the site's onboarding configuration lives (site declaration applied by host apply vs runtime admin settings vs both), the CLI surface (host vs admin) so an installing agent can configure it, and who holds the authority to admit/invite (today the root broker owns admission; browser and gateway hold none). Options with reasoning, one recommendation. No implementation.

Shared vocabulary for all three units (keep it consistent; it is a design assumption, not a decision): a site may define an onboarding with ordered steps — GitHub sign-in (always), repositories (default repositories: auto-checkout or pre-selected; staleness filter in days; or skip), integrations (e.g. Google; required/optional/off), AI account — plus who may join (admitted GitHub users, invitations). Use these names: `onboarding.steps`, `onboarding.repositories.defaults`, `onboarding.repositories.stale_after_days`, `onboarding.integrations`, `invitations`.

Prototype/plan only; production unchanged until Jari chooses.

## Acceptance Criteria

- [x] Published for review with a Finnish summary, recommendation and the question for Jari.

## Comments

### 2026-10-23T11:04:28Z · @worker

Decision proposal: [plan.md](plan.md). Recommends host-owned security/delegation policy, gateway-owned runtime onboarding via browser/admin CLI, and broker-owned invitations behind an explicit root-enabled delegation. Gateway trust expansion is not approved. Awaiting Jari’s choice; no production change.

### 2026-10-23T16:37:49Z · @conductor

Input from Jari's proto-admin-server-onboarding r2 review (2026-10-23): (1) no invitations — admission is the list of allowed GitHub usernames; (2) the admin may pre-provide an AI API key (OpenAI/Anthropic/DeepSeek) so the AI step is skipped. (2) distributes one site credential into every person's native Pi configuration, which touches 'no own credential broker' and per-user credential ownership; the plan must say where that key lives, who can read it, and how it reaches each Unix user.
