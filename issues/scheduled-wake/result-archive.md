# Result: archiving a conversation with a pending wake (prototype round 2)

## Saatesanat

Päätit 21.11., että herätystä odottavan keskustelun arkistointi perii
herätyksen vahvistuksen jälkeen. Tein kierroksen siitä vahvistuksesta.
Arkistoida voi kahdesta paikasta, kuten nyt: sivupalkin rivin
painikkeesta ja keskustelun yläpalkista (puhelimessa yläpalkin
valikosta). Mukana on keskustelu, jossa on yksi herätys, agentin oma
seuranta ja keskustelu, jossa on kaksi herätystä. Neljäs keskustelu on
hiljainen ilman herätystä, ja se arkistoituu kaikissa suunnissa
kysymättä, kuten nyt.

Suosittelen suuntaa **2 Ikkuna**. Se on se vahvistusikkuna, jonka päätit,
ja se näyttää ainoana sen, mikä katoaa: herätyksen ajan, kuka sen asetti
ja agentin muistiinpanon. Ikkuna on sama kuin se, jonka tuotanto jo
näyttää, kun arkistoitavalla keskustelulla on avustajia, joten
arkistoinnissa on yksi tapa kysyä. Enter arkistoi ja Esc jättää ennalleen.

Arkistoinnin jälkeen tuotannon ilmoitus kertoo, että herätys peruttiin.
Sen Palauta tuo takaisin sekä keskustelun että herätyksen. Jos keskustelu
palautetaan arkistosta myöhemmin, herätys ei palaa. Keskusteluun jää
Open Habitatin rivi, ja agentti kuulee perumisesta henkilön seuraavan
viestin mukana. Sitä varten ei herätetä agenttia omalle vuorolleen.

Sivu: `node design-system/prototypes/rounds/2026-11-21-wake-archive/build.mjs`
→ `design-system/prototypes/dist/wake-archive/offline.html` (and
`index.html` without embedded fonts). The page built for this review is
kept at `/var/tmp/agent-keep/scheduled-wake/archive-round/offline.html` on
the build host, with the check's screenshots in `screens/`; none of it is
committed. Check: 640 checks, clean console, at 1440 and 390 px in Päivä,
Yö and Kontrasti, plus English on desktop and phone.

## Axis and directions

Axis: how the person is asked before an archive cancels a pending wake,
and so how much of the wake they see before it is gone. Everything else is
the same in all directions: the production archive buttons, the production
notice with its undo, the archived conversation's foot, Habitat's line in
the history, and today's behaviour for a conversation without a wake.

- **1 Rivillä.** The archive button opens a small confirmation in its
  place: inside the rail row, below its line, or under the header for the
  header's button. One line names the wake (`Herätys to 9.00 perutaan.`,
  or `2 herätystä perutaan, seuraava 1.12. 10.00.`), then Arkistoi and
  Älä arkistoi. No window; the rest of the page stays usable.
