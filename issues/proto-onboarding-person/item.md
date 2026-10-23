---
created: 2026-10-23
updated: 2026-10-23
type: task
reporter: jari
status: done
priority: normal
related: ['@proto-site-onboarding-and-invites']
preparation: pending
lane: proto-onboarding-person
lane_seq: 1
closed: 2026-10-23
---

# Prototype: onboarding as the new person sees it (default repo, stale filter, integration steps)

## Description

Jari 2026-10-23 (see `proto-site-onboarding-and-invites`, the parent request): The person being onboarded, step by step: GitHub sign-in, repositories with a site default (auto-checked-out vs pre-selected, skip allowed), stale repositories hidden (no commits > N days), integration steps such as Google reusing the same views/components as Settings › Integraatiot, AI account. Always a way to continue.

Shared vocabulary for all three units (keep it consistent; it is a design assumption, not a decision): a site may define an onboarding with ordered steps — GitHub sign-in (always), repositories (default repositories: auto-checkout or pre-selected; staleness filter in days; or skip), integrations (e.g. Google; required/optional/off), AI account — plus who may join (admitted GitHub users, invitations). Use these names: `onboarding.steps`, `onboarding.repositories.defaults`, `onboarding.repositories.stale_after_days`, `onboarding.integrations`, `invitations`.

Prototype/plan only; production unchanged until Jari chooses.

## Acceptance Criteria

- [x] Published for review with a Finnish summary, recommendation and the question for Jari.

## Decisions

### 2026-10-23T11:21:23Z · @jari

Jari 2026-10-23: choose 'Reitti rinnalla' and riff on it. Round 1 lacked the variant picker and did not use the /prototype skill's ready code (~/.claude/skills/prototype, PICKER.md copied verbatim, the design-system/prototypes library and build). Page 3 (integration step) has far too much text: the whole integration drowns in a wall of text.

### 2026-10-23T15:49:25Z · @jari

Jari 2026-10-23 on r2: the Kartta route (whole route visible beside the step) is chosen as the frame. Step contents were only placeholders: keep the current production repository chooser (better than the prototype's) and the current AI-account flow (much better); the Google step uses the same views/components as Settings › Integraatiot; when an integration such as Google is selected for onboarding, the map shows it as a step.
