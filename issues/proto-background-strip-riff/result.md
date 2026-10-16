# Result: a quiet background strip with spinoffs and processes apart

One round, built from `design-system/prototypes/` with

```
node build.mjs rounds/2026-10-16-taustatyo-riff
```

into `dist/2026-10-16-taustatyo-riff.html` (not versioned). Directions:
**Kaksi lokeroa**, **Rivi lajille**, **Merkit**.

**Starting point.** Round `2026-10-16-taustatyo`, direction *Yksi palkki*,
which Jari chose as the base (`proto-composer-strip`, Decisions). Its summary
line named the waited items and counted the rest ("Odotan spinoffia README… ja
`hidas-testi` · 2 muuta käynnissä · 4 päättynyttä"), and its open list mixed
both kinds under state headings with a second line, a status word, a clock, a
bell and a button on every row. Production today (`nykytila-lab.png`,
captured from the synthetic lab) still has only the framed process tray above
the field and spinoffs as a loose text line, so the riff starts from the
prototype, not from production.

**The story every direction plays.** The library's Status-skripti
conversation with the same background work as the base round, plus one
running spinoff that nobody waits on, so "running" and "waited" are not the
same item:

- spinoffs: *README: --today-esimerkki* working, the agent waits on it through
  its `taskfleet run wait` process; *Testit aikavyöhykkeille* working;
  *CI: pip-välimuisti* merged; *Aikavyöhyke tulosteeseen* not merged, work
  preserved;
- processes: `testit` and `sivu` running; `hidas-testi` running, the agent
  waits on it; `haku` finished (code 0); `kello` failed (code 1).

The turn plays and ends; the conversation is then *Odottaa spinoffia* in the
sidebar (blinking) and in the top bar, whose chip opens the strip at the
README spinoff. **Seuraava tapahtuma** finishes `hidas-testi`, merges README
(the wait ends), fails *Testit aikavyöhykkeille* (a new "needs me"), then
resets. **Tilanne** has the base round's six situations (both, only
processes, only spinoffs, none, no process connection, Taskfleet not
answering).

## Axis: how little the strip says at rest while the two kinds stay apart

At rest every direction answers only three things: is something running, of
which kind, and does anything need me. Two marks carry the last two: a bell
when the agent's turn has ended and it waits on something of that kind, and a
red dot when a spinoff ended unmerged with its work saved. Everything else
(names, branches, commands, clocks, finished items) is behind a click.

Open, all three show the same list, which is also quieter than the base:
**one kind at a time**, one line per item (mark, name, clock or result,
bell, stop), the running items first with the waited one on top, the finished
ones folded under "2 päättynyttä", and the branch, command, output and run id
only when a row is opened. Kinds never mix in one list.

| Direction | What it decides |
|---|---|
| **Kaksi lokeroa** | One framed bar split down the middle into two named compartments: `⑂ Spinoffit 2 · 🔔 •` and `>_ Prosessit 3 · 🔔`. At rest only a count of running items and the two marks. A compartment opens its own list above the bar (the bar does not move) and is underlined while open. Still one line high, the closest to Yksi palkki. |
| **Rivi lajille** | Two low lines in one frame, one per kind, each with a label and its single most important fact: the agent's wait ("🔔 Odotan README: --today-esimerkki"), else what needs me ("1 ei mergetty · työ tallessa"), else the count ("2 työskentelee"). The count follows in grey on desktop when the wait takes the line. Each line opens its own list above itself. Says the most in words; costs two lines. |
| **Merkit** | Two small pills with an icon and a number, no words. The bell and the red dot sit on the pill's corner. A pill opens a floating panel above the strip with *Spinoffit* and *Prosessit* as tabs, so the thread does not move. The quietest; the kind is told by icon alone at rest. |

**Recommendation.** *Kaksi lokeroa*. It keeps the one-bar shape Jari
accepted, the two kinds are separated by a name and a wall rather than by
icon or font, and at rest it says two words and two numbers. *Rivi lajille*
reads best when the agent waits (the name of what it waits for is visible
without a click), but it spends a second line and puts the same "Odotan"
on both lines when both kinds are waited on, which starts to rebuild the
overload. *Merkit* is the least information, but at rest the kind and the
marks are icon, number and colour only, which `design-system/AGENTS.md`
("merkki, sana, väri") does not allow for essential state: the words exist
only in the tooltip and the screen-reader label.

