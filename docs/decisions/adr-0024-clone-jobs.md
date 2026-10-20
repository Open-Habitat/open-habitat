# ADR 0024: A clone is a job of the user's daemon, recovered from the filesystem

**Status:** Accepted by Jari on 2026-10-17 as the host side of the
Kloonaussivulla direction
(`issues/proto-repo-selection/result.md` (in history),
implemented in [repo-catalog-clone-jobs](../../issues/repo-catalog-clone-jobs/item.md)).
It replaces the "Completion and interruption" part of
ADR 0005; ADR 0005's progress parsing and
verification from Git still hold.

## Context

ADR 0005 tied a clone to the HTTP request that streamed its progress: closing
the dialog or losing the connection cancelled Git, and the partial directory
stayed for inspection. A large repository takes minutes, so it held a modal
dialog for that long. A failed clone left a directory that refused the next
attempt with `checkout_exists`, and after a daemon restart that directory was
a `.git` without commits that appeared in the workspace list.

Jari chose a clone page where running, failed and cut clones are listed and
the person can leave and come back. That needs a clone to outlive the request
that started it, without a new store that could drift from the checkout.

## Decision

The user's daemon owns each clone as a job. A `POST` starts it after the same
admission as before (the bound `gh` identity, GitHub's repository facts, the
quota and an absent destination); the browser then subscribes to the job's
progress and may resubscribe at any time. Each subscription begins with the
job's current state. Leaving the page or losing the stream does not affect the
job. One job runs at a time, under the same per-user writer lock as other
writes to `~/src`.

Jobs live only in the daemon's memory. When the daemon stops, a running Git is
stopped with it and the directory stays. After the restart the directory is
recognised from the filesystem as an interrupted clone: it holds nothing but a
`.git` whose origin is `https://github.com/<owner>/<name>.git`, with no index
and no ref, and Git agrees that `HEAD` has no commit. An interrupted clone is
not a workspace. The clone page shows it with its size, and only the person's
explicit "start again" or "remove" acts on it. Nothing restarts a clone by
itself, because an automatic restart could repeat a transfer of gigabytes
without anyone asking.

Cancel and native failure remove the directory the job created. Removal
works by descriptor on the directory the daemon reserved or recognised, never
follows a symlink or enters another filesystem, and stops if the name no
longer refers to that directory. The browser names a repository, never a path.

A light clone (`git clone --filter=blob:none`) is a choice on the start
request; full history stays the default. A light clone fetches older file
contents from GitHub later with the person's own credentials.

## Consequences and alternatives

The person can leave a long clone and see it again, and a failed attempt no
longer blocks the next one. A daemon restart loses the progress of a running
clone but not its evidence: the interrupted directory is found again from the
filesystem. A shell-made `git init` that contains nothing but a matching
GitHub origin is indistinguishable from an interrupted clone and is treated as
one; a workspace the product creates always has its `.agent-host/` settings
and is never mistaken.

A persistent job record would keep progress across restarts, but it would be
a second account of what is in `~/src` that can disagree with the directory,
and the recovery decision would still have to look at the directory. Keeping
the clone bound to its request, as ADR 0005 did, would keep the modal dialog
and the stale leftovers. Restarting a cut clone automatically was rejected
for the reason above.
