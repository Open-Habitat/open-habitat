# Result

All nine lab failures were stale tests. No product code changed. Running the
whole default suite also turned up two load races in other specs, and both are
fixed here as well.

## Lab failures (all stale expectations)

- `lab-composer-area.spec.ts` "Enter steers, Alt+Enter queues…": the dictation
  mic (`e253d0d1`) sits between the file picker and the mode chip, so tab order
  now passes `dictation-mic` before `composer-mode`. The test now names it in
  the walk.
- `lab-composer-area.spec.ts` "composer on a phone…": the mic's label hides
  while Pi works, like the attach, command and file labels. There are now four
  hidden labels, not three. The row still fits within 390 px.
- `lab-english-url-paths.spec.ts`: the speech sections added `/settings/speech`
  (after `ai`) and `/settings/speech-key` (after `ai-key`). The unit contract
  `settingsRoute.test.ts` already listed them; the lab spec did not.
- `lab-skill-invocation.spec.ts` (six sizes): the load loop waited for
  `[aria-busy="true"]` to clear. The Button primitive has never set aria-busy;
  it marks an in-flight read with React Aria's `data-pending`, so that wait
  never matched anything. On the third pass the loop counted the button while
  the final chunk was still loading, clicked it, and the completing read
  removed it, so the click waited until the test timed out. Instrumentation
  showed both 64 KiB chunks returning 200 and the panel reaching
  `END OF RECORDED INSTRUCTION`, so the product works. The loop now waits for
  `data-pending` to clear.

## Default-suite races found while proving the suite green

- `browser-conversation.spec.ts` "warm controlled return…" (1 of 24 under
  8-worker load): its trace shows the extra `file-offers` and `start_page`
  reads belonged to the *second* conversation's own mount. They landed after
  its field was enabled but before the measurement listener was attached. The
  measured return to the first conversation read neither. The spec now waits
  for those two mount reads before it starts measuring. Afterwards: 72/72 under
  the same load, and the whole spec passed 72/72.
- `long-pause-composer.spec.ts` "(stream drops)": during the one-hour
  fast-forward the event stream failed three times while offline, and the
  journal's transport backoff is `min(3 s × failures, 30 s)`. The first read
  after wake therefore came after the default 5 s poll ran out. The poll now
  covers the 30 s backoff bound. Afterwards: 24/24 under 8-worker load.
- `site-ai-key.spec.ts:205` ran out of its 30 s test budget once under load
  average 15. It passes in about 10 s alone. It is filed unlaned as
  `site-ai-key-journey-times-out-under-load` and not changed here.

## Verification (Birch, 2026-10-28, OH_PORT_BASE=15300)

- Whole lab suite `./scripts/test-focused.sh --area browser --lab`: 151 passed
  (before the default-suite fixes) and 151 passed on the final tree.
- Whole default suite `./scripts/test-focused.sh --area browser`: four runs.
  The first three each failed one different, untouched load-sensitive case
  (warm return, site-ai-key, long-pause), with 425 passed each time. The final
  run on the final tree passed 426 with 3 skipped.
- `./scripts/test-focused.sh --area web`: passed.
- Review: focused self-review. Only test files changed; no daemon, contract,
  session state or authority path was touched.

## Decisions for later review

- The warm-return spec waits for the second conversation's mount reads rather
  than adding `file-offers` and `start_page` to its allow-list. The
  alternative would hide a real reread on return, which is what the case
  exists to catch.
- The long-pause poll timeout is set to the product's own backoff bound. The
  alternative was to advance the fake clock until the retry fires, which would
  change the timeline the spec deliberately models.
