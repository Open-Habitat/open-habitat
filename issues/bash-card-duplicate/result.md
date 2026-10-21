# Result

Based on `20b0dda46a412af462ad37baac00df282666d4ab` plus this focused diff.

Reproduced both failures in host-backed synthetic Chromium before fixing:
`command-cards.spec.ts` found the live card wider than the transcript and two
cards after settled `!!git status`.

Idle bash completion has no `agent_end`, so its saved entry was read through a
file invalidation without retiring streamed output. Completion now publishes
native **bash entries only**, retiring output in the event stream and snapshot
tail. Other native entries remain owned by assistant settlement. The live card
now occupies the timeline column. The fake Pi follows the pinned SDK's idle
append-before-reply ordering; saved/live selectors use stable data attributes.

Independent review (`claude-fable-5-1`) caught a status/page-ordering hole in a
discarded client-side proposal, then the need to restrict publication to bash.
Both findings were addressed. Native regressions cover repeated identical
commands, clean snapshot tails, and preservation of assistant settlement keys.

Checks:
- `go test -race -count=1 ./internal/daemon ./test/browser-host`: passed,
  75.047 s / 3.248 s (85 s command elapsed).
- `./scripts/test-web-fast.sh`: passed, 81 files / 471 tests, 23.77 s Vitest
  (26 s elapsed).
- `cd web && npx playwright test tests/command-cards.spec.ts`: both passed
  (117 s command elapsed);
  covers running width, cancellation, keyboard disclosure, axe, repeated
  identical commands, mobile width and native saved cards after reload.
- Generated-contract drift, project-view validator and `git diff --check`:
  passed. No full gate, packaging run or deployment by this worker.

This is synthetic browser/host evidence, not live-server or distinct-UID proof.
Native-entry/status observations remain asynchronous: a cached running status
can briefly retain the live placeholder until the next status observation;
tests establish settled cardinality, not zero-frame overlap.

Recovered development failures: lint/format/test-fixture mistakes in the
superseded client proposal; Cedar admission refusal on one browser retry;
two incorrect consult-llm CLI invocations. The reviewer's own Go harness failed
with `native_source_unavailable`; worker race runs passed. Logs:
`/var/tmp/bash-cards-*.log` on Alder.
