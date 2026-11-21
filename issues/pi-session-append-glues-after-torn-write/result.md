# Result: a failed Pi append no longer glues the next entry onto its tail

## Change and reason

At `session_start` the companion (`internal/daemon/process-extension.mjs`,
`guardSessionWrites`) wraps the pinned Pi 1.5.2 manager's `_persist`. When a
native write throws, it makes the disk follow Pi's own in-memory rollback:
it removes exactly the bytes the failed call wrote, and only after proving
they are a prefix of what that call meant to write. For an append that
means truncating to the size before the call; for a failed first flush it
means removing the file that call created. Shrinking a file needs no free
space, so this works at a full quota. The file is then byte for byte what
it was before the call, Pi's memory agrees with it, and the same Pi process
carries on natively once there is room. No turn is stopped and no history
is guessed at.

When the bytes cannot be proven to be the failed call's (the starting size
was unknown, the tail is longer than the entry, its bytes differ, or the
cut itself fails), nothing is removed. Every later append through that
manager is refused, so nothing can glue onto the tail, and the companion
asks Pi to abort and shut down. After Pi has exited, the daemon's existing
owner-fenced `readyNativeTail` quarantines the torn bytes and cuts the
incomplete final line before the next start. Pi's graceful shutdown waits
for an idle session, and its run finalizer can throw on the refused writer
before it settles the run, so a watchdog sends SIGTERM after 10 s and again
5 s later. Pi's own handler kills its tracked children on each signal and
exits on the second. The watchdog stays armed until the process ends,
because `session_shutdown` runs inside `dispose()`, before later handlers
and credential writes that have no bound of their own.

### Why this design

- **A newline guard alone is not enough for Habitat.** It protects the next
  record for Pi's tolerant loader, but it turns the fragment into a
  terminated invalid interior line, which Habitat deliberately refuses as
  `history_damaged`.
