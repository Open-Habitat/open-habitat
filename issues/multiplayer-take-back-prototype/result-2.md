# Result, round 2: offering to stop the participant's processes

## Saatesanat

Jatkoin päättämääsi suuntaa 1 Heti. Sivu avautuu hetkeä sen jälkeen, kun
Aino on ottanut Villen täydet oikeudet pois. Villen kesken oleva pyyntö
jatkuu vain tekstinä, ja hänen aiemmista pyynnöistään on käynnissä kaksi
prosessia: esikatselu, joka tulostaa yhä, ja testien vahtitila, joka on
ollut hiljaa kuusi minuuttia. Kolme suuntaa eroavat siinä, missä
pysäytystarjous on ja mitä sille käy, jos Aino ei tee mitään.

Suosittelen suuntaa **1 Kortti**. Prosessi on pysäytettävissä vain, jos
omistaja tunnistaa sen, ja kortti näyttää kaiken ilman avaamista:
komennon, Villen viestin, josta se käynnistyi, milloin se käynnistyi ja
tulostaako se yhä. Kortti pysyy näkyvissä, kunnes prosessit päättyvät tai
Aino valitsee Jätä käyntiin, joten Ainon käyttäjänä pyörivä vieras
prosessi ei unohdu. Merkit (2) on siistein, mutta silloin päätös jää
paneeliin, jota ei ole pakko katsoa. Kysymys (3) on kevein, mutta tiedot
ovat piilossa juuri silloin, kun niitä tarvitaan.

Rakennettu sivu: `/var/tmp/agent-keep/multiplayer-take-back-prototype/round-2/offline.html`
(kuvat samassa hakemistossa, `shots/`).

## Axis and directions

Axis: *where the offer to stop lives, and what becomes of it when the owner
ignores it.*

- **1 Kortti / Card** (recommended): an owner-only card in the conversation,
  right under the take-back line. It lists each process the participant's
  turns started, with full identification and a **Pysäytä** button, plus
  **Pysäytä kaikki N** when more than one runs, and **Jätä käyntiin**.
  *Ignored:* the card stays where it is, and the people band shows
  "Villeltä 2 prosessia käynnissä", which jumps back to the card. *Jätä
  käyntiin* folds the card into a line ("Jätit käyntiin: …", with Näytä).
  The band reminder stays as long as the processes run.
