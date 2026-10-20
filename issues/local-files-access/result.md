# Worker result — implementation preserved, not landed (see latest resume below)

Taskfleet origin: `01m5cjgqhgq7g4fzxmprsdr1e9`.
Base: `b779dafa85444c17bd293056167ed4e117d47955`; the implementation is the worker commit containing this result. The issue remains in progress. No push, merge, test-server access, deployment or installation change was made.

## Verification and blockers

Required final checks are **not green**. Do not close this issue or deploy this worker as verified. Resume maintained testing after the shared runner is repaired; use `--untracked` for any new inputs if working before committing.

- Initial `./scripts/test-focused.sh --area web` passed remotely: job `c31ff5665d7c0dab3be689f315010618953455419c6e8dda8575d74fc7a28d2a`, captured snapshot `a9bf3acaed72dfb280e9764375202f55e40c73af116c96252922955148674c78`. This predates final review repairs and is **not** final-tree evidence.
- Initial daemon package run: `./scripts/test-focused.sh --area go --go-package ./internal/daemon`, job `2142fa465e7078119d995b97d93aef9a3fa821be9d569ce2b91d8ec27755ef8b`, failed. Two new test requests used the wrong HTTP Host and were fixed to `unix`. Other failures: pinned native Pi tests cannot find `/usr/bin/node`; snapshot schema tests lack Python `referencing`; terminal fixture tests fail shell survival/busy/taskfleet/lingering checks. These unrelated prerequisites/fixtures remain unresolved. Final daemon retry was refused by `spool_quota` before capture, so the repaired new Go tests have no maintained final pass.
- Initial browser run: `./scripts/test-focused.sh --area browser --spec local-files.spec.ts`, job `7e1b18be58ce1d5916ca1e05d047d3ab632ae44e27b478aaccd03392e27be978`, failed compiling the new browser-host route because its closure preceded `current`'s declaration. The route was moved below the declaration. No browser case ran. Final browser/attachments/a11y reruns remain required; they are blocked by the same spool capacity problem.
- Contract checks: two submissions failed with `io_error` reading an older retained input's `source.tar.gz`; a third failed with `spool_quota`. These were capture failures, not contract passes. Canonical fingerprints were independently recomputed with Python and agree with generated files, but this does not replace the maintained drift/validation checks.
- Final fast-web retry was also refused with `spool_quota`: retained input spool exceeds 8 GiB after lossless compaction. Final TypeScript/unit checks remain required. Gateway package tests were not run after capacity was exhausted.
- `TMPDIR=/var/tmp node --test internal/daemon/pi-device-test/local-files.test.mjs` passed after the final extension changes. This dependency-free synthetic socket test proves the tool's request, path and visible native custom receipt, not browser permission or UID isolation.
- Changed TypeScript files pass lightweight Biome check. Initial assignment-in-expression lint errors were repaired. `git diff --check`, `python3 scripts/validate-project-view.py` and `issuectl doctor --json` passed.
- Captures were deferred because Alder's maintained remote policy refuses lab/capture runs. No live screenshots or personal data were used.

## Independent review

Critical `/llm-review` used `claude-fable-5-1` as finder and `gpt-6-astra` as verifier (two calls), with `/assess-findings` classification. Five original findings were confirmed and repaired: clock-skew rejection; generic recovery errors/large-directory failure; receipt hidden inside collapsed tool output; stale grant UI after observed permission denial; ambiguous empty-list response.

The verifier confirmed four repairs and found an escaped-filename overflow in the first pagination repair: Go serializes each ampersand as six bytes. Pagination now additionally budgets 48 KiB conservatively at six bytes per UTF-16 unit plus separators, with envelope headroom. A regression uses 200 filenames containing 60 ampersands. No demonstrated cross-identity/folder/UID bypass was found statically. This is not distinct-UID runtime proof.

The finder bypassed the maintained Go wrapper and ran a system-Go focused test locally on Alder. That was a review workflow violation; its result is not counted as maintained test evidence. The verifier was explicitly restricted to read-only inspection and ran no tests. Optional model-performance logging failed because the helper's SSH-to-alder transport was denied. Ignored local working artifacts are `history/review-local-files-access.md`, `history/assessment-local-files-access.{json,md}` and the raw finder/verifier outputs; the substantive conclusions above do not depend on their retention.

Auxiliary guessed-path lookups initially hit nonexistent files; correct paths were then read. No capability was silently skipped as a result.

## Resume