- **Stopping Pi on every failure (the earlier draft on the rescued branch)
  hung.** Its own review showed that once the writer was latched, Pi's run
  finalizer threw while flushing queued custom messages (for example a
  process's default `onKilled` context notice), `_isAgentRunActive` never
  cleared, and both RPC shutdown and `dispose()` waited forever. A proven
  rollback avoids stopping at all in the common case, and the watchdog
  bounds the rare fallback. The native RPC test reproduces a session that
  never goes idle and shows that the watchdog ends it in about 10 s.
- **A turn hook is too late.** Notices and several messages can append
  within one turn, so the guard has to sit on the write itself.

## Reproduction and checks

Pinned `@earendil-works/pi-coding-agent` 1.5.2, Node 22. Base `main` at
`3f8ab4e8`.

- **Real kernel ENOSPC** (`pi-device-test/fixtures/session-enospc.mjs`;
  the command is in its header): rootless Podman, Ubuntu 24.04, no network,
  a private 1 MiB tmpfs filled with a filler file. Unguarded: the SDK wrote
  7,911 partial bytes, then the next append after freeing space was glued on
  and lost on reload. Guarded: the file was back to its pre-call bytes, a
  second attempt while still full was undone too, and after freeing space
  the later entry survived reload and every line parsed. This exercises a
  full filesystem, not a kernel quota (EDQUOT); the failure shape is the
  same.
- **Companion node tests** (`session-write.test.mjs`, against the real
  `SessionManager`, with only the fs call faulted): the native glue
  reproduction; a torn append cut back and the conversation continuing; a
  zero-byte failure; a torn first flush removing its file so the next write
  starts it again; unproven bytes (foreign tail, tail longer than the entry,
  unknown starting size) kept, later appends refused, Pi asked to stop, and
  the latch kept across `/reload`; a first write refused with `EEXIST`
  removing nothing; in-memory sessions; a missing seam failing setup.
  Four tests run the real pinned Pi CLI in RPC mode with the
  product companion: a torn append undone and the same Pi writing on; an
  unproven tail stopping Pi gracefully with stdin still open and the bytes
  untouched; a command that never settles, and a later extension's
  `session_shutdown` handler that never settles, both ended by the
  watchdog in bounded time (about 10 s and 15 s).
- The whole companion suite: `node --test internal/daemon/pi-device-test/*.test.mjs`
  (138/138). Five existing tests' fake session managers gained a `_persist`
  stub, because a missing seam now fails setup.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`,
  which launches the real Pi with the companion: passed (254.9 s) before
  the review fixes. The re-run after them failed only
  `TestWorkspaceDeleteDuringSnapshotGitInspection`, a test-side fork/exec
  race in workspace deletion (filed through intake as
  `partially-godly-friends`). That test passed 3/3 on its own, and the
  review fixes touch only the companion's failure path.

Evidence (synthetic only) is under
`/var/tmp/agent-keep/pi-session-append-glues-after-torn-write/`:
`native-enospc-rollback.log`, `session-write-rollback.log` (this round) and
the rescued round's logs and reviews.

No wire contract, browser surface, packaging input, daemon code or
authorization boundary changed. The guard runs inside the person's own Pi
process, and it only ever shrinks that person's own session file back to
bytes it has just read.

## Review

Independent `/llm-review` at critical rigor, because the guard truncates
or removes a person's session file: GPT-6 Astra as finder, Claude Fable 5.2
as verifier, then `/assess-findings`. Two findings, both confirmed and fixed
here:

1. The rollback had no writer exclusion between its check and the cut, so
   a terminal Pi's append landing in that window would be cut with it; and
   a first write refused with `EEXIST` on an empty file unlinked a file the
   guard had not created. Fixed: no unlink after `EEXIST`, and an inode and
   size re-check immediately before the cut. The residual window (adjacent
   syscalls) is accepted, see below.
2. The watchdog was cleared in `session_shutdown`, which runs before the
   rest of an unbounded shutdown. Fixed: it stays armed until exit, with a
   test for a hanging later shutdown handler.

## Upstream handoff

`upstream-report.md` is ready for the conductor to post at
https://github.com/earendil-works/pi/issues/new. It names the related
upstream items #8345 and #11460/#11486, gives a kernel-ENOSPC reproduction,
proposes a trailing-newline check before `appendFileSync` plus the on-disk
rollback as a complement, and offers a PR with tests. Upstream `main`
(v1.6.0) still has the gap. Nothing was posted by this worker.

## Live check

Not run on a test server: no real account's quota or filesystem was
filled. The same check on an isolated synthetic account with a small quota:
send messages until a write fails part-way; free space; send another
message in the same conversation without restarting. The conversation
continues, and reopening it shows every message except the one that failed.

## Decisions for later review

- **Roll the failed write back in the companion instead of only stopping Pi
  or adding a newline.** Alternatives: a newline before each append (still
  an invalid line that Habitat refuses), stopping Pi and letting the daemon
  repair the tail (hangs when Pi cannot become idle, and needlessly ends the
  turn), or live repair in the daemon (it does not own the running writer).
  The rollback cuts only bytes proven to be the failed call's own, and
  touches nothing in any other case.
- **On an unproven tail, refuse further appends and stop Pi with a bounded
  SIGTERM watchdog (10 s, then 5 s).** A forced exit can skip Pi's
  credential-refresh settlement and pi-processes' own cleanup. Pi's signal
  handler still kills its tracked children. The trade-off is accepted
  because this path is rare and the alternative is a hung conversation.
- **Accept a residual race with an unlocked concurrent writer.** Node cannot
  take the write lease that the daemon's own tail repair uses, so an append
  by a terminal Pi on the same session that lands between the guard's last
  check and its cut (two adjacent syscalls) would be cut with it. Such a
  record would sit on the fragment's line and be unreadable anyway, and at
  a full quota that writer's append would normally fail too. The
  alternative, never cutting in-process and stopping Pi on every failed
  write, ends the person's turn every time the quota fills.
- **Use the pinned private `_persist`, `flushed`, `fileEntries`, `persist`
  and `sessionFile`.** The public extension API has no hook on every
  session append. The device tests drive the real SDK, so a pin bump that
  changes these fails there, and a missing `_persist` fails companion setup
  instead of silently running unprotected. Remove the guard once upstream
  ships an equivalent fix.
- **Not added to KOKEILTAVAA.** Exercising it needs a filled quota on a
  test account; the live check above describes how.
