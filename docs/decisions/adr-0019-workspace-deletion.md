# ADR 0019: Delete a workspace by moving it to the freedesktop Trash

**Status:** Accepted by Jari, 16 October 2026, with the amendment below,
and amended again for the browser view on 17 October 2026.
Extended by [ADR 0025](adr-0025-worktree-as-a-place.md) on 18 October 2026:
the daemon also lists and removes linked worktrees, including forced removal,
under the same safety rules.
Proposed in
[recoverable-workspace-deletion](../../issues/recoverable-workspace-deletion/item.md);
implemented in [implement-workspace-trash](../../issues/implement-workspace-trash/item.md)
and [implement-trash-ui](../../issues/implement-trash-ui/item.md).

## Amendment: clean, fully pushed clones are deleted outright

When the workspace is a Git repository whose status is clean and whose
commits all exist on its remote (nothing unpushed, no stash, no untracked
files), deletion may remove it permanently at once, since the remote holds
everything. Anything else goes to the Trash as described below. Settled but
open conversations never block deletion: Jari chose the lighter rule over
alternative B's speed bump.

The outright deletion keeps the Trash's safety: the directory is moved into
the Trash first, the Git facts are read again on the moved inode, and only
then is the entry removed with the same descriptor walk as "Delete
permanently". If the facts changed or a process is inside, the entry stays in
the Trash. "All commits" covers every ref, not only branches and tags.
Initialized submodules and ignored directories that are Git repositories
prevent outright deletion, because their commits are not checked against any
remote. Ignored files are not on the remote either; they do not prevent
outright deletion and are shown in the confirmation.

## Amendment: the browser view and its host support

Jari chose direction Tallennustila of the
[2026-10-17 prototype round](../../issues/proto-trash-and-devices/item.md)
and answered its questions on 17 October 2026:

- The Trash lives in Asetukset › Tallennustila, under the quota bar, which
  shows the Trash's share. The notice after a move offers Palauta and links
  there; the confirmation names the place.
- Git-ignored files simply go: they never send a clean, fully pushed clone to
  the Trash. The confirmation still names them.
- An outright deletion fetches first. After the move, every configured remote
  is fetched by name on the moved directory (`git fetch --multiple --prune
  --no-tags`, hooks and automatic maintenance off, 30 seconds), and only then
  are the Git facts read again. A remote branch deleted or rewritten since the
  last fetch therefore keeps its commits in the Trash, and a fetch that fails,
  or a repository without a configured remote, keeps the whole workspace there
  (`kept_reason: fetch_failed`). A fetch that moved any ref outside
  `refs/remotes/` (a configured refspec can write local branches, leaving a
  commit on no ref) keeps it there too (`changed_after_check`). The check before the confirmation stays read-only and
  fetches nothing, so the dialog says that a fetch will follow.
- A clean, fully pushed clone has no "move to Trash anyway" alternative.
- "Tyhjennä roskakori" empties the Trash after a confirmation. The listing
  carries a token over its entries' names, inodes and info; `trash_empty`
  sends it back and removes exactly that set, entry by entry with the same
  checks and walk as "Delete permanently". A Trash that changed after the
  person looked is refused whole (`trash_changed`), so an entry moved there
  meanwhile is never emptied unseen. Entries with a process or mount inside
  stay and are reported.

The Trash listing also reports each entry's size, measured within one shared
bound so a large Trash answers as quickly as a small one.

## Decision

From the browser, "Delete workspace" moves the directory `~/src/<name>` into
the person's home Trash as defined by the freedesktop Trash specification 1.0
(`$XDG_DATA_HOME/Trash`, by default `~/.local/share/Trash`). The browser lists
workspaces in the Trash and can restore them. Nothing is removed permanently
until the person chooses "Delete permanently" on a Trash entry, empties the
Trash in the browser, or empties it with native tools. There is no automatic purge. This replaces the
quarantine design of 6 October recorded in
[manage-workspace-lifecycle](../../issues/manage-workspace-lifecycle/result.md).

