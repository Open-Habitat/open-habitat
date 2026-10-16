---
created: 2026-10-16
updated: 2026-10-16
type: feature
reporter: jari
status: open
priority: high
lane: web
collision: [web/src/app/, web/src/components/]
preparation: ready
---

# Implement workspace page Ikonirivi, no context menus

Implement the workspace page that Jari accepted on 2026-10-16 in the second round: direction 2, **Ikonirivi**, of `design-system/prototypes/rounds/2026-10-16-tyotilasivu-2/`. Read `issues/proto-workspace-page-2/result.md` and its Decisions.
- The head has five icons in the conversation top bar's language (copy path, GitHub, rename dialog, hide toggle, delete disabled with its reason), a divider and `+`. On the phone they form their own row of 40 px targets.
- No context menus: the sidebar's workspace row is name plus `+` only, and the `…` menus are removed.
- A conversation cannot be archived before its agent is done, including while it waits for a process or a spinoff; the reason is shown.
- Earlier decisions stand: the Git pill, `+` creating directly, spinoffs Langassa, and the archive notice Hetki alhaalla.

## Acceptance Criteria
- [ ] Paired lab screenshots match the round (desktop and phone, light and dark), with deviations justified.
- [ ] Browser tests for each icon, the sidebar row without a menu, and the archive block while working or waiting.
