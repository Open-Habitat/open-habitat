# Times in conversations: implemented behind `conversation-times`

The design Jari decided on 24–26.11.2026 is in the product behind the
experimental feature `conversation-times` (Ajat keskustelussa). It is off by
default.

- `timelineItems` takes a `times` switch. With it on, a day separator
  (Tänään, Eilen, "Pe 20.11.") comes before a turn that begins on a new day,
  every saved message carries its time, and the switch reaches `AgentTurn`
  and `Entry`. `BrowserConversation`, the read-only `HistoryView` and the
  participant's `SharedConversation` read the switch.
- `Message` takes `at` ({ms, took?}) and draws `MessageTime` right after the
  name, before Kopioi. `UserMessage`, `AssistantMessage` and `InterimMessage`
  pass it through. `MessageTime` and `DaySeparator` live in
  `components/ConversationTimes.tsx` so that agent-to-agent message blocks can
  reuse the same header.
- `AgentTurn` uses the times it already had (each step's `at`, `startedAt`,
  `stopped.at`) to give each saved reply its time. `turnMinutes` puts the
  duration only on a settled turn with two or more stages that ran 5 minutes
  or longer, rounded down. It goes on the final answer, or on the stop row of
  a stopped or restart-cut turn. The stop row reads "Keskeytit 14.52 · vuoro
  kesti 8 min" with no dot before the time, and keeps the full moment in its
  title.
- The host needed no new data.

## Verification

All runs used `umask 077` and a leased scratch TMPDIR:

- `./scripts/test-focused.sh --area web`: 266 files and 2249 tests passed.
  New unit tests in `components/conversationTimes.test.tsx` cover the
  duration rule: single-stage vs multi-stage, the 299 s / 300 s threshold,
  rounding down, missing ends, a stopped turn, a restart-cut turn, a turn
  stopped mid-tool, a running turn and the switch off. They also cover day
  separators: local midnight, the same moment in Helsinki and New York, and
  Eilen vs earlier. A `timelineItems` test checks that a separator appears
  only where a turn begins on a new day, never inside a turn that runs past
  midnight, never with the switch off, and that a message without a saved
  time shows none.
- `--area browser --spec conversation-times.spec.ts --spec
  settings-experimental.spec.ts`: 7 passed. `conversation-times.spec.ts`
  passed `--repeat-each 3` (9/9). The new spec runs through the real gateway
  and daemon on a synthetic multi-day native session (fixture
  `history?mode=times`) with the page clock fixed. At 1440 and 390 with the
  switch on it checks: three separators at the right turns, 13 message times
  plus the stop row's, durations only on the 48-minute four-stage turn and
  the stopped two-stage turn, each time between the name and Kopioi on one
  line, no horizontal overflow, and axe on the feed. With the switch off it
  checks that the feed has no separators, times or durations, and that the
  stop row keeps its own time.
- `go test ./internal/daemon -run Experimental` passed, the browser host
  builds, and `scripts/test-ui-reference.py` passed after regenerating the
  UI references.
- Visual review material from the synthetic host, outside the repository:
  `/var/tmp/agent-keep/times-conversations-experimental/` (`top-1440`,
  `top-390`, `stop-1440`, `stop-390`). The first screenshots showed
  "10.18· vuoro kesti": the flex wrapper swallowed the space before the dot.
  The wrapper is now inline-block.

Review was a focused self-review. The history contract was not touched, so
no independent reviewer was called. No full browser suite or installed-host
check was run.

## Decisions for later review

- **Where a separator goes.** A separator goes only before a turn's first
  message (the person's or a participant's), and only when its day differs
  from the last saved entry drawn. A turn that runs past midnight stays
  whole, and the next turn names the new day. The alternative was a
  separator before any entry on a new day, which would split a turn between
  its work and its answer.
- **Days before yesterday.** These read as weekday and date ("Pe 20.11.",
  "Fri 20 Nov"), with the year added when it is not the current one. The
  rounds never showed a conversation older than a week.
- **The clock.** With the switch on, every time uses a numeric hour ("9.38")
  as round 1 decided, the stop row included. With the switch off, the stop
  row keeps its old two-digit "09.38".
- **Failed turns.** A failed turn's reply gets its time but no duration,
  because the turn did not finish. Decisions covered finished, stopped and
  restart-cut turns, not failed ones.
- **Separator semantics.** The separator's word is read as ordinary text in
  the list, and its hairlines are decoration. It has no `role="separator"`,
  because a labelled separator is not reliably read out and lint asks for
  `<hr>`.
- **"Tänään" refresh.** The label is computed at render, so a conversation
  left open across midnight says Tänään until it next renders.
- **Participant messages.** A participant's message in a shared conversation
  gets its time through the card's existing `at`, after the role chip. The
  rounds did not show this card.
- **Messages with no native timestamp.** A message the page sent that native
  history has not saved yet shows no time.

## Live check

After release, on a host with real conversations:

1. Settings › Kokeelliset ominaisuudet › Ajat keskustelussa on. Open a
   conversation continued on several days: separators read Tänään, Eilen or
   the date, and each message reads "Sinä 16.40" or "✓ Vastaus valmis 17.03"
   with Kopioi after the time, interim replies included.
2. Ask for work with an interim reply that runs over five minutes: the final
   answer's header ends "· vuoro kesti N min". A long single-stage turn shows
   no duration.
3. Stop a long multi-stage turn: "Keskeytit 14.52 · vuoro kesti N min". Stop
   a short one: "Keskeytit 14.52".
4. On a phone (390 px), check that headers wrap cleanly. Then switch the
   feature off: the conversation looks as it did before.

Status stays `testing` for this live check.
