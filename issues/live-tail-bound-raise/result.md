# Result

The live tail now holds 1000 frames and 1 MiB per conversation, up from 128
frames and 128 KiB (`internal/daemon/events_linux.go`). The browser's matching
fragment bound is 1000 as well (`liveTailFragments` in
`web/src/app/conversationEvents.ts`).

## Measurement

Pi publishes a run's history entries only when the run settles, so the tail
holds the whole run.

- **Per tool call, lab (exact):** `TestLongRunFitsLiveTail` drives Pi-shaped
  RPC turns through `publishDelta`: turn_start, thinking, tool-call delta and
  end, tool started/updated/finished, turn_end. That is 8 frames per tool
  call. At the busy size, where every result reaches the 4 KiB live cap and is
  carried by both `tool.updated` and `tool.finished`, a turn is 13.5 KiB. A
  frame envelope is about 370 bytes.
- **Real runs, Birch (metadata only):** `measure_runs.py` replays the same
  projection over the native session files of the `maintainer` account. It
  reads entry types, roles, stop reasons and UTF-8 JSON byte sizes, never
  content. 92 runs:
  - tool calls: median 7, p95 31, max 55
  - frames: median 51, p95 174, max 404
  - bytes: median 55 KiB, p95 246 KiB, max 453 KiB
  - over the old bound: 8 runs on frames (>128), 18 runs on bytes (>128 KiB).
    Bytes were the bound that bit more often.
  - over 512 frames or 512 KiB: none.

  The largest runs (tool calls / frames / KiB / steering messages) were
  55/404/453/3, 47/354/386/0 and 31/237/276/3.

1000 frames is the snapshot contract's `live_tail` `maxItems`, so the contract
does not change. 1 MiB holds about 125 tool calls of the average measured size,
or about 75 at the busy size. Both are more than twice the longest measured
run.

## Memory bound

- Per running conversation the tail holds at most 1 MiB. Its frames are the
  same byte slices the per-UID event ring (16 MiB, 1024 frames) holds while the
  ring still has them, so the extra memory is usually only merged text frames.
  A settled conversation keeps only a running `!` command's output.
- Each workspace snapshot carries every running conversation's tail, so a
  snapshot can grow by up to 1 MiB per running conversation, up from 128 KiB.

## Tests

- Daemon:
  - `TestLongRunFitsLiveTail`: the longest measured run (55 calls) at busy
    size stays live. It checks the event ring for any `ring_truncated`, because
    a tail given up and resumed would look whole at the end. It fails with the
    old constants.
  - `TestJournalOverflowResumesAtNextModelTurn`: exactly `tailFrames` frames
    fit, and the next gives the tail up.
  - `TestJournalTailByteBound`: the byte bound is used in full, and the first
    frame over it gives up.
  - The two older overflow tests are scaled to the new byte bound.
- Browser unit test: the fragment bound is 1000, with exactly 1000 kept and
  the 1001st given up, then resumed at turn_start.
- Browser spec `live-long-run`: the fake-Pi long run is now 130 turns and
  sends `toolcall_start` as Pi does, which gives 8 frames per turn and about
  1040 in total. So it still crosses the new bound once and exercises
  resume-at-turn_start. The spec counts `ring_truncated` invalidations on the
  app's own event stream and requires at least one. Without `toolcall_start`
  the drain hides the argument delta, and the run stays under the bound; that
  version fails the new assertion.

## Decisions for later review

- **Workspace snapshot size:** during a run the browser re-reads the workspace
  snapshot up to once a second per tab. That snapshot now carries up to 1 MiB
  of tail per running conversation; in the longest measured run it reached
  about 450 KiB near the end. The browser uses `live_tail` only to seed a
  window it has not opened live yet. A snapshot that carried tails only on
  request would remove this cost, but that is a contract change and is not
  done here.
- **Frame bound at 1000:** it was set to the contract's `maxItems` rather than
  a round 1024 so that the contract stays as it is.
- **Not pruning per model turn:** the tail still holds the whole run rather
  than being pruned at each turn. The reasons are those in
  `live-gap-banner-returns`: a mid-run opener's snapshot, and the turn clock.
  A run longer than about 125 calls gives the tail up once and resumes at the
  next model turn.

## Checks (Birch, worktree)

- `scripts/test-focused.sh --area go --go-package ./internal/daemon` passes.
- `go vet ./test/browser-host/` passes.
- `scripts/test-focused.sh --area web` passes.
- `scripts/test-focused.sh --area browser --spec live-long-run.spec.ts` passes.
  It fails as intended without the fixture fix.
- Review: `/llm-review` (gpt-6-astra finder, verifier not needed) found two
  should-fix findings: the fixture did not cross the bound, and the script
  counted characters as bytes. `/assess-findings` classed both as FIX, and
  both are fixed here.
