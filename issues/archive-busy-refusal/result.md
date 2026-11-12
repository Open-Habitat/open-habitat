# Result: archive busy refusal

## What refused

Archive and restore of a conversation (`POST /api/v1/workspaces`,
`action: conversation_archive`, `internal/daemon/archive_linux.go`) took the
daemon-wide `cloneWriter` with `TryLock` and answered `409 workspace_busy` at
once if anything else held it. The same instant refusal applied to the
workspace settings family on the same endpoint (create, rename =
`settings`, hide = `visibility`, `git_init`, `icon`;
`internal/daemon/workspace_manage_linux.go`) and to single and merged
worktree removal (`workspace_worktrees_linux.go`). The browser's mutation
layer already retried `workspace_busy` twice (after 250 ms and 500 ms), so a
refusal reached the person only when the writer stayed held for about 0.8 s.

Jari's journal (Birch, 15:20:52–53) shows exactly that: one archive's three
attempts at 52.884, 53.193 and 53.708 were all refused in 0 ms, while every
logged workspace POST took under 10 ms. The holder was therefore something
the request log does not show: it skips GETs faster than 250 ms (for example
the GitHub checkout observation, which holds the writer while it runs `git`)
and background jobs (clone runs and the clone plan hold it for their whole
run). The logs cannot say which one it was.

## Fix

The daemon now queues these short writes behind the current holder for at
most 2 s (`workspaceWriter.waitBriefly`, `briefWriterWait`), the same bounded
wait worktree creation already used (which now shares the helper). A holder
still running after that is a real operation, and the refusal names it with
the holder's product code (`workspace_clone_running`,
`workspace_deletion_running`, …), which the browser already words as "GitHub
repository import is under way" and so on, instead of "Toinen muutos oli
juuri kesken". Nothing is written on a refusal, so the browser's "Keskustelu
palautettiin listaan" rollback stays correct.

Tests:

- `internal/daemon/archive_queue_linux_test.go`: three archives and then
  three restores sent concurrently while a checkout observation holds the
  writer for 300 ms all succeed; an archive behind a clone that outlasts the
  wait is refused with `workspace_clone_running` after about 2 s and writes
  nothing. Both failed before the fix (409 `workspace_busy`).
- `web/tests/archive-quick-succession.spec.ts`: archives three conversations
  from the rail, holding the requests in the browser until all three are sent
  so they meet in the daemon; all three get 200, no error card. It failed
  before the fix (a 409 reached the browser). The browser host gained a
  `/fixture/history?mode=several` that seeds three short settled histories.

## Other places where `refusals.busy` reaches the person

These still answer `409 workspace_busy` immediately. The browser retries them
twice in 0.75 s; after that the person sees "Toinen muutos oli juuri kesken":

- Trash: delete one entry permanently, empty Trash, restore an entry, and
  the `trashWriter` half of workspace deletion
  (`workspace_delete_linux.go`). Deleting several Trash entries one after
  another meets this, because a permanent delete holds the lock while it
  removes a tree. It is the same pattern, but `trashWriter` is a plain mutex
  and the holder can run for a long time, so a bounded wait would mostly
  move the refusal 2 s later. Not changed; worth a follow-up that names the
  holder ("Roskakorin tyhjennys on kesken").
- Workspace deletion and restore (`cloneWriter`, `workspace_deletion_running`
  holder): answers `workspace_busy` rather than the holder's code. Rare to
  run twice quickly.
- GitHub publish and disconnect (`github_publish_linux.go`,
  `github_disconnect_linux.go`): long, one-at-a-time operations; the generic
  code hides which operation holds the writer.
- Starting a conversation in a workspace that deletion is fencing
  (`conversation_linux.go`, `c.admits`): a real conflict with a deletion,
  correctly refused, but worded as the generic busy text.

The separate "busy" texts in Own machines, integrations and GitLab
(`ownMachines.tsx`, `integrationsSettings.ts`, `gitlab.tsx`) belong to their
own per-feature writers and are not part of this pattern.

## Decisions for later review

- **The daemon waits; the browser was not changed.** Alternatives: browser
  retry with longer backoff, or a separate short lock for `user-state.json`
  so annotation writes never queue behind `~/src` work. The daemon owns the
  writer and knows who holds it, so a bounded wait there serialises the
  writes without the browser guessing, and it already existed for worktree
  creation. A separate annotation lock would let an archive land during a
  clone, but the shared writer also orders archive against workspace
  deletion and worktree changes, so splitting it is a locking redesign, not
  a fix for this report.
- **2 s bound, holder named after it.** Long enough for archives, renames,
  checkout observations and state fsyncs; short enough that a person behind
  a clone or deletion hears why within a moment rather than waiting on it.
  The holder's code replaces the generic `workspace_busy` in these paths, so
  the browser's own busy retry no longer applies to them (the daemon already
  waited longer than that retry would).
- **Worktree removal got the same wait.** Removing worktrees one after
  another is the same click-in-succession case and the change was one line.
