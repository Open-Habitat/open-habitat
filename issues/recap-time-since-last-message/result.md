# Result

The recap read (`GET /api/v1/agents/<id>/recap`) now carries
`latest_message_at`: Pi's own `timestamp` of the newest person or agent
message on the active branch, read in the same backward scan that finds
`latest_message`, or null when Pi recorded none. The recap card in the
conversation, the conversation cards on the home and workspace pages, and the
read-only history show the age from it, and each surface's clock moves on once
a minute (`useMinuteNow` in `web/src/components/RecapCard.tsx`).

Tests: `RecapCard.test.tsx` (age from the latest message, none without a
timestamp, ticks with time), `HomeWorkspaces.test.tsx` (home card age),
`conversations.test.tsx` (contract read), `recap_linux_test.go` (daemon
reports the native timestamp and null for an entry without one),
`lab-conversation.spec.ts` (conversation and read-only history cards carry the
daemon's timestamp against real native history).

Suites on Birch (OH_BROWSER_WORKERS=4): web unit 784 passed; daemon package
and contracts passed; lab suite 134 passed; browser suite 405 passed, 5
failed: the four known main-red cases (`browser-conversation.spec.ts:465` x3,
`title-regeneration.spec.ts:161`, tracked as `main-browser-suite-red`) and
`github-stream.spec.ts:34`, which passed when rerun alone (load flake).

Review: `/llm-review` with gpt-6-astra as finder returned no findings; no
verifier was warranted, and `/assess-findings` had nothing to triage.

## Decisions for later review

- `latest_message_at` is required (nullable) in the v1 schema rather than
  optional: the daemon always sends it, and pre-release v1 has no older
  clients to keep.
- When Pi wrote no readable timestamp for the latest message, the card shows
  no age at all instead of falling back to the recap's own age, which would
  contradict what the label now means.
- The recap command reply was left alone; the browser reads the time from the
  recap read that follows it, as it already did for the recap itself.
- "Jatka-näkymä" in the issue was taken as the read-only history view
  (`HistoryView`), the only other place that shows the recap card; the
  workspace page shares the home card and is covered by it.
