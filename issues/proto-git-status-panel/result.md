**Prototype:** https://glasspad.example.test/p/srjt5my3fyqncv7dcc4uebt5rm/
(1–3 switch direction, R replays the turn; the hosted page's CSP blocks the
embedded fonts.)

Round `design-system/prototypes/rounds/2026-10-17-git-tila/`, built with
`node design-system/prototypes/build.mjs design-system/prototypes/rounds/2026-10-17-git-tila`.

## Axis

Where Git status lives in the conversation view, how much it says at rest and
what the details look like. Every direction shows the same facts:

- branch `status-rivit` in `aurinkokello`
- its tracking branch `origin/status-rivit`: 2 commits not pushed, 1 incoming
- its base branch `main` (`origin/main`): 5 commits ahead, 3 behind
- four changed files with line counts
- last fetch 25 minutes ago

Hae etärepo fetches one new commit into `main`. When the agent's turn ends,
the state is read again, and the file Pi edited glows with its new line counts.

## Directions

| # | Direction | Where and how much | Details | When it's the right choice | Cost |
|---|---|---|---|---|---|
| 1 | **Yläpalkissa** | A chip next to the model in the top bar: `⑂ status-rivit ↑2 ↓1 ●4`. On a phone the branch name is dropped. | Anchored popover (bottom sheet on a phone). The tracking and base branches are rows with ↑/↓ counts; their commits are folded. Changed files and fetch age come last. | Git is a property of the conversation, like the model, and stays out of the reading area. | On a phone the top bar is already full, and the title shrinks to "St…". |
| 2 | **Kentän yllä** | A badge among the background-work badges (Merkit) above the composer, with the same anatomy as the chip. It pulses when the turn ends and the state is read again. | The same floating panel as background work, with tabs: Muutokset (files) and Commitit (tracking branch open, base branch folded). | Git changes are the agent's work output, so they belong where you watch it work and next to where you write the next instruction. | The composer area holds more. Git status and background work could read as the same kind of thing. |
| 3 | **Haararivi** | A thin full-width line under the top bar that spells everything out: branch, ↑↓ against `origin/…`, "main: 5 edellä, 3 jäljessä", 4 muutosta, haettu 25 min sitten. On a phone it shows only branch, ↑↓ and the change count. | A side panel (full screen on a phone) with everything open: commits under both comparisons, files with +/− bars and totals, and Hae etärepo as the primary action at the top. | You want the base-branch comparison and fetch freshness visible without clicking, and space for a richer view. | It costs one permanent row of vertical space in every Git conversation. |

Same in every direction: ↑ means not pushed or ahead, and ↓ means incoming or
behind. Incoming commit hashes use the accent colour. The fetch age is always
in the details, with a note that incoming commits are only as fresh as the last
fetch. **Lue uudelleen** reads the state from disk again and never touches the
network. **Hae etärepo** runs `git fetch` as the user.

## Host facts the views assume

Already available: `GET /api/v1/workspaces/git` has the branch, upstream,
ahead/behind counts, files with their XY status, the last 8 commits with
`pushed`, and `fetched_at` (the FETCH_HEAD mtime). The snapshot's `git_summary`
has the branch and the change count.

New (the views don't work without these):

1. **Base-branch comparison.** Which branch is the base: `origin/HEAD`, the
   GitHub default branch or a Taskfleet worktree's source branch? Also needed:
   left/right counts against it (`rev-list --left-right --count HEAD...origin/main`).
2. **Commits by name for each comparison:** `@{u}..HEAD` (not pushed),
   `HEAD..@{u}` (incoming) and the same pair against the base, each with a
   limit. Today only the last 8 commits come, with a pushed flag; incoming
   commits are not listed at all.
3. **Line counts per file** (`git diff --numstat HEAD` plus line counts for
   untracked files). Today there are only statuses.
4. **When the state is read again:** at least when a turn ends, and in
   direction 2 also after a file tool. A light `git_summary` update needs
   ahead/behind as well, so that the chip can be drawn without opening the
   details. Today the snapshot does not carry ↑↓.
5. **Hae etärepo** is a new mutation: the daemon runs `git fetch` as the user
   with that user's own credentials. This changes the current rule that the Git
   layer "never fetches". Deletion already fetches (ADR 0019), so there is a
   precedent, but this is an authority decision (question 2).
6. A conversation in a linked worktree (a spinoff) shows its own worktree's
   branch, because the agent's working directory decides which branch is shown.

Proposed library change: none. Everything is a round-local override
(`APP.actions` for the chip, and an `APP.painted` hook that adds the badge to
the strip and the line under the top bar).

## Questions for Jari

1. **Which direction?** I recommend **Kentän yllä**. Git changes are the
   agent's output, and the badge sits where you look while the agent works and
   while you write the next instruction. The background-work panel already
   teaches you how to open and close a panel, and the top bar stays readable on
   a phone, where Yläpalkissa squeezes the title to almost nothing. If you want
   the base comparison always visible, Haararivi is the alternative; its line
   costs one row.
2. **May the daemon fetch on request?** I recommend yes, as an explicit button
   only (no background polling), run as the user with their native
   credentials. Without it, "how much is coming from the remote" is only as
   true as the last time you fetched in a terminal.
3. **What is the base branch?** I recommend the remote's default branch
   (`origin/HEAD`) for an ordinary clone, and the branch the worktree was made
   from for a Taskfleet worktree. Hide the row when neither can be confirmed.
4. Should the chip/badge show at all when everything is clean and in sync
   (↑0 ↓0, no changes), or shrink to just the branch name? The prototype shows
   zeros in a faint colour.
