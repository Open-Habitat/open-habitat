# Fixed — 10 November 2026

Run `01m72mcar9n57xd40xstdvggsy`, based on `f7cebd6f65a183438d39d2a879e9ab7c2e623317`.

## Change

A following conversation now lends its reading anchor to a pointer press until
click delivery, then resumes following. An already-reading conversation keeps
its anchor. This protects the target through pointer-down/up without turning
an output expansion into a permanent stop. Click capture is intentional:
React Aria can stop click propagation. Cancellation, release outside the
control and window blur release the temporary hold; changing conversations
clears it. Authored introductions are not scrolled to their end.

A focus event following pointer-down restores the existing anchor immediately.
The stress detector reproduced an 18px lazy-layout shrink before focusin, with
pointer-up arriving before ResizeObserver. Waiting for the observer was too
late to protect Load. Focus does not recapture the already-shifted anchor.
Keyboard focus at the end keeps following; keyboard entry into older content
still establishes a reading position.

The state at pointer-down, not the physical bottom gap, decides whether to
resume: browser scroll-into-view may already have moved a following view to
an earlier control. No component, session, contract or host state changed.

## Verification

Final executable inputs (SHA-256):

- `web/src/app/useReadingPosition.ts`: `abc12f3c546dc6703af40454d20f3fec6880902b87566ee1dd70274964517069`
- `web/src/app/useReadingPosition.test.tsx`: `842158d02b0bafa86fff3aaf910a9e9464f1ec8ce78f58ada43a1d6275d18011`

All final checks below passed on Birch, umask 077, a fresh short disk-backed
TMPDIR, `OH_BROWSER_WORKERS=2`, `OH_PORT_BASE=18700`. Each command had a
300–600 second timeout; browser commands ran from `web/` and rebuilt assets.

| Check | Result | Log |
| --- | --- | --- |
| `./scripts/test-focused.sh --area web` | 206 files, 1560 tests | `/var/tmp/hp-final-web.log` |
| `npx playwright test --config playwright.lab.config.ts tests/lab-skill-invocation.spec.ts --repeat-each 6`, D250, seed `sweep-lab-repeat` | 36 passed | `/var/tmp/hp-final-sweep-lab-repeat.log` |
| Same skill command, D250, seed `sweep-focus` | 36 passed | `/var/tmp/hp-final-sweep-focus.log` |
| `npx playwright test tests/browser-conversation.spec.ts tests/thread-fill.spec.ts -g 'latest action follows\|only reader scroll\|latest pill clears\|thread-fill' --repeat-each 3` | 15 passed | `/var/tmp/hp-final-follow.log` |
| `npx playwright test --config playwright.lab.config.ts tests/lab-conversation-scroll.spec.ts tests/lab-open-at-end.spec.ts --repeat-each 3` | 27 passed | `/var/tmp/hp-final-scroll.log` |

The latter two use D60, seed `history-follow`. D250 means
`OH_REPLY_DELAY_MS=250`; seeds use `OH_REPLY_SEED`. The skill matrices include
all widths/themes, reader opening, full-block loading and their axe checks.
`issuectl doctor --json`, public/private project-view validators and
`git diff --check` passed (doctor lists existing non-AVIF images only).
Unit cases cover expansion, resize before activation, scroll-into-view,
click/cancel/outside release, an already-reading full press, immediate focus
repair before ResizeObserver and introduction preservation.

Exploration was not uniformly green: a bottom-gap exemption lost one Load
press in 36 cases; temporary hold without synchronous focus repair also lost
one in 36 (and two in a 12-case instrumented run). A bubbling click listener
failed all three expansion repetitions because React Aria stopped the event.
One intermediate follow batch missed the jump-latest pill at line 918 once;
the same selection then passed all repetitions twice, including the final
run. No assertion, timeout or retry was weakened. Temporary instrumentation
was removed. These logs are `/var/tmp/hp-skill-seed1.log`,
`hp-skill-final1.log`, `hp-debug.log`, `hp-follow-final.log` and
`hp-follow-final2.log` in the same directory.

## Review and limits

Focused source/diff self-review, deterministic event-order unit tests and
repeated host-backed browser regressions are proportionate for local reading
position state. Reviewed event capture/cleanup, original-follow restoration,
route changes, cancellation, keyboard entry and introduction handling. No
independent model review was required or claimed: sessions, contracts, daemon
state and authorization boundaries are untouched.

No whole browser suite, clean gate, live deployment, real provider or Safari
verification was run. This is synthetic Chromium evidence. Deployment and
live acceptance remain with the conductor; KOKEILTAVAA contains a pending
release check.

## Decisions for later review

Use the actual press lifecycle to pause/resume following, rather than a delay
or an exemption for particular buttons. Preserve the pre-press following
intent even after browser scroll-into-view. The alternative bottom-gap-only
rule both reproduced lost Load and misclassified the expansion regression.
No new product or authority decision was needed.
