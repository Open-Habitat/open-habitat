---
created: 2026-09-29
updated: 2026-09-29
type: improvement
status: open
priority: high
related: ['@github-repos-first-onboarding']
lane: github-picker-ui
collision: [web/src/components/]
blocked_by: ['@github-chooser-component']
---

# Make first-use GitHub selection a single continue action

## Description

Jari asks that first-use checkout is real and the UI maximally simple. Replace the chooser component three-action checkout/continue/skip flow with one primary Jatka: selected repositories are checked out by the parent on click, zero selection proceeds to Pi; progress shows actual checked-out count and verified success advances automatically without another click. Explicit click authorizes writes; checking a box alone still does not mutate, avoiding premature duplicate clones. Uncertain/partial outcomes stay visible, and read-only recheck is offered before a manual new attempt, never auto-POST. Update controlled component props, component tests and real Storybook stories (no App edits: final integration issue wires once clone backend lands). Cover empty/selected/pagination/failure/accessibility, use synthetic names, run clean CI on committed tree. Product-wide UI wiring and live clone proof remain @github-repos-first-onboarding.
