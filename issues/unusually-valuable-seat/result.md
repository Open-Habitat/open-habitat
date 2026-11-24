# Result

Every check that went red only under the clean gate's own load was traced
from the gates' own logs (each gate's stdout keeps the browser and packaging
logs) and, where it would reproduce, from a Playwright trace taken under
synthetic load: CPU hogs (busy loops, one per core and more) beside the spec
repeated with `--repeat-each`. Two were product defects; the rest were the
tests or the harness.

## Product defects fixed

- **A queued second clone never started** (`github-stream.spec.ts`). The
  checkout observation briefly takes the daemon's `~/src` writer. A clone
  start that met it found the writer held with no clone running and answered
  `checkout_unavailable`, which the client takes as final, so the queue
  stopped for good. Clone start, remove and forge starts now queue for the
  existing brief writer wait behind any holder but a running clone
  (`internal/daemon/github_jobs_linux.go`, `TestCloneStartWaitsOutABriefWriter`
  fails without the change).
- **The release verifier missed many source maps** (`verify-release.sh`).
  `find | grep -q .` under pipefail: grep leaving at the first map killed find
  with SIGPIPE and the check read as no maps (3000 maps: missed 3 of 3). It
  now uses `find -print -quit`; the fixture guard re-signs a package with
  2000 maps and the old verifier accepts it.

## Tests and harness fixed

| Check | Cause | Fix |
|---|---|---|
| `test-gate-storage.py` exit 141 | the `sha256sum` stand-in exited without reading the checksum piped into it; echo died of SIGPIPE | the stand-in reads its input (6 of 20 → 0 of 30 under 16 hogs) |
| `attachment-documents.spec.ts:39` | waited on the paperclip, which no longer disables during uploads, then clicked a chip still changing size | waits until no chip uploads or shows its saved moment |
| `github-stream.spec.ts:34` | the product race above; also the default 5 s for two native clones in sequence | product fix; 10 s per clone |
| `pi-onboarding-race.spec.ts:6` | the abort was clicked while the Git panel was still reading; it grew and moved the button, the click hit empty space and the next click waited out the test (the `finally` reset then reported the timeout) | waits for the Git step's action first, as `github-session` does |
| `browser-conversation.spec.ts:2335` | the fake Pi's abort `message_end` lacked Pi's abort text, so the daemon journaled `message_error` and the page flashed an error notice until `agent_end` | the fixture sends the text; with 600 ms between the events the old fixture shows the notice in 3 of 3 runs, the new in none |
| `recap-resting.spec.ts:178` | asserted inside `expect.poll` that the recap read succeeds; `expect.poll` ends at the first throw, so one retryable `native_source_unavailable` failed the case | the polls treat a refused read as not yet |
| `lab-worktree-agent.spec.ts:26` | measured the intro and composer right after `setViewportSize`; the navigation follows the width partly in React state, so one read saw them in different columns | polls the offset |
| `nativegh` `TestRejectionIsConfirmedAgainstTheSameCredential` (race detector, met in a validating gate) | the test changed `verifyAfter` while the check it had scheduled could be settling and reading it under `flightMu` | the test changes it under `flightMu` (200/200 under the race detector and 12 hogs) |
| `lab-offer-title-select.spec.ts:143` (met in a validating gate) | the second click reused the point measured before the first; the opened card's panel narrows the conversation and moves the title, so the click landed on the panel | re-aims at the title once its position is still (2 of 16 failed before; the file 96/96 under 20 hogs) |
| packaging block, silent exit 1 | the regressions matched the verifier's stderr with a bare `grep -q`, so a verifier failing for another reason ended the block with no word | every expected refusal prints the verifier's own error otherwise |

## Not changed, with the evidence

The renderer crashes (`Target crashed` in `lab-conversation-scroll.spec.ts`,
the phone case and its neighbour), the design-system cluster (four cases at
once not mounting within 5 s), `lab-reply-selection.spec.ts:44` and both
silent packaging exits occurred only in the gates whose scratch was on
`/var/tmp` (rounds 1 and 2's gate 4), never in the five gates with scratch
elsewhere. Gate 4 logged 40 `no space left on device` errors; round 1 ran
before `/var` was freed. None of them reproduced under synthetic CPU load
(design-system with a cold Vite cache 88/88, lab-reply-selection 20/20 under
28 hogs). The packaging block now names the cause if it recurs.

## Filed

- `altogether-unusual-comfort`: onboarding's abort button moves when the
  Git panel loads; a person reaching for it as the step arrives can miss it
  or continue instead.
- `relatively-annoying-whistle`: in the validating clean gate,
  `TestTurnSnapshotsThroughPinnedPi` saw a rewind's switch back leave a file
  the continuation had deleted, while reporting success. It passed 22 of 22
  under 16 hogs; the likely cause is the turn-snapshot module's 2 s capture
  budget dropping the undo point under load, a product question rather than
  a test wait.

## Evidence

Under synthetic load after the fixes (8 cores, busy-loop hogs):
pi-onboarding-race 24/24 (20 hogs, 8 workers; 2 of 24 before),
attachment-documents and github-stream 24/24 (20 hogs; attachment 2 of 6
before), the whole recap-resting file and the stopped-turn case 50/50
(28 hogs), lab-worktree-agent and lab-reply-selection 24/24 (20 hogs),
gate-storage 30/30 (16 hogs).

Validating clean gates: on `7d3457696` both browser suites and packaging
were green and the Go test filed above was the only red; on `df2242ad8`
two runs each had one red: `lab-phone-account-sheet.spec.ts:15` (the drawer
already open after Settings and Back; 24/24 under 20 hogs, not reproduced,
also seen once in round 1) and the race and offer click fixed above. The
gate on the landing commit is reported with the run, since a receipt names
the exact tree and this file is part of it.

