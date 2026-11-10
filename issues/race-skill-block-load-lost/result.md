# Fixed — 10 November 2026

Run `01m72fv7gt7s9f20hf5644qyqx`, starting at `18d9930004f77fdec88f3349933d968a5d8e2575`.

## Cause and fix

Both reported failures reproduced. Neither was a lost block response or a
reader remount: **the control moved between pointer-down and pointer-up**.
Playwright completed its click, but pointer-up landed outside the button, so
React Aria correctly did not fire a press. No block request was sent.

- Before the fix, the 390/light reader trace shows `scrollToEnd` from
  `useReadingPositionLayout` moving the chip from y=528.765625 to 28.765625
  after pointer-down. The same mounted node survives.
- The original 1440/light Load failure reproduced without instrumentation.
  Instrumented reproductions show `useFollowLatest`'s ResizeObserver calling
  `scrollToEnd`, moving the mounted button from y=398.46875 to -1879.90625.
- Stopping tail-follow on interaction alone was insufficient. A later trace
  shows two assistant rows above Load each shrinking by 9.1875px during the
  press, while the stream's scrollTop stays 3402. Load moves from y=398.46875
  to 380.09375 and pointer-up hits its article. A focusin following pointer-down
  must not replace the original anchor with this already shifted position.

`useReadingPosition` now treats pointer-down on a history control, or keyboard
focus entering one while following, as reading intent. It captures the row
anchor before a host render can scroll the control away. It also restores that
anchor on nested content resizes, not only parent history renders. Focusin
while already reading leaves the existing anchor alone. Ordinary wheel/touch,
reopening at latest and the explicit latest action retain their existing paths.

No change to SkillInvocation, history revision fences, native/session state,
contracts, daemon code or test assertions/timeouts/retries. Temporary input and
scroll-stack instrumentation was removed. Deterministic unit tests cover pointer
and keyboard entry, a subsequent host render, a nested resize, and focusin
between pointer-down and resize delivery.

## Final verification

Birch; umask 077; fresh short TMPDIR directories under `/var/tmp`; two browser
workers; port base 17700. Every browser/build command had a timeout (300–360s).
No CPU hog, whole browser suite, clean gate or live installation was run.

From `web/`, the final skill runs used:

```
npx playwright test --config playwright.lab.config.ts tests/lab-skill-invocation.spec.ts --repeat-each 10 --trace on
```

| Final run | Selection | Result | Log under /var/tmp |
| --- | --- | --- | --- |
| D250, seed sweep-lab-repeat | all six width/theme variants | 60 passed | skill-final1.log |
| D250, seed sweep-focus | `-g '390\|1440 light'` | 30 passed | skill-final2.log |
| D0 (no detector) | all six variants | 60 passed | skill-final-default.log |
| focused web | static, types, units/components | 206 files / 1555 tests passed | skill-final-web.log |
| focused browser, default D60 | lab-conversation-scroll.spec.ts + lab-open-at-end.spec.ts | 9 passed | skill-final-scroll.log |

Focused commands were `./scripts/test-focused.sh --area web` and
`./scripts/test-focused.sh --area browser --spec lab-conversation-scroll.spec.ts
--spec lab-open-at-end.spec.ts`. The unit cases also passed separately.
`issuectl doctor --json`, project-view validation and `git diff --check` passed.
The final executable delta is only `useReadingPosition.ts` and its test.

## Reproduction trail and retained evidence

The previous investigation (run `01m720vap8bg1vfbbd1y2xyd7z`, starting bb5241c0f)
left this open: D250 batches of 36, 36, 18 and 6 cases reproduced reader opening
but not block loading. This run resolved both leads using input/frame evidence.

Synthetic traces and screencast frames are retained on Birch under
`/var/tmp/skill-reader-evidence/` (not large binaries in git):

- `block-failure/trace.zip`: unmodified baseline block failure;
- `stack2/lab-skill-invocation--lab--e609d-rded-skill-reader-390-light-repeat9/trace.zip`:
  reader pointer-down → tail-follow stack → cancelled press;
- `stack2/lab-skill-invocation--lab--f0a0a-ded-skill-reader-1440-light-repeat7/trace.zip`:
  Load pointer-down → ResizeObserver tail-follow stack;
- `claim6/lab-skill-invocation--lab--f0a0a-ded-skill-reader-1440-light-repeat8/trace.zip`:
  residual 18.375px layout shift after the first, incomplete fix; input logging
  includes row geometry and scrollTop;
- `frames/screencast/`: extracted frames of that class of residual failure;
- `claim/` and `fixed3/`: the separate startup problem described below.

All exploratory batch logs are `/var/tmp/skill-<name>.log`. Counts include every
failure, including startup failures unrelated to the reader:

| Stage | Log names: passed/failed |
| --- | --- |
| baseline | first 6/0; seed1 20/0; seed2 29/1 |
| baseline with temporary input/stack logging | seed3 20/10; stack 30/0; default 30/0; stack2 23/7 |
| incomplete interaction-only fix | fixed1 60/0; fixed2 30/0; fixed-default 18/0; fixed3 20/10 |
| instrumented residual investigation | claim 8/2; claim2 19/1; claim3 20/0; claim4 12/8; claim5 17/3; claim6 9/1 |

Baseline seed1 used sweep-focus, 390 only, repeat 10. Seed2/stack used
sweep-lab-repeat, `390|1440 light`, repeat 10. Seed3/stack2/fixed3 used
skill-third with that selection. Default disabled jitter. The claim batches
used 1440/light only: claim and claim4 used skill-third (10 and 20 repeats);
claim2/3/5/6 used sweep-lab-repeat (20/20/20/10 repeats). All recorded traces.
The first web check rejected a non-null assertion in the added test; it was
removed and the complete focused web checks passed afterward.

`skill-third` also repeatedly produced a full-page “Palvelin päivitettiin”
notice before the first chip, on the baseline and interaction-only fix. This
is not reader evidence and is not counted as a pass. Filed unlaned as
`lab-startup-spurious-upgrade-notice`, with exact provenance and retained traces.
It was not chased by weakening the upgrade fence or adding waits. Final required
reader matrices above use two other seeds; no claim is made that every possible
seed or the whole lab suite is green.

## Review and limits

Focused source/diff self-review plus deterministic ordering and browser
regressions: proportionate for local reading-position UI state. Reviewed
listener cleanup, stream containment, pointer/focus ordering, resize restoration
and resuming existing scroll paths. No independent model review was required or
claimed: sessions, contract and authority boundaries did not change.

This is synthetic host-backed Chromium evidence, not Safari, a live deployment,
real Pi/provider behavior or kernel user isolation. Deployment and live testing
remain with the conductor; KOKEILTAVAA has a pending-release check.

## Decisions for later review

A history control interaction claims the reading position, rather than briefly
suppressing scrolling for a guessed timeout or retrying a cancelled click.
Following resumes through the existing end/jump paths. This preserves deliberate
reading and works for keyboard focus as well as pointer input. No product or
security authority decision was needed.
