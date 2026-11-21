# Result: taking back a participant's full rights

## Saatesanat

Kolme tapaa ottaa Villen täydet oikeudet pois, kaikki samassa tilanteessa.
Villen pyytämä linkkitarkistus on kesken, ja hänen aiemman vuoronsa
esikatselupalvelin on yhä käynnissä. Ajo, prosessit ja lukuoikeus käyttäytyvät
kaikissa suunnissa ADR 0038:n mukaan. Suunnat eroavat siinä, missä kohdassa
päätökset tehdään.

Suosittelen suuntaa **1 Heti**. Kun omistaja haluaa oikeudet takaisin,
yhdenkään valinnan ei pidä viivästyttää sitä. Vasta oikeuksien poistamisen
jälkeen kortti näyttää, mitä on yhä käynnissä, ja siinä on pysäytykset.
Arkin (2) valinnat ovat hyviä, mutta ne seisovat juuri siinä kohdassa, jossa
viive maksaa eniten. Määräaika (3) sopii lisäksi myöhemmin, mutta ei korvaa
välitöntä poistoa.

Rakennettu sivu: `/var/tmp/agent-keep/multiplayer-take-back-prototype/offline.html`
(kuvat samassa hakemistossa, `shots/`).

## Axis and directions

Axis: *when the owner decides what happens to the work in progress*, after,
before or in advance.

- **1 Heti / At once** (recommended): one tap on the full-rights chip or in
  the people panel takes the rights back immediately. A card that only the
  owner sees then sits in the conversation. It shows the run in progress
  (continues as text only, with **Pysäytä ajo**), the processes started by
  the participant's turns (each with **Pysäytä**), and a folded list of the
  actions the agent took for the participant's messages. Removing the
  participant works the same way, and the card says they no longer see the
  conversation.
- **2 Arkki / Sheet**: **Ota pois…** opens a sheet listing what was lent and
  since when, the actions taken, the run in progress (*let it finish as
  text only*, the default, or *stop it now*), the participant's processes
  (checked by default), a note that the owner's own processes are not
  touched, and *also remove from the conversation*. No card afterwards, only
  Habitat lines.
- **3 Määräaika / Time limit**: full rights are given for a time (next
  message, 1 hour, until the end of today, until I take them back). The chip,
  the panel and the participant's strip show the time left. **Jatka
  tunnilla** extends. Expiry produces the same card as direction 1, and
  **Ota pois** also works at once.

## What every direction shows (ADR 0038 sections 4 and 7)

- The participant's run in progress turns text-only from the next tool call
  on. The call already running (`node scripts/check-links.mjs`) finishes, the
  next `edit` shows as blocked, the agent ends in text, and the request
  becomes an ordinary waiting request (Salli kaikki / Älä salli).
- Processes started by earlier turns keep running until stopped. Only those
  started by the participant's turns are offered for stopping.
- A participant who keeps the share sees the whole conversation, including
  what the agent did for them, and their strip says that Aino took full
  rights back and when. Their next message gets a text-only answer.
- A removed participant sees nothing. Their open view closes with "Aino
  poisti sinut keskustelusta. Et näe sitä enää…", and the share disappears
  from *Jaettu kanssasi*.
- Archiving asks first and names who loses the conversation. Afterwards the
  participant sees "Aino arkistoi keskustelun. Arkistoitu keskustelu avautuu
  vain Ainolle." The owner's view says that only they see it.

## Host facts the view assumes

- The daemon reports per run who started it and its current mode,
  including the switch to text-only mid-run (ADR 0038 section 8 already lists
  the run mode).
- **Processes are listed by the participant whose run started them.** The
  process registry already records `run_ids` per process
  (`internal/daemon/processes_linux.go`), and native history says which
  message started each run (an `oh-participant-message` with its subject,
  ADR 0038 section 3). Joining the two gives the attribution without a new
  store. It is still to be confirmed that a run ID can be tied to its
  starting entry reliably, including for wakes that keep a participant's
  mode.
