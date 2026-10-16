# Result: the whole workspace page without context menus

Round: `design-system/prototypes/rounds/2026-10-16-tyotilasivu-2/`. Build it from
`design-system/prototypes/`:

```
node build.mjs rounds/2026-10-16-tyotilasivu-2      # → dist/2026-10-16-tyotilasivu-2.html
```

Keys 1–3 switch direction. The page opens on `aurinkokello`. Clicking a
workspace name in the sidebar, or the workspace link in a conversation's top
bar, opens its page.

## Starting point

The live page (lab, `OH_PORT_BASE=29200`, 16.10.) is direction 1 of
`2026-10-16-tyotilasivu` as implemented. The head is on the page itself: name,
path, `+` and `…` on the right, and the Git pill below them. Below that come
Avoimet as recap cards, each with an archive button, then Valmiit folded. The
sidebar's workspace row shows `+` and `…` on hover. Jari asked to remove both
`…` menus and to prototype the whole page.

## Shared by all directions

- **Sidebar row:** name and `+` only. `+` creates a conversation directly. The
  library's `…` is removed in the round (see library proposal).
- **Head:** name, path and `+` (a conversation directly, no menu). Below them,
  the Git pill (`main · 2 muutosta ↑1`) opens the Git layer, which becomes a
  bottom sheet on the phone. Beside the pill is the same attention summary as
  on the home page (`2 odottaa sinua · 1 työskentelee · 2 odottaa prosessia tai
  spinoffia`). On the phone the top bar shows only the menu button and the name,
  as in production.
- **Avoimet:** recap cards in attention order: Uusi vastaus, Työskentelee,
  Odottaa prosessia, Odottaa spinoffia, Odottaa sinua. Each card has a state
  line (state word and age). A working or waiting card also has a line of what
  it is doing, in the agent's words: `Odotan: vertailuajo · jatkan itse, kun se
  päättyy.` / `Odotan spinoffia CI:n pip-välimuisti · jatkan itse, kun se
  valmistuu.` / `Ajaa …`. The spinoff wait mark is the blinking dot in both the
  card and the sidebar. Spinoffs are not their own group, per Langassa.
- **Archive:** the card's archive button archives at once. The card fades out,
  and the **Hetki alhaalla** notice (`Arkistoitu <title>` · Palauta · ×) floats
  for 8 s, pausing while it is under the pointer or has focus. After that, the
  way back is the Arkisto row. Archiving is disabled, with its reason, while the
  agent is working or waiting for a process or spinoff.
- **Valmiit** and **Arkisto** are folded. Arkisto has Palauta, and restoring
  does not start Pi.
- **Hiding from the sidebar** uses the same notice (`Kumoa`). The page then
  carries a dashed `Piilotettu sivupalkista · Näytä` tag in the head, so a
  hidden workspace is not a dead end.
- **Delete** is visible but disabled in every direction, and shows its reason
  (`recoverable-workspace-deletion`).

## Axis: where the workspace's own actions are, now that there is no menu

| # | Direction | What it decides | When it wins | Its cost |
|---|---|---|---|---|
| 1 | **Asioiden vieressä** | Each action sits next to the fact it acts on. The name has a pencil for inline rename (Enter saves, Esc cancels). The path has a copy button, and the GitHub repo is a link on the same line. Hiding and deletion are on a quiet `TYÖTILA` line at the end of the page. | The actions are self-explanatory where they are, and the head stays light | Hiding and deletion are at the bottom of a long page |
| 2 | **Ikonirivi** | Five icons on the right of the head, in the conversation top bar's language (Ikonirivi, 13.10.): copy path, GitHub, rename (dialog), hide (a toggle, `aria-pressed`) and delete (disabled), then a divider and `+`. On the phone they become their own row of 40 px targets. | Same grammar as the conversation top bar; everything is one click away | Five unlabelled icons to learn; the head gets busy |
| 3 | **Työtila-osio** | The head has only name, path, Git and `+`. After the work comes a `Työtila` section where each fact is a labelled row with a named button: Näyttönimi (Muuta, inline), Polku (Kopioi), GitHub (Avaa), Sivupalkissa (Piilota/Näytä), Poisto (disabled, with reason). On the phone, rows stack. | Nothing to learn, and room to explain; deletion gets space when it arrives | The actions are below the work, like a settings form (close to the pre-round production form) |

## Host facts the view assumes

All already exist or were accepted earlier: workspace `path`, display name,
`visibility` (hide), observed GitHub remote, the Git summary from the
implemented read-only endpoint, recaps with their age, conversation states
including `waiting_on` from pi-processes (process name) and Taskfleet waits
(spinoff title), and the archive/unarchive commands. The view needs no new
fact. Card ages are native recap ages, as in production.

## Library proposals (not made in `lib/`)

- `lib/account.js`: drop the workspace row's `…` menu (`ws-more`, `wsMenu`).
  The round removes it in its own `paintRail` wrapper.
- `lib/app.js`: add `procwait`/`spinwait` to `STATES` and `STATE_ORDER`, with
  the blinking `st-dot spinwait`, which this round and `prosessilohkot` each
  define for themselves.

## Questions for Jari

1. Which direction: 1 Asioiden vieressä, 2 Ikonirivi or 3 Työtila-osio?
2. Can a card be archived while the agent waits for a process or spinoff? The
   round says no, with a reason, because the background work would continue
   unseen.

## Decisions for later review

- The round name is `2026-10-16-tyotilasivu-2`. The issue's collision path
  (`rounds/proto-workspace-page-2`) did not follow the dated naming rule.
- The axis is only where the actions are. The page's organisation (cards in
  attention order, waiting lines, Valmiit and Arkisto folded) is the same in all
  directions, because it is already the implemented, accepted structure, and a
  second axis would make the comparison unreadable.
- The head stays on the page, as in production, not in the top bar as in the
  first round.
- `+` stays an accent icon button in the head in every direction, so that only
  the actions differ.
- Hiding uses the Hetki alhaalla notice with Kumoa, and the hidden state stays
  visible on the page.
- Review level: focused self-review of the prototype HTML/JS/CSS with synthetic
  content. No architecture sketch was written, because no authority, credential
  or Unix-user question arises, so no independent `/llm-review` was run.
- Verification: `check.mjs` was run for each direction, in light, dark and
  phone, clicking the Git pill, closing it, archiving a card, hiding the
  workspace and renaming it. The console was clean.
