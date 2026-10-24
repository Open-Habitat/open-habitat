---
created: 2026-10-23
updated: 2026-10-24
type: task
reporter: jari
status: done
priority: normal
related: ['@proto-site-onboarding-and-invites']
preparation: ready
lane: plan-site-onboarding-authority
lane_seq: 1
closed: 2026-10-24
closed_by: worker
---

# Plan: who holds the site onboarding, admission and site AI-key authority

## Description

Jari 2026-10-23 (parent `proto-site-onboarding-and-invites`), rewritten 2026-10-24 after `proto-admin-server-onboarding` rounds 2–6: one decision proposal (ADR draft, not accepted; no implementation) for the settled product. It covers where the onboarding configuration lives (repositories `{mode, defaults[]}`, integrations `{provider, required}`, AI account `{offer}`), who writes it, and how a person's daemon receives it without trusting the browser; admission without invitations (allowed numeric GitHub ids, browser request + server confirmation, withdrawal ending sessions, restore to the same Unix account, administrators only from `site.json`); the site AI key (storage, readers, seeding only new onboardings, rotation and removal, checked against "no own credential broker"); auto-import of default repositories with the person's own GitHub identity; and the administrator's cross-user view of onboarding outcomes. Each part gives options, one recommendation, the explicit authority changes and the CLI surface.

## Acceptance Criteria

- [x] Published for review with a Finnish summary, recommendation and the question for Jari.
- [x] Rewritten after prototype rounds 2–6 as one ADR draft covering configuration, admission, site AI key, default-repo import and the onboarding receipt, reviewed with `/llm-review`, with numbered questions for Jari in result.md.

## Comments

### 2026-10-23T11:04:28Z · @worker

Decision proposal: [plan.md](plan.md). Recommends host-owned security/delegation policy, gateway-owned runtime onboarding via browser/admin CLI, and broker-owned invitations behind an explicit root-enabled delegation. Gateway trust expansion is not approved. Awaiting Jari’s choice; no production change.

### 2026-10-23T16:37:49Z · @conductor

Input from Jari's proto-admin-server-onboarding r2 review (2026-10-23): (1) no invitations — admission is the list of allowed GitHub usernames; (2) the admin may pre-provide an AI API key (OpenAI/Anthropic/DeepSeek) so the AI step is skipped. (2) distributes one site credential into every person's native Pi configuration, which touches 'no own credential broker' and per-user credential ownership; the plan must say where that key lives, who can read it, and how it reaches each Unix user.

### 2026-10-23T17:00:35Z · @conductor

Jari 2026-10-23: a site AI key applies only to new onboardings; already-joined people are not changed (the CLI covers such administrative actions); usage bills the key's own account.

## Decisions

### 2026-10-24T05:13:28Z · @jari

Jari 2026-10-24 accepted the plan (ff3468c5) with all recommendations: (1) the browser administrator may admit new people, only when site.json has runtime_admission: true (default off); (2) nobody allowed by site.json can be removed from the browser, and browser editing of the administrator role is removed; (3) the gateway may store the site AI key and seed it once into a new person's Pi credentials, never over their own key; (4) the gateway may use the person's sign-in token to check access to default repositories; (5) the sign-in receipt is enough for the admin's user list; (6) seeding the key for already-joined people is later, separate work.

## Resolution

### 2026-10-24T05:16:58Z · @worker

Recorded as ADR 0030 (docs/decisions/adr-0030-site-onboarding-authority.md). Implementation: onboarding-config-store, runtime-admission-broker, site-access-tab, onboarding-default-repositories, onboarding-integration-steps, onboarding-ai-offer, site-ai-key, onboarding-signin-receipt; admin-ai-key-seed later.
