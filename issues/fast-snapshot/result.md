# Result: cheap snapshot

`GET /api/v1/snapshot` no longer rebuilds everything on every request. The
daemon keeps each expensive derived fact in memory and derives it again as
soon as one of its native inputs changes. No copy is written anywhere.
Discovery, the process census and the controlled-Pi inventory are still
observed on every request. The browser requests the snapshot for
agent-scoped invalidations (Pi file writes during a turn) at most once a
second, ending with the last one. No contract change.

| Fact | Kept until | Code |
| --- | --- | --- |
| Native GitHub state (`gh auth status`, `gh api user`, helper, credential fill) | the stat stamps of gh's `hosts.yml`/`config.yml`, Git's global configuration (symlink targets and include/excludesFile targets included), the gh/git binaries or an adapter mutation change; rechecked in the background after 5 min (30 s for `unknown`) for remote revocation; keyring-backed answers are never kept | `nativegh.ObservedStatus`, `GitConfigStamp` |
| Git remote classification, branch, change count | any inotify event on the worktree (minus Git-ignored directories), its Git directory or the common directory, or a global Git configuration change; ignore/index/config events also rebuild the watch set | `daemon/snapshot_git_watch_linux.go` |
| Pi session header, first prompt, native name | the session file's stat stamp (dev, inode, size, mode, uid, mtime, ctime) | `sessionFileFacts` |
| `taskfleet run list` | stamps of the binary, `runs/`, each run's `manifest.json`, `nodes/` and node records (supervisor heartbeats and logs excluded) | `taskfleetRunFacts` |

Before answering, each snapshot drains the inotify queue under the watcher
lock. The kernel queues an event within the system call that changed the
file, so a change that finished before the request is always seen. The
remaining parts (GitHub state, Pi inventory, session read, per-workspace Git,
up to four at a time) now run concurrently.

## Measurements

**Live before** (test server, release `7601f1f1`, 2 vCPU, six Git workspaces
among nine entries, 31 session files, `curl` on the mapped user's daemon
socket as in `5f8a86c9`, 18:28 UTC): warm 0.96–1.26 s (eight runs), two
overlapping 1.09–1.15 s. An `strace -e execve` attributed about 1.3 s to the gh
chain (`auth status`, `api user`, `config get`, `git config`,
`credential fill` → `gh auth git-credential`). There were 5–6 git processes
per workspace run in sequence and one `taskfleet run list` of about 100 ms.
The test user had 4 processes and 60 open fds, so the census is negligible
there.

**Lab** ([measure-snapshot.mjs](measure-snapshot.mjs), signed-in lab page,
in-page fetch through the lab gateway; gh is stubbed, four real Git repos;
[lab-snapshot.jsonl](lab-snapshot.jsonl), three runs of ten each):

| | warm median | slower of two overlapping, median |
| --- | --- | --- |
| before (`15b2a769`) | 37.3 / 41.1 / 43.1 ms | 41.9 / 41.2 / 48.1 ms |
| after (final tree) | 19.5 / 19.7 / 19.5 ms | 34.5 / 28.4 / 24.3 ms |

**In-process benchmark** (`BenchmarkSnapshotWarm`: nine Git repositories of
40 files with one change each, 24 sessions, gh stubbed; Alder i3-12100F):
77–93 ms per warm snapshot on `15b2a769`, 17.1–17.7 ms after. Of the
remainder, 82% is the per-request `/proc` census, which is large on Alder
(257 processes, ~5 100 fds for `jari`) and small on the test server.

**Live after** (conductor, release `4f6610d5`, 2026-10-16 ~19:40 UTC, same command, nine warm runs): 5–18 ms, median ~9 ms. Earlier note: not measured in this run. The worker does not push, so the
release watcher has not yet deployed it. Expected: the GitHub and Git terms
(~1.2 s) are gone after the first snapshot. What is left is discovery, the
census over 4 processes, the Pi inventory and JSON, so tens of milliseconds.
Measure after the release with the same command:

```sh
S=/run/open-habitat/users/maintainer/daemon.sock
for i in 1 2 3 4 5 6 7 8; do runuser -u open-habitat-gateway -- curl -s -o /dev/null --unix-socket $S -H "Host: unix" -w "%{http_code} %{time_total}\n" http://unix/api/v1/snapshot; done
```