## Host facts the views assume

Unchanged from `proto-composer-strip`: pi-processes' inventory (name,
command, start/end, status, exit code, whether the end wakes the agent);
Taskfleet's runs for this conversation's session (`created_by_session`) with
state, branch, run id and merge result; the daemon recognising a running
`taskfleet run wait <run-id>` and joining it to the spinoff. Two additions
the riff needs, both browser-side:

- **"Needs me" is a failed (not merged, work saved) spinoff the reader has
  not yet looked at.** "Looked at" means opening the spinoff list once in
  this browser; nothing is stored on the host. A failed *process* does not
  raise the mark: the agent was woken by it (`wake`) and handles it.
- **The bell is the agent's wait after its turn has ended**, derived as the
  base round's *Odottaa spinoffia / prosessia* state. While the agent works,
  the bell is shown only on the rows.

## Questions for Jari

1. Kaksi lokeroa, Rivi lajille or Merkit?
2. Is "needs me" right as *a spinoff that ended unmerged with its work saved,
   until you have opened the list once*? Alternatives: it stays until the
   branch is gone (a standing alarm), or failed processes also count.
3. When the agent waits and its turn has ended, is the bell enough in the
   strip (the top-bar chip already says *Odottaa spinoffia* and opens the
   item), or should the strip name what it waits for, as Rivi lajille does?

## Decisions for later review

- **A second running spinoff was added** to the base content so that
  "running" and "waited on" are different items, as the brief asks.
- **Open lists show one kind at a time and never mix kinds.** The base's
  state-grouped mixed list was a large part of the overload and of kinds not
  reading as separate.
- **Rows are one line.** The branch or command moved into the row's details;
  the clock shows minutes only; a running item's state word is dropped (the
  breathing dot says it).
- **Finished items are folded** under "N päättynyttä" inside their kind;
  opening a kind with an unseen failure unfolds them, so the failure is seen
  where the red dot pointed.
- **Lists open above their bar** (Kaksi lokeroa, Rivi lajille) so the bar
  stays at the same place under the pointer; Merkit floats its panel instead.
- **Every direction starts from the same facts**: switching direction resets
  the story.
- **Kept from the decided behaviour**: `taskfleet run wait` is shown only as
  the spinoff's bell and in its details; *Poista päättyneet* sits in the
  process list only and leaves spinoffs; *Lopeta odotus* stops only the wait;
  the waiting mark blinks only in the sidebar.

## Library proposals

- The chosen direction replaces the process tray in `lib/` together with the
  base round's `items()` model and this round's `facts(kind)` (everything the
  strip says at rest about one kind), so the at-rest summary is derived in one
  place.

## Verification and review

`node check.mjs dist/2026-10-16-taustatyo-riff.html` with clicks, run three
times so each direction's interactions were clicked: Kaksi lokeroa (open a
compartment, open a row, fold finished) in light, dark and phone; Rivi
lajille on a phone (open Prosessit, unfold finished, open the failed
`kello`); Merkit on desktop and phone (open a pill, switch tab, open a row).
Clean console in every run. A scripted Chromium walk additionally clicked the
top-bar chip, all six *Tilanne* values, all four *Seuraava tapahtuma* steps,
*Poista päättyneet* and stop in every direction, with no console errors.
Screenshots next to this file: `levossa-kaikki-suunnat.png` (the three at
rest, light and dark), `kaksi-lokeroa-auki.png`, `rivi-lajille-puhelin.png`,
`merkit-auki.png`, and the production view `nykytila-lab.png`.

Review level: focused self-review. The change is prototype HTML/JS/CSS with
synthetic content; nothing touches credentials, the Unix-user boundary or
authority, so no independent review was run. The self-review found and fixed
that switching direction kept the previous direction's stopped processes.
