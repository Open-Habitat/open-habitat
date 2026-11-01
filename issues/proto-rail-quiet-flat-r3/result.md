# Result: one Hiljaiset menu that narrows to a workspace and sorts

Prototype: `prototypes/hiljaiset-r3.html`, one offline page built from
`prototypes/page.src.html` by `python3 prototypes/build.py`. It reuses round
2's page, story and state-graph machinery. Jari's Finnish guide is
`prototypes/NOTES.md`. The screenshots in `prototypes/kuvat/` (device scale
factor 2, AVIF) were made by `prototypes/shots.mjs`. The same script clicks
every control and event in every view (desktop, phone, dark without icons
with Paljon, narrow rail), and the console stayed clean.

The default view has icons on, 5 workspaces and 22 conversations (17 in
Hiljaiset), and the menu already open. A card titled *Taitettuna*, beside
the graph, draws the riff's folded section with Hiljaiset's *Verbien
taivutus* open. Every difference, the fold included, is therefore visible
without a toggle. The top of the page names what differs in one line per
riff.

## What spreadsheets taught

In Excel, Google Sheets and Numbers the column-header menu starts with the
sort, which is one click. The value filter is slow: in Excel and Sheets you
clear the checkboxes, tick one value and press OK, and in Numbers *Quick
Filter* is one more menu step. The header then shows that a filter is on
(Excel's funnel, Sheets' green icon). The riffs keep the sort first and
one click. They make a workspace **name** mean "only this" with no OK, and
they make the header show what is active.

## Riffs (axis: the shape of one menu that holds both choices)

| | Riff | Header, menu closed | Menu | Folded |
|---|---|---|---|---|
| – | **Lähtökohta** (round 2 dir. 1) | *Uusin ensin ⌄* | three orders, no workspace | the open row under the header |
| 1 | **Pudotusvalikko** | *Kaikki ⌄*, or the chosen workspace's icon · order | Järjestys (3), then Työtila: Kaikki työtilat + each workspace with icon and count; a choice closes it; a bottom sheet on the phone | only the open row, emphasised |
| 2 | **Kuvakeruudukko** | a stack of three workspace icons, or the chosen one ringed | popover: order as a three-way segment, workspaces as icon tiles with count; applies live and stays open until *Valmis*, Esc or a click outside | the open row and a strip of workspace icons with counts; a tap opens the section narrowed to that workspace |
| 3 | **Sarakeotsikko** | two column marks, sort and funnel, lit when not default (funnel shows how many are chosen) | four orders (adds *Vanhin ensin*), *Näytä kaikki työtilat*, search, workspaces with checkboxes: the name means only this and closes the menu, a checkbox adds or removes one | the open row; the lit marks stay on the header |

Common to 1–3: a choice applies at once, with no OK. The header count
shows the narrowing (*4/17*). When the fold or the narrowing would hide the
open conversation, its row stays visible with an accent bar on the left.
The fold is the section header, as in round 2.

### Measured (desktop rail, 800 px tall)

| | Single action (only this workspace) | Newest first | Menu height, 5 / 10 workspaces |
|---|---|---|---|
| Lähtökohta | not possible | 2 | 144 px |
| 1 | 2 | 2 | 386 / 543 px (phone sheet 465 px) |
| 2 | 2 + close | 2 + close | 248 / about 407 px |
| 3 | 2 | 2 | 399 / 546 px |

Narrowed to open-habitat, Työtilat starts at 442 px instead of 806 px.

### Costs

- **1**: a long menu that covers the top of Hiljaiset on desktop, and only
  one workspace at a time.
- **2**: one action also needs a close step. It leans on the icons:
  without them the tiles and the header stack carry only letters.
- **3**: the richest menu, with small 22 px marks (30 px on the phone)
  that do not say in words what is chosen. Search and multi-select pay off
  only with many workspaces.

## Host facts

- **Order**: an account preference, for example `quiet_sort` with
  `new | ws | name` (3 adds `old`). The contract change is the same shape as
  `recent_count` today: a `$defs` enum, a `write` branch, a `result` field
  in `contracts/v1/account-preferences.schema.json`, the daemon's
  merge in `internal/daemon/account_preferences_linux.go`, and the
  generated contracts. It replaces `recent_count`, which round 1 removes.
- **Workspace (1, 2)**: one more account preference, for example
  `quiet_workspace`, a nullable `common.schema.json#/$defs/workspaceId`.
  Writing it is as easy as the order, so it is stored on the account as the
  brief asked. One extra rule: if the workspace no longer exists, the
  browser treats it as *Kaikki*.
- **Workspaces (3)**: the same field as a list of `workspaceId`s, with
  `maxItems` and the same stale-id rule.
- **Fold**: one `localStorage` key, for example `nah:quiet-folded`, like
  `nah:agent-work`.
- **Icons**: the experimental `workspace-icons` feature, assumed on.

Nothing needs a new store, service or daemon endpoint.

## Recommendation

**Riff 1, with its own folded state.** Every choice is one click from
the open menu, and the closed button says the state in words (*Kaikki*,
or the icon and order), so it also works with icons off. It is the
smallest step from the baseline Jari picked in round 2, and the phone
sheet gives the long list a natural place. Riff 2's folded icon strip is
the one idea worth keeping if Jari wants the folded section to be a
shortcut, and it can be added to 1 without the popover. Riff 3's
multi-select is richer than the stated need (show only this workspace),
and its marks are the hardest to read.

## Questions for Jari

1. Which shape: 1 (dropdown), 2 (icon grid) or 3 (column header)? I
   recommend 1.
2. Folded: only the open row (1), or the open row plus a strip of
   workspace icons that opens the section narrowed to one (2)?
3. The workspace choice follows you to the phone, as the brief asked. Is a
   narrowed list on another device what you want, or should only the
   order follow and the workspace stay on the device?

## Decisions for later review

- Workspaces in the menus are alphabetical, as in Työtilat, and the menus
  list only workspaces that have quiet conversations.
- With nothing narrowed, all of riff 3's checkboxes are ticked, like
  Excel's *(Select All)*. Ticking the last one back clears the narrowing.
- The menu opens over the list rather than pushing it down, as round 2's
  did.

No production code was changed.
