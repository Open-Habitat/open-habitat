---
created: 2026-10-23
updated: 2026-10-23
type: bug
reporter: jari
status: open
priority: normal
preparation: ready
lane: onboarding
lane_seq: 1
collision: [web/src/app/GitHubOnboarding]
---

# Onboarding: no way to continue when the repo list is unavailable

## Description

Jari 2026-10-23 on the pilot: onboarding step 2 says "Voit myös jatkaa ilman valintoja", but when the repo list is unavailable there is no continue button, so a new person is stuck. The person must always be able to continue without repositories (and fetch them later from the workspace view), in every phase of the chooser including `unavailable`, `uncertain` and `no-auth`.

## Acceptance Criteria

- [ ] A visible "Jatka ilman repoja" action in every chooser phase; browser test for the unavailable phase.