- **2 Merkit / Badges**: the conversation gets only a line ("… they are
  above the composer, marked as Ville's"). The list lives in the process
  panel above the composer. It opens with the take-back, and Ville's
  processes form their own group under his avatar, with **Pysäytä Villen
  prosessit**. The owner's own processes appear below as a separate group.
  *Ignored:* the panel closes like any popover, and the process pill keeps
  Ville's avatar and count while his processes run. Nothing else reminds.
- **3 Kysymys / Question**: a compact owner-only question under the line
  ("Villen pyynnöistä on käynnissä 2 prosessia. Pysäytetäänkö ne?"), with
  the commands, **Pysäytä molemmat**, **Jätä käyntiin** and **Näytä
  tiedot**, which opens the same rows as in 1. *Ignored:* once the owner
  writes on, it folds into "Villen pyynnöistä jäi käyntiin `…` ja `…`" with
  **Pysäytä…**, which reopens it with the details open.

## What every direction shows

- **Which processes are listed:** only those the participant's turns
  started and that still run. The owner's own processes are never offered
  for stopping. 1 and 3 note them in one line ("Omat prosessisi (1) eivät
  ole tässä listassa"), and 2 shows them as a separate group.
- **How a process is identified:** command (monospace, verbatim). *From
  Ville's message at 14.20*, with the message quoted and **Näytä viesti**
  scrolling to it and highlighting it. *Started 14.20 · 11 min ago.* Output
  state: *printing · last 5 s ago* (filled dot) or *no new output for 6 min*
  (ring), and the last output line. In 2 the rows are denser: no quote and
  no last line.
- **Stop one / stop all:** each stop writes a Habitat line for everybody
  ("Pysäytit `npm run preview`, jonka agentti käynnisti Villen pyynnöstä").
  Stop all writes one line. A stopped row stays, struck through, until the
  offer resolves.
- **A process that ends by itself** shows as such ("päättyi itsestään
  (koodi 1)") and gets a line. When no participant process runs any more,
  the offer folds into "Villen pyynnöistä käynnistetyt prosessit ovat
  päättyneet."
- **The run** is not part of the process offer: **Pysäytä ajo** sits on
  the take-back line as long as the run continues as text only.
- **What the participant sees:** the take-back in his strip, his request's
  state (continues as text only, stopped, waiting for Aino), and the
  Habitat lines in his own words ("Aino pysäytti `npm run preview`, jonka
  agentti käynnisti pyynnöstäsi"). He never sees the offer, the list or any
  stop button. If the owner leaves the processes running, he sees nothing
  about them.

## Host facts the view assumes

- **Attribution:** as round 1 noted, the process registry's `run_ids`
  (`contracts/v1/process.schema.json`), joined with the run's starting
  message in native history, gives "started by Ville's message at 14.20".
  The join still needs confirming. The quote is that message's text.
- **"Still printing" needs a new fact.** The inventory has `started_at` and
  the output endpoint has `lines`, but neither says *when* a line was last
  written. The daemon appends the output, so it can report a
  `last_output_at` per process (a field in the process record, not a new
  store). Without it the row can only show the last line, not whether the
  process is alive in that sense.
- **Last output line:** the tail of the existing output endpoint.
- **Stopping** uses the existing process control (`process-control`), with
  the owner's authority. Only the owner's browser sees the offer or sends
  the stop. A participant has no process view (ADR 0038 section 6).
- **The offer's state** (open, left running) is per conversation and only
  matters to the owner. It can live in browser state. If it should survive
  a reload or another device, it must be derivable: "left running" could be
  marked by the Habitat line the owner's choice writes, rather than by a
  new store.

## Decisions for later review

- **Exited and stopped rows stay in the card until everything has ended.**
  Alternative: remove a row at once. Keeping it shows what the stop did.
  The card folds when nothing runs.
- **Jätä käyntiin is an explicit choice** in 1 and 3, and it writes nothing
  to the conversation. Alternative: a Habitat line "Aino jätti … käyntiin"
  that Ville would also see. I left it out because leaving things as they
  are is not news to the participant.
- **The participant sees stop lines** in his own wording. Alternative:
  nothing at all, as in round 1's question 5. He saw the agent start these
  processes in the conversation, so silence would leave him with a wrong
  picture of what still runs.
- **The band reminder (1) stays even after Jätä käyntiin**, as long as the
  processes run. Alternative: hide it after an explicit "leave running".
  It is one quiet chip, and the processes run as the owner.
- **The take-back line carries Pysäytä ajo** in every direction, so the
  run's stop is not part of the process axis.
- **The panel opens by itself in 2** at take-back. On the phone it then
  covers the take-back line until it is closed. Shown as is.

## Questions for Jari

1. Direction: **1 Kortti** as recommended, **2 Merkit**, or **3 Kysymys**?
2. When the owner **ignores** the offer, should it stay as a card with a
   band reminder (1), fold into a line when the owner writes on (3), or
   leave only the process pill (2)?
3. Should the participant **see the stop lines** ("Aino pysäytti …"), or
   nothing about processes?
4. Is **"still printing"** worth a new daemon fact (`last_output_at` per
   process), or is the last output line enough?
5. Should **Jätä käyntiin** be recorded in the conversation (visible to the
   participant too), or stay silent as shown?

## Evidence

`/var/tmp/agent-keep/multiplayer-take-back-prototype/round-2/`:
`offline.html` (the built page), `index.html` (without embedded fonts) and
`shots/` (52 screenshots from the check: all directions, 1440 and 390 px,
Päivä, Yö, Kontrasti, flows and English).

Check: `check.mjs` passed 943 checks with a clean console.
