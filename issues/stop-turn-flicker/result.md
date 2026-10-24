# Result

Stopping a running turn is now one step in the composer. After Pysäytä, the
Stop button turns into a spinner (screen readers hear "Keskeytetään…"). Any
queued messages go back into the field and leave the queue card in the same
frame, the turn ends, and Stop turns back into Send. On a successful stop no
banner appears, the state-check button stays hidden and the composer height
changes at most once. That one change is the queue card leaving as its text
enters the field. If the stop fails or its outcome is unknown, one message in
the composer says so. A refused stop can be pressed again. Either message
disappears when the turn ends.

## Where the time and the flicker came from

I timed each phase with a frame-by-frame DOM recorder on the host-backed
browser harness: the real gateway/daemon controller and the synthetic Pi. I
also measured the pinned real Pi's abort separately.

- **Pi and daemon are fast.** With a synthetic provider, the pinned Pi kills
  a running `sleep 60` tool (or a streaming reply) and acknowledges `abort`
  after `agent_settled {aborted: true}` in 10–13 ms. The daemon replies to
  the browser at once with `pending` and waits for Pi in the background. The
  stop path has no slow step on the host. Stop-to-idle is network-bound: one
  abort round trip plus one status read, and one more round trip first when
  queued text is restored. Pi's TUI clears the queue before aborting too.
- **The synthetic Pi did not implement `abort`.** In every browser test a
  stop waited 30 s for the daemon's RPC timeout and then became `uncertain`:
  the "Agentin työ keskeytyi…" banner and the *Tarkista keskustelun tila*
  button. The old lab spec asserted that outcome. The fixture now aborts the
  way the pinned Pi does: it signals the run, a running tool returns "Command
  aborted", and `agent_settled {aborted: true}` comes before the
  acknowledgement. A prompt containing "ei pysähdy" refuses the abort, to
  exercise the failure path.
- **The browser drew every step.** One stop showed in sequence the queue
  receipt "Jonosta poistetut viestit palautettiin…", "Keskeytystä
  pyydetään", then a warning "Keskeytyspyyntö vastaanotettiin… työkalujen
  päättymistä ei ole vahvistettu". That last one stayed after the turn had
  ended. Each round trip was one more state on screen. Between the queue
  clear and the next status read, the restored text was shown both in the
  field and in the still-visible queue card: the composer went 176 → 207 →
  139 px. A refused abort (409, e.g. a turn that ended just before the press)
  showed "Keskeytystä ei hyväksytty. Tarkista keskustelun tila." even when
  nothing was wrong.

I could not reproduce Jari's exact path to the state-check button on the
synthetic host. Both plausible causes are covered. A refused abort now gets
one composer message, and only while the turn still runs. An abort Pi does
not acknowledge within 30 s remains the genuinely unknown case: the daemon
reports `uncertain`, and the existing recovery is shown.

## Measured stop-to-idle

Measured from the Stop click until Send is back, synthetic host on Alder,
three runs each. The "250 ms" rows delay every browser API request by
250 ms; the event stream is not delayed.

| Case | Before | After |
| --- | --- | --- |
| Turn only, local | 78–114 ms, 2 receipt states, warning stays | 111–112 ms, no receipt |
| Queue + draft, local | 92–104 ms, 2 receipt states, warning stays | 88–104 ms, no receipt |
| Turn only, 250 ms | 841–2354 ms, 3 receipt states | 821–840 ms, no receipt |
| Queue + draft, 250 ms | 1333–1352 ms, 3–5 receipt states, heights 176/207/139 | 836–1351 ms, no receipt, heights 176/139 |

The time is the same within noise, because it is round trips. The fix is
that those round trips no longer each show a state.

## Changes

- `web/src/app/ConversationActions.tsx`: `stopNow` owns the whole stop. It
  restores the queue quietly with no receipt and no extra status read in
  front of the abort, then aborts. It keeps one local `StopAttempt`
  (`pending`, `rejected` or `uncertain`) instead of receipts. After a refused
  or failed abort it reads status before saying anything, so a turn that
  ended on its own gets no message. Restored queue texts are marked by their
  queue revision.
