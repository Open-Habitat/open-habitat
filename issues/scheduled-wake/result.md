# Result: scheduled wake (implementation)

## Saatesanat

Ajastettu herätys on nyt kokeiltavissa omana kokeellisena ominaisuutenaan
(Asetukset › Kokeelliset ominaisuudet › Ajastettu herätys, oletuksena pois).
Agentti asettaa herätyksen komennolla `open-habitat agent wake create
--current --at … --note …`, tavallisesti kun pyydät muistuttamaan.
Keskustelu siirtyy Hiljaisiin, ja rivin lopussa on kello ja herätysaika
iän paikalla. Keskustelun alareunassa, kirjoituskentän yläpuolella, on
herätyksen palkki: aika, agentin muistiinpano, Muuta aikaa… ja Peru
herätys. Sovittuna aikana Habitat käynnistää pysähtyneen Pi:n ja antaa
agentille vuoron, jossa on muistiinpano. Agentin vastaus nousee Sinun
vuorosi -osioon, ja lukematon rivi näyttää, milloin se herätettiin.
Keskustelussa on Open Habitatin rivi herätyksestä. Jos herätys myöhästyi,
koska palvelin tai Habitat ei ollut käynnissä, rivi sanoo senkin, ja
agentti kuulee sen omassa viestissään.

Arkistointi kysyy ensin samassa ikkunassa kuin avustajien arkistointi.
Ikkuna nimeää jokaisen herätyksen ajan ja muistiinpanon, ja kohdistus on
Arkistoi-painikkeessa, joten Enter arkistoi. Avustajien ikkuna toimii nyt
samoin. Ilmoituksen Palauta tuo keskustelun takaisin herätyksineen ja
Hiljaisiin. Myöhempi palautus arkistosta ei tuo herätystä, ja agentti
kuulee perumisesta seuraavan viestisi mukana.

## What landed

- **Daemon** (`internal/daemon/scheduled_wake_linux.go`): the person's
  wakes in `~/.local/state/open-habitat/wakes.json` (0600, atomic). Agent
  routes `/agent/v1/wakes` (create, list, PATCH, DELETE with the live
  `--current` context; `due` without one). Creating needs the feature on,
  a future RFC 3339 time with an offset, a 1–1000 byte note, and fewer
  than 100 pending wakes per person (`wake_limit_reached`). An optional
  idempotency key makes a repeat return the stored wake. Creating also
  places the conversation in Hiljaiset while the turn runs. The browser
  route `POST /api/v1/conversations/<id>/wake` moves or cancels a wake.
- **Timers**: an in-process timer on the next wake. The person's own user
  timer `~/.config/systemd/user/open-habitat-wake.timer` (`OnCalendar=`
  the next wake, `OnStartupSec=30s`, `Persistent=true`) runs
  `open-habitat agent wake due`, which only asks the person's own daemon
  to fire what is due. The timer is rewritten after every change and
  removed with the last pending wake. Every daemon start fires what is
  overdue.
- **Firing**: starts a stopped Pi as Habitat's own wake does and sends the
  companion op `scheduled_wake` (process-extension.mjs), which becomes an
  `oh-scheduled-wake` custom message turn. It goes only into an idle Pi;
  during a running turn or an open question it waits and is tried again a
  minute later, without spending a retry. The companion sends each wake id
  once. More than 2 minutes after the set time is late, and the
  message says how late. A failed delivery is retried each minute for an
  hour, then marked `failed`.
- **Archive**: cancels pending wakes with the archive's stamp. The undo
  (`restore_wakes`) restores exactly those and re-places the conversation
  in Hiljaiset. A later restore marks them to be told: just before the
  person's next prompt, the companion op `wake_tell` queues an
  `oh-scheduled-wake-cancel` message (deliverAs `nextTurn`).
- **Contract**: `agent-wake.schema.json`; snapshot agent `wakes` and
  `last_wake`; history and event `scheduled_wake`.
- **CLI**: `agent wake create|list|update|delete|due` with help, agent
  skill and host-context text.
