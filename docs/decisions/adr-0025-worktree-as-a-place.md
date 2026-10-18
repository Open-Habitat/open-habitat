# ADR 0025: A worktree is a place; agents settle it, the daemon cleans it up

**Status:** Accepted by Jari on 18 October 2026 in
[proto-interactive-worktrees](../../issues/proto-interactive-worktrees/result.md#jaris-decision-2026-10-18).
Amends [ADR 0010](adr-0010-taskfleet-worktree-agents.md), extends
[ADR 0019](adr-0019-workspace-deletion.md) and leaves
[ADR 0017](adr-0017-observe-taskfleet-spinoffs.md) unchanged.

## Context

A person wants to start an agent in its own Git worktree from the browser, talk
to it directly, and see the worktree's state in the browser. ADR 0010 decided
that Taskfleet would own such a worktree as a caller-owned run, with its
settlement (merge, cancel, discard), while the daemon controlled Pi inside it.
ADR 0017 deferred that and kept Taskfleet spinoffs observe-only.

The [host research](../../issues/research-worktree-agents-host/report.md)
weighed three options again on 17 October 2026: (A) a Taskfleet caller-owned
run with a daemon-controlled Pi, (B) a plain `git worktree` made by the daemon
without Taskfleet, and (C) Taskfleet's own interactive worker in tmux. It
recommended A, because the browser controls then asked for (merge, discard,
running/done) need an owner of the worktree's lifecycle, and only Taskfleet
already has one. Its argument against B was that either the daemon becomes a
second merge and cleanup engine beside Taskfleet, or nobody owns the end of a
worktree and abandoned ones pile up.

Jari decided on 18 October 2026 that the browser offers no settlement buttons.
That removes the reason for A: with nothing for the browser to settle, nobody
has to own a settlement lifecycle, and Git's own state is the whole truth about
a worktree. Jari also named the other half of B's problem as one the person
already has: "Näiden kanssa on nykyäänkin ongelmia, eli tässä tietenkin pitäisi
olla joku tapa ehkä siivota näitä pois tai forsettaa ne pois." Cleaning up
worktrees is removal, not settlement, and the daemon already removes
directories safely for the Trash (ADR 0019). So B's shape fits now, with
removal added to the daemon instead of a merge engine.

## Decision

### A worktree is a plain Git place

A worktree is an ordinary linked `git worktree` of a workspace's repository.
There is no run, job or record of ours behind it. It holds zero or more
ordinary browser conversations whose working directory is the worktree; an
agent in it may end and new conversations may start there later. The term in
the product is *worktree-agentti*.

It is created in one of two ways:

- **From the browser.** *Uusi worktree-agentti* opens an empty conversation.
  The first message makes the daemon create, as the user, a new branch from the
  workspace's current branch and a worktree for it, and then start Pi there
  exactly as for any new conversation. The workspace's uncommitted changes are
  not carried over, and the empty conversation says so. There is no dialog and
  no choice of another base branch.
- **By asking an agent.** An agent runs `git worktree add` itself, as it would
  over SSH. Such a worktree is as much a place as a browser-made one.

A browser-made worktree goes to `~/src/<workspace>__worktrees/<name>`, the
sibling layout Taskfleet and Jari's own tools already use, on the home
filesystem and outside the workspace's own tree. Its branch records the base
natively as its upstream (the local branch it was made from), so `git status`
in the worktree and the browser agree on ahead and behind. A worktree whose
branch has no local upstream, such as one an agent made, is compared with the
main checkout's current branch. A directory directly under `~/src` that holds
only linked worktrees of discovered workspaces is their container, not a
workspace of its own; this is judged from Git's registry, never from the name.

The daemon finds a workspace's worktrees in Git's own registry
(`$GIT_DIR/worktrees/*/gitdir`, the source `git worktree list --porcelain`
reads), never by directory name, so worktrees made anywhere by any tool,
including Taskfleet's `<repo>__worktrees` siblings, are found. A conversation
belongs to a worktree when its Pi session header's working directory exactly
matches the worktree's path, the same path rule as for workspaces. The browser
shows the worktree and its conversations under the workspace it belongs to:
a branch mark in the rail and the workspace page, and the worktree's marks in
the top bar (Jari chose direction *Yläpalkissa*).

### Agents settle; the browser shows Git's state

The browser has no merge, cancel or discard controls. The person asks the
agent in conversation to commit, merge, rebase or throw the work away, and the
agent runs the native commands. The top bar shows what Git says, read again on
demand as the user, like the Git status pill: the branch, commits ahead of and
behind its base, whether the branch is merged into the base, and uncommitted
changes. Nothing is stored about the worktree's history; "merged" is a fact
read from Git each time, not a state the host remembers. A later merge button
is allowed only as a shortcut that sends the agent a prepared request; it may
not run the merge itself.

### Taskfleet does not own these worktrees

Browser worktree agents do not use Taskfleet's caller-owned runs. Spinoffs stay
as ADR 0017 decided: Taskfleet launches and settles them, and the browser
observes them read-only. A worktree that a Taskfleet run made still shows up in
a workspace's worktree list, because it is in Git's registry, but while its run
is live the run's lifecycle wins and the browser does not touch it. A
browser-created worktree agent cannot be attached from tmux, as with any
browser conversation; Jari does not need that.

### Cleanup belongs to the daemon

The daemon lists every linked worktree of the person's workspaces, on the
workspace page and in Asetukset › Tallennustila, with its Git state, and
removes them on the person's request. This applies to every worktree in Git's
registry, including existing ones and Taskfleet leftovers, not only to ones
the browser made. A workspace's main checkout is never removed this way; that
remains workspace deletion (ADR 0019).

| Git state | What the person can do |
|---|---|
| Merged into its base, no uncommitted changes | Remove the checkout and the branch. *Siivoa kaikki yhdistetyt* does this for every merged worktree in the listing the person saw. |
| Not merged, no uncommitted changes | Remove the checkout and keep the branch, so its commits stay reachable. |
| Uncommitted changes | *Tallenna muutokset haaraan ja poista*: commit everything to the worktree's branch, then remove the checkout as above. Or *Poista pakolla*, confirmed by typing the worktree's name: the uncommitted changes are lost, and the branch is treated as above. |
| Directory missing | Prune the stale registry entry. |

### Cleanup safety rules

Cleanup follows the Trash's safety rules (ADR 0019); anything that cannot be
checked blocks, as a found problem does.

- **The daemon resolves every path.** The browser sends a workspace ID, the
  worktree's registry entry and an observation token; never a path. The daemon
  takes the worktree's path from the registry of a freshly discovered
  workspace, opens it by descriptor without following symlinks, and checks that
  its device, inode and branch tip still match the token.
- **Nothing is in use.** A live managed Pi child in the worktree blocks, and
  the conversation controller fences the worktree against new starts while
  cleanup runs, as it does for workspace deletion. Another process of the
  person with its cwd, root, executable or a descriptor inside blocks and is
  named. A mount at or below the worktree blocks. A worktree that a Taskfleet
  run owns blocks unless `taskfleet run list` shows the run merged or
  cancelled; an unreadable Taskfleet reply blocks. A worktree Git has locked is
  shown with its reason and is not removed.
- **Facts are read again just before acting.** Git status, untracked files,
  the branch tip and whether it is merged are read again on the pinned
  directory. If any differ from what the person saw, nothing is removed and a
  fresh listing is needed. *Siivoa kaikki yhdistetyt* carries a token over the
  listed worktrees, like *Tyhjennä roskakori*, and acts only on that set.
- **Removal cannot reach outside.** The checkout is removed with the same
  descriptor walk as permanent deletion from the Trash: no symlink is followed,
  no mount or other filesystem is entered, and whatever cannot be removed stays
  and is reported. Only then is Git's registry entry for that worktree pruned.
  Ignored files in the checkout are lost and are named in the confirmation.
- **A branch is deleted only by compare and delete.** The merged branch is
  removed only if its tip is still the observed commit and that commit is still
  in the base; a branch that moved is kept.
- **No stages to resume.** An interrupted cleanup leaves native state that the
  next listing reads correctly: a missing directory with a registry entry is
  stale, a kept branch without a worktree is an ordinary branch.

Everything runs in the person's daemon as their own UID, on their own home.
The gateway and the provisioning broker gain nothing.

## Consequences

- The host needs none of ADR 0010's caller-owned machinery: no launch gate,
  writer lease, session binding or settlement keys, and none of the research
  report's asks to Taskfleet. A browser worktree agent is an ordinary browser
  conversation in another directory, plus a branch creation.
- An abandoned worktree has no settled state of its own. Its Git state says
  what is left, and cleanup ends it. Workspace deletion still refuses while the
  repository has live linked worktrees (ADR 0019, check 4); the browser now
  points to the worktree list instead of only to `git worktree remove`.
- An agent may merge, rebase or delete branches the browser shows; the top bar
  follows because it reads Git again. The browser never claims more than Git
  says.
- [implement-worktree-agents](../../issues/implement-worktree-agents/item.md)
  implements creation and the marks;
  [implement-worktree-cleanup](../../issues/implement-worktree-cleanup/item.md)
  implements the list and removal.

## Alternatives

- **Option A, Taskfleet caller-owned runs (ADR 0010 as decided).** Not chosen.
  It exists to give browser settlement buttons a lifecycle owner, and there are
  no buttons. It would cost the gate-held launch, session binding and restart
  recovery the research listed, for nothing the person sees.
- **Option C, Taskfleet's interactive worker in tmux.** Not chosen. The agent
  would lose streaming, Stop, steering and the other browser conversation
  controls, and tmux attach is not needed.
- **Settlement buttons run by the daemon.** Rejected. That is the second merge
  engine the research warned against.
- **Moving removed checkouts to the Trash instead.** Not chosen. Jari asked for
  a way to force worktrees away; the branch keeps committed work, saving
  uncommitted changes to the branch is offered first, and a forced removal is
  confirmed by typing the name, as permanent deletion is.