Moving to the Trash is one `renameat2` call within the home filesystem. A
check that misses a dependency can then leave something stranded in the Trash,
where it is still whole and can be restored, but cannot destroy it. This
property is why the design is short enough to ship soon. Permanent deletion
works only on the Trash's contents, and by then nothing else needs to depend
on them.

## Why the earlier design stalled

The quarantine design (option A) needed a private quarantine directory, a
durable intent journal written by us, an observer for native effects, a
delayed purge, and the ability to resume stages after a browser disconnected.
Two attempts stopped on the gaps listed in the issue's
[result.md](../../issues/recoverable-workspace-deletion/result.md). Most of
that machinery existed to make an irreversible recursive removal safe *at the
moment of deletion*. Separating the reversible move from an explicit,
later permanent deletion makes most of it unnecessary:

- **Intent journal.** The Trash specification already prescribes one: the
  implementation "MUST create the corresponding file in `$trash/info` first",
  atomically with `O_EXCL`, and only then move the file into `$trash/files`.
  The `.trashinfo` file (`[Trash Info]`, `Path=` URL-encoded per RFC 2396,
  `DeletionDate=YYYY-MM-DDThh:mm:ss`) is the durable record of intent, written
  in a format that the person's other tools also read. Writing a second
  journal of our own would duplicate it. ADR 0001 rules out a parallel store.
- **Delayed purge and stage resume.** The move is one system call. After a
  disconnect, the browser reads native state again: the directory is either
  still in `~/src` or in the Trash with an info file. There are no stages to
  resume.
- **Native-effect observer.** It no longer has to be complete, only
  conservative about what it blocks. Each remaining miss is listed under
  "Races and how each is closed" below.

## What is checked and what blocks

The delete request has the same shape as the existing workspace mutations in
`internal/daemon/workspace_manage_linux.go`: a fresh `Discover`, the workspace
ID, an observation token bound to device and inode (`workspaceToken`), the
`cloneWriter` lock, and a descriptor opened with `openWorkspace` whose
`dev/ino` must match. Then the following checks run. Any check that returns
*unknown* blocks the deletion, just as a confirmed problem would.

1. **Managed agent sessions.** The workspace handler already receives the
   `ConversationController` (`handoff_linux.go:78`). Deletion takes a fence
   for that workspace's `cwd` under `c.mu`. The fence is refused while
   `c.sessions` holds a live Pi child for that `cwd`. While the fence is held,
   `workspaceFD`, the single place where create, continue, archive and title
   resolve a workspace (`conversation_linux.go:221`), refuses that workspace
   with `workspace_busy`. The fence is released after the move. From then on
   the path no longer resolves, so no new start can follow. **Blocks.**
2. **Other processes of the person.** A scan of `/proc` like
   `scanPiWriterExcept`'s (`pi_writer_linux.go`) covers every process of the
   mapped UID. A process whose `cwd`, `root`, `exe` or any open descriptor lies
   inside the workspace **blocks**, and the browser names it by PID and
   `comm` (a tmux shell, an editor, an unmanaged Pi). An unreadable process of
   that UID is reported as unknown and blocks too. Processes of other users
   cannot reach a home directory with mode 0700, and inspecting them is
   outside the daemon's authority.
3. **Taskfleet runs.** `taskfleet run list --output json` is read with the
   fixed argv that the spinoff adapter already uses (`spinoffs_linux.go`). A
   run whose `worktree_path` or source checkout lies inside the workspace, and
   which is not merged or cancelled, **blocks**. The message points to the
   Taskfleet command that ends the run. If Taskfleet is installed but its
   reply cannot be read, the result is unknown and blocks. If Taskfleet is not
   installed, there are no runs to check.
4. **Linked worktrees of this repository.** For each entry in the main
   checkout's `$GIT_DIR/worktrees/<id>/`, the `gitdir` file names the linked
   worktree's `.git` file (gitrepository-layout(5)). An entry whose target
   still exists **blocks**, as does a `locked` entry. The message suggests
   `git worktree remove`. An entry whose target is missing is stale; it is
   shown and does not block. ADR 0025 adds the browser's worktree list as
   a way to remove them. This reads Git's own registry, so it finds
   worktrees anywhere on disk, including Taskfleet's `<repo>__worktrees`
   siblings. The earlier attempt lacked such a scan outside `~/src`.
