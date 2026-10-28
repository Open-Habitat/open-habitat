# Result: prototype round 1

Prototype: `prototypes/work-facts/index.html` is one offline file with three
variants behind the picker. [NOTES.md](prototypes/work-facts/NOTES.md) is
Jari's guide in Finnish, and `prototypes/work-facts/evidence/` holds the
screenshots: 47 AVIF images at device scale factor 2, desktop 1440 and phone
390, light and dark, encoded by `check.mjs` with ffmpeg because
`scripts/screenshots-to-avif.py` does not exist yet. The page is hand-written
(`round.js`, `round.css`). `surface.css` is the production frame from
proto-ended-worker-lifecycle round 3, and `build.mjs` inlines it with tokens,
fonts and the picker. The page contains no production components. To rebuild
and check it:

```
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright node issues/proto-worker-row-work-facts/prototypes/work-facts/check.mjs
```

The check passes 12 variant × width × theme cases. It verifies:

- the same facts in every accessible name;
- that "nothing yet" and "unknown" read differently;
- that a merged row shows no facts;
- that the row keeps its height while the worker progresses;
- the PR link;
- the worker view in each form;
- the rail's worktree rows;
- that a missing gh login gives one note and no PR claims;
- no sideways overflow, the picker contract, and no console errors or network.

## The axis: how the row speaks the work facts

The research report's idea 5 (`issues/research-workmux-sidebar/report.md`):
the row should say whether a worker has produced anything before it is opened.
All three variants show the same facts in the same three production places:

- the Workers panel above the composer (`BackgroundStrip.tsx` `spinRow`);
- the rail's worktree conversations (`Navigation.tsx` `AgentNavItem`);
- the worker view (`Spinoffs.tsx` `WorkerView`).

| # | Variant | Row | Worker view | Right when | Cost |
| --- | --- | --- | --- | --- | --- |
| 1 | Lause | Words on the existing second line, right after the state word: "2 committia · 3 muutosta", "PR #412 luonnos tarkistukset käynnissä", "ei vielä muutoksia". The rail gets a short detail line ("2 committia · 1 muutos · #409 läpi"). | The full sentence in the band and an *Avaa PR* link. | The panel keeps the Rivi rule (Jari 27.10.2026): the second line says in words what the row means, so no legend is needed. | The second line fills. On a phone it wraps to three lines by whole clauses. The PR cannot be a link on the row, because the row is one button. |
| 2 | Luvut | The conversation Git chip's marks at the row's end: ↑ ahead, ↓ behind, ● changed files, +/− lines, and a PR tag with a ✓, ✗ or spinning mark. Zero counts are hidden, as on the chip. | A chip in the band; its layer lists files and checks. | Density and one shared visual language with the top bar chip (`GitStatus.tsx`). The PR tag is its own control. | The marks need reading. On a phone, ↓ and the PR number are hidden and names truncate. "Nothing yet" is an empty space, not words. |
| 3 | Työrivi | A third line with a five-cell diff bar, +/− lines, "2 committia · 3 muutosta · main edennyt 5", and a PR pill that counts the checks ("1/4 epäonnistui"). The rail shows the bar, the lines and the PR mark only. | A Työ card at the top of the history, with files and every check. | Everything is visible at once, and a failing check stands out. | Each row is about a third taller, so fewer workers fit in the panel's max height. |

## Host facts each variant needs

| Fact | Exists? | Where | Needed by |
| --- | --- | --- | --- |
| Worktree-place Git summary (branch, dirty_count, ahead/behind, base, merged) | **Yes** | `contracts/v1/snapshot.schema.json` `worktreePlace.git_summary`; `internal/daemon/worktree_places_linux.go:279` `placeGitSummary`; `internal/daemon/workspace_git_linux.go:36` `gitSummaryAt` | All three, for the rail. This part is web-only: `AgentNavModel.worktree` (`web/src/components/Navigation.tsx:436`) carries only `merged` today. |
| The same summary for a Taskfleet worker's worktree, against `source_branch` | **No** | Spinoff runs carry `branch`, `worktree`, `source_branch` only (`contracts/v1/spinoffs.schema.json`). Taskfleet worktrees are left out of the snapshot (`snapshot.schema.json` `worktrees` description). Runs are served by `serveSpinoffs` (`internal/daemon/spinoffs_linux.go:198`). | All three. The run needs a `git_summary`, read with `gitSummaryAt` and `readPlaceBase`, with the run's `source_branch` as base. |
| Added and removed lines of the worker's whole work (merge base → working tree) | **No** | `gitSummary` has no line counts. Numstat exists only in the on-demand compare against `HEAD`, which covers uncommitted changes only (`internal/daemon/workspace_git_compare_linux.go:248` `addGitLineCounts`). | 2 and 3 on every row. 1 needs it only in the worker view. |
| Per-file list for the worker | **Partly** | `GitDetailFacts.files` (`web/src/components/GitStatus.tsx`) is read per workspace or place ID. A Taskfleet worktree has no place ID. | The layer in 2 and the card in 3 (and the recommended combination). |
| Pull request and its checks for the branch | **No** | Nothing reads PRs. `internal/nativegh/native.go` runs the person's `gh` only for credential state. `git_summary.github_repo` gives the repository. | All three when a PR exists. The daemon, as the person, would run `gh pr list --repo <github_repo> --head <branch> --state all --json number,state,isDraft,statusCheckRollup --limit 1`. |
| Whether gh can answer | **Yes** | The nativegh observation in the snapshot (`internal/daemon/snapshot_linux.go:51`, `:59`) | All three, for the "PR-tiedot puuttuvat" note. |

