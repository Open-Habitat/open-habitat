# Result: workspace icon from the page heading (Otsikko)

Behind the existing *Työtilan kuvake* experimental card. The workspace page's
heading starts with the icon; it is a button that opens the picker
(`WorkspaceIconPicker`, a bottom sheet on a phone): *Automaattinen*, the repo
logo when there is one, *Kirjaintunnus* (1–3 letters, Enter), an emoji grid
and *Oma emoji*. A line under the path says where the icon comes from. A
choice shows in the heading at once and in the rail with the next snapshot;
nothing is announced.

Host: `POST /api/v1/workspaces` gains `action: "icon"` (browser socket only,
not the agent route) under the existing observation token and workspace
lock. The daemon edits the root `.open-habitat.yaml` line by line
(`workspace_icon_write_linux.go`): the one top-level `icon:` line is replaced
or appended, every other line and comment stays, and the result is read back
(other keys unchanged, the icon exactly the one asked) before an atomic
rename; several icon lines, a multi-line value, a non-mapping or a symlinked
file are refused. The edit starts from bytes proved against their stat, and
the replacement is a `RENAME_EXCHANGE` whose displaced file must still be the
one read (else it is put back; a new file uses `RENAME_NOREPLACE`), so
another writer's change is not lost. In a Git checkout the daemon then
commits exactly the bytes it wrote, as the person, with hooks, signing and
fsmonitor off like the worktree save: a private index from the HEAD read
before the write, `commit-tree`, `update-ref HEAD <new> <old>` (refused if
HEAD moved), and the same index entry in the real index, which is what
`git commit --only -- .open-habitat.yaml` would leave. Message `Työtilan
kuvake: 🦔 (open-habitat)`; nothing is pushed; no commit while a merge,
rebase, cherry-pick or revert is under way. The reply's `icon_commit` says
`committed`, `unchanged`, `not_git`, `uncommitted` or `commit_failed`, and a
journal invalidation makes every tab read the new snapshot.

The reader (`workspace_icon_linux.go`) has one flat-format parser
(`parseIconValue`) shared by the reader and the writer: `auto`, a repo image
path, 1–3 letters or digits (A–Z, 0–9, ÅÄÖ, stored upper case) or a short
emoji. The snapshot gains the `letters` icon kind, `icon_auto` and
`icon_logo` (the logo whatever the config says, for the picker; served by the
icon route with `logo=1`, which the gateway admits as one more exact shape).

## Checks

- `go test ./internal/daemon -run 'TestEditIconConfig|TestParseIconValue|TestWorkspaceIcon|TestAgentWorkspaceRouteHasNoIconWrite'`
  (with `TestWorkspaceIconWriteRaces`: a write landing before the rename is
  put back, a config created meanwhile is not replaced, an edited base is not
  committed, the working tree at commit time does not enter the commit, a
  moved HEAD is not overwritten, an unborn branch, no commit mid-merge)
  and `go test ./internal/gateway -run TestWorkspaceIcon`: line edit and
  refusals, the commit holds only the config while staged and unstaged agent
  work stays, a failing pre-commit hook is not run, a dirty config is left
  uncommitted, no Git gives only the file, a symlinked config is not
  followed, `logo=1`.
- `lab-workspace-icon-setting.spec.ts` (real gateway, daemon and lab Git
  repos): emoji, letters and *Automaattinen* on a Git repo with dirty files,
  one new commit and identical working-tree changes afterwards, the logo
  option, a non-Git directory, the phone sheet, axe on the picker.
- `vitest src/app/workspaceIcons.test.ts`, contracts validation and
  generation.

## Decisions for later review

- **Plumbing instead of `git commit --only`** (the brief named `--only`).
  The independent review found that `--only` commits whatever the working
  tree holds when Git reads it, so an agent's edit of the same file between
  the clean check and the commit would be committed silently under the icon
  message. The commit is now built from the exact written bytes on the HEAD
  read before the write; the clean check compares the edited bytes with the
  committed and indexed blob. Alternative: keep `--only` and verify
  `HEAD:.open-habitat.yaml` afterwards, which would only report the foreign
  commit after making it.

- **Automaattinen writes `icon: auto`**, not a removal of the line. The
  suggestions issue made `auto` the permanent "no suggestions"; a picker
  choice of the chain is that same decision. Alternative: delete the line
  (and the file the page created). Removal would bring the suggestions row
  back on the next visit, which the person just declined.
- **A config with changes of its own is written but not committed**
  (`uncommitted`, the page says so in one line). Alternatives: refuse the
  write, or commit those changes too. Committing silently would commit work
  nobody chose; refusing would block a person who edited the file by hand.
- **A failed commit leaves the file written** (`commit_failed`, e.g. no Git
  identity, HEAD moved meanwhile, a merge or rebase under way) and says so. Alternative: roll back the write. The person asked for the icon, and
  the file is the repository's own truth either way.
- **Letters are A–Z, 0–9 and ÅÄÖ, stored upper case**; lower case written by
  hand is read as upper case. Alternative: any Unicode letter. The contract's
  pattern stays checkable by both validators, and the prototype used the
  same set.
- **The logo is offered as its own choice** (`icon: <logo path>`), as the
  prototype did, which needed `icon_logo` in the snapshot and `logo=1` on the
  icon route. Alternative: only *Automaattinen*. Pinning the logo survives a
  later second logo file on the fixed list.
- **No undo or commit offer** on the page, per Jari's 30.10 decision (silent
  commit); the Git chip's count is the trace.
