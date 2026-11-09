# Result

## What happened on the test server

The test server's journals (read-only, as root on the guest from Alder)
explain the screenshots. The times are UTC; Jari's 09:45 is 07:45Z.

- 07:40:45–07:43:49Z: ten pictures upload (10–29 s each, all complete).
  After trimming, six of them are sent.
- 07:46:10Z: the send is admitted (1 ms). Pi was running and idle, so it went
  as a direct send.
- 07:46:12Z: a release deploy restarts the daemon (and at 07:46:2x the
  gateway). Pi is killed with it before it has the message. The restarted
  daemon knows neither the command nor its receipt, so the page shows *Ei
  tiedossa, saiko agentti viestin* and puts the text back in the field.
  This is the warning Jari did not have time to read.
- 07:46:34Z and 07:49:00Z: two more sends of the same text. The restarted
  conversation rests (`stopped`), and a send to a resting agent is held and
  starts Pi. It goes even while this tab's unknown send blocks the composer.
  Each one ends exactly two minutes later (07:48:36Z, 07:51:04Z) with
  `conversation_pi_ended … Habitat closed Pi's input after a failed write of
  prompt to Pi`.

Pi never received the message, so the conversation has no copy of it.

**Why the write failed.** Six pictures of about 16 MB each make a JSON frame
of about 130 MB on Pi's stdin. Pi's pinned reader (`modes/rpc/jsonl.js`)
appends each 64 KiB chunk to one string and then searches the whole string
for the newline again. The cost grows with the square of the frame:
`TestPromptAttachmentCombinedSize` takes 27 s for 100 MiB on Birch, and the
smaller test VM, busy with the daemon's own base64 work (the `processes`
route timed out at 5 s throughout), did not finish within the two-minute
deadline. The cut-off write was then recorded as *uncertain*.

**Hypotheses.** The issue's chain matches only partly. The large send did
outlast a daemon deadline, but it was Pi's intake, not the gateway, a
daemon HTTP deadline or the laptop's sleep. The upload and send requests
all completed. The first message was lost to a deploy restart, not to the
size. Nothing rewrote the text so that history could not match it; the
message simply never reached Pi.

**The screens.** Screenshots 1 and 2: the second send went held and cleared
the field, and the held message drew the dashed *Odottaa agenttia* bubble
during the two-minute write. The first send's warning kept saying the text
was in the field, and *Tarkista* printed the same sentence every time.
Screenshot 3: *ping* was refused with the uncertain-send wording because the
first send's record still blocked direct sends while Pi was busy receiving.
Screenshot 4: the cut-off write made the held message uncertain (*Toimitus
epävarma*). A remount gave the first record's text back a second time, ahead
of *ping*.

## What changed

Daemon:

- **A cut-off write is a definite non-delivery.** The frame is one JSON
  object followed by its newline, so any write shorter than the object
  leaves Pi nothing it can frame or parse. `piRPC.request` returns
  `errPiNotReceived` for it. `finishPrompt` records the new receipt
  `undelivered` (ack `rejected`, journal `not_delivered`), also when the
  ending child's watcher came first. A write that got all but the newline
  stays uncertain, since Pi would parse that line at end of input.
  `admitMessage` refuses a message while such a child is still ending.
- **The budget follows Pi's reader.** `promptRequestTimeout` grows with the
  square of the image bytes: 15 s for plain prompts, about 105 s for 50 MiB
  and about 6.3 min for the largest admitted batch, capped at 7 min.
  Calibrated at about 13 times Birch's measured speed.

Browser:

- `undelivered` puts the text and its pictures back in the field with
  *Agentti ei saanut viestiä: sen siirtäminen agentille keskeytyi…*. This
  happens on the direct path (`send-receipt`) and the held path, where the
  notice now lasts until the next send instead of 6 s.
- A held message whose outcome is unknown is no longer a dashed bubble. Its
  text goes back to the field and the single *Ei tiedossa* warning shows it
  (`data-reason="held"`). When history shows the message, the field is
  cleared again if it still holds that text. `WaitingMessage` lost its
  uncertain state.
- A message the person sends that carries an unknown send's text is that send
  made again. Its record ends (`releaseUnknown`, `held.release`), so nothing
  gives the text back again or keeps claiming it.
- The warning says *Teksti on kirjoituskentässä* only while the field holds
  the text. *Tarkista* reports the time of the check (*Tarkistettu klo
  9.47.12: …*), so each press is visible.
