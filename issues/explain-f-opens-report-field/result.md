# Result

F activates the showing card's existing report button instead of merely focusing
it. The existing layout-effect focus lands in the report textarea before the
next keystroke. The opening F is prevented; subsequent F characters are ordinary
input. The report still holds its card, uses the polite live region and labelled
field, and opens the same prefilled GitHub issue only on explicit send.

## Verification

Tested the implementation diff on base commit
`7e76f9cc290ac7ea0f594a1d0ba90f3f98ad0baf`, with these checks before committing:

- `./scripts/test-focused.sh --area web`: passed, 248 files / 2,026 tests,
  including the new ExplainMode F-then-type regression.
- `OH_BROWSER_WORKERS=2 OH_LAB_WORKERS=2 OH_PORT_BASE=16300 ./scripts/test-focused.sh --area browser --spec lab-explain-mode.spec.ts`:
  18 passed.
- From `web/`, `npx playwright test --config playwright.lab.config.ts tests/lab-explain-mode.spec.ts --repeat-each 3`, with two workers, the same port
  base and `OH_REPLY_DELAY_MS=60`: 54 passed. Includes keyboard cancellation,
  prefilled GitHub content, pointer pinning, and report accessibility audits at
  phone/desktop widths in Finnish and English.
- `git diff --check`, `issuectl doctor --json` and
  `python3 scripts/validate-project-view.py`: passed.

All test commands ran with `umask 077`, bounded timeouts and the shared scratch
lease. Logs: `/var/tmp/agent-keep/explain-f-opens-report-field/`.
These are synthetic browser/host checks, not deployment or actual screen-reader
speech evidence. No live installation was changed or tested.

## Review

Focused self-review: low-risk keyboard/focus change, no session, contract,
daemon or authorization changes. Checked shortcut guards, event cancellation,
existing button activation, same-commit focus, open-report and already-sent
fallbacks, first/second Escape and unchanged GitHub payload construction.
The existing polite live region and textarea label remain intact. No independent
model review was required for this scope.

## Decisions for later review

None beyond the requested behavior. Already-sent cards retain their completion
focus behavior; F from a control inside an open report returns to its text field
without resetting the draft.

## Live check

Open Explain mode, point at a part to show its card, press F and immediately type
a correction. The field should contain exactly that correction, with no leading
F and no Enter required. Move the pointer across other parts: the card stays.
Press Escape: the report closes but Explain mode stays. Press Escape again:
Explain mode ends. With a screen reader, verify the opened report is announced
and the labelled text field receives focus.
