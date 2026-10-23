---
created: 2026-10-23
updated: 2026-10-23
type: bug
reporter: jari
status: fixed
priority: normal
preparation: ready
lane: onboarding
lane_seq: 1
collision: [web/src/app/GitHubOnboarding]
closed: 2026-10-23
commits:
- hash: 3c0f1f30
  summary: 'onboarding: continue without repos in every phase; clone in the background'
---

# Onboarding: no way to continue when the repo list is unavailable

## Description

Jari 2026-10-23 on the pilot: onboarding step 2 says "Voit myös jatkaa ilman valintoja", but when the repo list is unavailable there is no continue button, so a new person is stuck. The person must always be able to continue without repositories (and fetch them later from the workspace view), in every phase of the chooser including `unavailable`, `uncertain` and `no-auth`.

## Acceptance Criteria

- [ ] A visible "Jatka ilman repoja" action in every chooser phase; browser test for the unavailable phase.

## Resolution

### 2026-10-23T12:45:18Z · @issuectl

Delivered together with onboarding-background-clone; evidence and limits in issues/onboarding-background-clone/result.md.
