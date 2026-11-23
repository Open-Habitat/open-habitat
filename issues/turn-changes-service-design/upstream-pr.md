# Upstream pull request: turn-snapshot recorder for better-pi-rewind

Not opened. Jari decides when it goes to `raine/better-pi-rewind`.

- **Fork/branch:** `Open-Habitat/better-pi-rewind:turn-snapshots`, pushed
  23 November 2026. No pull request was opened.
- **Commit:** `2aa1b1c87d917144a9fc9193d316f6af7d8981d1`, preserving the reviewed
  recorder commit `17dfa796d6b1daf2b0749afb69d035508f5ecebf` and adding the
  generic restore/ignore safety policy used by Habitat. Both upstream and
  fork `main` remain `e42fa9cbf14c300867fb2f31511979dde1898aee` (v0.4.0);
  no rebase was necessary.
- **Checks:** `npm run check` (typecheck and `node:test`): 66/66 passed,
  including a real Pi loader against an npm-shaped installation. All 18
  embedded recorder/policy files and tests match the fork byte for byte.
  Mapping and synchronization checklist: `issues/pi-rewind-own-repo/result.md`.

This is draft text, not permission to submit. Jari decides after the agreed
couple of weeks of real use. At that point fetch both main branches, reconcile
any movement, rerun the checks, and update this text before opening a PR.

---

**Record a working-tree snapshot per prompt, in a format other tools can read**

*Problem.* Checkpoint coverage is the set of files that went through `edit`
or `write`. Agents change many files through the shell (formatters,
generators, `sed -i`, scripts, `git checkout`), and those are neither
restored nor counted. Open Habitat, a browser front end for Pi that embeds a
derivative of this extension, has the same gap in two places: its rewind and
its per-turn "what changed" summary.

*What this adds.* A second extension entry, `extensions/snapshots.ts`, with
no UI. At the two ends of a run (the first assistant message after a user
prompt, and when the run has settled) it takes a snapshot of the working
tree into a private bare Git repository under the agent directory,
`file-history/<session-id>/tree.git`, and records the tree id in a session
custom entry. And a module, exported as `better-pi-rewind/snapshots`, that
reads those entries and compares, snapshots and restores against them.
`/rewind` itself is unchanged in this PR; see *Next step*.

*How a snapshot is taken.* The store has its own index and configuration.
Its `objects/info/alternates` points at the workspace repository's objects,
so content that repository already has is not stored again, and its index
starts as a copy of the workspace's index, so Git's stat cache is warm and
only changed files are read. A snapshot lists what differs from the store's
index (`ls-files -m -d -o --exclude-standard`, plus the workspace's
`info/exclude` and excludes file), applies the limits per path, feeds the
rest to `update-index`, and runs `write-tree`. Each tree is kept by a ref
that points straight at it (`refs/snapshots/<ms>/<entry id>-<phase>`), which
survives `git gc`. The user's repository is not written: the store reads no
system or global Git configuration, runs no hooks, filters or fsmonitor,
drops inherited `GIT_*` variables, and copies only the `core.*` settings that
affect hashing (`autocrlf`, `eol`, `filemode`, `symlinks`, `ignorecase`, …)
from the workspace. Skip-worktree and assume-unchanged marks are cleared in
the store's copy of the index, so edits to such files are seen, and the copy
keeps the original index's modification time so Git's racy-clean check still
re-reads entries written in the same second. The one
effect on the workspace repository is Git's own:
when the store would write an object that already exists there as a loose
object, Git refreshes that file's modification time instead. Linked
worktrees use the common object directory and their own index.

Measured on Linux on a 5 000-file repository: about 25 ms for the first
snapshot, 15 ms when nothing changed, 25 ms after `sed -i` on 50 files, and
7 ms to compute the run's file and line counts; the store was 1.2 MiB.

*Entry (v1).* Custom type `turn-snapshot`:

