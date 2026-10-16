# Why browser actions feel slow

Measured 2026-10-16 on the test server (`open-habitat-test-nbg1`, 2 vCPU,
pilot.163, five workspaces, 23 Pi session files, three Pi processes running)
and read from the code at `e9bec7d5`. Live numbers come from `curl` against the
mapped user's daemon socket as the gateway peer and from a six-second
`strace -e execve` of the daemon; no conversation content was read.

## What happens after a click

Every mutation in the browser follows the same shape (`App.tsx` `changeArchive`,
`closeConversation`, `WorkspaceManagement`, `NewWorkspace`, `WorkspaceGitHub`,
`PiModelSelector`): `await` the write, then call `refresh()`. The control stays
in its busy or pending state until a *snapshot* shows the new fact
(`pendingArchive` is cleared only when a snapshot lists the agent as archived).
`refresh()` bumps `refreshKey`, which runs four sequential round trips: account
session, `/api/v1/snapshot`, account session again (`stillBound`), then the
conversation list.

The same `refresh()` is also the handler for almost every event on the stream:
`snapshot.invalidated`, `process.changed`, `agent.changed`, `workspace.changed`,
`title.changed`, `source.warning` all call `onSnapshotNeeded`
(`conversationJournal.ts`). The history watcher turns every burst of Pi session
writes into `snapshot.invalidated` after 250 ms coalescing
(`history_watch_linux.go`, `events_linux.go`). So while any Pi turn is running,
the browser requests a full snapshot several times a second, and the user's
own action adds one more on top of the one the event already triggered.

## What a snapshot costs

| Request on the daemon socket | Live result |
| --- | --- |
| `GET /api/v1/snapshot`, six warm runs, nothing else running | 1.14–1.30 s, 22.9 kB |
| same while another snapshot was in flight | 2.41 s |
| `GET /api/v1/conversations` | 0.6 ms |
| gateway TLS round trip on the guest, no daemon work | 11–15 ms |

The snapshot handler re-derives everything from scratch on every call
(`snapshot_linux.go`). One snapshot spawned about 30 child processes in the
trace:

- `taskfleet run list` to hide taskfleet worktrees (~100 ms).
- For each git workspace, three `git` runs for the remote classification
  (`remote get-url`, `rev-parse`, `for-each-ref`) and two for the summary
  (`symbolic-ref`, `status --untracked-files=all`): 25 processes for five
  workspaces, ~0.5 s together. A stale index made one `git status` take
  844 ms; warm it is ~30 ms per workspace.
- `gh auth status` followed by `gh api user`: a network round trip to
  GitHub on every snapshot, ~1.0 s in the trace (`nativegh/native.go`
  `identityDetail`, called through `nativeStatus`).
- A walk of the Pi session tree reading each file's header, a `/proc` census
  of every process of the user, and a 600 ms-bounded inventory call to each
  controlled Pi.

The GitHub call alone is most of the fixed cost, and the git work grows
linearly with workspaces. Jari's own home has 313 session files (314 MB), so
the header walk is a further per-snapshot cost on a real account that the
test server does not show.

The write itself is not the slow part for archive. `archive_linux.go` re-walks
the session tree, reads the whole session file twice (`reconciledNativeHistory`),
runs a `/proc` census and fsyncs the annotation; that is tens to low hundreds
of milliseconds, serialised behind `cloneWriter`. The second or more that Jari
sees is the refresh chain that follows: four round trips, of which the snapshot
is 1.1–2.4 s, often queued behind a snapshot an event already started.

## Causes, ranked

1. **The snapshot is the only answer to "what changed", and it costs 1–2 s.**
   It re-runs GitHub authentication over the network, `git status` for every
   workspace, taskfleet discovery and a process census on each request, with
   no memory between requests.
2. **The browser does not apply results it already has.** `setArchive`
   validates the daemon's returned archive state and then discards it, waiting
   for a snapshot to say the same thing. Every action therefore pays the
   snapshot cost before the UI changes.