- The list of actions taken for a participant is derived from native history
  (tool calls in runs started by that participant's messages). No new store
  is needed.
- Direction 3 only: the membership record holds a grant expiry, and the
  daemon enforces it with the same revocation path as a manual take-back
  (bridge notice to the companion, then a Habitat line). The browser never
  decides expiry.

## Decisions for later review

- **The run continues as text-only by default, rather than stopping.**
  Alternatives: stop it on take-back; ask. This follows ADR 0038 section 4
  and loses no work. Stopping is one button away on the card (1) or one radio
  away (2).
- **Processes are not stopped automatically** in 1 and 3. Alternative:
  stop them with the take-back. Processes such as a preview server are often
  harmless, and stopping them silently could break the owner's own work. In
  2 they are checked by default because the owner sees them before
  confirming.
- **Only the participant's processes are listed.** The owner's own
  processes are mentioned in 2 and absent in 1 and 3. Listing everything
  would turn the card into a process manager.
- **The summary card is owner-only.** The participant sees the Habitat line
  and their own strip, not the process list, because processes belong to
  the owner's workspace and ADR 0038 section 6 gives participants no
  workspace view.
- **Removal implies take-back** and uses the same card, with "ei enää näe".
- **The participant's waiting request survives their removal** and stays
  with the owner, who may still release it. Alternative: drop it. It is the
  owner's agent and the owner's call.
- **Restoring an archived conversation does not bring participants back**,
  because ADR 0038 section 7 ends every membership on archive. The dialog
  says so.
- **Duration choices in 3**: next message, 1 hour, end of today, until I
  take them back, defaulting to 1 hour.

## Questions for Jari

1. Direction: **1 Heti** as recommended, or the sheet, or a time limit
   (possibly as an addition to 1 later)?
2. On take-back, should the participant's run **continue as text only**
   (ADR default, shown here) or **stop**?
3. Should take-back also **stop the participant's processes automatically**,
   or only offer it (shown here)?
4. Is listing processes **by the participant whose run started them**
   (process `run_ids` joined with the run's starting message, see above)
   worth building, or should the card list all of the conversation's
   running processes?
5. Should the participant see **anything about processes** their turns
   started, or stay at "Aino otti täydet oikeudet pois" (shown here)?

## Evidence

`/var/tmp/agent-keep/multiplayer-take-back-prototype/`: `offline.html` (the
built page), `index.html` (without embedded fonts) and `shots/` (the
check's 100 screenshots, all directions, 1440 and 390 px, Päivä, Yö,
Kontrasti, English).

Check: `check.mjs` passed 967 checks with a clean console.

# Implementation: the take-back card (1 Kortti) in the browser

Jari accepted round 2's **1 Kortti** on 21.11.2026. It replaces the plain
process list on `multiplayer-browser`'s take-back card and stays behind the
experimental `multiplayer` switch.

## What exists now

- **Attribution** (`web/src/app/takeBack.ts`): the process registry's
  `run_ids` turned out to be Taskfleet run IDs, not agent runs, so the join
  that rounds 1 and 2 assumed does not exist. The owner's browser instead
  reads its loaded history. It finds the `process` start call whose result
  names the process, then the message that opened that turn: the owner's own
  message or a participant's (`participant_message`). If the start call is not
  loaded, it falls back to the turn that was open at the process's start time.
  A process that started before the loaded history begins is *unknown*. It is
  offered in its own group and never counted as the owner's.
- **The card** (`MultiplayerOwner.tsx TakeBackCard`), for each person whose
  rights were taken back or who was removed. It lists the processes their
  turns started. Each row shows the command, "Hänen viestistään klo 14.20"
  with the message quoted and **Näytä viesti** (scrolls to the message and
  highlights it), the start time and how long ago it was, and whether the
  process still prints ("Tulostaa · viimeksi 2 s sitten", or "Ei uutta
  tulostetta 6 min"). **Näytä tuloste** opens the existing process window.
  The card has **Pysäytä** per row, **Pysäytä kaikki N** when more than one
  runs, and **Jätä käyntiin**, which folds the card into "Jätit käyntiin: …"
  with **Näytä**. A stopped or self-ended row stays struck through until
  nothing runs; then the card resolves. Other running processes are counted
  in one line. **Pysäytä ajo** stays as before, only for the run of this
  tab's take-back.
- **Lifetime**: the card comes from this tab's action, or from history's
  `full_rights_taken`/`removed` line while something of that person's still
  runs. So it comes back after a reload and on another device until the
  processes end. Giving full rights again ends it.
- **Band reminder**: "Bob Example: 2 prosessia käynnissä" in the people row
  as long as the person's processes run, also after Jätä käyntiin. Pressing
  it reopens the card and scrolls to it.
- **Stop lines for everybody**: the stop sends `for_participant` with the
  process control request (`process-control.schema.json`). After a `killed`
  result the owner's daemon queues a `process_stopped` Habitat line. It takes
  the command from its own inventory (the redacted preview) and the name from
  the membership record, and writes the line only for someone the record
  still names as joined. The browser asserts only *who* started the
  process. The line goes through the existing pending-lines path and the
  companion's `conversation_line` op (`validMemberLine`, which now quotes the
  command as data). The owner reads "Pysäytit prosessin ”npm run preview”,
  jonka agentti käynnisti pyynnöstä. Pyytäjä: Bob Example.", the participant
  reads "Alice Example pysäytti prosessin ”…”, jonka agentti käynnisti
  pyynnöstäsi.", and other participants read the owner's name and "Pyytäjä:".
- **`last_output_at`** per process (`process.schema.json`): the companion
  notes the time of each `processes:output_changed` event per process ID and
  reports it in `list`. The daemon passes it on, dropping a value before the
  start. It is null when this Pi has seen no output.
- **Browser host**: the fake Pi's bridge answers `list`, `stop` and
  `output` from a small registry. A full-rights participant's "esikatselu"
  makes the agent start a preview that keeps printing and a quiet test
  watcher with the `process` tool. Process-stopped lines are written like
  membership lines.

## Decisions for later review

1. **Attribution is read from the browser's loaded history, not from a new
   daemon fact.** Alternative: the daemon attributes processes from its
   hidden `oh-turn-mode` marks, which say precisely whose run was going. The
   history join needs no contract or daemon state and covers the usual case
   (a recent take-back). Its limit is honest: what lies beyond the loaded
   pages is *unknown* and still offered.
2. **A process whose origin is unknown is offered, in its own group**, on
   the newest take-back's card. Alternative: treat it as the owner's and
   hide it. A participant's process wrongly hidden is worse than one extra
   row the owner can leave running.
3. **Answers to round 2's questions:** ignored offer = the card stays, with
   the band reminder (Q2, as recommended). The participant sees the stop
   lines (Q3). `last_output_at` is worth a small companion fact (Q4), and
   the last output line is not fetched; **Näytä tuloste** opens the process
   window instead, which avoids an output request per row per poll. Jätä
   käyntiin stays silent (Q5).
4. **Jätä käyntiin is remembered per tab (session storage) and person,
   by time**, so a later take-back opens the card again. Alternative: a
   Habitat line, which round 2 argued against (Q5). Another tab or device
   shows the card open, which is a reminder, not a loss.
5. **No line when a process ends by itself.** Round 2 suggested one. The
   row says "Päättyi itsestään", and Pi's own process notification already
   tells the conversation when the agent asked to be told.
6. **No stop line for a removed person.** The record no longer names them,
   so the daemon has no name it trusts, and they cannot read the
   conversation anyway. The owner still sees the row struck through.
7. **The stop line uses the nominative** ("Pyytäjä: Bob Example") and
   typographic quotes rather than code formatting, as the catalog's other
   lines do. The browser cannot inflect names.
8. **"Still printing" means output within the last 30 seconds.**
9. **The card comes back from history only while something runs** (a
   known process of that person's or one of unknown origin). A resolved
   card from an earlier session would otherwise sit at the end of the
   conversation until Pi clears finished processes.
10. **Known limit: a user message an extension sends during a participant's
    turn reads as the owner's.** The companion keeps the participant's
    turn for such a message (its hidden `oh-turn-mode` marks), but the
    browser's history does not carry that distinction. A process started
    after one would be counted among "other processes" rather than offered.
    The owner still sees and stops it in the process tray. Closing it means
    projecting the daemon's turn attribution into history, the same daemon
    fact as decision 1's alternative.
11. **Only the start call attributes a process.** A later `write` or
    `rename` of the same process from another turn does not move it. A
    continue line attributes the run it starts to the person it names (with
    their message quoted when it is loaded).
12. **An inventory that could not be read keeps the last one read.** Before
    the first read the card says the processes could not be read, rather
    than that nothing runs. A Pi that is not running has no processes.

## Review

Critical rigor, because this concerns the owner's control over processes
started for another person, a new daemon write path and the contract.
Independent `/llm-review` used gpt-6-astra as finder and claude-fable-5-2 as
verifier (two calls), followed by `/assess-findings`. All seven candidates
survived. Six were fixed: start-only attribution, continue lines, offers
with only unknown-origin processes after a reload, an unreadable inventory
read as "nothing runs", stop buttons that dropped clicks while a stop was
pending, and a stale take-back after rights were given again. One was
dropped as rare and recorded as a known limit (decision 10).

## Checks

- `./scripts/test-focused.sh --area web`: 1962 passed. That includes the
  new `takeBack.test.ts`, with nine cases on attribution and offers.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`:
  passed, including `TestProcessStopForParticipantWritesTheLine` (rejects a
  malformed subject and a subject on clear; writes no line for someone the
  record does not name; the line carries the redacted preview and the
  record's name) and `last_output_at`. `go vet ./test/browser-host` is
  clean.
- Companion: `node --test internal/daemon/pi-device-test/membership-line.test.mjs`
  passed, 4 tests.
- `./scripts/test-focused.sh --area contracts`: valid, generation clean.
- Browser with `OH_BROWSER_WORKERS=2`: `multiplayer.spec.ts` passed. It
  covers the take-back card end to end through the real daemon and the fake
  bridge: two rows with the quoted message, printing state, one stop, the
  line in both views, leave running, the reminder, and the resolved card.
  `multiplayer.spec.ts` with `process-tray.spec.ts` passed with
  `--repeat-each 3` (24 cases) before the review fixes and with
  `--repeat-each 2` (16 cases) after them, and `multiplayer.spec.ts` passed
  once more after the final edit.
- Not run: a live host or the real Pi companion with the browser. No
  screenshots were captured.
