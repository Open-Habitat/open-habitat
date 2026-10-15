# Result: workspace page and the "+" layer

Round: `design-system/prototypes/rounds/2026-10-16-tyotilasivu/`. Build it from
`design-system/prototypes/` with:

```
node build.mjs rounds/2026-10-16-tyotilasivu      # → dist/2026-10-16-tyotilasivu.html
```

Keys 1–3 switch direction. The page opens on `aurinkokello`. Clicking a
workspace name in the sidebar, the workspace name in a conversation's top bar,
or "Avaa työtilasivu" in the sidebar's `…` menu opens that workspace's page.

## Starting point

The production page (lab, 16.10.) is a back link, a heading, the directory
name, a folded "Työtilan tiedot" block, an "Aloita uusi Pi-keskustelu" button,
one flat conversation list and a settings form (display name, Piilota). It has
no Git state, no recaps and no worktree work. `design.md` currently promises
only "name, path, starting a new conversation and conversations".

## Axis: how much weight Git gets on the page

All three directions show the same content:

- open conversations in attention order, each with its recap and Seuraavaksi line;
- the worktree-agent group;
- Valmiit and Arkisto folded, with Palauta (restore) in the archive;
- branch, changed files, sync with origin and recent commits.

Every direction also shares the same top bar: the workspace name and path,
plus `+` and `…` on the right.

| # | Direction | What it decides | When it wins | Its cost |
| --- | --- | --- | --- | --- |
| 1 | **Keskustelut edellä** | Git is one pill in the page head (`main · 2 muutosta ↑1`) that opens a Git layer. The body is the home page's recap cards for this workspace | You come here to continue work; it matches the chosen home page, so it costs the least to learn | Git detail is one click away; you cannot see changes and conversations side by side |
| 2 | **Git rinnalla** | Two columns: a compact work list on the left (rows whose disclosure shows the recap) and a sticky Git + Työtila panel on the right. On a phone the panel drops below the list | You review what agents changed while deciding what to answer | Recaps are hidden behind a disclosure; the side panel narrows the work list |
| 3 | **Haaroittain** | The page is organised by checkout. The main checkout is a card with its changes, commits and conversations. Each live worktree is its own card (branch, mode, ↑ commits, path) with its agent. Merged worktrees become rows | Worktree agents are common and you think in branches | The most structure; overkill for a workspace without worktrees |

## The "+" layer (same in every direction)

`+` in the top bar and `+` on a sidebar workspace row both open the same layer.
The sidebar `+` no longer creates a conversation straight away. On a desktop
the layer is anchored to the button; on a phone it is a bottom sheet over a
scrim. Its title is "Uusi työtilassa <name>", with two sections:

- **Tässä hakemistossa:** Keskustelu (Pi · model · thinking level · branch) opens a new empty conversation, as `+` does today.
- **Omassa worktreessa** (Taskfleet creates the branch and the worktree): Interaktiivinen worktree-agentti and Itse mergeävä agentti. Both are entry points only. `proto-worktree-agents` designs what happens after the click, so the prototype just shows a note naming that round.

The keyboard works: arrow keys move, Enter chooses, Esc closes and returns
focus to the button. The `…` menu holds Kopioi polku, Avaa GitHubissa, Muuta
näyttönimeä…, Piilota sivupalkista and Poista työtila (disabled, with the
`recoverable-workspace-deletion` reason). The production settings form
therefore moves off the page into that menu.

## Slot for proto-worktree-agents

The **Worktree-agentit** group (an icon heading with a count) appears in every
direction. In v1 and v2 it sits after Avoimet; in v3 the worktree cards are its
content. Its rows show a status mark, title, mode tag (`mergeää itse`, dashed /
`interaktiivinen`), branch and one status line. The three synthetic rows (one
working self-merging, one waiting interactive, one merged) are placeholders.
`proto-worktree-agents` owns the states, the row content, opening an agent and
the merge outcome, and may replace the group's inner markup freely. When the
group is empty it says how to start an agent from the `+` layer.

## Host facts the view assumes

Existing facts: `git_summary` (branch, dirty_count, github_repo), `kind`,
`git_remote`, `visibility`, agent `title`/`activity`/`archive`, recaps, the Pi
default model, and the archive/unarchive commands.

New facts: the changed-file list, ahead/behind the upstream, the time of the
last fetch, recent commits with their pushed state, each conversation's last
activity time, and the linked-worktree list with its Taskfleet binding.
`architecture.md` says where each one comes from: on-demand native Git reads by
the daemon as the user, with no store, no fetch and no new authority.

## Questions for Jari

1. Which direction? (I would pick 1 for daily use because it matches the home page and keeps the page about the conversations. Choose 3 if worktree agents become the normal way to work.)
2. Should the sidebar `+` open the layer, as prototyped, or stay a one-click new Pi conversation, with the layer only on the page? The layer costs one extra click for the most common action.
3. Should the page show Git actions such as pull or push? The prototype only reads. The commands `workspace.git.integrate` and `.init` exist in the contract, but integrate has no implementation, so I left them out.

## Decisions for later review

- **One axis (Git weight), with the `+` layer kept constant.** The issue names two pieces. Varying the layer at the same time would have mixed two axes in one picker.
- **Settings form moved into `…`.** Display name and hide are rare actions; a form on the page competes with the work. Rename is a small dialog.
- **The sidebar `+` opens the layer.** Once worktree agents and other harnesses exist, a direct-create `+` would need a second entry point. See question 2.
- **No agent choice (Claude/Codex) in the layer.** That belongs to `proto-agent-harnesses`. When that round lands, its choice fits as a row or a third section under Tässä hakemistossa.
- **Read-only Git.** No commit, push or pull buttons. Agents and the terminal own those, and no implemented host command exists for them.
- **An architecture note was written** even though the brief allows skipping it. The page does need host facts that do not exist yet. The note touches no credential, Unix-user or authority boundary, so it got self-review rather than an independent review.
- **Library proposal:** if a direction is chosen, the `+` layer (`.wl` and its sheet mode) and the sidebar `+` override move to `lib/account.js`/`account.css`, replacing the direct-create handler in `lib/app.js`.
