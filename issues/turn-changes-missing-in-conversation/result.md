# Result

## Triage analysis

**Verdict: the missing cards for script-based edits are the current tracking
limit; a rendering defect was not reproduced. No product behavior changed.**

Read-only inspection of the authorized native session found shell commands that
rewrite files using Python heredocs, plus commands that change directory before
using redirection or `sed`. `turnChanges.ts` does not execute or interpret Python,
and deliberately stops recognizing file operands after `cd`: guessing would
attribute paths to the wrong directory. Successful commands therefore need not
produce a Muutokset card. `process` calls are not inputs to this tracker either.
This is the gap already addressed by the proposals in
`rewind-tracks-all-changes` and `turn-changes-service-design`, not a new recorder
implementation delivered by those designs.

There is also an early successful native `edit` with `path` and `edits[]`, in an
assistant message containing thinking and a second, shell tool call. It **should
have a card when that early turn is brought into view**. Its result is present,
not an error, and both remain on the active parent chain. The session is emitted
through Claude bridge but uses ordinary Pi tool-call/result shapes; no malformed
JSON lines were found. Result `details.diff`/`patch` differences cannot explain
this card: `TurnChangesSource` derives edits from the arguments and uses the
result to determine completion/failure, not to parse the edit diff.

The added synthetic history regression exercises that mixed message with invented
paths and content. The native batch edit produces exactly one file; a following
script-only turn produces no card or unread warning. Existing host-backed native
history tests also pass for older pages, returning to a conversation, live turns,
and the neighboring browser card.

`HistoryView` supplies tool results separately from assistant entries, and
`AgentTurn` renders changes independently of the work disclosure and the browser
card. Changes wait until the turn stops working; argument reads are lazy near the
viewport. Neither adding the browser card nor collapsing tool details provides
a reason to suppress a finished native edit. The inspected daemon journal had
no matching history-failure diagnostic, but that absence is not evidence of a
successful client read.

**Limit:** no authenticated live browser was inspected. The claim that even the
early native-edit turn has no card remains unverified; this is why the disposition
is `cannot-reproduce`, not a claim that a rendering bug was fixed. If that early
turn still lacks its card after scrolling to it, investigate that concrete
client/block-read failure rather than extending the shell parser.

## Verification

Base: `ed1e8dafa`; changes are only this result, sanitized issue text and
`web/src/app/TurnChangesSource.test.tsx`.

- `./scripts/test-focused.sh --area web`: passed, 255 files / 2,144 tests,
  including static and component checks.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=15400 ./scripts/test-focused.sh --area browser --spec turn-changes.spec.ts`:
  8 passed; 1 opt-in screenshot-capture case skipped. Includes older-history and
  live-turn coverage. No changed browser specs require a repeat run.
- Same environment, `--spec server-browser.spec.ts --tag "agent's request"`:
  1 passed, checking the neighboring browser card.
- Initial setup attempts stopped on a nonexistent spec name and missing Pi SDK
  fixture; the corrected runs above passed after installing the locked fixture.
  Initial web lint warnings in the new test were corrected before its passing run.
- `issuectl doctor --json`, project-view validator and `git diff --check`: passed.

Private inspection summary and test logs are retained outside git at
`/var/tmp/agent-keep/turn-changes-missing-in-conversation/`. No session content,
installation identifiers, screenshots or captured HTML are added to the project.
The guest was not changed. No release or live UI change was performed.

## Review

Focused self-review: test-only and issue changes; no sessions, derivation contract,
daemon state or authority boundary changed. Checked the regression against
`TurnChangesSource`, `turnChanges`, `FileToolCard`, `HistoryView` and `AgentTurn`.
The test distinguishes a supported batch edit at a nonzero block index from
opaque script effects, without adding shell interpretation or asserting UI copy.

## Decisions for later review

- Keep the conservative script boundary. Alternative: recognize particular Python
  snippets or follow `cd` heuristically. That would still miss arbitrary scripts
  and risk false paths; the existing snapshot-record design owns complete tracking.
- Close as cannot reproduce rather than fixed or wholly by-design: script-only
  turns are explained, but the early native edit deserves a card and its actual
  live rendering has not been observed.