The first request after a daemon start pays the full cost once (it also sets
up the watches).

## Tests

- `internal/daemon/snapshot_facts_linux_test.go`, through the real snapshot
  handler with a controller and a synthetic home. These cases show up in the
  very next snapshot: a worktree edit; a new directory and then a file inside
  it; ignored output, followed by the ignore rule's removal and a file in the
  formerly ignored directory; a globally ignored directory becoming visible;
  edits to a force-added file in an ignored directory; commit; branch switch;
  remote added; a global `~/.config/git/ignore`; a linked worktree's branch;
  its own index (outside its tree); its edits; and a workspace replaced under
  the same name. Unchanged workspaces and ignored churn are not re-observed.
  Pi titles follow appended names, and new and removed files appear and
  disappear. Taskfleet is listed once while unchanged, again on a new or
  rewritten node record, and not on heartbeats.
- `internal/nativegh/native_test.go`: these each change the next answer:
  hosts.yml, `~/.gitconfig`, a symlinked `~/.gitconfig` target, an included
  file, and an adapter mutation. The remote-revocation recheck works.
  Keyring answers are not kept. A caller whose inputs changed during an older
  flight does not get its answer.
- `web/src/app/conversationJournal.test.tsx`: the first agent hint refreshes
  at once and a burst refreshes at most once a second, ending with the last
  hint. Stale answers during a burst are paced too. User-scoped and workspace
  events are not delayed.
- The key invalidations were mutation-checked: without the linked-worktree
  Git directory root, rewatch on directory creation, rewatch on
  global/index changes, the flight check, symlink following in the config
  stamp, or the paced retry, a test fails.

Checks run: `go vet ./...`; `go test` for `internal/daemon`, `nativegh`,
`transport` and `cli`; `-race` on the snapshot, conversation and archive
tests; `scripts/test-focused.sh --area web`; browser specs
`browser-conversation`, `reconnect-recovery`, `terminal-sync`,
`native-history`, `workspace-slice`, `spinoffs`, `queued-send`,
`lab-live-turn`, `lab-conversation`, `lab-workspace-page`. Known
pre-existing failures only: the six daemon Pi
credential/device/model/startup tests, plus lab-conversation "expired
combined cursor" and the intermittent "combined stream gap".

Review: `/llm-review` with gpt-6-astra as the finder and claude-fable-5-1 as
the verifier. Six candidates came back and five were confirmed. The ignore set
was not rebuilt on global/index changes. Symlinked and included gitconfig were
not stamped. Keyring lock state is not a file. A caller could join an older
status flight. The stale-answer retry bypassed the pacing. The sixth, symlinked
taskfleet records, was refuted as a security issue, but a guard was added
anyway. All are fixed with tests.

## Decisions for later review

- **Remote token revocation is seen within five minutes, not at once.** A
  token revoked on github.com has no local input. The first snapshot after
  five minutes still answers the old state and starts a background recheck.
  A synchronous recheck would put the 1 s GitHub call back on a click every
  five minutes.
- **Keyring-backed gh logins are not remembered.** Locking a keyring writes no
  file. An account whose token is not in `hosts.yml` keeps paying the gh call
  on every snapshot. The test server uses `hosts.yml`.
- **Changes inotify cannot see.** These are writes through `mmap`, remote
  writes on a network filesystem, and changes inside a Git-ignored directory
  that a later global include re-enables without touching any stamped file.
  They stay unseen until the next event in that workspace. A workspace over
  4 096 watched directories, or a home over 8 192 (the test server allows
  29 376 per user, shared with Pi), is observed on every snapshot rather than
  watched.
- **Taskfleet's run layout is read for the stamp only.** The stamp reads
  `manifest.json` and `nodes/`. A run directory without a manifest, or a
  symlinked record, makes the listing uncacheable rather than stale.
- **Pacing is in the browser, at 1 s, for every agent-scoped invalidation.**
  The daemon uses the same event for controller state changes as for file
  bursts, and the contract has no reason to tell them apart. The first hint
  after a quiet second still refreshes at once. Telling them apart would need
  a contract reason value. Option B in the analysis (events that carry their
  facts) removes the need.
- **The `/proc` census stays per request.** Process facts have no stable
  native input. It is most of the remaining cost on a busy account (Alder).
