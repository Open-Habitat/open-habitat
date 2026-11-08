---
created: 2026-11-08
updated: 2026-11-08
type: bug
reporter: jari
status: open
priority: high
lane: unlaned
preparation: ready
---

# Lone 'Tarkista keskustelun tila' button above the composer explains nothing and does nothing

## Description

Jari 8.11.2026 18:47, test server (`evidence/jari-2026-11-08-recheck.png`):
during a working turn (composer in *Ohjaa agenttia…* mode with Stop), a
full-width quiet button *Tarkista keskustelun tila* sits alone above the
composer with no text saying why. Pressing it does nothing visible.

Code: `web/src/app/BrowserConversation.tsx` (~3030) renders
`conversation-recheck` when `!storagePressure.full && !statusStale &&
(visibleRecovery || details)`; its press calls `refresh(true, true)`. So
some recovery or details state is set while the explanation that should
accompany it is missing or empty, and the refresh changes nothing.

Find which `visibleRecovery`/`details` state produced the lone button during
a normal working turn, and fix the cause: either the state is wrong (no
recovery needed during a healthy turn, so no button), or the explanation must
show with it as a `WarningBanner` and the button must give visible feedback
(checking…, then the result). Reproduce in a browser spec first.

## Acceptance Criteria

- [ ] A healthy working turn shows no recheck button.
- [ ] When a recheck is offered, it comes with its reason and visible result.
- [ ] Touched specs green.
