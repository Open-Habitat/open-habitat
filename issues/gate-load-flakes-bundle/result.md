# Load investigation — incomplete

The bundle remains open. No product or test changes are proposed for landing:
the required startup classification and first-turn fix are not established.

## Startup notice: not yet classified

The `1440 light` skill-reader case passed 40/40 executions (10, then 30)
with two browser workers, eight bounded CPU busy loops, 250 ms reply jitter,
and `OH_REPLY_SEED=skill-third`. This does not disprove the earlier failure.

There are two relevant notice paths:

- `App.tsx` sets its version-change state from `checkBundle()` when the served
  index's asset references differ from those captured by the tab.
- `ChunkLoadBoundary.tsx` shows the same notice for a `vite:preloadError`,
  without establishing that a release changed. The earlier report's
  `ERR_TOO_MANY_RETRIES` is consistent with this path but does not prove it.

No daemon-instance or gateway fence was changed. There is insufficient evidence
to classify the reported occurrence as a fence defect or harness timing.
A subsequent investigation should record the failed asset request and preload
error alongside the index comparison, rather than infer a version change from
this banner alone.

## Reproduction counts

All batches used `OH_PORT_BASE=12100`, two workers, 250 ms reply jitter and eight
CPU busy loops bounded by `timeout`. Each browser batch had a 600-second outer
bound. These are focused spec runs, not clean-gate results.

| Case | Passed / executed | Seed |
| --- | --- | --- |
| Skill reader, 1440 light | 40 / 40 | skill-third |
| First turn followed before history | 3 / 6 | r56-reds |
| Recap geometry journey | 6 / 6 | r56-reds |
| rail-unread, quota-pressure, rail-archive, live-long-run, account-settings, workspace-slice (all cases in those files, three repeats) | 81 / 81 | gate-load |

The first-turn failures were the reported 45-second stream-height predicate
failure. This is the only reproduced baseline failure; no before/after stability
claim is made for any case.

## Rejected first-turn experiment

An experiment paused synthetic `longRun` after 30 steps using the existing
`pi-visual-hold` scenario (before the live-tail limit), and held history requests
until the browser had observed tall live work. It failed 4/6 loaded executions.
One inspected failing snapshot still showed the conversation-loading state while
the rail reported working. Thus extending the turn's lifetime alone does not
resolve this failure. The experiment was reverted, not shipped as a fix.

In one baseline failure's trace, repeated history requests were cancelled before
a final successful read. A useful next investigation is the ordering between
cold status, `store.view`, buffered live events, and history cancellation. The
current evidence does not distinguish an incorrectly gated live view from all
other possible causes; it is not justification for disabling reconciliation.

## Other folded reports

- Quota Escape already waits for focus inside the popover; retained unchanged.
- Recap geometry and the ordinary reported cases did not reproduce in these
  batches. No unrelated spec was edited and no timeout was increased.
- The next lane member was not touched.

## Evidence and review

Local logs and the rejected experimental patch are preserved under
`/var/tmp/agent-keep/gate-load-flakes-bundle/`. They are working evidence, not
public attachments. Playwright output directories were overwritten by subsequent
batches, so the failing traces are not retained; only the observations above and
the logs survive. This limits further trace-based diagnosis from this run.

Focused self-review covered the findings and the reverted diff. No independent
review was requested because no runnable change remains. Web/Go validation was
not run for this evidence-only commit; it must not be treated as implementation
completion. No full gate was run.

## Decisions for later review

- Keep the issue open rather than claim all six reports fixed or file duplicates
  of work still tracked here. Alternative: close on passing reruns. Rejected
  because first-turn failures reproduce and the startup cause remains unknown.
- Leave the build fence intact. Alternative: suppress the upgrade notice or
  extend the chip timeout. Neither follows from the available evidence.
- Revert the held-turn experiment. Alternative: land it as a timing fix. Its
  failing repeats demonstrate it is not such a fix.

Live check: no new behavior to try; this run produces investigation evidence,
not a test-server change.