1. Fleetrepo runner maintenance: provide a supported lossless archive/pruning route for terminal input bundles so the 8 GiB spool can admit captures; repair retained-input compaction's missing-archive handling. Do not delete another worker's inputs or edit queue records ad hoc.
2. Repair declared Go runner prerequisites: the native Pi fixtures need `/usr/bin/node` (or a deliberate portable fixture-path change); Go schema tests need the declared Python requirements/`PYTHON` environment; reproduce and repair the terminal fixture failures in the declared guest. The product feature itself needs no installation change.
3. Run final maintained fast web, daemon and gateway package tests, contract checks, `local-files.spec.ts` and the unchanged `attachments.spec.ts` regression. Browser tests must include the permission-handle IndexedDB roundtrip, unsupported-browser state and a11y. The new pure-client tests cover paging/escaping, clock skew, stale identity reads, claims and distinct error outcomes.
4. Once all required evidence passes, close this issue and land with a `Fixes-Issue: local-files-access` trailer. The preserved worker commit uses `Refs-Issue` because verification is unfinished.


## Resume run `01m5cksp533v796xfzwq79qzg1` — still not verified

The preserved commit was cherry-picked cleanly as `5461551d` onto main
`043a9fcf`; code tree `79f4868b01cb40975ffbd25887646f0bd1f27b76`.
No push, merge, test-server access, deployment, Fleetrepo edit, or issue closure.
**Do not deploy or close this as verified.** Required failures remain; the old
resume assumption that reclaiming the spool was the only remaining work was
incorrect. The queue admitted work again, briefly hit spool_quota again, then
admitted retries. No retained inputs or other workers' state were deleted.

### Changes and findings

- The declared Go task now prepares Node and the Python venv correctly: neither
  the previous `/usr/bin/node` failures nor missing `referencing` recurred.
- tmux 3.4 in the guest escapes the existing control separator as the literal
  `\037`. A temporary synthetic diagnostic captured
  `demo_repo-GXahVL-1\037bash\037bash`, so splitting on U+001F returned no
  rows. Replaced that separator with printable U+241F. Four initial terminal
  failures disappeared on the next maintained package run. This does not
  change identity/UID authority. Delimiter collisions retain the existing
  fail-closed exact-field-count behavior.
- `TestTerminalLingeringStartsServerAsUserService` still fails: the foreground
  server becomes reachable, `list-sessions` completes, then the queued
  `new-session ... ; set-option ...` command hits the four-second deadline.
  Synthetic-only fixture logging now captures commands and stderr on failure;
  there was no native stderr for this timeout. An experimental exact `-t =sess`
  change regressed ordinary shells (`no such session: =demo_repo-GXahVL-1`)
  and was reverted. The causal comment based on that hypothesis was removed.
  No raw native error text was added to production diagnostics.
- The supported-folder browser case reaches the first grant but fails after
  reload with `Runtime.callFunctionOn: Internal server error, session closed`,
  before Axe and revoke assertions. Unsupported-browser case passes. Waiting
  for the real IndexedDB transaction and allowing 15s did not solve it. A
  synthetic permission override also did not solve it and was reverted.
  The retained test now waits for handle persistence before reload; it still
  needs a maintained pass. This is **not** persistent external-folder permission
  proof. The fixture uses an OPFS handle and synthetic picker.
- The gateway retry and unchanged attachment browser spec pass. The original gateway failure was `TestWorkspaceGitFetchRequiresSessionAndCSRF` returning 503 and did not recur on retry. Captures remain deferred under
  Alder policy; no lab, personal browser profile, or live data was used.

### Independent review and assessment

Retained the original independent critical review for the unchanged local-files
implementation. An incremental routine review by `claude-fable-5-1` inspected
the tmux compatibility and browser-test changes (one call, --no-perf-log).
No demonstrated authority/UID regression was found in the delimiter change.
Assessment removed the unsupported causal comment and dropped the probe-creates-
empty-DB claim as unreachable after the visible grant. The finder incorrectly
accepted the experimental exact targets as safe; maintained runtime evidence
refuted that claim and the targets were reverted. Its request to log raw native
stderr in production was rejected under `internal/AGENTS.md`; only synthetic
fixture errors are captured. No new authority change survived, and no actionable
security candidate remained to send to a verifier. Existing independent feature
review remains intact; no review issues were filed.
Scratch review/assessment artifacts: `history/review-local-files-resume.md`,
`history/assessment-local-files-resume.{json,md}` and raw finder output. No model
performance logging was requested. Required test failures still block landing
regardless of review. The new fixture stderr diagnostic received focused
self-review; it executes the same installed tmux binary with the same arguments.

### Maintained command inventory

