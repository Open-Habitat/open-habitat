---
created: 2026-09-29
updated: 2026-09-29
type: improvement
status: open
priority: high
related: ['@github-repos-first-onboarding']
lane: github-picker-ui
collision: [web/src/app/github.ts, web/src/app/GitHubOnboarding.tsx, web/src/components/GitHubRepoChooser.tsx, internal/daemon/github_repos_linux.go, contracts/v1, test/browser-host/main.go]
---

# Show a useful GitHub repository page during first use

## Description

Live pilot.10 first-use UI fetches only two GitHub repositories per page (`web/src/app/github.ts` hard-codes limit=2). Jari explicitly rejects repeated “Näytä lisää repoja” clicks and wants to see when a repository last received code. Read-only live mapped-UID GitHub API confirmed 40 owned personal repositories and 52 total accessible repositories, including 38 personal in the first 50. The existing OAuth permission is sufficient; no reauthorization.

Automatically collect all bounded pages through the existing per-UID catalog (50/page, up to the contract's safe page ceiling), with no “Näytä lisää” button and no silent truncation: show a clear error if the complete catalog cannot be loaded. Present all repositories with a client-side name filter and a truthful nullable **Viimeisin push** date derived from GitHub's `pushed_at` metadata (not `updated_at`, which may reflect metadata), ideally recent-first with stable name tiebreak; show unknown when absent. Preserve explicit selection→one Jatka checkout, verified outcomes and Pi order. Add a way back from Pi onboarding to select additional repos, without logging out, changing credentials or automatically repeating checkout; clear prior selection before a new checkout. Keep pages private to the mapped UID and bound identity. Adapt strict neutral browser/host contract, native GH and production-bundle synthetic browser fixtures; prove >50 results, filtering, date/null, progress/partial failure, and focus. No fixture seams in the production bundle or new registry. Clean committed-tree CI and package verification before release; don't replay the one-shot pilot.9 successor. Live visual acceptance stays with @github-repos-first-onboarding.

## Decisions

### 2026-09-29T07:00:35Z · @jari

2026-09-29: Jari reports the repo chooser flashed away before he could select the repositories he wanted. The conductor had clicked Jatka during a live smoke, advancing Jari’s own Chrome session; this is not evidence that the chooser auto-advanced. The conductor restored only the session-bound GitHub step marker, leaving credentials and native checkout unchanged; chooser is visible again. Make the first-use chooser practical (not two repos/page) and add an explicit way back from the Pi step to select additional repos without logout or silent checkout. The conductor must not press Jatka in Jari’s open session again without him choosing.

## Comments

### 2026-09-29T07:02:11Z · @agent

Live read-only mapped-UID GitHub API confirms the permission hypothesis is false: affiliation=owner returned 40 personal repositories; combined owner/collaborator/org listing returned 52 total, with 38 personal in the first 50. Production browser hard-codes limit=2, and first two alphabetical repos are from an organization; the personal repos are reachable only after repeated load-more clicks. No new OAuth consent/scopes needed. The conductor restored Jari’s chooser, attempted only read-only page expansion, and stopped before any click on noticing Jari already had three checkboxes selected (ten rows loaded). Do not disturb his active selection. Page size/back navigation need a proper release.
