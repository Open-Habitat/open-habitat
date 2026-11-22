---
created: 2026-11-22
updated: 2026-11-22
type: task
status: untriaged
priority: normal
provenance: other
provenance_detail: follow-up from turn-changes-service-design build run
source_ref: taskfleet:01m8231bnf8pqh3n9z7skcdp20/follow-up:turn-snapshot-reader-migration
originating_run: 01m8231bnf8pqh3n9z7skcdp20
originating_run_kind: spinoff
---

# Habitat reads the turn-snapshot record for Vuoron muutokset and Palaa tähän

## Description

## Description

The turn-snapshot recorder now exists as a branch for better-pi-rewind (a second extension entry, `extensions/snapshots.ts`, and the module `better-pi-rewind/snapshots`). It snapshots the working tree at the start and settle of every run into `~/.pi/agent/file-history/<session-id>/tree.git` and writes a versioned `turn-snapshot` session entry per boundary (tree id, store, root, cwd, HEAD/branch, skipped paths; on the end entry `outcome` and `stat` = files/additions/deletions). The format, store layout and the PR text are in `issues/turn-changes-service-design/` (`design.md`, `upstream-pr.md`).

Habitat today still learns about changed files only from `edit`/`write` tool calls, in both *Vuoron muutokset* (`web/src/app/turnChanges.ts`) and *Palaa tähän* (`internal/daemon/rewind-extension.mjs`, `rewind_linux.go`). A conversation whose changes were made by scripts shows no changes at all. This issue moves Habitat to being a reader of the recorder's record. Decided by Jari (21.11.2026): no new switch — recording belongs to the same experimental feature as turn changes / rewind; no agent tool in the first step; stores are removed with the conversation and snapshots older than 90 days are dropped (the recorder does the latter itself).

## Steps (from the design's migration plan)

1. **Load the recorder.** Take better-pi-rewind at a pinned ref in the core runtime (or, until upstream merges, at the fork branch's commit), with its licence recorded in `licenses/DEPENDENCIES.md`. The daemon adds only `extensions/snapshots.ts` to its Pi child's arguments when the existing experimental turn-changes/rewind feature is on and the person's own Pi settings do not already provide the package (the same check as `nativeSettingsProvideProcesses`). The recorder also stays passive when a second copy is loaded in the same process. Because Pi's arguments are fixed when the child starts, the switch takes effect when a conversation's Pi next starts.
2. **Conversation deletion removes the store.** When Habitat deletes a conversation, it also removes `file-history/<session-id>/` (it already owns that decision); the recorder's daily sweep is the fallback for stores whose session file is gone.
3. **Vuoron muutokset reads snapshots.** The daemon's history projection carries the end entry's `stat` for a turn, so the collapsed line needs no extra read. Opening the list or a file is a new daemon read (contract change in `contracts/v1`) that runs `git diff-tree -r -M --numstat/--name-status <start> <end>` and `diff-tree -p … -- <path>` in the store, as the person, with bounded output. The browser keeps the tool-call aggregation as the fallback for turns without snapshots and as the timeline's source; a file in the snapshot that no `edit`/`write` names gets the tag *komennolla*. Skipped paths (`skipped`) are listed as not recorded.
4. **Palaa tähän reads snapshots.** The preview comes from the trees (`pathsChangedSince` semantics: paths changed in agent windows from M onward; between-turn changes stay and are listed) and from the recorded `git.head`/`git.branch` (exact commit count and branch change, replacing the `git log --since` heuristic). `/oh-rewind` restores through `restorePaths` and keeps Habitat's own markers; the undo point becomes `snapshotNow` just before the restore, named in the marker, with per-file copies only for paths outside the root or ignored.
5. **Old sessions stay as they are.** Turns without `turn-snapshot` entries behave exactly as today; nothing is converted. A conversation that spans the switch is old before it and new after it, message by message.
6. **Proven, then folded in.** Proven means: on real repositories the snapshot list contains everything the tool-call list does, restore followed by a new snapshot gives the target tree, and the added time per turn stays within budget. Then the `--since` heuristic and the command parser's role in the file list are removed.

No authority moves: the recorder and restore run inside the person's Pi as the person; the daemon gains one more read as the person and still writes neither the session nor workspace files.

## Acceptance Criteria

- [ ] The recorder is loaded into the daemon's Pi child under the existing experimental feature and never twice.
- [ ] *Vuoron muutokset* lists script-made changes for turns with snapshots and falls back unchanged for turns without.
- [ ] *Palaa tähän* previews and restores script-made changes from snapshots, with an undo point, and falls back unchanged for older turns.
- [ ] Deleting a conversation removes its snapshot store.
