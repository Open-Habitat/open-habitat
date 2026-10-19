# Result: one composer with buttons, caret completion and the Ctrl/⌘+P palette

Prototype riff round, 2026-10-19 (taskfleet run `01m59wa0tfe3kzj0fgcd6nynsf`), built on
Jari's choice in `issues/proto-composer-commands/result.md` ("Jari's choice"). No production
code changed. The round is in `design-system/prototypes/rounds/2026-10-19-kentta-yhdessa/`, and
its screenshots are in `shots/` next to this file.

Build and open, from `design-system/prototypes/`:

```
node build.mjs rounds/2026-10-19-kentta-yhdessa            # dist/2026-10-19-kentta-yhdessa.html
```

Keys `1`–`3` switch direction. The page bar lists what to try.

## What is the same in every direction

This is the combination Jari chose. All of it behaves identically in the three directions:

- **Komennot** and **Tiedosto** buttons. There is no visible command-mode toggle.
- **Typed `/` and `@` complete at the caret**, Kursorissa's behaviour unchanged: the list opens
  above the line at the caret's x, a mid-line `/` opens with nothing highlighted so Enter still
  sends, Tab inserts the top match, and Esc closes the list and keeps the text.
- **The button's menu and the caret list are one list.** It has the same rows, groups, tags and
  keys, and it is drawn by one function (`paintList`). Only the placement differs. Typed, the list
  sits at the caret and filters from the text you type. From a button, it is anchored at the
  button's edge, and a search line takes the place where the caret list shows its title,
  because there is no typed token to filter from.
- **`!` and `!!` are typed only**, as in Kursorissa and Pi's TUI: the `!` stays in the text, the
  field gets the tint, and a label says "Komento työtilassa `~/src/aurinkokello` · Pi näkee
  tulosteen" (or "vain sinulle, ei Pi:lle" for `!!`). Send turns into Run. The result block,
  Stop, exit code, the "Pi sees it with your next message" note and the process-tray hint for
  `make serve` are carried over unchanged from the previous round.
- **Ctrl/⌘+P opens Ponnahdus's palette**: Muutetut / Tiedostot / Komennot tabs, preview (a diff
  for changed files), and Tab to mark several files. New in this round: pressing Ctrl/⌘+P again
  in the palette moves to the next tab, so the tabs can be reached without a mouse. Pressing
  Ctrl/⌘+P while an `@` list is open at the caret **carries the typed query into the palette**,
  and the chosen paths replace the `@token`. This connects the small list to the large one.
- In a `!` command, Tiedosto and Ctrl/⌘+P insert shell-quoted paths without `@`, as
  tmux-file-picker does. Komennot is not offered there, because a `/command` cannot run inside a
  shell command.
- **A new conversation** (`/uusi`, or + in the sidebar) shows the model pill that production
  already puts inside the field before the first message. Its first command list shows
  "Haetaan Pi:n komennot ja taidot työtilasta…" for about a second, while browser actions are
  already listed. That is the list-only Pi helper Jari accepted, and the view shows its cost.

## Axis: where the buttons sit and how much they weigh

| # | Direction | Placement and weight | When it is the right choice | Its cost |
|---|---|---|---|---|
| 1 | **Alarivi** | Labelled buttons on the field's own bottom row. In a new conversation the model pill sits on the same row to the right, which is where production already puts it. With `!`, the command label takes the Komennot slot on that row, so the field does not grow a separate label row. | Everything that belongs to "what this message carries" is in one row inside the field: commands, files, model. It is the most discoverable on a phone and matches the production pill. | The field is always two rows tall, even at rest. The composer rounds had kept a bare one-line field. |
| 2 | **Yläpuolella** | The same labelled buttons as a light, muted row above and outside the field, with a quiet "Ctrl P tiedostot" hint at the right (the model pill there in a new conversation). The field itself stays a bare single line. With `!`, the command label replaces Komennot on that row. | Keeps the field exactly as chosen earlier and puts the aids in a strip that reads as part of the page, not of the text. The palette key is visible without a tooltip. | The row floats between the conversation and the field, where the background strip (Merkit) and the queue also live. When those land, three strips can stack there. Visual order puts the buttons before the field, so they are reached by Shift+Tab. |
| 3 | **Ikonit** | Only `/` and `@` icons inside the field, at the right end of its line next to Send. The names are in the tooltip and the accessible name. With `!`, Kursorissa's label row appears at the top of the field and the `/` icon hides. In a new conversation the model pill gets its own row in the field, as production does today. | Least chrome. The field stays one line, and the icons are the same symbols you would type, so they also teach the shortcuts. Closest to the earlier "bare field" choices. | A phone user who has never used a TUI may not read a bare `/` as "commands". The menu opens from the right, away from where the text starts. |

