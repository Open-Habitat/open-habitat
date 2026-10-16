# Result: thread fill direction; processes and spinoffs above the field

Two rounds, built from `design-system/prototypes/` with

```
node build.mjs rounds/2026-10-16-tayttosuunta
node build.mjs rounds/2026-10-16-taustatyo
```

into `dist/2026-10-16-tayttosuunta.html` and `dist/2026-10-16-taustatyo.html`
(not versioned).

**Why two rounds and not one with two axes.** The two topics are independent
choices: the fill direction is decided on an empty conversation that receives
its first message, and the strip is decided on a busy conversation whose agent
has background work. Putting both on one page would have meant 3 × 3
combinations or one story that shows neither topic well. With two rounds, each
page has one axis and three directions behind the picker, as the prototype
rules ask, and Jari can choose one without the other.

The production view the rounds start from was captured from the synthetic lab
(`nykytila-uusi-keskustelu.png`, next to this file): a new conversation after
its first reply sits at the top of the view with a large empty gap above the
field, and the spinoff state is a bare text line ("Spinoffien tila ei saada.")
under the bordered process bar. Jari's live screenshots in
`issues/spinoff-process-duplication/` show the same mismatch with real
content: the process bar has a frame, the spinoffs are loose text.

## Round 1 · `2026-10-16-tayttosuunta`: which way a new conversation fills

**The story every direction plays.** An empty conversation in `aurinkokello`.
The first message is typed into the field and sent by itself after about a
second ("Testit kaatuvat `scripts/status_rows.py`:ssä…"). Pi thinks, runs the
test suite, edits the script, runs the tests again and writes a long reply
(the short fix followed by the whole "Miten rivit valitaan" explanation with a
code block and a table). The conversation then gets its title (*Status-skriptin
testit*) and, after a short pause standing in for the three idle minutes, the
recap card appears above the field. **Jatkoviesti** in the page bar sends a
second message with a short turn (a grep, an edit, a short reply); the field
also works for your own messages. **Työ näkyvissä** replays the story with the
agent's work open from the start, as the account menu's *Agentin työ:
Näkyvissä* would give it, so the tool work can be seen filling the view; by
default the work is hidden as in production. Everything else (live turn,
hidden work, field, recap) is the library as it stands.

**Axis: where the conversation sits while it is shorter than the view.** Once
the conversation is taller than the view, all three behave alike; the
difference is the first screenful or two of every new conversation.

| Direction | What it decides |
|---|---|
| **Ylhäältä** | Today's production. The thread starts at the top of the view and grows downwards; between the last message and the field there is empty space until the conversation fills the view. |
| **Alhaalta** | Chat style, what Jari described. The thread sits on the field and grows upwards; the empty space is above it. The first message appears right above the field where it was written, the working row is next to the field, and the recap card pushes the thread up instead of covering an empty gap. The empty-conversation text also sits at the bottom, next to the field. |
| **Viesti ylös** | Each sent message rises to the top of the view, and the reply is written below it while the view stays still; the view no longer chases the newest line, so a long reply can be read from its beginning while it streams. The remaining space below the reply is reserved until the next message, which starts its own view. The Viimeisimpään arrow brings the reader to the end. |

All three use the same plain round Viimeisimpään arrow at the bottom of the
stage when there is content below; it is not the subject of this round (round
`2026-10-16-viimeisimpaan` is).

**Recommendation.** *Alhaalta*. It is what Jari asked for, it keeps the eye
near the field for the whole first exchange, and it changes nothing once the
conversation is long. *Viesti ylös* is the stronger choice if long replies are
read while they stream, but it gives up following the newest line, which the
quiet-work design (`design.md`: "Näkymä seuraa uusinta sisältöä…") now relies
on.

## Round 2 · `2026-10-16-taustatyo`: processes and spinoffs above the field

**Built on** `2026-10-16-prosessit` direction 3 (*Kentän yllä*, with *Poista
päättyneet*), `2026-10-16-prosessilohkot` direction 1 (*Merkintänä*; the
waiting summary reads "Odotan …") and `2026-10-16-spinoffit` direction 1 (the
spinoff state is shown above the field; the waiting mark may blink in the
sidebar). The bar, the row anatomy, the status marks and *Poista päättyneet*
are the chosen process tray's; spinoffs get the same row.

