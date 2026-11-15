# Result: design for a rewind that captures every change

No implementation. `design.md` is the deliverable; the issue stays open
(`preparation: pending`) until Jari answers its four questions.

- **Today, from code:** the tracked set grows only from `edit`/`write` tool
  inputs; `bash` calls are listed as text.
- **Recommendation:** a snapshot of the working tree at the start and settle
  of each turn into a private Git store in the person's home, taken by the
  existing Pi extension, with today's per-file copies kept beside it. The
  daemon stays a reader and no authority moves.
- **Experiments** (scratch clones only): snapshot cost on this repository and
  on a synthetic 100 000-file repository, what the snapshot captures and
  misses, restore and undo to identical trees, turn-window attribution, and
  the alternatives (workspace's own repository, full copy, reflink, overlay,
  mtime scan, inotify, strace). Numbers are in `design.md`.
- **Prototype round:** `design-system/prototypes/rounds/2026-11-15-rewind-all-changes/`
  (three directions: A Kaikki takaisin, B Agentin vuorot, C Valitse itse).
  Made because the choice of *what restores* is visible in the sheet. Its
  check passes (340 checkpoints).

## Decisions for later review

1. **Private store, not the workspace's repository.** Alternatives: `git
   stash create` or a hidden ref in the workspace. Chosen because the tested
   stash captured no untracked files and wrote objects into the person's
   `.git`, and a ref there is visible to their other tools.
2. **Alternates and a seeded index.** Alternative: a standalone store (4.4 s
   and 417 MiB for the first snapshot of 100 000 files, against 54 ms and
   8.6 MiB). Cost: content that was only staged, or rewritten away, can be
   pruned by the workspace's own `git gc`; such a file is then reported as
   not restorable.
3. **Turn windows decide what restores; per-command windows only label.**
   Parallel tool calls overlap and background processes outlive a call.
4. **Edit-tool copies stay.** They cover an ignored or out-of-workspace file
   the agent edited directly, which a snapshot does not.
5. **The round shows the sheet only**, not the history rows or the turn's
   *Muutokset* line, and its content differs from the earlier rewind rounds
   (commands that change files were added).
6. **Filesystem snapshots and tracing are rejected** for these hosts (ext4,
   no reflink, user namespaces blocked, `fanotify` needs root).

## Review

Focused self-review against the code: the description of today's behaviour
was checked line by line against `rewind-extension.mjs` and
`rewind_linux.go`; every number in `design.md` comes from a run in this
session, and cells that were not measured say so. Not measured: the preview
and the restore on the 100 000-file repository, a workspace with Git LFS or
a split index, and behaviour under a concurrently writing process.

Live check: nothing to try on the test server yet. Open the round's offline
page (build command in its `NOTES.md`) and compare A, B and C with the
*Tilanne* select.
