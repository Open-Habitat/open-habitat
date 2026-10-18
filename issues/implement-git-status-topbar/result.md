# Result: Git status in the top bar (Yläpalkissa)

## What changed

**Host (daemon, gateway, contract).** The daemon reads more Git natively as the
user, with bounded commands and no store:

- One `git status --porcelain=v2 --branch -z` now gives the branch, the
  upstream with Git's own ahead/behind and the changed paths, for both the
  snapshot summary and the details (`internal/daemon/workspace_git_compare_linux.go`).
- **Base branch** (rule recorded in `docs/architecture/workspaces.md` and the
  code): the source branch recorded in `branch.<name>.workmux-base`, else
  `refs/remotes/origin/HEAD` (set by `git clone` and, since Git 2.48, by
  `git fetch` from the remote's default branch, so for a GitHub clone it is
  GitHub's default branch), else none. A base equal to the branch or its own
  upstream is left out. `merged` = HEAD is an ancestor of the base.
- The snapshot's `git_summary` gains `upstream`, `ahead`, `behind` and `base`
  (`common.schema.json#/$defs/gitBase`: name, ref, source, ahead, behind,
  merged), so the chip and later the worktree-agent marks need no extra read.
- `GET /api/v1/workspaces/git` gains per-file `added`/`deleted` (numstat
  against HEAD; untracked text files counted through the pinned descriptor,
  binary or >1 MiB left without counts), `unpushed_commits`,
  `incoming_commits`, `base`, `base_ahead_commits`, `base_behind_commits`
  (newest first, ≤ 20 each; the counts stay the totals).
- **Hae etärepo**: `POST /api/v1/workspaces/git/fetch` `{workspace_id}`. The
  gateway requires session, Origin and CSRF; the daemon runs `git fetch -- <remote>`
  (the branch's upstream remote, else `origin`, else the only remote) as the
  user with the user's own config and credentials, automatic maintenance off,
  45 s bound (inside the gateway's 60 s proxy ceiling), one fetch per workspace
  at a time, and answers with the observation read again. Failures are
  classified from Git's stderr into fixed codes (`remote_ssh_unavailable`,
  `remote_auth_unavailable`, `remote_unreachable`, `remote_not_found`,
  `fetch_timeout`, `no_remote`, `fetch_in_progress`, `fetch_failed`); the text
  never leaves the daemon.

**Browser.** `web/src/components/GitStatus.tsx` holds the chip
(`GitStatusChip`, an inline pill `⑂ branch ↑a ↓b ● n`, the branch name hidden
on a phone) and the details (`GitStatusDetails`): tracking-branch and
base-branch rows with ↑/↓, folded commit lists by name, changed files with
+/− counts, fetch age and the note that incoming commits are only as fresh as
the last fetch, *Hae etärepo* and *Lue uudelleen*. Desktop: anchored popover;
phone: bottom sheet. `web/src/app/ConversationGitStatus.tsx` has
`useGitStatus` (snapshot summary until a newer on-demand reading; reads on
open, on turn end, on *Lue uudelleen*; never polled) and puts the chip in the
conversation top bar before the model chip. The workspace page's Git layer now
shows the same details (embedded) instead of its own list. Hae etärepo is
`workspace.git_fetch` in the mutation layer (confirmed class).

**Lab.** `aurinkokello` is now a clone of a bare repository in the synthetic
home in the prototype's exact state (status-rivit ↑2 ↓1 against
origin/status-rivit, main 5 ahead / 3 behind via origin/HEAD, four changes,
fetch 25 min ago), with one commit on the remote's main that the last fetch has
not seen, so Hae etärepo really fetches. `web/lab/capture-git-status.mjs`
captures lab and prototype in the same states.

## Evidence

- Go: `go test ./internal/daemon/ ./internal/gateway/` pass. New host tests:
  `TestWorkspaceGitBaseAndCommitLists` (origin/HEAD base, recorded base wins,
  merged after a fast-forward, invalid record ignored, base equal to upstream
  omitted, no base without a record or origin/HEAD, commit lists by name,
  numstat and untracked/binary line counts), `TestWorkspaceGitFetchRunsAsUserAndClassifiesFailures`
  (real fetch from a bare repository: incoming commit named, HEAD unmoved,
  strict body, missing remote → `remote_not_found` without leaking the path,
  `no_remote`, untrusted peer), `TestFetchFailureClassification`,
  `TestWorkspaceGitFetchRequiresSessionAndCSRF` (gateway).
- Contracts: `validate_contracts.py` (new negative case: unknown base source),
  generated packages regenerated.
- Web: `./scripts/test-focused.sh --area web` pass; new `GitStatus.test.tsx`
  and fetch cases in `workspaceGit.test.ts`.
- Browser: new `web/tests/lab-git-status.spec.ts` (@git-status @a11y, 1440 and
  390 px: chip name, details, axe on the open layer, real Hae etärepo, focus
  back on the chip after Escape). Whole lab suite 48/48 passed; normal browser
  suite 240 passed, 3 skipped, 1 failed: `account-settings.spec.ts` "native
  key add, suffix, provider switch and confirmed removal", which fails the
  same way on the base commit f4fd1516 and is the known failure recorded in
  earlier results (unrelated to Git). After the review fixes the web checks,
  `lab-git-status`, `lab-workspace-page`, contracts and the Go daemon and
  gateway packages were run again and pass.
- Review: one independent `/llm-review` (finder gpt-6-astra, verifier
  claude-fable-5-1) of the contract/daemon/web diff and `/assess-findings`.
  Three confirmed findings, all fixed in this branch with regression tests:
  a reading during Hae etärepo left the fetch busy for good; unmerged status
  pairs (AA, DD, AU, DU) were shown as added/deleted instead of a conflict;
  a renamed file's row showed the whole file as added (numstat is now
  rename-aware).