**The story every direction plays.** The library's Status-skripti
conversation. The agent's turn plays (working), and its background work is the
same in every direction:

- processes: `testit` (a watcher) and `sivu` (a preview server) running and
  not waited on; `hidas-testi` running, the agent waits on it; `haku`
  finished (code 0) and `kello` failed (code 1);
- spinoffs: *README: --today-esimerkki* working, the agent waits on it through
  its own `taskfleet run wait` process; *CI: pip-välimuisti* merged;
  *Aikavyöhyke tulosteeseen* not merged, work preserved.

The `taskfleet run wait` process (`odota-readme`) is in the process inventory
but **never listed as a process** in any direction: it is the README spinoff's
"Agentti odottaa" bell, and the spinoff's details name the wait command. When
the turn ends, the conversation is *Odottaa spinoffia* in the sidebar (with
the blinking mark Jari allowed) and in the top bar; the top-bar chip opens the
strip at the item the agent waits for. **Seuraava tapahtuma** in the page bar
finishes `hidas-testi`, then merges the README spinoff (which ends the wait
and wakes the agent), then resets. **Tilanne** switches between both kinds,
only processes, only spinoffs, nothing (the strip disappears), *Prosessiyhteys
puuttuu* (Pi controlled from a terminal) and *Spinoffien tila ei saatavilla*
(Taskfleet does not answer).

**Axis: how the two kinds share the space above the field.**

| Direction | What it decides |
|---|---|
| **Yksi palkki** | One *Taustatyö* bar for both. Its summary says "Odotan spinoffia README… ja `hidas-testi` · 2 muuta käynnissä" when the turn has ended and "1 spinoff · 3 prosessia käynnissä" while the agent works. It opens into one list grouped by state (*Agentti odottaa*, *Käynnissä*, *Päättyneet*) with spinoffs and processes mixed on the same row anatomy; the kind shows in the name (sans for a spinoff title, mono for a process name) and the second line (`spinoff · wt/…` or the command). |
| **Kaksi palkkia** | A *Spinoffit* and a *Prosessit* bar stacked, identical in shape, each with its own list. Each bar names its own wait ("Odotan spinoffia README…", "Odotan: `hidas-testi` · 2 muuta käynnissä"). One list is open at a time so the thread keeps its room. Closest to today's production; it fixes the mismatch by giving spinoffs the same frame. |
| **Sirut** | Every running process and spinoff is its own chip on one line, waited ones first with a bell and "Odotan" in front; a chip shows its clock and opens its details in a panel above the chips; all finished work is one "4 päättynyttä" chip that opens the finished list with *Poista päättyneet*. On a phone the chips scroll sideways with a fade at the edge. |

**Recommendation.** *Yksi palkki*. It is the most literal "equal footing": the
reader looks at one place, the state groups answer "what is the agent waiting
for" before "what kind of thing is it", and the strip stays one line high
whatever the mix. *Kaksi palkkia* costs two lines whenever both kinds exist.
*Sirut* shows the most without opening anything, but grows to two lines on a
desktop with four running items and hides items behind a sideways scroll on a
phone.

## Host facts the views assume

- **Fill direction (round 1)**: nothing new from the host. The direction is
  pure presentation over the same native thread; the recap and title already
  come from existing features.
- **Process inventory**: as in `issues/extend-process-ui/architecture.md`:
  pi-processes' list with id, name, command, start/end, status, exit code and
  the start call's notification setting (whether the end wakes the agent).
  Without the inventory (terminal-controlled Pi, no extension) the strip says
  so ("Prosessiyhteys ei ole saatavilla") instead of showing an empty list.
- **Recognising a wait**: a running process whose command is `taskfleet run
  wait <run-id> …` is recognised by the daemon (architecture of
  `proto-processes-blocks`) and joined to the spinoff with that run id. The
  view hides the process and marks the spinoff. If Taskfleet does not answer,
  the spinoff is still shown from the wait process, with *Tila ei tiedossa*
  and its run id, never as a generic process.
- **Spinoffs**: Taskfleet's runs created by this conversation's session
  (`created_by_session`, accepted 16.10.2026), with state, branch, run id and
  merge outcome. Finished runs are retained by Taskfleet; the browser cannot
  remove them.
