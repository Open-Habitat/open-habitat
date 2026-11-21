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
