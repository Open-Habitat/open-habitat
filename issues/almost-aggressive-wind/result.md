# Result

## Root cause

These were test setup races, not evidence of a broken status/identity contract.
`CreatingConversation` renders an enabled `message-input`, a command palette and
a details header while `conversation=new` is still waiting for creation. Those
locators cannot prove that the native conversation has opened. Its initial
status read is asynchronous even after creation replies.

The transient-503 and 401 cases installed their status interception before
opening native status controls. Under load the initial status read could consume
the injected error: a cold-load failure has no native recheck control, and a 401
correctly opens login before the test can click its intended recheck. The changed
snapshot identity case similarly mistook the placeholder's command palette for
native readiness, so its details toggle could be replaced during creation. The
warm-return setup also waited on the optimistic editor before the native route;
its readiness checks now occur in native-route-first order. The historical
identity/warm-return failures did not recur in the baseline stress run, so their
specific past failure stacks were not independently reproduced here.

## Evidence and change

Base: `49e89404`. The unmodified focused spec passed 67/67 once. An unmodified
`npx playwright test tests/browser-conversation.spec.ts --repeat-each=5 --workers=8`
then failed 3/335: two 401 cases timed out in `refreshConversation` waiting for
`workspace-details` after login had opened; the transient-failure case failed
at the helper's `conversation-recheck` visibility assertion. These are failures
in setup, before the behavioral assertions. Source inspection confirms the
placeholder exposes the supposedly native readiness controls, and cold status
failure takes a different path from refresh retry in `useConversation`.

The spec now waits for the native conversation URL before relying on its
editor, and arms the two fault injections only after native recheck controls
exist. Identity and warm-return setup use the same native readiness condition.
No assertion was removed or weakened; no retry, sleep or timeout was added.
Product code and shared fixtures are unchanged.

## Review

Focused self-review: checked the four reported journeys against
`PendingConversation`, `App`, `useConversation` and `BrowserConversation`.
This changes test sequencing only, not product behavior or an authority boundary,
so no external boundary review was needed. Fault/retry, login, stale-identity
response rejection and zero-status/history-read warm-return assertions remain.

## Validation

All commands used `umask 077` and an exported `TMPDIR` created with
`mktemp -d /var/tmp/oh-XXXX` (the repository test entrypoints normalize scratch
to `/var/tmp`). Browser execution used Cedar's shared warm runner.

- `./scripts/test-focused.sh --area web`: passed formatting, lint, TypeScript and
  fast client tests after fixing a callback return annotation caught by the
  initial typecheck. Initial attempt needed `npm ci --prefix web`.
- `./scripts/test-focused.sh --area browser --spec browser-conversation.spec.ts`
  five consecutive times: 67/67 each (56.6s, 55.4s, 56.5s, 56.2s, 1.1m).
- `cd web && npx playwright test tests/browser-conversation.spec.ts --repeat-each=5 --workers=8`:
  335/335 passed in 2.8m, versus 3 failures on the unmodified baseline under
  the same load configuration. The only subsequent spec edit was correcting
  the erased TypeScript callback return annotation (`Promise<unknown>`).
- Fast web: 93 files / 552 tests passed, in addition to format/lint/typecheck.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json`, and
  `git diff --check`: passed.

Tested spec blob: `7443d4677a34b4d85944289cd664e35f19e3bed5` (base `49e89404`);
runnable spec content was unchanged throughout the successful repetitions. No clean-gate
receipt is claimed.

This is synthetic same-UID browser/host evidence, not distinct-UID isolation,
live-provider or deployed-host acceptance. Go, contracts, packaging and the
full clean gate were not run for this spec-only change.