All three directions have the same keyboard flow, checked mechanically (below). The field,
Tab to a button (Shift+Tab in Yläpuolella), Enter opens the list with focus in its search,
type to filter, Enter inserts, and focus returns to the field. Esc from any list returns to
the field at the same caret.

## Recommendation

**Alarivi.**

Jari asked for visible buttons, so the buttons have to be readable at a glance, including on
a phone. That rules out Ikonit as the main form: a bare `/` glyph says "commands" only to
someone who already knows, which is the people who would type it anyway. Between the two
labelled forms, Alarivi keeps the buttons *inside* the thing they act on. It also gives them
the row production already has for the model pill, so the field gains no new structure, only
content in a row that exists. Yläpuolella keeps the field bare, but it adds a new strip
exactly where Merkit and the queue are already headed, and its buttons come before the field
in keyboard order.

What I would keep from the other two: Ikonit's rule that `/` disappears in a `!` command (all
three do this now), and Yläpuolella's visible palette hint. In Alarivi that hint could sit at
the right end of the row when the model pill is absent, but I left it out to keep the
comparison clean.

## What Jari decides

1. **Direction:** Alarivi, Yläpuolella or Ikonit, or a mix (for example, Alarivi on desktop
   and Ikonit on the phone).
2. **A command chosen from a button or the palette goes to the start of the message**
   (replacing a command already there), because Pi runs a command only at the start. A typed
   mid-line `/` stays where it was typed and is only a mention. Is that the rule he wants, or
   should the button insert at the caret like the typed list does?

After the choice, the next step is moving the chosen direction into `lib/` and starting the
implementation issues. Those carry the daemon work already described in
`proto-composer-commands` (command list with the list-only helper, file list, `bash` relay).

## What the view assumes from the host

Unchanged from `proto-composer-commands`: a per-conversation command list
`{name, description, source, scope}` (answered by the running Pi or the short-lived list-only
helper), a per-workspace file list with git marks plus a bounded preview for the palette, and
a `bash` write with a streamed `bash.output` and a stop. The one new visible assumption is
the helper's latency: the view shows a loading row for about a second in a conversation
without a running Pi, rather than an empty list.

## Checks

- `node check.mjs dist/2026-10-19-kentta-yhdessa.html --click '.x-btn[data-x="cmds"]'`: every
  direction in light, dark and phone with the live turn settled; console clean.
- The round's own `shots.mjs` types through the key states (`check.mjs` only clicks) and runs
  a keyboard-only flow in every direction that asserts the field's text. It produced 69
  screenshots, passed all 8 flows in each of the 3 directions, and the console stayed clean.
  The flows are: `/rev` Enter → `/review `; mid-line `/` not highlighted; `@status_r` Tab;
  Tab to Komennot, search, Enter → command at the start; Ctrl+P with two marked files; `@READ`
  then Ctrl+P → `@README.md`; Esc keeps the text; Ctrl+P inside `!git diff ` inserts a bare
  path.
  To regenerate: `node rounds/2026-10-19-kentta-yhdessa/shots.mjs dist/2026-10-19-kentta-yhdessa.html --out dist/shots`
  from `design-system/prototypes/`, with `PLAYWRIGHT_BROWSERS_PATH` set to the main checkout's
  `.cache/ms-playwright`.
- `shots/` holds 21 of them. They are named `<mode>-v<direction>-<state>`: 1 `/` at the start,
  2 `@` at the caret, 3 Komennot button with a search, 4 Tiedosto button, 5 Ctrl+P, 6 `!`,
  7 a finished `pytest -q`, 9–10 a new conversation while the command list loads and after.

## Decisions for later review

- **The button opens the same list with a search line, not a typed sigil.** The alternative was
  for the button to insert `/` or `@` at the caret and open the caret list, so that literally
  one placement exists. I rejected it because a mid-line `/` from a button would become a
  mention that never runs, and an inserted `@` is text the user has to delete if they cancel.
- **Command from a button or the palette → start of the message** (see "What Jari decides"
  2). Files from a button go to the caret, with a space added if the caret touches a word.
- **Esc from a button's list returns focus to the field, not to the button.** The ARIA
  menu-button pattern returns focus to the trigger. Here the button is a way to write the
  message, and the palette already returns to the field, so I chose the same for both.
- **Ctrl/⌘+P inside the palette cycles tabs.** Tab is already "mark" there, as in fzf, and the
  tabs had no keyboard route.
- **Ctrl/⌘+P from an open `@` list carries the query into the palette** and replaces the
  token. Without this, upgrading from the small list would leave a half-typed `@sta` behind.
- **Komennot is hidden while the text is a `!` command**, in all three directions. Tiedosto
  stays and inserts a shell-quoted path.
- **The list-only helper's latency is shown as a loading row**, and browser actions are listed
  at once. Showing nothing until Pi answers would look like "no commands".