```json
{
  "version": 1,
  "userEntryId": "…",
  "phase": "start",
  "tree": "<tree id, or null>",
  "reason": null,
  "store": "<session id that owns the store>",
  "root": "/absolute/repository/top",
  "cwd": "/absolute/working/directory",
  "timestamp": "2026-01-01T12:00:00.000Z",
  "git": { "head": "<commit>", "branch": "refs/heads/main" },
  "skipped": { "count": 0, "paths": [], "truncated": false }
}
```

An `end` entry adds `outcome` (`completed`, `aborted`, `error`) and `stat`
(`{ files, additions, deletions }` between this run's own two trees, with
rename detection), so a selector can show it without running Git. A
boundary without a tree says why in `reason` (`not-a-repository`,
`git-unavailable`, `unsupported-repository`, `time-budget`,
`snapshot-failed`). `timestamp` is when the snapshot began. `store` is per entry because a forked session carries
its parent's entries while their trees stay in the parent's store.

*Runs and windows.* Along a branch, start → end is the agent's run; end →
start is between runs; start → start happens when the user steers a running
agent or the host stopped before settling, and counts as the agent's
window. `listTurns` returns exactly this grouping.

*The reader module.* `turnSnapshotsFromEntries`, `listTurns`, `compareTurn` /
`compareTrees` (files, kind of change, line counts, bounded), `diffFiles`
(unified diff, bounded), `compareWithWorkingTree` (what restoring a snapshot
would change; works on a private copy of the store's index),
`pathsChangedSince` (paths changed in agent windows from a prompt onward,
leaving files only the user touched between runs alone), `snapshotNow` (for
example an undo point), and `restorePaths`. Restore writes whole files
through a temporary name and a rename, never through a symlink or a
symlinked parent directory, never into `.git` or outside the root. It
applies Git's built-in checkout conversions (`cat-file --filters`), so CRLF
and `working-tree-encoding` files come back byte for byte, sets Git's
executable bit, recreates symlinks, and removes files the snapshot shows did
not exist. Absence from a tree proves non-existence only for files the
snapshot could see, so a removal is refused when the path was skipped, when
a `.gitignore` changed since the snapshot, or when the file's birth or
modification time is older than the moment the snapshot began (the entry's
`timestamp`): such a file existed then, ignored or otherwise unrecorded. Removals run
first, deepest first, so a file the run replaced by a directory can come
back when that directory held only the run's files. Git references and the
index are never touched.

*Optional restore policy.* A separate export,
`better-pi-rewind/snapshots/restore-policy`, carries the consumer safety fixes
used alongside this recorder. `scopeFiles` accepts the caller's edited-path
set (or an explicit legacy all-tracked choice), excludes currently ignored
paths and refuses unknown ignore status. Compute it before restoring any tree:
putting back an older `.gitignore` must not expand the per-file fallback scope.
Git's exit 128 alone is not evidence of a plain folder; broken configuration
is an unanswered ignore check.

`restoreWithUndo` captures the current tree before any write. It leaves
skipped target paths to fallback, refuses a missing/different-root undo tree
or truncated skip list, and does not overwrite an existing file absent from
that undo tree. In particular, a file that grew beyond 20 MiB is not overwritten
just because its older target contents fit. Currently ignored paths are left
alone. Its result separates absolute `covered` paths from root-relative actual
writes and an undo descriptor; cancellation should restore only those writes.
These helpers accept no host context or command protocol. The caller owns
checkpoint decoding, recording edited paths, per-file backup capture, undo
persistence and navigation. Low-level `restorePaths` remains available without
this optional policy. Neither path is a transaction against concurrent writers.

*Limits.* A snapshot skips a new or changed file over 20 MiB, stops storing
new content after 200 MiB, and gives up after 2 s; skipped paths are named
in the entry (the first 200, then `truncated`). A skipped tracked file is
left out of the tree rather than kept with stale content. Not recorded:
ignored files, untracked nested repositories, Git's own state, anything
outside the repository, and folders that are not repositories. Because the
store borrows the workspace's objects, content that existed only as an
unreachable object in the workspace (staged, then reset) can be pruned by
the workspace's own `git gc` after its grace period; a restore then reports
that path as not restorable. Repositories
using clean/smudge filters (Git LFS), sparse checkout or a split index get
`unsupported-repository` until those cases are measured.

*Retention.* At most once a day the recorder removes stores whose session
file no longer exists, drops snapshot refs older than 90 days and runs
`git gc` in that store, or removes the store when nothing remains. A forked
session (Pi's `session_start` with reason `fork`, OMP's `session_switch`)
registers itself with the stores its inherited entries name, and
such a store stays while the fork's session file exists. A store written
within the last hour is never removed whole or collected, so a sweep in one
process does not race a snapshot in another. Only
directories carrying the recorder's own metadata file are touched, and only
their `tree.git`; the per-file backups beside them are left alone.

*Hosts.* Uses `message_start`, `message_end` and `appendEntry`, which the
rewind extension already uses on both hosts, plus one settle hook behind the
host adapter: Pi's `agent_settled`, and on OMP the `agent_end` whose
`willContinue` is not set. When the package is installed and a host also
loads its own copy of the recorder, the first instance in the process
records and the others stay passive (a `Symbol.for` slot on `globalThis`).

*What stays.* The per-file backups remain for ignored files, for files
outside the root, and as the whole mechanism where there is no `git` binary
or repository, so the extension still works without a repository. The
optional hard reset is unchanged.

*Next step.* The terminal selector and restore could consume
`pathsChangedSince` together with scoped per-file fallback, subject to snapshot
limits and successful undo capture. That requires recording per-turn edited
paths in upstream's checkpoint format and agreeing its restore semantics;
blindly unioning every previously tracked path would undo unrelated later work.
I kept that terminal integration out of this PR so the recorder, format and
optional policy can be judged on their own; I am glad to discuss it here or as
a follow-up, whichever you prefer.

*Tests.* `npm run check` passes typechecking and 66 tests. The five additional
policy/package regressions cover scoped and legacy fallback, outside-root
copies, ignored paths, broken Git configuration, oversized undo coverage,
ignore decisions frozen before `.gitignore` restoration, actual-write-only
undo, skipped target paths, unavailable path discovery, and loading the export
through Pi from a real `node_modules` layout in a fresh Node process.
The recorder's `node:test` suites run against real Git repositories in a
temporary directory: capture of shell edits, deletions, renames, new
directories, binaries, symlinks and mode changes with the workspace's `.git`
listing unchanged; alternates, store mode and no hook templates; size limits
and skipped paths; each no-snapshot reason; inherited `GIT_DIR` and
`GIT_INDEX_FILE` ignored; a linked worktree; run grouping, comparisons,
diffs and the working-tree comparison leaving the store's index and refs
unchanged; restore of contents, modes, links, deletions and creations, and
a fresh snapshot giving the target tree; CRLF round trip; a file replaced
by a directory; refusal of `..`, `.git`, symlinked parents, skipped paths,
removals after a `.gitignore` change, and removal of files older than the
snapshot (rules changed and changed back, a self-ignoring `.gitignore`);
racy-clean entries in the seeded index; skip-worktree and assume-unchanged
entries; bounded Git output; retention (deleted session, young store, busy
store, fork still naming the store, mixed ages, active store, unrelated
directories, once a day, `gc` keeping referenced trees); and the extension's run, steering, abort, duplicate
instance, no-session-file, plain-folder and OMP paths.

*Open points we would like your view on.* The OMP settle mapping
(`agent_end` without `willContinue`; OMP is detected by its extension API
carrying `logger` and `typebox`), Windows behaviour of the Git calls and the
restore, the entry and store names, and whether the recorder belongs in
this package or one of its own; the format does not depend on the answer.