- **Browser**: railNow `wakeAt`/`wokeAt`, the row's end slot, `WakeDock`
  with `PendingWakeBar`, `WakeLineMarker` in history, wake rows in the
  archive window, the notice's undo restoring wakes, and the Settings card.
  The rail now moves focus to the next row only once the row really leaves,
  so a cancelled archive window returns focus to the row's archive button
  (round 2's implementation note).

## Checks

- Go: `./scripts/test-focused.sh --area go` for `internal/daemon`,
  `internal/cli`, `internal/gateway`, `internal/experimental`,
  `test/browser-host`. New: `TestAgentWakeCommandsAndTheCap`,
  `TestWakeTimerUnitFollowsTheNextWake`,
  `TestOverdueWakeFiresOnceAfterARestartAndSaysLate` (persisted state
  survives the daemon's restart and the wake fires late, once),
  `TestDueWakeFiresIntoTheLivePi`,
  `TestArchiveCancelsWakesUndoRestoresLaterRestoreTells`,
  `TestWakeLineProjectsDetailsNotText`,
  `TestDueWakesAreReadAgainBeforeEachDelivery`,
  `TestSavedWakesAlwaysReadBack`, CLI
  `TestWakeArgumentsRefuseBeforeSocket` and
  `TestWakeRefusalsExplainThemselves`. The wake tests pass 3× and once
  under `-race`.
- Contracts: `scripts/validate-contracts.py`, `go generate
  ./internal/contracts`, `scripts/check-generated.sh`.
- Web: `./scripts/test-web-fast.sh` (railNow, component, flow and catalog
  tests).
- Browser: `tests/scheduled-wake.spec.ts` (new), `helper-archive`,
  `archive-quick-succession`, `rail-now` and `settings-experimental`,
  `--repeat-each 3` with 2 workers: 36/36.

- Review: the change touches daemon state, the agent socket's authority
  boundary and the contract, so it got an independent `/llm-review` (one
  finder, gpt-6-astra) and `/assess-findings`. All 8 candidates were real
  and are fixed with tests. A cancelled or moved wake could fire from a
  stale due list. A successful save could exceed the reader's bound. A
  stale timer reconcile could overwrite a newer one. A retry could send a
  wake twice; the companion now deduplicates by wake id. A busy Pi's wake
  was queued only in memory but recorded as fired; it now waits for the
  turn to end. Tell batches could exceed the bridge frame. Archive and
  restore ignored wake-write failures. A refused user-manager call was
  never retried. Companion test: `pi-device-test/scheduled-wake.test.mjs`.

Not verified: a real systemd user manager firing the timer across a reboot.
The timer unit text and the user-manager calls are tested with a fake
manager. The restart and late path is tested with persisted state across
two daemon incarnations.

## Decisions for later review

- **The bar, not a line under the reply.** Jari approved direction 1 with
  "the bar". The pending wake sits above the composer, so it does not have
  to be found in the history. Alternative: round 1's line under the reply
  that set the wake.
- **Only the agent sets a wake, and the bar says "agentti asetti".** The
  daemon cannot tell a reminder the person asked for from the agent's own
  follow-up, so it does not guess *pyysit*.
- **Moves and cancels get Habitat's line only when the agent is told.** A
  move is in the wake's line, a cancel in the line before the person's next
  message. There is no separate line at the moment of the change, because
  that would need Pi running to write into the branch. Alternative: an
  `appendEntry` when Pi happens to run.
- **A wake fires even after the feature is turned off.** Turning it off
  stops new wakes and hides the row time and the bar, but a promise already
  made is kept. Alternative: suspend firing while off.
- **The woken-row time shows only for an unread reply within 6 hours of the
  wake.** The snapshot does not say which reply a wake started, and a reply
  hours later answers something the person wrote meanwhile. Alternative: the
  daemon records the reply ID after the wake's turn.
- **No upper date limit and no per-conversation limit** (Jari 21.11.).
  Years up to 9999 are accepted.
- **The note is required.** It is what the agent is told at the wake.
- **Failed delivery is retried each minute for an hour, then `failed`.** A
  failed wake shows in `wake list`, not yet as a line in the conversation.
  Round 1 proposed an error line that raises the conversation, which would
  need the native write described above.
- **The timer also fires 30 s after the user manager starts.** This covers
  a wake missed while the host was down, where `Persistent=true` alone is
  unreliable for a single past calendar time with no stamp file.
- **`agent wake due` replies at once and fires in the background.** The
  oneshot only needs to know the daemon took the work. Starting several Pi
  processes must not hold the socket's reply.
- **Archive focus**: the archive window starts on Arkistoi for helpers too,
  as Jari decided, and the rail's focus hand-off waits for the answer.

## Installation

No change is needed in the installation tooling. It installs no Open Habitat system units
on the staging installation. It manages only its own named user units in the account and does
not sweep `~/.config/systemd/user`. The wake timer depends on lingering
(the broker enables it) and the user bus, the same as Omat koneet.
