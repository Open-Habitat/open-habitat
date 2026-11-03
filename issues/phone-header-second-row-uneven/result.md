# Result: the conversation header in one row, and what goes in ⋯

## Round 1 (2.11.), decided

Prototype: `prototype/otsakkeen-toinen-rivi.html`, guide `prototype/NOTES.md`,
source `design-system/prototypes/rounds/2026-11-02-otsakkeen-toinen-rivi/`.
Jari chose direction 3, **one row** (3.11.). Two findings from that round
still apply to the implementation:

- **The outlined H↻ box is a disabled action that escaped the phone rule.**
  A disabled `ControlButton` is wrapped in the tooltip's `_disabledTrigger`
  span. The header's `.ah-agent-topline > :is(.ah-retitle, …)` rules use a
  direct-child selector, so they miss the wrapped button. Give the wrapper a
  class, or match it the way `frame.css` does with `:has()`.
- **The model is shown twice only before the first message.** Before that
  message the composer carries `ComposerModelPicker`. Once the conversation
  runs, the header's chip is the only picker. One row therefore moves the
  running conversation's picker into the composer.

## Round 2 (3.11.): the split

Prototype: `prototype-2/otsakkeen-jako.html` (Jari's guide in Finnish:
`prototype-2/NOTES.md`). Source:
`design-system/prototypes/rounds/2026-11-03-otsakkeen-jako/`, the same
machinery as round 1: production markup and CSS captured from the synthetic
lab, with the directions laid over it.

```
OH_PORT_BASE=5934 scripts/lab.sh start && PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-03-otsakkeen-jako/capture.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-03-otsakkeen-jako/shoot.mjs
```

### Inventory: every header item today

Roles: **K** this conversation, **T** its workspace, **A** the agent.

| Item | Role | What it is for | How often it is needed | Phone today | Desktop today |
|---|---|---|---|---|---|
| Title (tap to rename) | K | which conversation this is | every glance | row 1 | row |
| Activity dot (*Odottaa sinua*, working, rests) | K | is the agent doing something; the rail's ball says the same | every glance | row 2 start | row |
| Workspace name (opens the workspace) | T | where this runs; way back to the workspace | now and then (phone has home + rail) | ⋯ | row |
| Git chip (↑ unpushed, ↓ incoming, ● changed; opens Git details) | T | reminder of unpushed or uncommitted work | glance a few times per conversation; matters at the end | row 2 | row |
| Context ring (tokens, %; colours from 70 % and 90 %) | A | how much room the agent has left | glance; matters near full | row 2 | row |
| Model chip (`Opus 5.5 · Medium`; picker in a new conversation, details once running) | A | which model answers | chosen at the start, rarely changed | row 2 (also in composer before the first message) | row |
| Editor toggle (*Editori*) | T | the workspace's editor beside the conversation | many times, for people who edit | row 1 | row |
| Terminal toggle (*Pääte*) | T | the browser shell | many times, for some people | row 1 | row |
| Files toggle (count) | K | files the agent offered | while there are offered files | row 2 | row |
| Guide toggle (*Opas*) | K | the start-page goal's guide | while the conversation has a goal | row 1 | row |
| *Tee tilannekatsaus nyt* | K | one-off: a recap now (recaps are otherwise automatic) | rare | ⋯ | icon |
| *Luo uusi otsikko* | K | one-off: generate the title again | rare | ⋯ (disabled box leaks to row 2) | icon |
| *Nimeä uudelleen* | K | one-off: name by hand (also by tapping the title) | rare | ⋯ | title tap |
| *Arkistoi* / *Sulje* | K | end the conversation | once per conversation | ⋯ | icon |
| *Tiedot* | K | facts: workspace, model, thinking level, control, started | rare | ⋯ | icon |
| *Vain luku* mark | A | the browser does not control this Pi | only while it holds; must be seen | row 2 | row |
| *Yhteys auki* mark | A | the agent has an SSH connection to your machine open | only while it holds; must be seen | row 2 | row |
| Status bell | account | account- or server-wide condition | only while one holds | row 2 | row |
| Worker, spinoff and process chips | K | background work | often while it runs | not in the header: the background strip above the composer, which stays | same |

### Directions

All three are one row on both devices. In all three:

- the one-off actions are in ⋯, on a desktop too;
- the model is only in the composer chip;
- the conditional marks (*Vain luku*, *Yhteys auki*, the bell) stay in the
  row;
- the disabled-wrapper box is gone.

⋯ is grouped by role into **Keskustelu**, **Työtila ‹name›** and
**Agentti**, and it lists only what the row does not show. The desktop
applies the same split and keeps the workspace name, since it has room.

| | Direction | Phone row (390) | ⋯ adds | Title at 390 / 360, running |
|---|---|---|---|---|
| 1 | **Työkalut esillä** (by frequency) | ● title · editor · terminal · ⋯ | Git, context | 124 / 94 px |
| 2 | **Tila esillä** (one sign per role) | ● title · Git ↑2 · ring · ⋯ | editor, terminal; full Git and context values | 124 / 94 px |
| 3 | **Pelkkä otsikko** (minimal) | ● title · ⋯ | Git, context, editor, terminal | 209 / 186 px |

`shoot.mjs` checked 48 views: four views (three directions and today) ×
390/360/1440 × light/dark × new/running. In every direction view:

- the header is one row and every item stays inside it;
- the model shows once and no one-off action is in the row;
- the row holds exactly that direction's items;
- everything else is in ⋯, which starts with Keskustelu, never repeats a
  row item, and closes with Esc.

The console is clean, there are no network requests, and `picker-check`
passes. Header height is 53 px on a phone, compared with 97–105 px today.

### Host facts the view assumes

None new. The Git summary, the context tokens and the panel labels are
already in the header's props and catalogs. A ⋯ row for Git or the context
opens the same layer as the chip did. Production's `Menu` has no group
headings yet, so the implementation adds sections (react-aria `Section` +
`Header`) to it. The group names *Keskustelu*, *Työtila*, *Agentti* and the
value texts (`4 muuttunutta`, `12k tokenia`) would be new catalog entries in
both languages.

## Recommendation

**Direction 2, Tila esillä**: the row says how things stand, and ⋯ holds what
you can do.

- The Git ↑ count and the context ring are what you would miss if they were
  hidden. Nothing tells you to open ⋯ to see that work is unpushed or that
  the context is filling up. The Yläpalkissa decision put Git in the header
  for exactly that reason, and the ring's 70 %/90 % colours only work while
  the ring is visible.
- The panels are the opposite: you go to them when you want them, so one
  more tap costs little. On a phone the editor and terminal take the whole
  screen anyway.
- It gives each role exactly one sign (activity, Git, context), which is the
  role split Jari asked for, and ⋯'s groups mirror it.
- Its title room equals direction 1's. Direction 3's wider title does not
  make up for hiding the two state signs.

## Questions for Jari

1. **Which split: 1, 2 or 3?** I recommend 2.
2. **Should the desktop follow the same split**, or keep the panels (and the
   files and guide) in the row as well, since it has room? I recommend
   keeping the panels in the desktop row. Only the phone's 280 px forces the
   choice.
3. In direction 2, should the phone show the context ring **always**, or only
   from 70 % as its percentage is today? I recommend always: the row then
   keeps the same shape, and the ring's colour already signals when the
   context needs attention.

No production code was changed.
