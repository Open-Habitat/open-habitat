# Result: the whole composer area, with Send, Stop and Ohjaa / Työn jälkeen

Prototype round, 2026-10-19 (taskfleet run `01m59z5p287e7a2t4c4cfdeg5p`), built on Jari's
choice of **Alarivi** in `issues/proto-composer-combined/result.md`. No production code changed.
The round is in `design-system/prototypes/rounds/2026-10-19-koko-alakerta/`, and its screenshots
are in `shots/` next to this file.

Build and open, from `design-system/prototypes/`:

```
node build.mjs rounds/2026-10-19-koko-alakerta            # dist/2026-10-19-koko-alakerta.html
```

Keys `1`–`3` switch direction. The page bar has a **Pi töihin** button, which starts a turn of
Pi's work without typing, and **Hidastettu**, which slows the turn down so there is time to try
things while Pi works.

## What is the same in every direction

- **Alarivi as chosen.** The field's own bottom row has Komennot and Tiedosto. In a new
  conversation it also has the model pill on the right. With `!`, the command label takes the
  Komennot slot. The caret list, the button list, the Ctrl/⌘+P palette and the `!` run block
  are the previous round's, unchanged.
- **Taustatyön merkit (Merkit)** stay where they were chosen, as small marks right above the
  composer. In this round they are on (`strip = true`), so the stacking can be seen: marks, then
  the queue or band, then the field.
- **Keys, as in Pi's TUI.** Enter sends. While Pi works, Enter sends in the chosen way (Ohjaa by
  default), and **Alt+Enter** sends once the other way. The placeholder says this while Pi
  works: "Ohjaa Pi:tä… · Alt+Enter: työn jälkeen". **Esc** in the field, with no list, menu or
  background panel open, stops what the composer's Stop stops: Pi's turn first, otherwise a
  running `!` command.
- **What Stop stops.** Stop is immediate and asks nothing, as chosen on 13.10. Pi drops its queue
  when it is stopped, so the queued messages **come back into the field** and a toast says so,
  instead of being lost.
- **The queue.** Each queued message is one row: its kind (Ohjaus / Työn jälkeen), its text, and
  when it goes ("seuraavassa välivaiheessa" / "kun vuoro päättyy"). The one queue action is
  **Palauta kenttään**, which takes all of them back into the field for editing. It replaces
  production's "Tyhjennä jono", which threw the text away.
- **The `!` command and Pi.** A `!` command runs at once, even while Pi works, as in the
  previous round. While the field holds a `!` command, the Ohjaa / Työn jälkeen choice is
  hidden, because a command is not a message to Pi, and Send becomes **Aja**. The Stop for the
  command lives in the composer area, not in the run block, so there is one place to look for
  "stop what is running".

## Axis: where Stop and the steer/queue choice live relative to the bottom row

| # | Direction | Placement | When it is the right choice | Its cost |
|---|---|---|---|---|
| 1 | **Rivillä** | Everything at the right end of the field's own bottom row. Idle: Send. While Pi works: a **mode chip** ("↪ Ohjaa ⇄"), which swaps between Ohjaa and Työn jälkeen when clicked, then Stop, then Send. While a `!` command runs: "! make serve 0:05", then Stop. The queue is a card above the field. On a phone, Komennot and Tiedosto drop their labels while Pi works, to make room. | One box holds everything that belongs to the next message: what it carries (commands, files, model), how it goes (mode) and the send itself. Stop sits beside Send, where chat tools have taught people to look. The field gets the full width. | The mode is one chip that shows only the current choice. The other choice is learned by clicking, or from the tooltip and placeholder. On a phone the row is full while Pi works. |
| 2 | **Vieressä** | Send stays outside, to the right of the field, as in production today. While Pi works, the column holds Stop on top and a **labelled split Send** below it ("↪ Ohjaa ▾"). The ▾ menu names both ways, explains them and shows their keys (Enter / Alt+Enter). The bottom row keeps only the aids. | The smallest change from production. The send button says what it will do ("Ohjaa", "Työn jälkeen", "Aja"), and the menu teaches the Alt+Enter key. | The column takes width from the field, more while Pi works, which is also when you write a steer. Stop floats above the Send pill and does not say what it stops: Pi or the command is only in its tooltip. |
| 3 | **Työnauha** | A **band joined to the top edge of the field** appears while anything runs or waits. It has one line per running thing, each with its own labelled **Pysäytä**: "● Pi työskentelee 0:42 [■ Pysäytä] · Viestisi [Ohjaa \| Työn jälkeen]" and "● ! make serve 0:05 [■ Pysäytä]". Below them are the queued messages. Send is at the bottom row's right end. | The most explicit. Pi and a `!` command each have their own visible Stop, and both choices are visible as one segmented control. The queue reads as part of the same "what is happening" band. | The tallest. The band appears when Pi starts and disappears when the turn ends, so the field moves under the hands at those moments. The band repeats the "Pi työskentelee" status that the turn already shows in the conversation. The band comes before the field, so its Stop and mode are reached by Shift+Tab, as with the earlier Yläpuolella. On a phone, the band, the mode and a two-message queue take about a third of the screen. |

All three directions have the same content and the same keyboard flow. These flows were checked
mechanically in every direction (below):

- Enter sends while idle, Enter steers while Pi works, and Alt+Enter queues.
- Tab from the field reaches the mode control (Shift+Tab in Työnauha), switches it, and the next
  Enter goes the new way.
