# Result

All four cases pass by name repeatedly. One was a stale expected value, one a
stale spec plus a small product alignment, one a product race that load
exposes, and one a load-timing wait.

## Cases

**Go `TestAgentCommandPathIsPerHomeAndInherited`.** This was a stale expected
value. Production appends the core runtime's `agent-bin` after Claude Code.
The test's expected PATH now observes it the same way it already observed
Claude Code. Fixed separately under `agent-path-test-misses-core-tools`.

**Lab `lab-conversation.spec.ts:55` (recap gaps, 6 px).** The spec was stale
after `composer-stack-gaps-uneven`. In the live composer stack, every part,
including a worker strip, now has one s3 (9 px) gap around it. So recap →
strip → composer has two gaps. The spec subtracted the strip's height on the
assumption that it adds no space, and compared the result with the read-only
footer's 12 px. Measured: live 9 + 26 (strip) + 9, read-only 12. The spec now
measures the card's own outer gap to whatever lies directly under it. The
read-only footer takes the same s3 gap under the recap, so the two views
still match, which was the spec's intent.

**Browser `helper-archive.spec.ts:21` (archive button not focused after
cancel, line 122).** This was a product race. It reproduced on unchanged code
with `OH_CPU_THROTTLE=4 OH_REPLY_DELAY_MS=250`: 3/12 and 3/6 failures. A
mutation trace showed the conversation moving from *Käynnissä* to *Hiljaiset*
to *Sinun vuorosi* while the archive question was open. Each rail section is
its own list, so the row remounts. React-aria's focus return then finds the
pressed button detached and leaves focus on `body`. A person archiving just as
a turn ends sees the same. Now `useHelperArchiveConfirmation` records the
pressed control when it is asked. On cancel, it returns focus to that control,
or to the same conversation's rail archive button (`data-archive-agent`) when
the row was remounted. It acts only if focus fell to the page. After the fix:
16/16 under the same probe, with a unit test that fails without the fix.

**Browser `attachment-documents.spec.ts:39` (five chips of six after 30 s).**
Never reproduced. Runs: 24 at nominal load, 18 with 6 workers, 15 with 8 CPU
burners, 12 and 32 with CPU throttle 4 plus 250 ms reply delay, and 16 with
throttle 6 at 4 workers. All passed. The composer still has the field it had
before creation (the spec asserts that). No upload error was shown, so the
evidence fits six sequential uploads outlasting a fixed 30 s on the gate's
saturated host. The spec now waits for the paperclip, which stays disabled
until the last upload ends (up to 90 s). It then requires no upload error and
all six chips. A slow host passes; a lost or failed upload still fails, and
says which.

## Checks

On Birch, `OH_BROWSER_WORKERS=2 OH_PORT_BASE=14600`, umask 077: see the final
runs in the run report. `go test ./internal/daemon -run TestAgentCommandPath
-count=3` passes. It failed before the test change. `test-focused.sh --area
web` passes.

## Decisions for later review

- The read-only footer's recap gap changed from 12 px to the stack's s3 (9 px)
  instead of the live stack going back to 12. Alternative: drop the
  live/read-only comparison from the spec. Kept the comparison because one
  rhythm across both footers is what the spec and `composer-stack-gaps-uneven`
  both ask for.
- A cancelled archive question returns focus to the conversation's own button
  even after its row moved section, instead of leaving it to react-aria's
  fallback (the page). No authority or data path changed.

## Review

Focused self-review (web-only change; no daemon, contract or authority path).
