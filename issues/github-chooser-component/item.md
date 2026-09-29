---
created: 2026-09-29
updated: 2026-09-29
type: task
status: open
priority: high
related: ['@github-repos-first-onboarding']
lane: github-picker-ui
collision: [web/src/components/]
blocked_by: ['@pre-pi-github-repo-catalog']
---

# Build shared GitHub first-use repository chooser component

## Description

Build a shared production/Storybook Finnish first-use GitHub repository picker, used before the Pi login card. It consumes validated catalog rows from the v1 github-repos contract and controlled selected/checkout states via props/callbacks, but it does not implement host calls or edit App.tsx: @github-repos-first-onboarding owns final integration after @pre-pi-github-clone. Accessible explicit selection and commit for checkout (no clone on check/uncheck), pagination/more, private badges, loading, empty, unavailable/denied, in-progress, partial and unknown write outcomes, retry only as explicit read-only recheck. Tidy desktop-first layout in design-system tokens; exact eyebrow Käyttöönotto, no Pi or provider admonitions. Use invented repository names only in stories/tests, no fixture seam in production build. Run components/Storybook/clean CI, record screenshots/evidence and revision. Browser will not pass arbitrary owner/path into host API.
