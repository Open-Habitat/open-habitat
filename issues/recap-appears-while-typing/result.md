# Result

The automatic recap no longer appears while the person is writing or reading.

- **Daemon.** New body-less `POST /api/v1/conversations/{id}/presence` (gateway allowlist, CSRF like other writes). It restarts a pending automatic recap's three-minute idle interval from the report. It does not fence a recap already running, so a manual request still completes.
- **Browser.** `web/src/app/recapHold.ts` reports presence on typing, a press in the composer, and reader input on the stream (wheel, touch, keys, pointer), at most once per 20 s. It also reports every 30 s while a draft is unsent. An automatic recap that arrives while the person typed or read within the last 60 s, or while a draft is unsent, stays hidden until they pause with an empty composer. A recap already there when the conversation opened, and one the person asked for, show as before.

## Decisions for later review

- **Focus alone does not count as activity**, although the issue lists it. The composer takes focus automatically when a conversation opens and keeps it while the person is away, and returning is when the recap is wanted. A press in the field and typing count.
- **The hold has a 60 s quiet period after typing or reading.** An unsent draft holds without limit, including in a background tab, because the reports continue. A recap present when the conversation opens is shown even if a draft was restored.
- **Sending a message also counts as typing.** The synthetic lab specs therefore fast-forward the browser clock 61 s before they expect a recap. In production the recap comes at least 3 minutes after the turn settles, so this has no effect there.
- **Review finding F2 was dropped.** Presence does not fence an automatic recap that the daemon has admitted but not yet sent. That window is milliseconds long and the browser still hides the result. The fix needed an extra state flag, so it was tried and reverted.

## Review

`/llm-review`: gpt-6-astra as finder, claude-fable-5-1 as verifier. Two findings, both confirmed. F1 is fixed here: the first recap read was exempt from the hold, so typing during conversation load could show a fresh recap. F2 is dropped, as above.

## Validation

- `go test ./internal/daemon ./internal/gateway ./internal/diagnostic` passed (full packages; schema tests used a venv with `requirements-ci.txt`). New `TestPresencePostponesAutomaticRecapButNotARunningOne`.
- `./scripts/test-focused.sh --area web` passed.
- Lab browser, `lab-conversation.spec.ts` with `--tag recap`: 3 passed, including the new `@lab recap waits while the person writes a long message`. With the hold disabled, that case fails at its "no card" assertion.
- `lab-composer-focus.spec.ts --tag recap` (2), `process-tray.spec.ts` (6) and `phone-composer-keyboard.spec.ts` (2) passed.
- No contract schema changes, so the contracts area was not run.
