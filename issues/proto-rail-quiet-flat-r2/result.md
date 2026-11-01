# Result: a collapsible, sortable Hiljaiset with workspace icons

Prototype: `prototypes/hiljaiset-r2.html`, one offline page built from
`prototypes/page.src.html` by `python3 prototypes/build.py`. It reuses round
1's page, state machine and picker. Jari's Finnish guide is
`prototypes/NOTES.md`. The screenshots are in `prototypes/kuvat/` (device
scale factor 2, AVIF). They were made by `prototypes/shots.mjs`, which also
clicks every control and event in every view (desktop, phone, dark without
icons with Paljon, narrow rail). The console stayed clean.

The default view has icons on and the brief's person: **5 workspaces and 22
conversations**, 17 of them in Hiljaiset. *Paljon* (10 workspaces, 50
conversations, 45 in Hiljaiset) is there for comparison. The top of the page
names in one line per direction what differs, and every difference is
visible on the default view without a toggle.

## Axis: how Hiljaiset is reorganized, and where the control sits

| | Direction | What differs on the default view | Stored where |
|---|---|---|---|
| – | **Kierros 1** (baseline) | One list, newest first, no fold, no sort | nothing |
| 1 | **Valikko otsikossa** | A quiet *Uusin ensin ⌄* button at the end of the header; its menu offers Uusin ensin, Työtilan mukaan (workspaces alphabetical, a thin line between them, no headers), Nimen mukaan. The list stays one list. | sort: account; fold: device |
| 2 | **Työtiloittain** | Light workspace groups by default (icon, name, count), each foldable, alphabetical like Työtilat; a two-way switch under the header, Työtiloittain or Uusin ensin. | switch: account; section and group folds: device |
| 3 | **Työtilapiirit** | A row of workspace icon chips under the header (Kaikki, oh, hb …); a chip narrows the list to one workspace. No sort: always newest first. | filter: tab only; fold: device |

Common to 1–3: the Hiljaiset header is the fold toggle (the chevron of
production's Arkistoidut), the fold is remembered per device, and when the
section, a group or a filter hides the open conversation, its row alone
stays visible. Sinun vuorosi, Käynnissä and the narrow rail are round 1's.

The state graph on the page is the **section's** state on this device (for
example Uusin ensin, Työtilan mukaan, Taitettu), with *Lataa sivu
uudelleen* and *Vaihda laitetta* as events. The Työpöytä/Puhelin toggle is
two devices with their own browser storage, so it shows what follows the
person and what stays on the device.

### What the default view measures (desktop rail, 800 px tall)

| | Työtilat starts at |
|---|---|
| Kierros 1 | 806 px: one rail height of scrolling with only five workspaces |
| 1 | 806 px (the button does not take a row) |
| 2 | 966 px (five group headers and the switch); 770 px with two groups folded |
| 3 | 838 px (one row of chips); a chip leaves 4 rows and Työtilat at about 470 px |

With Paljon, 2 has ten groups and 3 needs two rows of chips on the phone.

### Costs

- **1**: the other choices are hidden in a menu, and the sort needs a new
  account preference.
- **2**: brings back workspace headers, which round 1 removed at Jari's
  request, as the default. Three things are remembered in two places. A
  folded group does not show that something new arrived there (a new reply
  still rises to Sinun vuorosi).
- **3**: does not do what was asked (sorting). It overlaps the workspace
  page, which already lists one workspace's conversations. The filter is
  forgotten on reload, and a chip shows only the icon; the name is in the
  tooltip, which a phone does not have.

## Host facts

What exists today:

| Store | Where | Used for |
|---|---|---|
| Account preferences | `~/.config/open-habitat/preferences.json`, written by the daemon (`internal/daemon/account_preferences_linux.go`), contract `contracts/v1/account-preferences.schema.json`: `engine`, `language`, `recent_count`, `experimental` | follows the person to every device |
| Browser storage | `localStorage`: `nah:theme`, `nah:agent-work` (Näytä agentin työ), `nah:language`, `oh.terminal.height`, `oh.icon-suggestions.*` | per device |
| Component state | the Arkistoidut workspaces fold in `Navigation.tsx` (`ArchivedWorkspaces`) | forgotten on reload |
| Workspace icons | experimental feature `workspace-icons` (account preferences `experimental`), the icon from the repository's `.open-habitat.yaml` or logo, else derived letters and hue (`web/src/app/workspaceIcons.ts`) | this round assumes icons on |

What each direction needs:

- **Fold (1–3)**: one `localStorage` key, for example `nah:quiet-folded`,
  like `nah:agent-work`. No host change. Per device because a phone and a
  desktop have different room.
- **Sort (1)**: a new account preference, for example `quiet_sort` with
  `new | workspace | name`: a `$defs` enum, one more `write` branch and a
  `result` field in the account-preferences contract, the daemon's merge and
  validation, and the generated contracts. It replaces `recent_count`, which
  round 1 already removes.
- **Switch (2)**: the same preference with two values, plus the folded
  groups as a list of `workspace_id`s in `localStorage`.
- **Filter (3)**: nothing stored.

Nothing needs a new store, service or daemon endpoint.

## Recommendation

**Direction 1.** Its default is exactly Jari's flat list from round 1, the
only new thing in view is one quiet button, and *Työtilan mukaan* gives the
by-workspace view when it is needed without bringing back headers. It costs
one account-preference field in place of the `recent_count` that goes away.
If the five-workspace person mostly works by workspace, direction 2 is the
alternative; direction 3 I would not take, because it duplicates the
workspace page.

## Questions for Jari

1. Which direction: 1 (menu, one list), 2 (workspace groups) or 3 (chips)?
   I recommend 1.
2. Should the sort follow you to every device (account preference, as
   recommended) or stay on each device like the fold?
3. When Hiljaiset is folded, should the open conversation still show as a
   lone row under the header (as prototyped), or should the fold hide it
   too?

## Decisions for later review

- Groups (2) and *Työtilan mukaan* (1) order workspaces alphabetically, as
  Työtilat does, not by latest activity, so a workspace is always in the
  same place.
- The fold is open by default on every device.
- Inside a workspace group the rows drop the icon, since the group header
  carries it.

No production code was changed.
