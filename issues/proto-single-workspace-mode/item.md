---
created: 2026-10-17
updated: 2026-10-17
type: task
reporter: jari
status: open
priority: high
lane: unlaned
collision: [issues/proto-single-workspace-mode]
preparation: ready
---

# Prototype: single-workspace mode

Jari, 2026-10-17: "Yhden workspacen moodi jossa käyttäjälle näkyy vain yksi workspace. Tässä ollaan jos on vain yksi workspace. Tässä serverin nimen tilalle tulee se repon nimi, ja muutenkin kaikki käyttöliittymä on tavallaan mietitty siten, että on vain yksi workspace. Sit jos käyttäjä lisää toisen, niin sitten mennään siihen moodiin."

A person with exactly one workspace sees a UI designed around that one workspace: the rail header shows the repo/workspace name instead of the server name, and the home page, the rail, navigation and the workspace page collapse into a single-workspace shape (no workspace list to pick from). Adding a second workspace moves the UI into today's multi-workspace mode. The mode is derived from the native workspace count, not a stored setting.

Prototype round (three directions on one named axis, per `/prototype` and `design-system/prototypes/AGENTS.md`): what the one-workspace UI looks like on desktop and phone, where "add a workspace" lives, and how the transition to multi-workspace mode (and back, if a workspace is archived or trashed) feels. Note Jari's 2026-10-17 request that clicking the server name goes home (`rail-home-and-hover`).

## Acceptance Criteria
- [ ] Prototype round with three directions, checked with `check.mjs`, published with glasspad, questions for Jari in result.md.
