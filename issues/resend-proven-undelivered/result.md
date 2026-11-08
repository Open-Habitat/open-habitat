# Result

## The rule as built

A send whose outcome is unknown (its reply was lost) is decided in
`useConversation` by `lostSendVerdict` (`web/src/app/sentMessages.ts`), only
for a command the host does not know: its receipt lookup answered 404 and no
status names it. The page remembers how many history reads had begun at that
finding (`ConversationStore.readsBegun`). Only history from a later read
(`newestRead`) can decide, and only if that read began after the status now
held arrived (`historyFollowsStatus`). Otherwise, while the agent looks
settled, the page reads the newest page again, queued behind any read
already running (`readNewest`).

- **Proven undelivered** (history readable and reaching the send's mark with
  no newer user message, Pi's queue and the daemon's held messages empty,
  the agent `idle` or `rejected` and not running): `ConversationActions`
  sends it again once, drawn as an ordinary sent message, and the restored
  text leaves the field. The once is recorded in `sessionStorage`
  (`resent`) before the request goes out.
- **Moved on** (a newer user message that does not carry the text, from any
  tab, or a rewind since the send: a rewind may have taken a delivered
  message off the branch, so its absence proves nothing): nothing is sent. The record ends,
  the text stays in the field where the unknown outcome had already put it,
  and one notice (`send-receipt`, `movedOn`) says why.
- **Anything less** keeps the existing single warning with *Tarkista
  keskustelun tila*. A resend whose reply is lost again keeps it too.

## Duplicate safety

The resend reuses the original `command_id`. The daemon already treats a
spent ID as the same message arriving again: it answers it as pending and
never writes it to Pi a second time (`admitMessage`, "A spent command ID is
this message arriving again"). This covers the cases that sessionStorage
alone could not: a duplicated tab holding the same record, and an original
request still on its way that arrives after the receipt lookup. No daemon or
contract change was needed. Separate tabs do not share the record. If a new
message from another tab and the resend meet, the daemon admits only one
send while the agent is idle, and the browser returns the refused text to
the field.

## Review

Independent `/llm-review` (finder gpt-6-astra, verifier claude-fable-5-1)
and `/assess-findings`. Three holes in the proof were confirmed and are
fixed:

- a newer idle status rendered against an older history window;
- a rewind past the delivered message;
- a history read request swallowed by a running older-page read.

By the assessment's derivation rules the first and the third would have
been dropped as rare. They were fixed anyway, because a false proof is the
one failure this feature must not have, and both fixes are small.

Residual risk: the daemon remembers spent command IDs only for one daemon
life. A request still on its way across a second restart could therefore
reach the new daemon after a duplicated tab's resend was delivered. That
window is one request's transit time, and every original send has the same
window.

## Evidence

`web/tests/browser-conversation.spec.ts` › *a send a daemon restart lost
before Pi took it is resolved* (live, reload, moved-on): the synthetic daemon
restarts before the send reaches it. Pi is then woken without a message, or
another tab's send starts it. All three cases fail with the resend and the
moved-on effect disabled. `sentMessages.test.ts` covers the verdict table.
The whole `browser-conversation.spec.ts` passes (86). In
`queued-send.spec.ts` 13 of 14 pass. *Stop before Pi runs* fails at line 202
identically on the base commit, and that failure is already filed as
`queued-send-stop-startup-background-control`.

## Decisions for later review

- **A stopped (resting) Pi is not "idle".** After a real restart the
  conversation is `stopped` until something wakes Pi. There, the composer is
  already free, because a send is held and starts Pi. The text is in the
  field and the warning stays. Once Pi wakes (typing wakes it), the proof
  applies. Alternative: resend into a stopped conversation, which the daemon
  would hold. Rejected because the held view and the sent bubble would both
  draw it, and the person can already send it themselves.
- **Moved on is usually seen once the other turn settles.** A newer user
  message is a positive fact. The history is read for the proof only while
  the agent looks settled, though, so during another tab's turn the text
  normally comes back when that turn ends. The notice says the message was not sent
  again, not that it never arrived. A skill invocation whose text Pi rewrites
  could be the "newer message" itself. In that rare case the person sees
  their own text back and decides.
- **The field is not consulted.** The resend goes even if the person edited
  the restored text. The field is cleared only when it still holds exactly
  that text. Alternative: treat an edit as taking over and only release the
  block. Rejected for now because the uncertain composer refuses sends
  anyway, and reading the field at the moment of restoration is racy.
- **Queued (steer/follow-up) records** follow the same rule and are resent as
  a direct send. The daemon keeps no receipt for them but does remember their
  ID, so a resend of one it knows is answered as a repeat and does nothing.
  The record then stays a warning.
- **Held messages** (sent while Pi was not running) have their own uncertain
  state and were left as they are. They never blocked the composer.
