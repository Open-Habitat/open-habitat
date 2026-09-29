---
created: 2026-09-29
updated: 2026-09-29
type: improvement
status: open
priority: high
related: ['@github-repos-first-onboarding']
lane: github-picker-ui
collision: [web/src/app/github.ts, test/browser-host/main.go]
---

# Show a useful GitHub repository page during first use

## Description

Live pilot.10 first-use UI currently fetches only two GitHub repositories per page (`web/src/app/github.ts` hard-codes limit=2), forcing repeated “Näytä lisää repoja” clicks to reach most of the mapped user’s repositories. Jari requests the simplest possible UI. Widen to a normal bounded page size (recommend 50, the existing daemon/gateway contract maximum), retaining the current explicit selection→one Jatka checkout, verified outcomes and Pi order. Adapt the production-bundle synthetic gh/browser fixture to prove a full page and page continuation; no runtime test fixture seams, no credential output, no new store. Confirm accessible scroll/read position and Finnish empty/error/partial states. Clean committed-tree CI and package verification; deployment requires a *new* guarded successor of active pilot.10, not replay of the one-shot pilot.9 successor operator. Live visual acceptance remains with @github-repos-first-onboarding.

## Decisions

### 2026-09-29T07:00:35Z · @jari

2026-09-29: Jari reports the repo chooser flashed away before he could select the repositories he wanted. The conductor had clicked Jatka during a live smoke, advancing Jari’s own Chrome session; this is not evidence that the chooser auto-advanced. The conductor restored only the session-bound GitHub step marker, leaving credentials and native checkout unchanged; chooser is visible again. Make the first-use chooser practical (not two repos/page) and add an explicit way back from the Pi step to select additional repos without logout or silent checkout. The conductor must not press Jatka in Jari’s open session again without him choosing.

## Comments

### 2026-09-29T07:02:11Z · @agent

Live read-only mapped-UID GitHub API confirms the permission hypothesis is false: affiliation=owner returned 40 personal repositories; combined owner/collaborator/org listing returned 52 total, with 38 personal in the first 50. Production browser hard-codes limit=2, and first two alphabetical repos are from an organization; the personal repos are reachable only after repeated load-more clicks. No new OAuth consent/scopes needed. The conductor restored Jari’s chooser, attempted only read-only page expansion, and stopped before any click on noticing Jari already had three checkboxes selected (ten rows loaded). Do not disturb his active selection. Page size/back navigation need a proper release.
