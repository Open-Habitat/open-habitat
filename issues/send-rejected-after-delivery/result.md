# Result

## What sent the second `send`

Not the rename, and very probably not the page. Evidence from the test guest
(pilot on `08feabec`, whose send and composer code is the same as now):

- Gateway and daemon: `POST …/send` 200 at 12:40:03.396, 409 at 12:40:07.984,
  then `POST …/presence` at 12:40:08.171. The page reports presence on the
  first keydown/pointerdown/wheel after a 20 s gap. The previous report was at
  12:39:46.7, so any input after 12:40:06.7 would have reported before the
  second send. The report came 190 ms after the 409, which matches the draft
  filling again when the refused text went back to the field. So no key or
  pointer press came before the second send.
- Pi's session file has one user line (`KAikki noi toimii`, 12:40:03.404). The
  second request reached the daemon 40 ms after the turn's first tool result,
  while the agent worked.
- In the web app every path to `POST /send` starts from a press (composer
  Enter or button, *Kerro agentille*, an ended worker's row, the editor
  note), and each press makes a new `crypto.randomUUID()` command ID. Nothing
  resends.
- The daemon refused with 409 for a spent command ID (`s.commands[id]`)
  under the same `control_uncertain` code as for a busy agent. The page
  reads 409 as "nothing was written".

Conclusion: the same POST reached the daemon a second time, a resend by the
browser's network stack or the Cloudflare/tunnel path (Alder's cloudflared is
on ISP) after the first reply was lost. The daemon refused the resend
as if it were a new message, and the page showed the delivered message as
rejected and put it back in the field. Neither log recorded the command ID,
so a second message with a new ID cannot be ruled out entirely. The daemon
now logs `conversation_message_repeated` and `conversation_message_refused`
with the command ID and the gateway's request ID, so a repeat of this
incident names its cause.

## Fix

- Daemon (`sendKind`, both direct and held sends, and steer/follow-up): a
  request whose command ID is already spent is answered like its admission
  (200, `pending`, or `held` while it is still held). It is never executed
  again and never refused. The receipt or Pi's queue gives the outcome as
  before. Tests that asserted 409 for a repeat now assert 200 and that Pi
  got exactly one prompt.
- Page: `NotAdmitted` carries the host's error code. A genuine refusal of a
  send or queue message says why, with a separate case for read-only
  history, and what to do. The text is in the field; send it again, and while
  the agent works it goes as steering or into the queue. The page also reads
  status again after a refused send. A message Pi itself refused says so.
- Browser spec `a send that arrives twice is delivered once and never
  refused`: rail rename, then send at once with the POST delivered twice
  (`route.fetch()` twice). Without the daemon fix it fails exactly as Jari
  saw: the message appears once in history and the rejected marker shows.

## Decisions for later review

- **A spent command ID is answered as the same message without comparing
  its text.** Alternatives: store a fingerprint per command and refuse a
  different body with a new error code, or keep 409. The browser makes a
  new UUID for every message, so a reused ID with other text is a client
  bug. A fingerprint would add per-command state, two copy sites (continuation
  and held relaunch) and a contract error code for a case that does not
  occur.
- **Only message commands (send, steer, follow-up, held) are idempotent.**
  Repeats of bash, abort, clear-queue and cancel-held IDs still get 409.
  Their pages already treat a refusal differently, and this issue concerns
  messages.
- **The send reply stays `pending`/`held` for a repeat** even when the
  receipt already says accepted. Widening the reply to every receipt state
  would change the contract, and the page reads the receipt anyway.
- **The repeat and refusal are logged at Info with the command ID** (a
  browser-made UUID, not content), to settle the cause next time.

## Left as is

- A steer/follow-up whose reply is lost and whose status is overtaken by
  another tab's command has no per-command receipt. The page then shows it
  as uncertain and gives the text back. This predates this change, is rare
  (lost reply plus another tab), and was found in review.
- After a daemon restart the spent IDs are gone (the in-memory map), so a
  repeat that late would be a new message. This also predates this change.

## Review

Independent `/llm-review` (finder gpt-6-astra, second model claude-fable-5-1)
and `/assess-findings`. Applied: the softened cause comment and diagnostics,
removal of the now-dead spent-ID checks, a later assertion in the
continuation test, the stronger spec assertion and hedged refusal wording.
Dropped: the queue receipt gap (pre-existing, rare) and the text fingerprint
(see decisions).