- A lost send that a **stopped** agent never got is now proven undelivered
  just as with an idle agent, and it goes again once, held, under its own
  command ID. In Jari's case that resolves the first message by itself after
  the deploy.
- A new held send clears an earlier send's outcome notice.

Contracts: none touched. The status and receipt shapes are validated in
`web/src/app/conversations.ts`, and `undelivered` was added there. The
journal's `error_code` is free-form.

## Evidence

Synthetic host, `OH_PORT_BASE=16300`, two workers:

- `web/tests/large-send.spec.ts` (new):
  - *pictures the agent cannot take in time…*: 6 × 2 MiB under the new
    `pi-slow-intake` scenario (fake Pi reads at about 800 KB/s, the budget is
    shortened to 2 s). A direct send, then a held send, each come back with
    the true notice, the text and six chips. Neither leaves a bubble or an
    unknown warning. With a normal Pi the same send then arrives once.
  - *about 90 MB of pictures arrive…*: 6 × 15 MiB through fake Pi as an
    ordinary send.
  - *a held message a restart made unknown…*: the text is in the field, one
    warning, no bubble. The check shows its time, the field claim follows the
    field, and sending the text again delivers it once.
- `browser-conversation.spec.ts`: the restart cases (*a send a daemon restart
  lost before Pi took it is resolved*, live/reload/moved-on) now expect the
  stopped agent's held resend.
- Whole `browser-conversation.spec.ts`, `queued-send.spec.ts` and
  `attachments.spec.ts`: 104 passed.
- Go: `internal/daemon` (all), `test/browser-host`. New tests:
  `TestPromptCutOffIsUndelivered` (both lock orders, plus a steer) and
  `TestPromptRequestTimeoutFollowsFrameSize`. `TestPiRPCNonReading` now
  expects the definite outcome.
- Web unit suite: 1523 tests, including new `heldMessages` and
  `lostSendVerdict` cases.

Not reproduced: a suspended tab mid-send. The send request itself is tiny
(the pictures are uploaded before it), and a reply lost to a suspended tab is
the existing lost-reply path, already covered by *a send whose
acknowledgement a daemon restart lost resolves from history*. Slow uploads
are `attachment-upload-timeouts`, filed separately. They did not occur here:
every upload completed.

## Review

Independent `/llm-review` (finder gpt-6-astra, verifier claude-fable-5-1)
and `/assess-findings`. Three findings were confirmed and fixed:

- A steer's interruption was erased in the watcher-first branch.
- The lasting held notice survived a later direct or queued send.
- The `undelivered` wording claimed a timeout although a write can also be
  cut off when Pi ends or a stop closes its input.

Dropped:

- A draft-ref race. It is refuted because every restoration awaits a real
  fetch.
- A microsecond window in which a held record could latch as unknown before
  `undelivered` is written. It is rare and unverified, so it is left alone.

Both models found no duplicate-send path, and both agreed that a strict
prefix of the frame cannot parse.

## Decisions for later review

- **Undelivered rather than uncertain for a cut-off write.** The no-resend
  rule guards against Pi doing the work twice. A frame shorter than its JSON
  object cannot be parsed, so a refusal with the draft back is true.
  Alternative: keep it uncertain. That is the state that left Jari stuck.
- **A longer deadline, not smaller pictures.** About 6 minutes for the largest
  batch lets it arrive on a slow host, at the cost of the conversation showing
  "on its way" that long and a Stop waiting behind the write. Alternatives:
  - Downscale pictures in the daemon. That needs an image pipeline Pi already
    has.
  - Send large batches by path only and let the agent read them. That changes
    what the model sees.
  - Lower the 100 MB limit.

  The real cost sits in Pi's quadratic reader. It is worth an upstream fix,
  which would make the budget generous rather than necessary.
- **A stopped agent proves non-delivery.** The previous decision
  (`resend-proven-undelivered`) excluded it for presentation reasons only (two
  bubbles). The resend now goes held, so there is one bubble, and a daemon
  restart stops every child with it (`KillMode=mixed`).
- **Held unknown messages go back to the field.** This reverses "held
  messages keep their own uncertain state". Jari asked for the dashed
  uncertain bubble to be gone. Held messages still never resend by themselves
  and never block the composer.
- **Sending the unknown text again ends its record.** This is the person's
  explicit choice under a warning that said the outcome was unknown. If the
  original did arrive, the agent gets it twice, by their decision.
- **The undelivered notice names large attachments as the usual cause**
  without claiming it, because the same outcome follows when Pi ends during
  the write.
