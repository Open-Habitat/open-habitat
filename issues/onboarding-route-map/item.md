---
created: 2026-10-23
updated: 2026-10-23
type: improvement
reporter: jari
status: done
priority: normal
related: ['@proto-onboarding-person']
preparation: ready
lane: onboarding
lane_seq: 3
collision: [web/src/app/GitHubOnboarding]
closed: 2026-10-23
---

# Onboarding: Kartta route frame around the production steps and a Google integration step

## Description

Jari 2026-10-23 chose the **Kartta** direction of `proto-onboarding-person` r2 (https://glasspad.example.test/p/o4zqhanv6x7odq62y4latbpoca/, round `design-system/prototypes/rounds/2026-10-23-onboarding-person-r2/`) as the frame of onboarding: the whole route stays visible beside the current step. Only the frame was being prototyped; the step contents in the prototype were placeholders.

Implement in production:
- the Kartta route frame around onboarding (desktop and 390 px, light/dark), with the route steps GitHub → repositories → integrations (when any) → AI account, current step and done steps marked, always a way to continue;
- the **current** production repository chooser (`GitHubOnboarding`, including background clones and continue-without-repos) and the **current** AI-account flow unchanged inside the frame;
- a Google integration step that reuses the same views/components as Settings › Integraatiot (no second implementation), skippable; when an integration such as Google is part of onboarding the map shows it as its own step.

Which integrations are part of onboarding is a site setting that waits for `plan-site-onboarding-authority`; until then, use the existing product behaviour to decide whether Google is offered (best judgement, recorded under "Decisions for later review").

## Acceptance Criteria

- [ ] Kartta frame in production with the current repo chooser and AI-account flow; Google step from Settings › Integraatiot components shown on the map; browser tests for route progression and skipping Google; screenshots desktop/390 px light/dark.