- **Poista päättyneet** removes finished *process* records and their logs
  (the extension's clear); finished spinoffs stay listed.
- The "Odotan …" summary and the *Odottaa spinoffia / prosessia* states are
  derived from the inventory as in `proto-processes-blocks` (a running process
  whose end wakes the agent, after the turn has ended); no host store.

## Questions for Jari

1. Round 1: *Alhaalta* as recommended, or *Viesti ylös* (reading a long reply
   from its start while it streams, at the cost of the view not following the
   newest line)?
2. Round 2: one shared bar, two matching bars, or chips?
3. Should *Poista päättyneet* also hide finished spinoffs from the strip
   (they would still be in Taskfleet and reachable from the thread), or is it
   right that only processes are cleared?

## Decisions for later review

- **Two rounds instead of one with two axes**, for the reasons at the top.
- **Round 1 plays the first message by itself** so that every direction shows
  the same story and `check.mjs` sees a live turn; Jari can also type.
- **Round 1 keeps work hidden by default** (production), with *Työ näkyvissä*
  in the page bar to see the tool work fill the view.
- **The recap appears after a short pause** in round 1 instead of three idle
  minutes, to show how the card moves the thread in each direction.
- **Round 2 turns the library's recap off** (`recap = false`) to keep the
  strip in focus; with a recap, the strip sits above the recap card as the
  process tray did in `2026-10-16-prosessilohkot`.
- **Finished spinoffs are not cleared by *Poista päättyneet*** (question 3):
  they are Taskfleet runs the browser only observes (ADR 0010 amendment
  accepted 16.10.2026), and a failed one carries "työ tallessa", which should
  not vanish with a click meant for process logs. The button's tooltip says so.
- **"Lopeta odotus" on a waited spinoff** stops only the agent's wait process
  (the spinoff keeps working), as in `2026-10-16-prosessilohkot`.
- **"Avaa spinoff" shows a toast** naming the read-only view of
  `2026-10-16-spinoffit` instead of repeating that view here.
- **The waiting mark blinks only in the sidebar** (Jari's spinoff decision),
  not in the strip or the top bar.
- **In *Kaksi palkkia* one list is open at a time**, so on a phone two open
  lists cannot cover the whole thread.

## Library proposals

- When a direction is chosen in round 1, the fill belongs in `lib/` (chrome or
  app CSS) rather than in a round: for *Alhaalta* it is one rule,
  `.stream > .vwrap { margin-top: auto; }`, plus the empty-conversation text
  moved down. An auto top margin, not `justify-content: flex-end`, keeps a tall
  thread scrollable from its first line.
- `lib/composer.js` sends only into the history thread; round 1 intercepts the
  send at rest to place the message. If *Viesti ylös* is chosen, the library's
  send needs a hook for where a sent message goes, and the queued
  *Työn jälkeen* message (sent by the library's `turnEnded`) should use it too;
  in the round it still goes through the library path.
- The chosen strip of round 2 should replace the process tray in the library
  once Jari has chosen, with `items()` (one shape for both kinds) as the model.

## Verification and review

`node check.mjs` on both pages: every direction in light, dark and phone,
clean console, with clicks (round 1: opening the settled thread; round 2: a
bar or chip and a row in each direction). `check.mjs` stretches the frame to
2400 px and cannot click page-bar controls, which hides exactly what round 1
is about, so both rounds were also walked at real frame height with scripted
Chromium (empty → working → long reply → recap → follow-up → Viimeisimpään for
round 1 in all directions, with work hidden and visible and on a phone; for
round 2 the waiting state, the top-bar chip, opening lists and rows, stop,
*Poista päättyneet*, both *Seuraava tapahtuma* steps and both unavailable
situations, in light, dark and phone). No console errors.

Review level: focused self-review of the round code. The change is prototype
HTML/JS/CSS with synthetic content and no architecture sketch; nothing touches
credentials, the Unix-user boundary or which component holds authority, so no
independent review was run. The self-review found and fixed: *Viesti ylös*
measured the view before the field grew its working row (the message landed
partly above the view), the browser's scroll anchoring fought the round's own
scrolling, two open lists in *Kaksi palkkia* could cover the thread on a phone,
and the chips' sideways overflow had no cue on a desktop (they now wrap there).
