---
created: 2026-10-23
updated: 2026-10-23
type: task
reporter: jari
status: open
priority: normal
related: ['@proto-site-onboarding-and-invites']
preparation: ready
lane: proto-admin-server-onboarding
lane_seq: 1
---

# Prototype: Settings › Palvelin — configure onboarding and invite people

## Description

Jari 2026-10-23 (see `proto-site-onboarding-and-invites`, the parent request): The administrator in Settings › Palvelin: configure the onboarding steps and defaults, and invite people (GitHub username → invitation; pending/accepted; revoke). Show what each change means for a new person.

Shared vocabulary for all three units (keep it consistent; it is a design assumption, not a decision): a site may define an onboarding with ordered steps — GitHub sign-in (always), repositories (default repositories: auto-checkout or pre-selected; staleness filter in days; or skip), integrations (e.g. Google; required/optional/off), AI account — plus who may join (admitted GitHub users, invitations). Use these names: `onboarding.steps`, `onboarding.repositories.defaults`, `onboarding.repositories.stale_after_days`, `onboarding.integrations`, `invitations`.

Prototype/plan only; production unchanged until Jari chooses.

## Acceptance Criteria

- [ ] Published for review with a Finnish summary, recommendation and the question for Jari.