5. **The workspace is itself a linked worktree.** If `.git` is a file that
   points to another repository's `worktrees/` directory, deletion **blocks**
   with "remove it with `git worktree remove` or the tool that created it."
   The same check applies to the `.git` file of each immediate child, which
   covers a plain directory that holds worktrees, such as
   `foo__worktrees/<wt>`. A `.git` file pointing into this workspace's own
   `.git/modules` belongs to a submodule and is fine.
6. **Mounts.** A mount point at or below the workspace in
   `/proc/self/mountinfo` (proc(5)) **blocks**. Unparseable mountinfo is
   unknown and blocks.
7. **Same filesystem.** The Trash directory must have the same `st_dev` as
   `~/src`, so `renameat2` cannot return `EXDEV`. If it does not, deletion
   **blocks**. The specification allows a copy across partitions; we never
   copy. Discovery already requires `~/src` to be on the home filesystem, so
   this holds in a standard installation.

**Informational, does not block:** Git's uncommitted changes, commits that no
remote-tracking ref contains, and the stash count. These come from the
existing read-only Git layer, so the check makes no fetch (an outright
deletion fetches afterwards; see the second amendment). Also shown: the number of
Pi conversations whose session header names this `cwd`. The Trash keeps all
of these, because `.git` moves with the directory and Pi history stays under
`~/.pi`. Path-based association brings the conversations back on restore.

## The move

1. Create `info/<name>.trashinfo` with `O_EXCL|O_NOFOLLOW` (on collision use
   `<name>.2`, and so on). Write `Path` and `DeletionDate`, then `fsync` the
   file and the `info` directory.
2. `renameat2(srcFD, name, filesFD, name', RENAME_NOREPLACE)`, followed by
   `fsync` of the source and `files` directories.
3. Open the moved entry with `O_NOFOLLOW|O_DIRECTORY` and compare its
   `dev/ino` with the observed token.
4. Repeat the process scan (check 2) on the new location, and report any
   process still inside the entry.

The browser handles disconnects by observing again. It does not track stages.

## Restore

The browser's Trash view lists entries whose `Path` is an immediate child of
this person's `~/src` and whose `files/` entry is a directory. Entries written
by other tools are untrusted data. They are parsed strictly, and any `Path`
outside that set is ignored. Restore uses `renameat2(…, RENAME_NOREPLACE)`
back to `Path`, then removes the info file. If the original name is now taken,
restore refuses and says so; it does not rename silently. Native tools that
follow the same specification (GNOME Files, Dolphin, `gio trash`, trash-cli's
`trash-restore`) see and restore the same entries. Restore therefore does not
depend on the browser or the daemon.

One known limit: once a moved main checkout has spent longer in the Trash than
`gc.worktreePruneExpire` (Git's default is three months), `git gc` may prune
the worktree metadata of a linked worktree whose path has gone. Check 4 blocks
deletion of a main checkout that still has live linked worktrees, so this
limit applies only to worktrees that were already stale.

## Permanent deletion

Apart from the amendment above, only an entry already in the Trash can be
deleted permanently. The person types the directory name. The confirmation repeats the informational Git
facts, because only at this point are they lost. The daemon removes
`files/<name'>` with a descriptor-based walk (`openat` with
`O_NOFOLLOW|O_DIRECTORY`, then `unlinkat`). The walk never follows a symlink,
never crosses a directory whose `st_dev` differs from the entry root's (this
defends against mounts in any namespace the daemon can see), and removes the
`.trashinfo` file last. The walk runs in a bounded context that does not end
when the browser disconnects, as `git_init` already does. If it is
interrupted, the entry is still listed in the Trash and can be deleted again.
If anything was not removed (a directory with another `st_dev`, or `ENOTEMPTY`
caused by a concurrent writer), the result reports it as remaining instead of
retrying without limit.

