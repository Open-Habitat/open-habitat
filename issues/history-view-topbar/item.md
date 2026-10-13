---
created: 2026-10-13
updated: 2026-10-13
type: bug
status: fixed
priority: normal
lane: web
lane_seq: 15
collision: [web/]
closed: 2026-10-13
closed_by: claude
---

# Read-only history conversations still use the old top bar

Jari, 2026-10-13 on the test server: an older conversation opened from the
sidebar ("Avoimien issueiden listaaminen taulukossa", workspace issuectl)
shows the old top bar — a "Prosessin tila ei tiedossa" chip, a dashed
"Vain luku" chip and an info button — while a new conversation shows the
agreed Ikonirivi (state chip, retitle, archive, info). The read-only native
history view (`web/src/app/HistoryView.tsx`, `activityLabel` /
`controlLabel` around the read-only agent header) was not moved to the top
bar that `conversation-actions-layout` implemented for browser-controlled
conversations.

## Agreed behaviour

Every conversation uses the same top bar as in
`design-system/drafts/Agentin vuoro.proto.html` and `design-system/design.md`
(Keskustelu: Ikonirivi). An action that is not available for a read-only or
uncontrolled conversation stays visible, disabled, with its reason, as the
design says for blocked actions; the state chip says the honest state
(unknown process state stays unknown, not invented). Whether archive and
retitle work on such a conversation follows from what the host supports;
if it does not, they are disabled with a reason.

## Done when

- An old native-history conversation and a browser-controlled one show the
  same bar layout; lab captures of both beside the draft in
  `issues/history-view-topbar/`, differences explained in `result.md`.

## Reopen Notes — 2026-10-13

The first pass disabled the archive icon for every native-history view, including archived conversations. The host allows restoring an archived readable history without a live controller, so the shared icon row must expose that supported action instead of leaving it in a separate button.

