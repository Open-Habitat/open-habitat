# Result

The issue's own reproduction (whole `browser-conversation.spec.ts`,
`OH_BROWSER_WORKERS=2`, `OH_REPLY_DELAY_MS=60`, `--repeat-each 3`, 264 cases)
was run after the `altogether-wanting-children` fixes. That issue fixed the
logout case (`:1815`) and the steer case (`:1469`) directly, and the Alt+Enter
cases that the product used to refuse when they were pressed during a status
re-read. The other cases listed here (`:2953`, `:3338`, `:3075`, `:3522`,
`:428`) did not fail in any of the whole-file runs below. Their reported
failures share the same signature of a press refused during a re-read, but
that link was not proven for each case.

## What remained

1. **Four cases failed every time on main, so they were not flakes:**
   `validated pending|rejected|uncertain send receipt never reposts` and
   `settled turn uses its native strip without a duplicate receipt`. The
   permission-question commit (1ce76981, today) put the composer inside a
   `display: contents` hold (`.ah-composer-hold`). After that, every
   `.ah-composer-stack > .ah-composer` rule stopped matching, both in
   `composerStack.css` and in the specs' composer locators. The product lost
   the composer's block-padding reset and the strip insets inside the stack,
   which is a small visual regression. `expectPhoneComposerWithinViewport` found
   no composer. The CSS rules and the locators in five spec/helper files now go
   through the hold. The other specs that use those locators
   (`resilience-states`, `browser-shell`, `github-connection-warning`,
   `lab-conversation`) are green.
2. **`one Enter queues a steer with an attachment once`** failed 1 of 3. It
   waited for the attachment chip, which is drawn while the picture is still
   uploading. The composer refuses a send while an attachment uploads, which is
   correct: a message cannot go before its attachment does. The trace shows the
   Enter landing 23 ms before the upload reply was processed. The spec now
   waits for the stored chip (`[data-attachment-url]`).

## Evidence

| run | result |
| --- | --- |
| issue's report (main 524acd6c) | 9 of 264 failed |
| after `altogether-wanting-children`, before this issue's fixes | 12 of 264 failed: the 4 deterministic hold cases × 3; no other failures |
| hold fix only | 1 of 264 failed (attachment case) |
| the four hold cases `--repeat-each 3` after the fix | 12/12 |
| attachment case `--repeat-each 20` after the fix | 20/20 |
| whole file `--repeat-each 3`, final HEAD | 264/264 |
| whole file `--repeat-each 3`, `OH_CPU_THROTTLE=4`, final HEAD | 264/264 |

Logs are in `/var/tmp/agent-keep/test-stability-v4b6/i3-*.log`.

Along the way the whole-file runs also caught two regressions in this
branch's own store change: a stale mark that stuck after a daemon restart,
and one that stuck after an epoch change. Both are fixed under
`altogether-wanting-children`. One run (before those fixes) also failed
`own message shows every line it fits; a clipped one fades only its last`
once. The screenshot was taken while the clipped bubble had no fade. The cause
was not established, and it did not recur in the 528 cases of the final
runs or in a targeted `--repeat-each 30` of that case (30/30).
