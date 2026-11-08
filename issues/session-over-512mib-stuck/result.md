# Result

The daemon no longer has a whole-file bound on a Pi session file. A
conversation past the former 512 MiB opens from its tail and pages back as
before, can be archived, named and rewound, and resumes after Pi has stopped.

## What changed

- Discovery no longer marks a large file `unavailable`. History, recap,
  notices, naming, archive, rewind, tail repair and the conversation status
  read the file without a size check. They already streamed one record at a
  time or read from the tail.
- The per-record bound `maxNativeLine` (= the Pi frame limit, about 137 MiB)
  is the only guard left. It refuses only a record it would have to hold
  whole, and its refusal logs `native_history_record` / `record_over_bound`
  with the size, both from forward and from tail reads.
- Rewind's structure read used a leftover 64 MiB line limit (it would have
  refused an 80 MB picture record). It now uses the shared record reader and
  its bound. So does the read of a replaced continuation.
- The readers that projected **every** entry of the file now keep only what
  they use (`retainEntry`), and they see only the active branch
  (`readNativeActive`: a tree pass, then a retain pass, with matching file
  stamps): forward paging (`?after=`) keeps limit+1 entries, continuation
  seeding keeps keys without projecting, and publication after each turn
  projects only unpublished entries. Abandoned branches (after a rewind) are
  never projected. This was the review's one finding.

## Measured (Birch, 600 MiB synthetic session, 1.1 MiB pictures)

- Before the fix, `TestLargeSessionStaysUsable` at 600 MiB: history 503
  `native_source_unavailable` (base commit, same test).
- After the fix, `OH_LARGE_SESSION_MIB=600`: paging to the first message,
  forward page, block read, rewind source, naming, archive/unarchive, and
  resume after a daemon restart all pass. Peak RSS of the test process
  (which runs the daemon controller in process) was 74–85 MB, never above
  its value right after writing the file.
- `TestLargeSessionContinuesWithNativePi` at 600 MiB: the pinned Pi resumes
  and answers.
- Per-pass cost at 600 MiB: proof 0.74 s, key seeding 0.72 s, newest page
  1.1–1.5 s, forward page 2.0 s (two passes). Projecting every entry took
  6.5–7.2 s, which publication used to pay after every turn.

## Decisions for later review

- **The test's large size is opt-in** (`OH_LARGE_SESSION_MIB`, default 40).
  The alternative was a 600 MiB file on every gate run, but that adds
  1–3 minutes and 600 MB of disk per run. The code paths are the same at
  40 MiB; only the removed bound differed.
- **Past ~256 MiB the synthetic session ends in a Pi compaction.** Pi
  serializes its whole context into one provider request, and 600 MiB of
  pictures in context exceeds V8's string limit (the resume never reached
  the provider). Real providers refuse far earlier, and Pi then compacts.
  This is Pi's and the provider's limit, not the daemon's. It is what the
  "model request" row of the step-1 table describes.
- **No new browser-facing error code for the record guard.** The guard
  names its reason in the daemon journal. The browser still shows the
  generic unavailable state. The record bound equals the send bound, so
  only a Pi echo larger than an admitted send could reach it, and how size
  problems look to the person waits on the prototype answer
  (`proto-large-content-graceful`).
- **Structure maps stay O(entries).** Whole-file readers still keep a map
  of entry IDs and parents (rewind: one small struct per entry). That is
  tens of bytes per entry, small next to Pi, which holds the whole session
  in memory. No entry-count guard was added.
- **Memory measured as the test process's VmHWM.** The alternative was a
  separately started daemon, but the controller and handlers under test
  are the daemon's own code, run in process.
