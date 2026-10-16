---
created: 2026-10-16
updated: 2026-10-16
type: feature
reporter: jari
status: done
priority: high
lane: web
collision: [web/src/app/, web/src/components/]
preparation: ready
commits:
- hash: c57a7bc8e1c3f7b4fec71130dce1dd89d4566340
  summary: 'fix(web): retain conversations when hiding a workspace'
- hash: 94cb9a85836af570dd858f36f2ccbc9972778f7c
  summary: 'fix(web): size the icon row from its workspace container'
- hash: 470ca5dd11c934c00dcceeef7381e9cff1dd48cf
  summary: 'feat(web): replace workspace menus with the accepted icon row'
closed: 2026-10-16
closed_by: pi
---

# Implement workspace page Ikonirivi, no context menus

Implement the workspace page that Jari accepted on 2026-10-16 in the second round: direction 2, **Ikonirivi**, of `design-system/prototypes/rounds/2026-10-16-tyotilasivu-2/`. Read `issues/proto-workspace-page-2/result.md` and its Decisions.
- The head has five icons in the conversation top bar's language (copy path, GitHub, rename dialog, hide toggle, delete disabled with its reason), a divider and `+`. On the phone they form their own row of 40 px targets.
- No context menus: the sidebar's workspace row is name plus `+` only, and the `…` menus are removed.
- A conversation cannot be archived before its agent is done, including while it waits for a process or a spinoff; the reason is shown.
- Earlier decisions stand: the Git pill, `+` creating directly, spinoffs Langassa, and the archive notice Hetki alhaalla.

## Acceptance Criteria
- [x] Paired lab screenshots match the round (desktop and phone, light and dark), with deviations justified.
- [x] Browser tests for each icon, the sidebar row without a menu, and the archive block while working or waiting.
