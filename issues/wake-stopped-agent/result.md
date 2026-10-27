# Result: wake a stopped agent (Kortti)

Implemented Jari's round-2 choice. A resting conversation shows Habitat's own
card before anything starts. The first typed character wakes Pi without a
turn, and the message carries the same report to the agent. After that the
card stays in history as "Agentti lepäsi A–B".

- **Daemon.** Each Pi handle remembers why and when it stopped: idle, room
  (stopped to make room for another conversation), person (Stop, cancel,
  archive or deletion) or crash (ended unasked). A conversation with no handle
  has rested since the daemon started: restart. The snapshot carries
  `rest {cause, at, awake}` until the agent is told. `GET
  /api/v1/conversations/<id>/rest` returns the report: cut-off processes,
  runs that settled unreported (with Taskfleet's summary, end time and kept
  branch) and runs still working. It is read as the person and starts
  nothing.
- **Wake.** `POST …/continue` is the idempotent wake from the ADR 0020
  amendment: a Pi that is already running or starting is the answer, both
  before and after the proof permit. A wake never closes as a lazy start,
  and an unused woken Pi idles out with its original rest intact.
- **Same report for the agent.** The daemon passes the stop to Pi
  (`OPEN_HABITAT_STOP_CAUSE`, `OPEN_HABITAT_STOPPED_AT`). The companion's
  catch-up names it, carries the summaries and says the person already saw
  them. A start ahead of the message re-reads Taskfleet at the first prompt.
  An unread Taskfleet is never told as "nothing settled". The Go
  `unreportedRuns` and the companion's `readSpinoffs` are held to one rule by
  `internal/daemon/testdata/catch-up-runs.json`.
- **Browser.** `RestCard` (Storybook "Conversation/Rest card"), "Lepää" in
  the top bar, the composer's "Kirjoita, niin agentti herää…", and one wake
  per rest on the first typed character.

ADR 0020's amendment is recorded in the ADR. It was committed and then
returned to history with this change, so `scripts/from-history.sh
docs/decisions/adr-0020-resume-on-send.md` prints the amended text. The rule
itself is in `internal/AGENTS.md`.

## Evidence

- Go: `go test ./internal/daemon ./internal/gateway`. New tests:
  `TestRestCausesWakeAndTell` covers every cause, one launch per wake, no
  prompt, the rest kept through an unused wake, and the stop passed to Pi.
  `TestRacingWakesShareOnePi` fails with 409 without the post-permit check.
  `TestRestReportReadsTaskfleetWithoutStarting` and
  `TestRestRunsFollowTheCompanionRule` cover the report. The real-Pi
  `TestProcessResumeCatchUpAcrossDaemonRestart` now expects the stop-only
  catch-up.
- Node: `catch-up.test.mjs` covers the shared rule, the stop fact and the
  unread inventory.
- Contracts: `rest.schema.json`, snapshot `rest`, history `stop` and the
  extended `restart`, scenario CT-044. Validated and regenerated.
- Browser: `rest-card.spec.ts` (desktop with axe on the card, and phone),
  plus queued-send, browser-conversation, spinoffs, process-tray,
  reconnect-recovery, title-regeneration, lab-conversation and
  lab-idle-pi-slots. The failures in title-regeneration:161 and
  browser-conversation:465 are the known main failures
  (`main-browser-suite-red`). browser-conversation:141 is a flaky stage
  toggle: it passes on rerun, and its failure screenshot has no card.
- Whole suites after rebasing onto main (Birch, `OH_BROWSER_WORKERS=4`).
  Browser: 408 passed, 5 failed, 3 skipped. Lab: 134 passed, 3 failed. The
  known main failures are browser-conversation:465 ×3, title-regeneration:161
  and lab-title-generation ×2. Two more were harness races under load and
  pass alone: reconnect-recovery:45 ("Route is already handled", 10/10 alone)
  and lab-snapshot-refresh-live:13 (a Playwright protocol error, 1/1 alone).
- Review: gpt-6-astra found five candidates. claude-fable-5-1 confirmed four
  and one sub-point, and refuted the claim that a wake delivers held messages
  (held sends are the person's, and retry predates this). All five FIX rows
  are fixed.

## Decisions for later review

1. **Restart is "at the latest".** The daemon keeps stop facts in memory
   only, so after a restart or upgrade every resting conversation says Pi
   stopped no later than the restart, even if it had idled out earlier.
   Persisting stop facts would be a new store, and upgrade and plain restart
   are not told apart.
2. **The agent is always told the stop.** It gets the stop sentence even when
   nothing settled ("Nothing settled meanwhile"), because the person saw the
   card. This adds one short context message to every resumed conversation.
3. **Stop no longer stops a woken Pi.** Stop on a held message after typing
   has woken Pi returns the text to the field and leaves Pi idle. The person
   is still writing, and an unused Pi idles out in 10 minutes. The queued-send
   spec was changed accordingly.
4. **No sidebar moon.** The sidebar's Käynnissä rail lists only live
   conversations and there is no per-conversation list of resting ones, so
   the rest shows only in the top bar and the card.
5. **Archive and workspace deletion count as "person"** ("Pysäytit agentin");
   a room stop has its own sentence.
6. **"Habitat" is a plain label**, not a link. Each run has no *Avaa* link to
   the worker's conversation; the spinoff pill already offers that (Jari's
   question 2 on round 2 was left open).
