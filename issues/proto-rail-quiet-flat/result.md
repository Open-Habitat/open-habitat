# Result: a flat Hiljaiset that lists every conversation

Prototype: `prototypes/hiljaiset.html`, one offline page built from
`prototypes/page.src.html` by `python3 prototypes/build.py`, which inlines the
tokens and fonts. The page machinery, state graph, events and picker come
from `proto-rail-recent-r2`. The picker offers three views: Nykyinen,
1 · Hiljaiset, nimi rivissä, and 2 · Hiljaiset, nimikirjaimet. Every view has
light and dark themes, desktop and phone, the wide or narrow (editor) rail,
workspace icons on or off, and a **Määrä** toggle:

- **Muutama** has 4 workspaces and 14 conversations.
- **Paljon** has 10 workspaces and 50 conversations from a month of work,
  which gives 45 rows in Hiljaiset.

Jari's guide in Finnish is `prototypes/NOTES.md`. The screenshots are in
`prototypes/kuvat/` (device scale factor 2, AVIF), made by
`prototypes/shots.mjs`, which also clicks every event in every view. The
console stayed clean.

## Baseline: main now

Main is unchanged since round 2 (`railNow.ts`, `Navigation.tsx` at
`c93c2e82`). The rail has three sections: Sinun vuorosi, Käynnissä, and
Viimeisimmät. Viimeisimmät lists finished, non-archived conversations
without a `worktree_id`, newest first, cut to `recent_count` (default 5). The
open conversation is appended in italics when it falls outside the cut.
Without icons, Käynnissä and Viimeisimmät group rows under workspace
headers. The narrow rail shows only the first two sections.

## What the prototype shows

The main direction is Jari's, with the defaults recorded in
`rail-quiet-all-flat`:

- **Sections.** Sinun vuorosi and Käynnissä work as now, including the cut
  turn. **Hiljaiset** lists every other non-archived conversation the
  snapshot has, newest `changed_at` first, as one flat list with no
  workspace header rows.
- **Worktree conversations.** The person's own worktree conversations are
  included and keep the worktree or merged glyph. Taskfleet workers never
  reach `agents[]`, so they stay out.
- **No italic row.** The open conversation is always a row in the list,
  however old it is.
- **Count setting removed.** The Ulkoasu settings have no count row.
- **Narrow rail unchanged.**
- **Icons on.** Every row leads with the workspace icon, so the two
  directions look the same.

The axis is the one choice Jari's description leaves open: **how a Hiljaiset
row names its workspace when icons are off.**

| | Direction | Row without icons | Cost |
|---|---|---|---|
| 1 | **Nimi rivissä** (the issue's default) | `● Labin portit … open-habitat 23 pv`: the name in faint UI text before the time, at most a third of the row | Titles shrink to about 15–20 characters on desktop, and long names (`tailspin-monorepo`) are cut too |
| 2 | **Nimikirjaimet** | `[OH] ● Labin portit 23 pv`: the narrow rail's initials in a grey tile where the icon would be | The letters have to be learned (`DE` deutschpad and `DO` dotfiles look alike), and the full name is only in the tooltip, which a phone does not have |

### Costs both directions share

- **A · Length.** With Paljon, Työtilat and its filter start 1638 px down a
  rail that is 800 px tall: two rail heights of scrolling on desktop. On a
  phone it is 2244 px in a 698 px drawer, more than three. Nothing leaves
  Hiljaiset except by archiving. The *Kolmen viikon takainen* story puts its
  target on row 42 of 45.
- **B · Two layouts in one rail.** Without icons, Käynnissä still groups rows
  under workspace headers ("as now") while Hiljaiset right below it is flat.

### What gets better

- The rule is one sentence.
- The open conversation always has a selected row.
- A worktree agent stays visible after it finishes or merges.
- Pi resting, a daemon restart or newer conversations never remove a row;
  they only move it down.

## Host facts it needs

| Fact | Where | Exists? |
|---|---|---|
| Every native conversation in visible places, terminal-run included; Taskfleet places omitted | snapshot `agents[]` (`snapshot_linux.go`), with no count limit | yes |
| Last change | `changed_at` | yes |
| Archive | `archive` | yes |
| Worktree and merged glyph | `agents[].worktree_id`, `worktrees[].git_summary` (`worktreeMerged`) | yes |
| Workspace name and icon for the row | `workspaces[]` display name; icons map (experimental) | yes |

No new host fact or store is needed. On main, the change in `railNow` drops
the worktree exclusion and the cut, renames `recent` to quiet rows, and drops
the `kept` case. `NowSections` renders Hiljaiset flat, without
`RunningGroups`, and adds the row's workspace mark when there are no icons.
Removing the count deletes `recent_count` from the account-preferences
contract, the daemon merge, `RecentSettings` and its settings-search entry,
and `railNow`'s parameter.

## Questions for Jari

1. Without icons, should the row show the workspace **name** at its end (1)
   or **initials** in front (2)? I recommend 1: it can be read without
   learning anything, and it works on a phone. It costs title length, and the
   page lets him judge whether that cost is acceptable.
2. With dozens of conversations, Työtilat sits two or three screens down.
   Is that acceptable for now ("first with all of them there"), or should
   Työtilat move above Hiljaiset, or should Hiljaiset get a later cut or
   fold? The prototype keeps the literal order.
3. Without icons, Käynnissä keeps its workspace headers while Hiljaiset is
   flat. Should Käynnissä (and Sinun vuorosi) use the same in-row name as
   Hiljaiset?

## Decisions for later review

- Hiljaiset rows sort strictly by `changed_at`; the open conversation does
  not jump to the top.
- The name in direction 1 uses the UI font (faint, 11 px), not the
  monospace used by the workspace headers. In monospace at up to 42% of the
  row, titles shrank to about ten characters (seen in the first screenshot
  pass).

No production code was changed.