- `web/src/app/BrowserConversation.tsx`: the attempt is shown only while its
  turn runs and is cleared when the turn ends. When the daemon reports the
  abort itself as `rejected`, that is shown too. A status read older than the
  restore no longer shows the restored texts in the queue card.
- `web/src/components/composer/Composer.tsx`/`composer.css`: an agent stop
  in progress shows as a spinner on Stop, so there is no notice row that
  appears and disappears. The new `rejected` stop state has one notice and
  keeps Stop and Esc usable. A command (`!`) stop keeps its existing row.
  Stories `PiStopping` and `PiStopRefused`.
- `test/browser-host/fakepi.go`: `abort` as the pinned Pi does it (above).
- Tests: the lab slow-turn spec stops mid-tool with a queued message and an
  unsent draft. Every frame it samples for banners, the state-check button,
  uncertain notices, queue and field showing the same text, and composer
  height. New browser case: a refused stop (real daemon `ack: rejected`) and
  an unknown one (lost reply) each say so once, Stop works again, and both
  clear when the turn ends. Composer unit case for retrying a refused stop by
  Stop and Esc. New native Go test
  `TestPiRPCNativeAbortDuringToolSettlesFirst` pins the real-Pi ordering the
  daemon relies on. Both new browser cases fail on the old UI code: the lab
  case records a receipt banner in the frames after the click, and the
  failure case never reaches a `rejected` state.

## Validation

The first worker exited mid-run; a second worker adopted its changes onto
current main, made the synthetic Pi read its run channels under its lock
(the read was outside it), dropped a one-off screenshot spec that wrote
into this directory on every suite run, and re-ran the checks:

- `go test -count=1 ./internal/daemon -run TestPiRPCNativeAbort` (umask 077,
  disk-backed TMPDIR, Pi SDK fixture installed): the pinned Pi acknowledged
  the abort of `sleep 60` 10 ms after the press, after `agent_settled`.
  `go test -race ./test/browser-host` — ok.
- `./scripts/test-focused.sh --area web` — 104 files / 639 tests passed.
- Lab slow-turn stop case: 5/5 green, stop-to-idle 123–141 ms locally. The
  same spec against the old UI code (this fixture) fails on a receipt
  banner present in every frame after the click.
- `browser-conversation.spec.ts` stop cases green (refused and unknown stop).
- Full gate `./scripts/ci-local.sh --clean --json`, twice. The first run
  caught `lab-composer-area`'s Esc case still waiting for the old stop
  notice; it now asserts the turn ends with no message. Otherwise each run
  had one different failure in an untouched spec, each green when rerun
  alone and filed as an intake item: a start-here focus race
  (`relatively-foamy-back`) and lab-slow-creation reading a response body
  after navigation (`acceptably-brown-soda`). Second run: ordinary suite 353 passed, lab 130/131, Go,
  contracts, Storybook and packaging green; no receipt written.

Not verified: a live stop against a real model on the test server (the
KOKEILTAVAA line asks Jari to try it), and real network latency; the
latency rows inject it.

## Decisions for later review

- **No stop confirmation.** The issue asks to keep "the existing explicit
  stop confirmation", but since Jari's 13.10. decision Stop is immediate and
  asks nothing; the code had no confirmation and the old spec asserted its
  absence. Kept immediate; the lab spec title no longer says otherwise.
- **Progress on the Stop button, not a "Keskeytetään…" row.** The row moved
  the whole composer twice for a stop that takes a fraction of a second.
  Alternative: keep the row (visible text, but two layout jumps).
- **Failure messages live in the composer, once.** Refused: "Pysäytystä ei
  hyväksytty. Agentti jatkaa työtä." with Stop enabled (a refused abort is
  definite, so retrying is safe). Unknown: the existing "Työn päättymistä ei
  tiedetä. Tarkista tila." with Stop disabled. No banner is added for
  either.
- **No daemon or contract change.** The daemon could hold its abort reply
  until Pi's ~10 ms acknowledgement, so the browser's next status read
  already shows the turn ended. That would save about one event-stream
  latency. Combining queue clear and abort into one request would save a
  round trip when text is queued, but it is a contract change. Neither was
  needed to remove the flicker.
- **Manual "restore queue" keeps its receipt.** Only Stop restores quietly.
  The restored text still goes after the draft (Pi's TUI puts it before).