All remote commands used `TMPDIR=/var/tmp`, synthetic fixtures, and the maintained
`test-focused.sh` wrapper; browser specs were submitted individually. The shell
loops themselves can exit zero after an inner failure, so only each job's terminal
state is evidence. Local lightweight checks: dependency-free
`node --test internal/daemon/pi-device-test/local-files.test.mjs` passed;
Biome check of changed browser test passed; `git diff --check`, project-view
validator, and `issuectl doctor --json` passed. No full gate or production receipt.

- `a11y`: `no job` — refused: nonexistent a11y.spec.ts.
- `attachments-final`: `dde7bf81e8519e6dcc24c18f2eaf472a4209068468627071399870d3328c351d` — success.
- `attachments`: `fb1f49a6d1a77bfa72d59a2516cca3a5619b8daf6cf4adbe16728fbc14f228a1` — refused: spool_quota.
- `contracts`: `4232b6af2d11d0d3e3f6d0672e59bab3e0af397a4cb45eba52a8659d1ac636a4` — success.
- `daemon-repair`: `d740219799146dcb9dbdc642ece789da3fb4f8d34edfdb95f5f1f7980f95a11e` — test-exit.
- `daemon-stderr`: `ea778a9a4d5551532af8c8d9042336125c5f9bfcf510b426a4398d57dcf90082` — test-exit.
- `daemon-target`: `25f335c2b556a5eccee4c4710e79a295da368131b927d5193b2084aa3fb31734` — test-exit.
- `daemon`: `1ff7c988e732bc4fbaef0059d078fc2da13c6ba70b44d9d08af92d5e382bb66d` — test-exit.
- `diagnostic`: `46aff8c5a8703372496f776b63b78431555600e46586c3d4bb93da46a581ba48` — test-exit.
- `gateway-final`: `7ea617d501f2c3d334d05819fa43fcd45d7fa10d6472a9c61371abd5f7d1f39f` — success.
- `gateway`: `b728e83a058863a8145b51855ae4f52219fead32537a925ad51d37a0b8296e39` — test-exit.
- `local-files-final`: `ba82a526b71c1161224a947f9d2ceaea7b4b5d2485c2e41b2446c772df9615b0` — test-exit.
- `local-files-permission`: `7b11e151e912c99e854555cedf8e2a7dc9f784bce12e88a0a093ce4cc4133660` — test-exit.
- `local-files-retry`: `9fd1cb11d4792cce9aaead4377fc5b11a2d6770a929714b5eb93eca2a28cbb27` — test-exit.
- `local-files`: `eb9091d9c42f1156f7c75adeb937b5da722a286289c07c3f5886e93d210e9470` — test-exit.
- `web`: `964e9bac5cf7a17f2a1ce466a33e3a11021e7f8c8a09f501ad7d70c480638ad9` — success.

The temporary diagnostic intentionally failed to expose output and was removed.
The first persistence-test retry had a host-authored parenthesis syntax error,
then was repaired before subsequent browser runs. The guessed `a11y.spec.ts`
does not exist: it was refused before capture; the actual accessibility check is
inside `local-files.spec.ts` and remains unexecuted after its failed reload.
Auxiliary guessed-path lookups, a truncated-log JSON parse, an incorrect tar
member path, and a nonunique edit failed before being corrected; no such failure
is counted as test evidence. No independent model ran tests on Alder in this run.

### Remaining landing work

1. Diagnose and fix the tmux 3.4 foreground-server create timeout using the
   synthetic fixture trace, then pass the whole daemon package. Do not replace
   required evidence with a skip or claim the delimiter alone fixes lingering.
2. Diagnose the Chromium session-close on OPFS-handle reload, then pass the full
   local-files spec including real IndexedDB roundtrip, revoke, unsupported state,
   CSRF and Axe. Do not simply drop the persistence assertion.
3. Resolve any remaining gateway package failure, and rerun checks for the final
   runnable tree (fast web, daemon/gateway, contracts, relevant browser specs).
4. Once required evidence is green, close and land with `Fixes-Issue`.

Fleetrepo: no product installation change is established. The shared runner still
needs a supported lossless terminal-input archival/pruning operation; its 8GiB
spool briefly refused this run too. Consider runner tmux 3.6 parity with Alder,
but that does not substitute for diagnosing the declared supported 3.4 fixture.

Preserved resume commits: `d340f8c1` (tmux delimiter and synthetic diagnostics), `a6a01a5a` (browser persistence test). These remain unlanded because daemon and browser requirements are not green. Final runnable code does not carry either experimental target or permission override.
