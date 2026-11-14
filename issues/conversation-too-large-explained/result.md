# Result

The issue's premise no longer holds, so no `too_large` state was added.
Two changes made the day after the issue was filed already cover it:

- `e82bebae` (`session-over-512mib-stuck`) removed the 512 MiB whole-file
  bound. Discovery no longer marks a large file `unavailable`. History,
  naming, archive, rewind and resume all stream the file. The only remaining
  guard is the per-record bound (`maxNativeLine`,
  `internal/daemon/native_stream_linux.go`). Its measurements cover
  600 MiB, including a resume with the pinned Pi.
- `6558c03b` (`large-content-graceful`) added the browser text this issue
  asked for (`web/src/components/ConversationWeight.tsx`,
  `web/src/text/conversationWeight.ts`, thresholds in
  `web/src/app/largeContent.ts`). It warns once from 384 MiB, while the
  conversation still works. From 512 MiB it shows a standing banner in
  Finnish and English that advises continuing in a new conversation and
  says this one stays readable and archivable. It has a "New conversation"
  button.

A conversation over 512 MiB therefore never reaches the generic
"Historiaa ei voitu tarkistaa" mark because of its size.

## What changed here

- A regression test, `TestDiscoveryKeepsConversationOverFormerBoundReadable`
  (`internal/daemon/history_linux_test.go`). Discovery must report a
  600 MiB session (a sparse file, so only the header is written) as
  `readable` with its size, because the browser's advice depends on that
  size. If a whole-file size gate came back in discovery, this test would
  fail.

## Decisions for later review

- **No `too_large` history state, no contract change.** The other option
  was to add the state anyway as a guard against a future bound. A state
  that no code path can set is dead contract, and the existing 512 MiB
  banner already says what to do. This issue's reason for keeping the
  bound was that Pi loads the whole file into one V8 string. The 600 MiB
  measurement in `e82bebae` refutes that for resume. Pi's limit shows up
  as a compaction when a request gets too large, not as a refusal to open.
- **The per-record bound still shows the generic unavailable state.** Only
  one record over about 137 MiB can trigger it. That cannot happen through
  an admitted send, because the record bound equals the send bound.
  `e82bebae` deliberately left it without a browser code. This issue does
  not cover it.
- **Archive works for a large conversation** already. Archive is part of
  what `e82bebae` measured at 600 MiB.

## Live check

None new. On the test server, a conversation over 384 MiB still shows the
one-time "Keskustelu on kasvamassa suureksi" note. Over 512 MiB it shows
"Keskustelu on hyvin suuri" with a "Uusi keskustelu" button, and it stays
openable and archivable. Making such a file takes a synthetic session.
