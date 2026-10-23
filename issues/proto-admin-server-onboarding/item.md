---
created: 2026-10-23
updated: 2026-10-23
type: task
reporter: jari
status: in-progress
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

- [x] Published for review with a Finnish summary, recommendation and the question for Jari.
- [ ] Round 2 from Vaihelista with Jari's 2026-10-23 feedback (see Decisions), published to a new page with the PICKER.md tablet, Finnish summary, recommendation and open questions.

## Prototype review

[Recommendation, alternatives and evidence](result.md). [Published review](https://glasspad.example.test/p/ai2t44d56dtch24msa4e636xgm/). Awaiting Jari’s direction choice; no production changes.

## Decisions

### 2026-10-23T16:01:05Z · @jari

Jari 2026-10-23 on r1: Vaihelista is the best direction; riff a round 2 from it. Feedback: the step order is fixed (not adjustable). Repositories: no stale-filter setting ('hide repositories updated more than N days ago' is not offered as configuration); the repository start mode (auto-checkout vs pre-selected) is good; there can be several default repositories. Integrations: the admin adds one or more integrations, and each one appears as its own step in the effect preview ('vaikutukset'). AI account: the admin chooses which option is offered as the default.