- Screenshots (`evidence/`): lab `desktop-*` and `phone-*` (PNG + inert HTML)
  next to `prototype-*` in the same states: 1 chip, 2 details, 3 commit lists
  open, plus `desktop-4-fetched` after Hae etärepo.

Limits: all evidence is the synthetic lab and same-UID tests; the live server,
an SSH remote without an agent and a GitHub HTTPS remote with `gh` credentials
were not exercised (the SSH classification is tested from Git's real message
texts, not from a live SSH failure).

## Differences from the prototype (same states)

- The base section also has a folded **Edellä main-haaraa** list (the
  prototype's Yläpalkissa showed only *Jäljessä*); worktree agents need "what
  would be merged". When the base is merged it is replaced by "Kaikki commitit
  ovat main-haarassa".
- Files are in Git's path order, not the prototype's hand order.
- Fold counts are small sunken pills; the prototype used bare numbers.
- On a phone the production top bar wraps to two rows (existing layout), so
  the title keeps more room than the prototype's "St…"; the chip sits beside
  the title with the arrows and change count.
- The prototype's "fresh" glow after a turn and the toast are not built; the
  fetch result is a status line in the details instead.

## Decisions for later review

- **Base record key.** `branch.<name>.workmux-base` is the native record
  Taskfleet/workmux already write. `implement-worktree-agents` should write the
  same key when the daemon creates a worktree, so its base is found the same way.
- **Merged** is ancestry only; a squash or rebase-with-rewrite merge shows as
  not merged. A fresh branch with no own commits also reads as merged
  (nothing left to merge).
- **Chip arrows without an upstream** compare against the base (a fresh
  worktree branch has no upstream); the accessible name says which.
- **Fetch scope**: one remote (upstream's, else origin, else the only one),
  tags as Git's default, hooks native, maintenance off, 45 s. No background
  fetch.
- **Linked worktrees** still leave the last-fetch time unknown (FETCH_HEAD is
  in the common directory outside the pinned descriptor).
- The native-history view (`HistoryView`, terminal conversations) does not get
  the chip; only browser conversations do.
