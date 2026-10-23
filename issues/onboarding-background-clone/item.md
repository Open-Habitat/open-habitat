---
created: 2026-10-23
updated: 2026-10-23
type: improvement
reporter: jari
status: open
priority: normal
preparation: ready
lane: onboarding
lane_seq: 2
collision: [web/src/app/GitHubOnboarding]
---

# Onboarding: fetch selected repos in the background during AI sign-in

## Description

Jari 2026-10-23: during onboarding, the selected repositories should be fetched in the background while the person continues to the AI-account sign-in, instead of "Jatka" blocking until every clone has finished (today: "Jatka-painike hakee ne työtiloiksi ennen ChatGPT-kirjautumista"). Start the existing native clone jobs when the person continues, move straight to the AI step, and show the clones' progress compactly (in the AI step and afterwards in the workspace list); a failed clone is reported with a retry and never loses anything. Combine with `onboarding-continue-without-repos` (same component): every chooser phase must offer continuing without repositories.

## Acceptance Criteria

- [ ] Continue starts clones and goes to the AI step immediately; progress visible; failures reported with retry; continue-without-repos works in every phase; browser tests; screenshots.