- Esc in an empty field stops Pi and puts the queued text back into the field.
- Palauta kenttään restores two queued messages in order.
- `!make serve` Enter runs the command, and Esc stops it.
- `/rev` Enter still completes to `/review `.

## Recommendation

**Rivillä.**

Jari's reason for Alarivi was that everything belonging to the message sits in one row inside
the field. Rivillä carries that reason all the way: the row's left end holds what the message
carries, and its right end holds how it goes and the send itself. It is also where Stop is
expected: right beside Send, in the same place as the most-used button, so it is found without
looking. The field keeps its full width while Pi works, which is when steering messages get
written.

Vieressä is the safe choice. It is closest to production, and its labelled split button is the
best teacher of Alt+Enter. But it spends field width on a column exactly while Pi works, and its
Stop is ambiguous between Pi and a command. Työnauha is the most honest about what is running,
but it pays with height and with a band that keyboard users reach backwards. It also makes the
field jump at the start and end of every turn, which happens many times a session.

What I would take from the others into Rivillä:

- Vieressä's **menu text** ("Pi saa viestin työn välivaiheessa · Enter") as the mode chip's
  tooltip. It is already close.
- Työnauha's rule that **a running `!` command shows its name next to its Stop**. Rivillä does
  this with the run chip.

## What Jari decides

1. **Direction:** Rivillä, Vieressä or Työnauha, or a mix.
2. **Esc stops.** Esc in the field, with nothing open, stops Pi as it does in Pi's TUI. This is
   fast, but an Esc pressed once too often after closing a list stops the turn. The alternative is
   to have no key for Stop, which leaves only Tab to the button.
3. **Stop puts the queue back into the field.** The alternative is to leave the messages queued
   and send them when you next press Send.
4. **Palauta kenttään replaces Tyhjennä jono.** Is clearing without keeping the text still needed
   anywhere?

## What the view assumes from the host

- `steer`, `follow_up`, `clear_queue` and `interrupt` as the daemon has them today
  (`contracts/v1/scenarios.json`).
- **Palauta kenttään** assumes that Pi's `clear_queue` reply carries the cleared steering and
  follow-up texts, so that the browser can put back exactly what Pi removed. A delivery can race
  the clear. A steer that Pi already took is not returned, and the view must not pretend that it
  was. This needs checking against Pi's RPC before implementation.
- **Stop restores the queue** assumes that abort leaves the queue observable, either cleared
  with its texts or still listed. The browser does not keep its own copy of the queue as truth.
- The queue's per-row "when it goes" comes from the kind alone (steer vs. follow-up). Pi reports
  no delivery time.

## Checks

- `node check.mjs dist/2026-10-19-koko-alakerta.html --click '[data-x="cmds"]'`: every direction
  in light, dark and phone with the live turn settled; console clean.
- The round's own `shots.mjs` types through the key states, plays the turn slowed down for the
  working states, and runs the keyboard flows above in every direction. It produced 57 screenshots. All 8
  flows passed in each of the 3 directions, and the console stayed clean. Phone screenshots hide
  the page's direction picker, which would otherwise cover the composer.
  To regenerate: `node rounds/2026-10-19-koko-alakerta/shots.mjs dist/2026-10-19-koko-alakerta.html --out dist/shots`
  from `design-system/prototypes/`, with `PLAYWRIGHT_BROWSERS_PATH` set to the main checkout's
  `.cache/ms-playwright`.
- `shots/` holds 27 of them, the key states named `<mode>-v<direction>-<state>`: 1 idle, 2 idle with text,
  3 Pi working, 4 Pi working with a draft, 5 a steer and a follow-up queued, 6 Vieressä's mode
  menu, 7 `!` typed while Pi works, 8 `!make serve` running, 9 after Stop with the queue back in
  the field, 10 a new conversation.

## Decisions for later review

- **Alt+Enter sends once the other way and does not change the chosen mode.** This matches Pi's
  TUI, where Enter steers and Alt+Enter queues a follow-up. The alternative was to make Alt+Enter
  switch the mode. I rejected it because a one-off follow-up is the common case, and a sticky
  switch would surprise the next Enter.
- **The chosen mode is kept for the conversation until changed.** It resets to Ohjaa only when
  switching direction in the prototype. Pi's own default is steer.
- **One Stop in the composer area stops Pi first, then a `!` command.** Työnauha shows both, each
  with its own button. Rivillä and Vieressä show one Stop, with the target in its accessible
  name. Rivillä also shows a run chip when the target is a command.
- **The run block lost its own Pysäytä button.** The previous round put one in the block. With
  Stop in the composer area, two stops for the same command competed. The block keeps the status
  and the clock.
- **`!` while Pi works hides the mode choice.** A command is not a message to Pi.
- **Tyhjennä jono becomes Palauta kenttään.** See the assumption above.
- **The prototype overrides the library composer in the round.** It hides `lib/composer.js`'s
  Send column, work row and queue, and draws its own from the same state. It also wraps
  `updateComposer` and `turnEnded`. When a direction is chosen, the library's composer should be
  rewritten rather than wrapped. Proposed library fix: `lib/composer.js`'s `turnEnded` should not
  send a queued follow-up when the stage is cleared by a direction switch, because the clear
  looks like the turn ending. The round guards against this itself.

## Jari's choice (2026-10-20)

"Kyllä, Rivillä näyttää minusta parhaalta." Direction 1 **Rivillä**, with Vieressä's menu text as the mode chip's tooltip as the round recommends. Implementation: `implement-composer-area`.
