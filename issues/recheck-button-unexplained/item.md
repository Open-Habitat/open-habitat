---
created: 2026-11-08
updated: 2026-11-08
type: bug
reporter: jari
status: fixed
priority: high
lane: unlaned
preparation: ready
closed: 2026-11-08
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

## Jari 18:48: after reload, *Historiaa ei saada*

After a page reload the same conversation shows a red *Historiaa ei saada*
banner at the top with no further text, the history partly drawn (the last
reply visible), and the same lone *Tarkista keskustelun tila* button above the
composer (`evidence/jari-2026-11-08-history.png`). So the button is the
recovery for a failing history read, and the real defect is that the
conversation's history read fails on the test server (pilot.643 or later),
with an empty explanation. Suspects from today's landings: the native frame
capacity raised to base64(100 MiB)+4 MiB (`attachment-combined-size`), the
ended-turn retirement in `ConversationStore` (`queued-message-duplicate-flash`),
and offer/view rendering changes. Find the failing read on the real test
server (daemon journal for that user, through Alder as Fleetrepo's
`infra/open-habitat-test/` runbook allows, read-only), fix the cause, and
make *Historiaa ei saada* say why and what to do.

## Acceptance Criteria

- [x] A healthy working turn shows no recheck button.
- [x] When a recheck is offered, it comes with its reason and visible result.
- [x] The conversation's history loads again on the test server; the cause is in result.md.
- [x] A history read failure shows its reason.
- [x] Touched specs green.
