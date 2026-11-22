# Investigation: non-open conversation attention sound

Jari confirmed on **22 November 2026** that device-dark-mode night quiet caused
the silence; sound works. Closed as **done, fixed-by-diagnosis**. No production
code changed: suppression remains by design until the separate
@attention-sound-night-visible work makes it visible.

## Outcome

No trigger defect reproduced. The confirmed cause is night quiet, not a missing
notification trigger. The regression tests and original analysis were adopted
from commit `7d3570b72`.

A host-backed Chromium reproduction now covers a Settings preview followed by
conversation A completing while conversation B is open, without a page reload
between the preview and completion. Both same-workspace and different-workspace
cases request A's workspace sound once. The native AudioContext is running before
and after completion; the test observes it rather than substituting a fake player.

There is a confirmed way to obtain the reported symptom with the accepted design:
**device dark mode plus the default `sound.night: true`**. The Settings preview
plays, but the subsequent non-open reply stays silent. The third browser case
reproduces that combination. Jari's subsequent confirmation, rather than the
synthetic test alone, resolves the reported cause.

## Code findings

- App passes all `now.yours` rows to `useAttentionSound`, before rail section
  filtering. The hook is not restricted to the open conversation or a hidden tab.
- `railNow` supplies the replying conversation's workspace ID and selection;
  the sound lookup uses that row, not the currently open workspace.
- `ConversationStore` observes `turn.settled` and snapshot replies for non-open
  conversations. The synthetic real-daemon/fake-Pi tests exercise this path.
- `silence` applies off, device mute, device dark mode with night quiet enabled,
  then the viewed-conversation choice. `playSound` previews deliberately bypass
  these suppressions, so a successful preview does not rule them out.
- The existing hook already unlocks audio on pointerdown and keydown. No autoplay
  failure was observed after the preview. No blocked-audio settings indicator
  was added because autoplay was not established as the cause.

## Harvest verification (22 November 2026)

Tested revision: `bab440594`, based on `cda5637c1`; subsequent changes are only
issue metadata and this report. All commands ran under umask 077, the shared
scratch lease and a 600-second timeout.

- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=18600 ./scripts/test-focused.sh --area browser
  --spec attention-sound.spec.ts`: **5 passed**.
- From `web`, `OH_BROWSER_WORKERS=2 OH_PORT_BASE=18600 OH_REPLY_DELAY_MS=60
  npx playwright test tests/attention-sound.spec.ts --repeat-each 3`:
  **15 passed**, with a private TMPDIR under the scratch root.
- `./scripts/test-focused.sh --area web`: **255 files, 2143 tests passed**,
  including `attentionSound.test.tsx` and `soundSynth.test.ts`, plus the fast
  static/component checks.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py` and
  `git diff --check`: passed.
- Focused self-review: test/documentation-only, low risk; no session, contract,
  daemon state or authorization changes. The three scenarios distinguish
  non-open replies within/across workspaces from intentional night suppression,
  while checking real AudioContext state after preview. No production change,
  independent model review, live-server check or physical audio check was needed.

Current logs: `/var/tmp/agent-keep/harvest-attention-sound-tests/`.
The old run's branch is now an orphan; it was not deleted by this worker.
No user-visible deployment change, screenshots, captured HTML, whole browser suite
or clean gate was produced.

## Original investigation evidence (before confirmation)

Base: `248a44d84`; changed executable artifact: `web/tests/attention-sound.spec.ts`.

- `./scripts/test-focused.sh --area web`: **255 files, 2144 tests passed**.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=15400 ./scripts/test-focused.sh --area browser
  --spec attention-sound.spec.ts --tag 'non-open reply'`: **3 passed**.
- From `web`, `OH_BROWSER_WORKERS=2 OH_PORT_BASE=15400 OH_REPLY_DELAY_MS=60
  npx playwright test tests/attention-sound.spec.ts --repeat-each 3`:
  **15 passed** on the final test changes, including the existing settings/strip
  interaction and axe assertions. Commands ran under umask 077, timeout and the
  scratch lease. No whole browser suite or clean gate ran.
- The first browser attempt was blocked by the absent Pi SDK fixture; installing
  its locked dependencies resolved it. Early new-test failures were selectors
  for controls unavailable in the conversation/settings view; these were corrected.
- Focused self-review: proportionate for test-only changes. No session, contract,
  daemon state or authority changes, so no independent model review was required.
  The old cross-workspace assertion remains covered; new cases add an actual
  second conversation, preview/audio-state evidence, and night suppression.
  Fixture hold/release replaces the old slow-turn timing assumption; browser
  clock advancement passes the agreed initial-settle window.

Logs, not committed:
`/var/tmp/agent-keep/attention-sound-silent-other-conversation/`.
No screenshots or captured HTML were committed. No live installation access,
physical sound-output check, or live reproduction was performed.

## Decisions for later review

- Keep the agreed night behavior unchanged. Alternative: disable night quiet by
  default or interpret it by time of day. Neither follows from a proven trigger
  defect; both would change the accepted product choice.
- Close as fixed-by-diagnosis after Jari's confirmation, preserving the tests.
  Retyped the report as a diagnosis task so it can close as the requested `done`:
  issuectl rejects `done` for bugs, reserving `fixed` for a bug fix. No product
  fix is claimed.
  Alternative: change a trigger or autoplay path despite passing evidence.
  There is no demonstrated defect in either path; visibility is separate work.

## Original suggested live check (superseded by confirmation)

1. In Settings > Sounds, note whether night quiet is enabled and whether the
   device reports dark mode. Habitat's own theme does not determine this.
2. Disable night quiet, ensure sounds are enabled and this device is not muted,
   and play the test sound. Close Settings without reloading the page.
3. Start a turn in A, switch to B, and let A finish after the initial load has
   settled. Check both whether A enters Your turn and whether its sound plays.
4. If it remains silent, report those two observations and whether another
   Habitat tab is open. A separate tab can claim the two-second sound burst.

At the time of the original investigation this evidence was missing. Jari's
22 November confirmation now resolves the cause; this worker did not repeat a
live check or infer live success solely from synthetic tests.
