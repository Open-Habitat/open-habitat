# Result: worktree cleanup and forced removal

ADR 0025's cleanup half is implemented. The daemon lists every linked worktree
of the person's Git workspaces from Git's own registry, with its Git state, on
the workspace page (a **Worktreet** section, shown when the repository has
any) and in Asetukset › Tallennustila (all workspaces, above the Trash), and
removes them as the person asks with the Trash's safety rules.
`docs/architecture/workspaces.md` ("Worktree cleanup") describes the
behaviour and `docs/architecture/http-api.md` the route.

## What changed

- **Daemon** (`internal/daemon/workspace_worktrees_linux.go`): actions
  `worktree_list`, `worktree_remove` (`remove`, `commit`, `force`, `prune`)
  and `worktree_clean_merged` on `POST /api/v1/workspaces`. The checkout is
  pinned by descriptor below home without following symlinks or crossing a
  mount, must point back to its registry entry (its `.git` file, compared by
  inode), and is removed with the Trash's descriptor walk (`.git` last), then
  its registry entry alone. Blockers: live managed Pi child in or below it
  (the fence's `liveIn` now matches subdirectories, which also tightens
  workspace deletion), another process of the person inside, a mount, a
  registered worktree inside it, any other Git repository below it (a
  submodule, an embedded clone, another repository's worktree), a Taskfleet run that owns it and has not
  ended, an unreadable Taskfleet reply, a checkout outside home; locked and
  unknown worktrees offer nothing. The row's observation token hashes every
  fact shown, blockers included, and is recomputed under the fence just
  before acting. A merged branch is deleted in one `update-ref --stdin` transaction
  that verifies the base commit and deletes the observed tip, after checking
  that no checkout uses it.
  `porcelainCounts` is now shared with the deletion check; `walkRemove` gained
  a keep-one-name variant.
- **Contract** `contracts/v1/workspace-worktrees.schema.json`, two examples,
  four negative checks, regenerated packages.
- **Browser**: `web/src/app/workspaceWorktrees.ts` (validated client, command
  `workspace.worktree`, confirmed class), `WorktreeCleanup.tsx` (container),
  `components/WorktreeList.tsx` (rows, removal dialog with the typed name for
  force, *Siivoa kaikki yhdistetyt* dialog), `worktreeText.ts`. The workspace
  deletion blocker for a linked worktree now points to the Worktreet list.
- **Lab host**: `/fixture/worktrees` makes worktrees of `aurinkokello` in each
  state and a live synthetic Taskfleet run owning one.

## Evidence

- `go test ./internal/daemon` (whole package, 53 s) passes; the new
  `workspace_worktrees_linux_test.go` covers each state's listing, each
  removal (merged with branch deletion, unmerged keeping the branch, save to
  branch with untracked files, force with wrong and right name, prune,
  locked), the live-run guard for every Taskfleet status and an unreadable
  reply, a live Pi child in a subdirectory, a real process in `/proc`, a
  nested worktree, changes after the listing (file, new commit, symlink swap,
  impostor `.git`), compare-and-delete when the branch moves after the last
  check, and *Siivoa kaikki yhdistetyt* refusing a changed merged set while
  ignoring changes to unmerged rows.
- `./scripts/test-focused.sh --area contracts` and `--area web` pass
  (`workspaceWorktrees.test.ts`, `WorktreeList.test.tsx` new).
- Lab browser specs `lab-worktree-cleanup.spec.ts` (new: list, prune, remove,
  save, force, Tallennustila clean merged, axe), `lab-workspace-trash.spec.ts`
  and `lab-workspace-page.spec.ts` pass. Screenshots:
  `screenshots/workspace-desktop.png`, `save-dialog.png`, `force-dialog.png`,
  `storage-phone.png`.

Review: one independent `/llm-review` of the final diff (finder
gpt-6-astra, verifier claude-fable-5-1) and `/assess-findings`. Five
defects were confirmed and fixed with tests: nested repositories below a
checkout were removed with it (a commit to the branch would have kept only a
gitlink); ignored files were not part of the observation token; branch
deletion now verifies the base in the same `update-ref --stdin` transaction;
a live Taskfleet run that names no worktree now blocks as unknown; an
unreadable registry entry no longer invalidates the whole listing. The
verifier refuted all of these against the fixed code. One candidate was
dropped (below). The model-performance log could not be written (SSH from
alder to itself refused, the known `assess-models-alder-self-ssh` issue).

Limits: all of this is same-UID on synthetic homes. The live check on the test
server, with real Taskfleet leftovers and a real Taskfleet binary, is the
KOKEILTAVAA list. No mount-below-worktree case runs in Go (the mount check is
the deletion check's, tested there).

## Decisions for later review

- **Failed Taskfleet runs do not block.** The ADR says a Taskfleet-owned
  worktree blocks unless the run is merged or cancelled; the issue says never
  remove one a *live* run owns. Most leftovers are of `failed` runs, which are
  terminal, so `done`, `cancelled` and `failed` release the worktree and
  `pending`, `running` or any other status blocks. A failed run's uncommitted
  work still needs *Tallenna ja poista* or a typed forced removal, and its
  branch is kept. Alternative: block `failed` too, which leaves those
  leftovers to the terminal.
- **Commit hooks and signing are off** for *Tallenna muutokset haaraan ja
  poista* (`core.hooksPath=/dev/null`, `--no-verify`, `--no-gpg-sign`). The
  commit exists only to keep the work; a failing lint hook or a signing prompt
  would otherwise make saving impossible. Message: "Tallennettu ennen
  worktreen poistoa (open-habitat)". A missing Git identity refuses with
  `commit_failed` and removes nothing.
- **Detached HEAD**: a clean detached worktree whose commit no ref contains
  offers only forced removal; a dirty detached one offers only force, since
  there is no branch to save to.
- **Prune removes only that entry** (`$GIT_DIR/worktrees/<id>`), not every
  stale one as `git worktree prune` would.
- **Checkouts outside home** are listed with an `outside_home` blocker and
  never removed; the daemon acts only on its own home, as the ADR says.
- **Listing scope**: the workspace page lists only main checkouts' registries
  (a linked-worktree workspace shows nothing of its own); Tallennustila lists
  all. The workspace page hides the section when there are none.
- **Blockers are part of the observation token**, so a row shown blocked is
  not acted on by a later click even if the blocker has gone; the person sees
  the fresh list instead.
- **The merged fact is computed here**, not taken from the top-bar Git status
  (`implement-git-status-topbar` had not landed). Rule: the branch's local
  upstream, else the main checkout's branch; squash merges count as not
  merged, so their branches are kept.
- **Process scan only at removal**, not in the listing, to keep the listing
  cheap; a process found then is a blocked reply that names it.
- **Assume-unchanged edits are not detected**, as `git worktree remove`
  does not detect them: Git status and `git add --all` both skip such
  files, so remove and save-and-remove lose their edits. The review verifier
  reproduced this on git 2.53. A `git ls-files -v` scan would misfire on
  sparse checkouts (skip-worktree) and exceed output bounds in large
  repositories; a person who set the flag asked Git to ignore the file.
- **Any `.git` below the checkout blocks removal**, including one inside an
  ignored `node_modules`; such a worktree is removed from the terminal.
- Not done here: whether a removed worktree's conversations stay listed under
  the workspace (left to `implement-worktree-agents`).
