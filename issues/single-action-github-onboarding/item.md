---
created: 2026-09-29
updated: 2026-09-29
type: improvement
status: done
priority: high
related: ['@github-repos-first-onboarding']
lane: github-picker-ui
collision: [web/src/components/]
blocked_by: ['@github-chooser-component']
closed: 2026-09-29
---

# Make first-use GitHub selection a single continue action

## Description

Jari asks that first-use checkout is real and the UI maximally simple. Replace the chooser component three-action checkout/continue/skip flow with one primary Jatka: selected repositories are checked out by the parent on click, zero selection proceeds to Pi; progress shows actual checked-out count and verified success advances automatically without another click. Explicit click authorizes writes; checking a box alone still does not mutate, avoiding premature duplicate clones. Uncertain/partial outcomes stay visible, and read-only recheck is offered before a manual new attempt, never auto-POST. Update controlled component props, component tests and real Storybook stories (no App edits: final integration issue wires once clone backend lands). Cover empty/selected/pagination/failure/accessibility, use synthetic names, run clean CI on committed tree. Product-wide UI wiring and live clone proof remain @github-repos-first-onboarding.

## Comments

### 2026-09-29T05:40:01Z · @agent

Shared chooser now has one Jatka action; selected names are passed once to the parent and no selection advances without checkout. Partial/uncertain states offer read-only recheck. Controlled component tests (45/45), typecheck, lint and full clean ./scripts/ci-local.sh --clean --json passed on worker committed revision a8dac049a98c408035c6c9750cd5cab6ec8a9687 before self-merge/rebase (main commit 96c1889). No App integration/live clone yet; tracked in @github-repos-first-onboarding.

## Resolution

### 2026-09-29T05:40:01Z · @issuectl

Single-action component and tests delivered; integration belongs to @github-repos-first-onboarding.
