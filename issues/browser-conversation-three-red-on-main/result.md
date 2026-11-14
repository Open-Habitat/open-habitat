# Result (verification incomplete)

The three reported failures are stale specifications, not demonstrated product
regressions. The focused fix is preserved; the issue remains open because the
required complete-spec green run was not obtained.

## Per-case attribution

- **New controller / rail:** `git log -S 'ah-nav-mark'` identifies `64752848`
  (new brand/state mark). Agent rows now render `rail-mark`, not `ah-nav-mark`.
  Assert that stable test ID and bind the row to the created conversation URL,
  after creation finishes. The old `.last()` selected an unrelated quiet row.
- **Lost accepted send / reload:** `git log -S '!statusStale && sendUncertain'`
  identifies `de9ee7ec` (one warning for unknown sends). That landing moved the
  uncertainty notice behind fresh-status eligibility while changing this test
  to expect it even though the test deliberately fails status reads. The
  visible warning is `conversation-stale`. Preserve the original draft,
  disabled-send and one-write recovery assertions.
- **Lost accepted reply / HTTP snapshot:** the same `de9ee7ec` mismatch. The
  original trace showed the stale warning instead of `send-uncertain`. Also,
  intercepting EventSource only after opening did not disconnect its existing
  stream: native content still arrived. Intercept before opening, then freeze
  retries. Assert the connection warning, preserved draft and disabled send,
  followed by recovery without another write. Block status, receipt and
  snapshot observations after the send, including responses to earlier reads;
  otherwise the test can accidentally learn acceptance before recovery.

`038ba881`, `a95dea58` and `dfec2cd4` are not the source of these selector /
presentation mismatches. Attribution comes from pickaxe and inspecting the
landing diffs and current warning branches, not an executed historical bisect.

## Evidence and limits

- Baseline: all three reported failures reproduced.
- Final focused tests: all three passed in each of five consecutive runs,
  two Chromium workers, port base 14500, default 0–60 ms jitter, on the final
  spec with only the three reported cases selected. A preceding five-run
  selection included the attachment case (four passes, then one failure).
- Fast web checks passed: 215 files / 1668 tests plus static checks. No product
  source, contracts, daemon or authority behavior changed.
- Five whole-spec runs did **not** pass: 85/88, 86/88, 87/88, 87/88, 84/88.
  Failures included attachment paste not producing a chip; steer/follow-up
  queue visibility; pending-ack queue visibility; logout status fencing;
  late-steer draft clearing; malformed-status readiness; changed-identity
  recheck readiness. The last run also exposed an in-flight observation race
  in the HTTP test, addressed by blocking late status/receipt responses before
  the final five focused runs.
- An attempted readiness improvement to the unrelated attachment test did
  not eliminate its missing-chip failure and was reverted, not included.
- Focused self-review: checked selectors against production components,
  preserved no-resend/draft assertions, and checked that HTTP-only recovery
  occurs before restoring SSE or the clock. Independent review is not required
  for this spec-only change.

## Decisions for later review

1. Keep one higher-priority stale/connection warning rather than restore a
   duplicate send warning. Alternative: change product warning arbitration.
   The existing warning accurately says control cannot be trusted, keeps the
   draft and disables sending; separate unknown-send behavior remains covered
   by the existing fresh-status uncertainty tests.
2. Preserve this bounded fix rather than broaden it to repair every flaky
   journey. The requested complete-spec green result is still outstanding;
   none of the unrelated failures is claimed fixed or proven against a
   separate main checkout.

Live check: no user-visible product change. The conductor can try creating a
conversation and verify its rail mark; browser synthetic tests exercise lost
replies without touching a real conversation.
