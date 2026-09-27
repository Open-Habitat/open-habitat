---
created: 2026-09-27
updated: 2026-09-27
type: task
status: open
priority: high
lane: login-ui
collision: [design-system/]
---

# Refine Omega Habitat login and error screen

## Description

Use Omega Habitat as user-facing name now, without wide repository/systemd/package rename. Login screen: friendly welcome heading, keep Kirjaudu GitHubilla, remove Unix-account and native GitHub technical paragraphs. Error state: visually distinct danger treatment, concise Kirjautumisessa tapahtui virhe, safe diagnostic/reference code and contact route without exposing details; assess existing safe code path rather than assuming URL parameter is trusted. Update shared components and tests including Storybook. Do not change OAuth, backend auth flow or provisioning. Verify with ./scripts/ci-local.sh --clean --json.