- **2 Ikkuna.** A modal window built like production's helper-archive
  confirmation: the conversation's title, every pending wake with its full
  time, who set it (*pyysit* / *agentin oma seuranta*) and the agent's
  note, and one sentence on the consequence ("Agentti ei herää
  arkistoituun keskusteluun. Jos palautat keskustelun myöhemmin,
  herätykset eivät palaa; pyydä agenttia asettamaan uusi."). Buttons Älä
  arkistoi and Arkistoi ja peru herätys(et).
- **3 Heti.** No question: the archive happens at once, as it does today,
  and the notice says what went with it (`Arkistoitu Varakopion poisto ·
  herätys to 9.00 peruttu`). Its Palauta brings back the conversation and
  the wake. This is the alternative to the confirmation Jari decided on,
  shown so the trade-off is visible.

Covered in every direction: archiving from the rail row and from the
header (phone: the header menu), several pending wakes in one
conversation, a conversation without a wake (no question), Esc keeps and
returns focus to the archive button that was pressed, Enter archives, the
notice's undo, a later restore from the archived foot with what the agent
is told, phone 390 px, light, dark and contrast, Finnish and English.

## Recommendation

**2 Ikkuna.**

- It is the confirmation Jari decided on, and it is the only direction
  that shows what the archive throws away. A wake is a promise made in a
  conversation days or weeks ago; "to 9.00" on its own does not say which
  reminder it was. The window shows the note ("Muistuta poistamaan
  backup-2024") and who set it, and with two wakes it lists both.
- Production already asks with this window when a conversation with
  helpers is archived. Using the same window keeps one way of asking
  before an archive, and the two can become one window when a conversation
  has both helpers and wakes.
- 1 Rivillä is lighter and keeps the person in the rail, but its one line
  has room only for a short time. On the rail, at 280 px, the note does
  not fit. It is the fallback if the window feels heavy for one wake.
- 3 Heti is the least friction and is fully undoable while the notice is
  up, but the notice goes in 8 seconds, and a missed notice means a
  reminder that silently never comes. That is the failure the confirmation
  exists to prevent.

## What the agent is told

Habitat, not the agent, writes the line in the history: "Herätys to
19.11. klo 9.00 peruttiin, kun arkistoit keskustelun." While the
conversation is archived nothing more happens; the agent is not woken to
be told. If the conversation is restored later, the line adds "Agentti
kuulee sen seuraavan viestisi mukana:" and the exact text Habitat puts
before the person's next message:

> [Open Habitat] Ajastettu herätys to 19.11. klo 9.00 peruttiin ti 17.11.
> klo 15.20, kun henkilö arkistoi keskustelun. Keskustelu on palautettu.

This follows round 1's rule that a cancel is told with the next message.
The agent then knows its earlier promise no longer holds and can offer to
set a new wake.

## Decisions for later review

- **The notice's undo restores the wakes too; a later restore does
  not.** Alternative: neither restores them, or both do. Why: an undo that
  half-undoes surprises; but after the notice has gone the wake time may
  already have passed, and the agent can set a new wake when the person
  writes.
- **Archive has focus in the confirmation (Enter archives, Esc keeps).**
  Alternative: focus on Älä arkistoi, as in production's helper window.
  Why: the person already pressed Archive; the window informs about a
  consequence that the agent can redo, and Esc or a press outside always
  keeps. If the helper and wake windows merge, they should agree; see
  question 2.
- **A conversation without a pending wake is archived without a question
  in every direction.** Why: Jari's decision is about the wake; adding a
  question to every archive would undo the undo-notice design.
- **The notice names the cancelled wake in all directions**, not only in
  3. Why: it is the last place the person sees the consequence before the
  conversation leaves the rail.
- **Habitat's line stays in the history** after the archive and after a
  restore. Why: like round 1's moved and cancelled lines, it is a host fact
  the conversation should keep.
- **A row with several wakes shows the next one** (`1.12. 10.00`), and its
  description says "2 herätystä, seuraava …". Alternative: a "+1" mark.
  Why: the end slot holds one short value.
- **The open conversation, archived from the header, stays on screen
  archived** in the prototype; production moves to the workspace page.
  This is a review convenience, not a proposal.
- **Production's rail moves focus to the next row before archiving.**
  With a confirmation in between, that move has to wait for the answer,
  and a kept archive returns focus to the row's archive button (as the
  prototype does). Implementation note, not a product change.

## Host assumptions

No new authority beyond round 1's sketch. The archive command, which
already runs in the person's daemon, cancels the conversation's pending
wakes in the same write (`wakes.json` entries → `cancelled`, reason
`archived`), rewrites the user timer to the next remaining wake, and
appends Habitat's entry to the conversation. The browser reads the
pending wakes (time, `set_by`, note) from the snapshot to build the
confirmation, so the snapshot's agent needs the full list of pending wakes
rather than only the next one. Undo is the restore command with "restore
the wakes this archive cancelled" while those wakes are still in the
future. If the snapshot's wake list is unknown or stale, the confirmation
should say it could not read the wakes rather than archive silently.

## Questions for Jari

1. **Which direction?** Recommendation: 2 Ikkuna, with 1 Rivillä as the
   lighter fallback.
2. **Where does focus start in the window?** Recommendation: on the
   archive action (Enter archives), and align production's helper window
   to the same. The alternative is to keep the helper window's Älä
   arkistoi focus and copy it here.
3. **Should the notice's Palauta also bring back the wake?**
   Recommendation: yes within the notice's 8 seconds; no for a later
   restore from the archive.
4. **Is telling the agent with the next message enough** after a restore?
   Recommendation: yes; a turn of its own just to say "cancelled" would
   spend a model call and raise the conversation for nothing.