3. **Refreshes are redundant and fan out from Pi writes.** The action's own
   `refresh()` and the event's `onSnapshotNeeded` both run, and every
   session-file burst during a turn triggers another full snapshot. On a 2 vCPU
   host these snapshots contend, which is the 2.4 s case.
4. **One refresh is four sequential round trips** where one would do.

## Options

**Current pattern.** Mutation, then full re-read of everything. Simple and
always consistent with native state, but the latency floor is the snapshot
cost, and every new feature inherits it, which is exactly Jari's observation.

**A. Keep the pattern, make the snapshot cheap.** In the daemon, remember the
expensive facts and recompute them only when their inputs change: GitHub
identity until `gh`'s credential files change, git remote and summary per
workspace keyed by `.git` mtimes or recomputed in the background and published
as `workspace.changed`, taskfleet runs on a short timer. Run the independent
parts concurrently. Expected snapshot: well under 100 ms on the test server.
Daemon-only, contract unchanged, measurable this week. It does not change the
shape: every click still waits a round trip plus four requests, and the browser
still re-reads everything on every event.

**B. Mutations and events carry the changed facts; the snapshot is for start
and recovery only.** The daemon already knows the exact result of an archive,
a close, a title change or a settings save; it returns it, and the browser
applies that result to its Redux snapshot at once. Events such as
`agent.changed` and `workspace.changed` carry the new fact in their payload
instead of being a request to re-snapshot, and `snapshot.invalidated` from the
watcher refreshes only the affected agent's metadata. The snapshot remains the
recovery path after a stream break or instance change, as ADR 0008 and 0009
already frame it for conversation content. This removes the round-trip wait
from the visible path for most actions; the click shows its result when the
daemon's reply arrives, typically tens of milliseconds through the gateway.
Cost: per-resource reducers in the browser, payloads in `contracts/v1/`, and a
daemon that publishes facts rather than hints.

**C. Optimistic UI.** Show the result before the daemon replies and roll back
on refusal. Instant, but this daemon refuses writes for real reasons
(`control_uncertain`, `writer_conflict`), and a rollback of an archive that
already navigated away is confusing. Worth doing only for the control's own
visual state (the button changes immediately, the notice appears) while the
list change waits for the reply.

## Recommendation

Do A now and B as the structural change, and treat C as a per-control detail
inside B.

A is the quickest relief and is needed anyway: even with B, the snapshot still
runs on page load and on recovery, and a 1–2 s GitHub call per load is not
acceptable. B is what makes the application feel immediate and stops every new
feature from inheriting the wait. The migration is incremental:

1. Daemon: cache GitHub identity and git facts, run snapshot parts
   concurrently, measure `GET /api/v1/snapshot` on the test server below
   100 ms.
2. Browser: collapse `refresh()` to one snapshot request (session facts can
   ride on the snapshot or run in parallel), and skip the action's own
   `refresh()` when the stream will deliver the change.
3. Contract: add payloads to `agent.changed` and `workspace.changed`; add
   reducers that apply them; stop calling `onSnapshotNeeded` for events that
   carry their fact. Start with archive, close and title, then workspace
   mutations and settings.
4. Mutation replies: apply the returned fact locally (`setArchive` already
   receives it), and make the control reflect its new state on the reply, not
   on the next snapshot.

What is not recommended: a browser-side cache of host facts that outlives
events, or a second store of workspace state. B keeps the daemon the single
source and the browser a viewer that applies what it is told, which is the
constraint in `CLAUDE.md`.

## Reproduction

On the guest as root, with the mapped user's daemon running:

```sh
S=/run/open-habitat/users/maintainer/daemon.sock
runuser -u open-habitat-gateway -- curl -s -o /dev/null --unix-socket $S \
  -H "Host: unix" -w "%{http_code} %{time_total}s\n" http://unix/api/v1/snapshot
P=$(systemctl show open-habitat-daemon@maintainer.service -p MainPID --value)
timeout 6 strace -f -tt -qq -e trace=execve -p $P 2>&1 | grep execve
```
