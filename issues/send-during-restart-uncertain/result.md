# Result

## What kept the send uncertain

Two browser paths, both in this tab's send record in `sessionStorage`
(`last-send`, `uncertain`, `submitted`), which is why a reload did not help:

1. **The reply was lost after a status had already settled the send.** The
   synthetic reproduction hit this first: the old daemon's status named the
   command as accepted, then the restart cut the HTTP reply, and the send's
   `catch` marked the already settled command uncertain again. With
   `last-send` gone, nothing could ever settle it: no receipt lookup, no
   status match. `ConversationActions` now marks a failed reply uncertain
   only while the command is still this tab's outstanding one.
2. **The restart came before any status said so.** The restarted daemon keeps
   no receipts (by design: no durable acceptance claim), so the receipt is a
   404 and the outcome stays unknown, although Pi's native history has the
   message. `useConversation` now settles an uncertain send as accepted once
   native history shows it: a native user message newer than the newest one
   present at sending (`sent-after`, kept with the send record) that carries
   the sent text (`lostSendArrived` in `sentMessages.ts`). This works live and
   after a reload.

The daemon already gives the browser what it needs: native history entries
with stable keys and text. No daemon or contract change.

## One notice

A truly unknown outcome is now one `WarningBanner` (`send-uncertain`) above
the composer with one action, *Tarkista keskustelun tila*; after the check
it says the message still does not show. The dashed bubble with *Kopioi
teksti* and the separate *Aiemman pyynnön tulos epävarma* card are gone: the
text is back in the field already. When the history cannot be read at the
same time, the history banner stays the one warning and adds that the last
message's delivery is unknown for that reason.

## Evidence

`web/tests/browser-conversation.spec.ts` › *a send whose acknowledgement a
daemon restart lost resolves from history* (live, reload, settled) restarts
the synthetic daemon between Pi taking the message and the page hearing the
reply. Live and reload fail without the history reconciliation; settled fails
without the guard in the `catch`.

## Decisions for later review

- **Text containment as the history match.** A native user message newer than
  the send mark that contains the sent text counts as the send. Alternatives:
  any newer user message (as the in-flight bubble uses, tolerating a skill's
  expansion), or a command ID in Pi's history (Pi does not record it). Chosen
  because a wrong "delivered" hides a lost message; a skill invocation whose
  text Pi rewrites stays uncertain, which is the safe side.
- **No mark, no history proof.** A send keeps its history mark only when
  nothing else could be the newer message carrying its text: Pi's queue is
  empty (another tab's messages included) and none of this tab's queued
  messages is delivered but not yet in history. Otherwise, and for a record
  written before this change (Jari's tab open across the deploy), only a
  receipt or a status settles it, as before. Alternative: match queued texts
  one by one like `reconcileQueued`; rejected because after a restart the
  local queue state is gone and a wrong match hides a lost message. A tab
  stuck from before the deploy is closed once; a new send is the test.
- **A truly unknown send still blocks the composer in that tab.** If history
  never shows the message, the tab keeps refusing new sends until it is closed,
  as before (`a receipt lost on daemon restart remains unknown`). Releasing it
  (for example when the agent is confirmed idle, the daemon has no record and
  history lacks the message) would change the no-resend safety rule, so it was
  left for Jari to decide.
- **Banner tone neutral, not progress,** even while the check waits for the
  connection: the state does not resolve by itself in every case.
