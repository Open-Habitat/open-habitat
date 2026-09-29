---
created: 2026-09-29
updated: 2026-09-29
type: task
status: done
priority: high
related: ['@github-repos-first-onboarding']
lane: github-picker-ui
collision: [web/src/components/]
blocked_by: ['@pre-pi-github-repo-catalog']
closed: 2026-09-29
---

# Build shared GitHub first-use repository chooser component

## Description

Build a shared production/Storybook Finnish first-use GitHub repository picker, used before the Pi login card. It consumes validated catalog rows from the v1 github-repos contract and controlled selected/checkout states via props/callbacks, but it does not implement host calls or edit App.tsx: @github-repos-first-onboarding owns final integration after @pre-pi-github-clone. Accessible explicit selection and commit for checkout (no clone on check/uncheck), pagination/more, private badges, loading, empty, unavailable/denied, in-progress, partial and unknown write outcomes, retry only as explicit read-only recheck. Tidy desktop-first layout in design-system tokens; exact eyebrow Käyttöönotto, no Pi or provider admonitions. Use invented repository names only in stories/tests, no fixture seam in production build. Run components/Storybook/clean CI, record screenshots/evidence and revision. Browser will not pass arbitrary owner/path into host API.

## Comments

### 2026-09-29T05:26:40Z · @agent

Delivered controlled GitHubRepoChooser in web/src/components at eaaee3f7a288ce37c791bd9cda11f31114579933. Synthetic Storybook scenarios cover loading, catalog, empty, no-auth, unavailable, page-more/loading-more, progress, partial, uncertain and confirmed; component tests cover controlled selection, inert description text, explicit checkout, skip and continuation gating. Evidence: npm run typecheck, lint and test:component passed (43 component tests); ./scripts/ci-local.sh --clean --json passed on committed clean tree at eaaee3f7a288ce37c791bd9cda11f31114579933 with TMPDIR=/var/tmp and disposable verified Go 1.27.1. Limits: component-only; no App wiring, native checkout or live GitHub verified. Storybook build passed within full gate; no screenshot recorded because no integrated screen exists yet.

## Resolution

### 2026-09-29T05:26:40Z · @issuectl

Controlled component delivered and clean CI passed at eaaee3f7; App integration belongs to the conductor after clone backend lands.