## Races and how each is closed

| Race the earlier attempts found | Here |
|---|---|
| A same-UID process replaces `~/src/<name>` between the inode check and `rename`; Linux has no atomic compare-and-rename | The swapped directory is moved into the Trash, not deleted. Step 3 detects the mismatch and restores it with `RENAME_NOREPLACE`. If restoring fails, the browser says that a different directory is in the Trash and can be restored there. No data is destroyed. |
| A managed conversation starts between observation and removal | The controller fence in `workspaceFD` (check 1) refuses the start. After the move, the path no longer resolves. |
| `piRPC.close()` does not prove that Pi has exited or that its history is settled | Deletion never stops Pi. It refuses while a live child exists. Pi history is outside the workspace and is not touched. |
| A process enters the directory after the scan | The process runs inside the Trash entry. Step 4 reports it, and its writes are kept and can be restored. |
| Linked or Taskfleet worktrees outside `~/src` cannot be seen | Git's own `worktrees/*/gitdir` registry (check 4) and Taskfleet's run list (check 3) find them. Anything they miss is stranded but whole until restore. |
| Incomplete journal temp files after a crash | The only journal is the specification's info file. An info file without a matching `files/` entry, whose `Path` still exists in `~/src`, is an aborted intent and is removed on the next Trash listing. A `files/` entry without an info file is shown as an emergency entry, as the specification requires, and is never purged automatically. |
| A pre-unlink `stat` does not atomically match the inode that is unlinked | Unlinking happens only inside a Trash entry the person chose to destroy. Descriptor-relative traversal keeps the walk inside the entry, and the `st_dev` fence keeps it out of mounts. |
| Stages must be reported after a disconnect | There are no stages. Native state (in `~/src`, in the Trash, partly emptied) is the report. |

## Security and authority

Everything runs in the person's daemon as their own UID, on files in their
own home. The gateway and the broker gain nothing. The browser sends a
workspace ID, an observation token or a Trash entry name (one validated path
component). It never sends a path. The Trash counts toward the person's quota
(ADR 0012), and permanent deletion is how a person who uses only the browser
gets that space back.

## Alternatives and how close they were

- **(A) Finish the quarantine design.** Rejected. Its safety comes from a
  journal, an observer and resumable stages that we would have to own. Each of
  them duplicates either the Trash specification or native state, and two
  attempts could not close them. Its one advantage, a quarantine that native
  tools do not see, is a drawback here, because restore would then exist only
  in our UI.
- **(B) as briefed: also block while the workspace has settled but open
  conversations.** That part is rejected; the rest of B is adopted. Settled Pi
  history lives in `~/.pi`, is never touched, and reappears on restore.
  Requiring the person to archive conversations first would add work without
  protecting any data. This was the closest call, and Jari may prefer the
  stricter rule as a deliberate speed bump.
- **(C) Git guards as blocking confirmations at move time.** Rejected as
  blocking. Kept as information, and repeated at permanent deletion, which is
  where the loss actually happens. Blocking a reversible move on unpushed
  commits would stop exactly the throwaway clones Jari wanted to delete.
- **Automatic purge after N days.** Rejected for now. The specification does
  not require one, and a purge that runs without the person's action is the
  irreversible step this design avoids. A later automatic purge can use the
  same permanent-deletion path.
- **Plain `rm -rf` behind exact-name confirmation.** Rejected. The pathname
  race would destroy the wrong data, with no recovery.

## Consequences

The browser gets Delete, a Trash view with Restore, Delete permanently and
Empty Trash. The daemon gains these as actions on the existing workspace route
and no new store. Tests can be deterministic: injected swaps before `rename`, a crash
after the info file and before the move, `EXDEV`, a mount below the
workspace, a live Pi, a foreign process, Taskfleet and Git worktree fixtures,
and a permanent deletion interrupted midway. The architecture page
`workspaces.md` describes the implementation.
