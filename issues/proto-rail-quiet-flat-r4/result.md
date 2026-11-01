# Result: the Hiljaiset icon grid, UI only

Prototype: `prototypes/hiljaiset-r4.html`, one offline page built from
`prototypes/page.src.html` by `python3 prototypes/build.py`. It reuses
round 3's page, styles and world (5 workspaces, 22 conversations, 17 in
Hiljaiset; *Paljon* has 10 and 50) and drops the state graph and events, as
the brief asked. Jari's Finnish guide is `prototypes/NOTES.md`. The
screenshots in `prototypes/kuvat/` (device scale factor 2, AVIF) were made
by `prototypes/shots.mjs`. The same run clicks every control in every
riff (desktop, phone, dark with *Paljon*), and the console stayed clean.

The open conversation is *Verbien taivutus* (deutschpad), a quiet one, so
its row is in Hiljaiset from the first view. Three side cards draw the
section in fixed states: *Ikkuna auki*, *Yksi työtila valittuna* and
*Taitettuna*. Every difference is therefore visible without a click, and
the top of the page names it in one line per riff.

## Riffs (axis: how the icon grid, the section and the open conversation look)

| | Riff | Header, menu closed | Popover | Open row | Folded |
|---|---|---|---|---|---|
| 1 | **Ruudut** (round 3 riff 2, polished) | stack of three workspace icons, or the chosen one | sort segments, 3-column tiles with icon, name, count; *Valmis* | accent bar on the left | open row, then pills of workspace icons with counts |
| 2 | **Nauha** | the order in words (*Uusin ensin ⌄*) | the same as 1 | ringed all round | the band stays under the header, open row below it |
| 3 | **Tiivis** | the choice in words (*Kaikki*, or icon and name) | narrow: orders as a radio list, workspaces as a 6-column icon grid with count badges, the choice named below | bar in the workspace's colour | the icons move onto the header line, open row below |

In riff 2 the band is always under the header, open or folded. One tap
narrows to a workspace and a second tap shows all again. The popover offers
the same choice with names, for when the icons are not enough.

Common to all three:

- With one workspace chosen, the order offers only Uusin and Nimi, never
  *Työtilan mukaan*. A stored *by workspace* order is kept on the account
  and returns when the choice goes back to Kaikki. Meanwhile the list is
  newest first.
- A tap on a folded icon opens the section narrowed to that workspace.
  The open conversation's workspace is marked in the icon row.
- If the narrowing would hide the open conversation, its row stays in
  sight at the end of the list.
- A choice applies at once. The popover stays open until *Valmis*, Esc or
  a click outside, as in round 3's riff 2.

### Measured (desktop rail)

| | Popover, 5 / 10 workspaces | Section header to first row, open |
|---|---|---|
| 1 | 248 / 407 px | 26 px |
| 2 | 248 / 407 px | about 85 px (the band) |
| 3 | 202 (173 with one chosen) / 236 px | 26 px |

### Costs

- **1**: the closed header shows only icons, so the order is visible only
  when it is not the default (a word appears beside the stack).
- **2**: the band takes about 55 px of the rail permanently, and the
  workspace choice exists twice, in the band and in the popover.
- **3**: the icon-only grid leans fully on the icons. Names show only for
  the chosen workspace and as tooltips. The folded header gets crowded with
  many workspaces.

## Host facts

Unchanged from round 3. The order is an account preference (for example
`quiet_sort`: `new | ws | name`), and the workspace is a nullable account
preference (`quiet_workspace`, a `workspaceId`). Both use the same contract
shape as `recent_count` in `contracts/v1/account-preferences.schema.json`
and the daemon's merge. A stale workspace reads as Kaikki. The one new
rule, *no by-workspace order while one workspace is chosen*, is a browser
rule. The stored value is not rewritten, so the contract needs no
cross-field constraint. The fold is a `localStorage` key. Icons assume the
experimental `workspace-icons` feature. Nothing needs a new store, service
or endpoint.

## Recommendation

**Riff 1 · Ruudut.** It is the grid Jari picked, with the closed header
kept quiet. The folded pills give the shortcut he described (the open row
and the icon row) without taking space when the section is open. Riff 2
makes narrowing one tap but pays for it with a permanent band and a
duplicated control. Riff 3 is the smallest and scales best to many
workspaces, but it drops the names Jari can read at a glance.

## Questions for Jari

1. Which look: 1 (tiles), 2 (a permanent band) or 3 (compact)? I recommend
   1.
2. The open row's emphasis: accent bar (1), ring (2) or the workspace's
   colour (3)? The choice is independent of the riff.
3. With one workspace chosen and *by workspace* stored, should choosing a
   workspace keep the stored order for when you return to Kaikki (as here),
   or reset it to Uusin?

No production code was changed.