None of this moves authority. The daemon already reads the person's worktrees
as the person, and a PR read would use the person's own `gh` credentials,
which `nativegh` already observes. There is no new credential store and no
cache. The cost of PR facts is one GitHub request per listed worker branch on
each spinoffs read. That is a product question, not a boundary question.

## Recommendation

Use **1 Lause** in the panel and the rail, and give the worker view **3
Työrivi's Työ card**.

- Lause keeps the panel's agreed anatomy: two lines, with the second line in
  words and no legend.
- It says "ei vielä muutoksia" out loud, which is the fact this idea exists for.
- On rows it needs only the commit and change counts, plus the PR when gh can
  answer. Line counts and the file list are then needed only in the worker view,
  where the person decides what to do with the work.
- Luvut is the better choice only if density beats readability. Työrivi costs
  too much panel height for a list that is opened to glance at.

The implementation would be a later issue. Its parts:

1. `git_summary` on spinoff runs, against `source_branch`.
2. The rail reads the place summary it already receives.
3. A PR read through the person's `gh`, if Jari wants PR facts.
4. A place-like Git read for the worker's worktree for the Työ card.

## Decisions for later review

- **Comparison base:** the run's `source_branch`, not an upstream. A worker
  branch has no upstream. The alternative would compare against `main`. Why: a
  run started from another branch would then look further ahead than it is.
- **Line counts:** these cover everything the worker produced, committed or
  not (merge base → working tree). The alternatives are committed only, or
  uncommitted only (the existing compare). Why: the question is "has it
  produced anything", and an unfinished worker has often not committed yet.
- **Nothing yet:** Lause and Työrivi say "ei vielä muutoksia". Luvut shows
  nothing, as the Git chip does for zeros. Why: each follows its own model, and
  the difference is part of what Jari compares.
- **Merged rows show no work facts.** The alternative is to show the merged
  PR number. Why: the branch may already be gone, and the work is in the
  source branch. The state word "laskeutui" already says so.
- **A missing gh login gives one panel note** instead of a per-row "PR ?". Why:
  the cause is one thing for every row, and a per-row mark would read as
  "something wrong with this worker".
- **PR facts come from GitHub only.** Gitea and GitLab are left out for now.
  Why: `github_repo` is the only forge identity in `gitSummary`.
- **Lause has no PR link on the row,** because the row is one button
  (`BackgroundStrip.tsx` `ah-bg-main`) and a link nested inside it is invalid.
  The PR opens from the worker view. The rail is a link for the same reason, so
  its PR marks are not controls in any variant.
- **Wording:** "3 muutosta", as the home page's worktree card already says it
  (`HomeWorkspaces.tsx` `WorktreeCardLine`). The alternative was "3
  commitoimatta". The accessible sentence and the worker view keep the exact
  form ("3 tiedostoa commitoimatta").
- **Phone:** Lause wraps its second line by whole clauses. Luvut drops ↓ and
  the PR number. Työrivi's rail line drops the words.
- **Rail facts only on worktree conversations,** not on conversations in a main
  checkout. The top bar chip already covers those. Why: the idea is about
  separate pieces of work.
- **Freshness:** the facts refresh with the existing spinoffs read and
  snapshot. There is no new watcher or cache. *Worker etenee* only stands in
  for the next read.

## Questions for Jari

1. Which variant, or the recommended combination?
2. Are PR and checks worth one GitHub request per worker through the person's
   own gh? Without them every variant still works on Git facts alone.
