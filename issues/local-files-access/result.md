# Worker result — implementation preserved, not landed

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
