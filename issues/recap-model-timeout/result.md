# Result

## Cause (native evidence, 2026-10-29)

Birch, Jari's account, pilot.14. The daemon journal has one failure:
`18:16:29 conversation_recap failed reason=model_timeout trigger=automatic
model=claude-bridge/claude-sonnet-5-5` for conversation `63f45868…`, the same
conversation that had 16 successful automatic recaps that day with the same
model. The test server's journal (read-only, since 28.10.) has only successes.

- The conversation runs `claude-bridge/claude-opus-5-5`; background work
  excludes Opus, so Sonnet was the only candidate. No recap settings were set
  (defaults: 16k-token excerpt, 512 response tokens).
- Native timing: each successful recap was written 3–10 s after the 180 s idle
  timer; the failed one ended 11.4 s after it, i.e. at the extension's 12 s
  per-attempt abort. The remaining 8 s of the 20 s budget were unused because
  there was no other candidate.
- Measured on Birch with that conversation's actual 63 KB recap prompt via the
  Claude Code CLI (the bridge spawns one per call): 3.1, 3.4, 3.7, 4.4, 4.9,
  5.6, 8.9, 9.7, 11.2 s. The 12 s cap sat on the bridge's latency tail.

Not the cause: a reasoning model, the new response/context limits (defaults
in use), or a provider error (no error detail; abort).

## Fix

- `recap-extension.mjs`: the last candidate gets the whole remaining budget;
  earlier candidates still get 12 s so a stalled one leaves the fallback time.
  Budget 20 s → 25 s. A timeout's journal detail now says how long it waited.
- `recap_linux.go`: the recap prompt's RPC window 25 s → 30 s (the channel's
  maximum; same 5 s margin before a timeout would poison the channel). An
  automatic recap that timed out is retried once (journal `outcome=retrying`)
  before the card shows the failure; the activity fence still applies.
- `RecapCard.tsx`: the empty-state invitation is not shown next to a failure;
  the timeout tells the person to retry shortly or choose a faster recap model
  in settings.

Tests: `pi-device-test/recap-timeout.test.mjs` (fails on the old extension),
`TestAutomaticRecapRetriesOneModelTimeout`, a RecapCard unit case.
Review: focused self-review (daemon/extension, no contract change).

## Decisions for later review

- **Retry only automatic recaps, in the daemon.** Alternatives: retry inside
  the extension within one budget (splits 25 s into two short attempts, worse
  for a slow-but-progressing model), or retry manual ones too (the person's
  HTTP request would wait up to a minute). Chosen: a fresh full budget for the
  automatic one; a manual failure says plainly what to do.
- **The person's prompt can wait up to 30 s behind a running recap** (was 25 s),
  because the RPC writer lock is held for the recap prompt. Alternative: keep
  25 s and a 20 s budget (would still fail on an 18 s tail). The longer window
  is rare and the retry is fenced by the person's activity.
