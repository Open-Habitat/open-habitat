# Result

## Causes and changes

- `BackgroundStrip` used `spin.working` for the unqualified Workers count,
  but retained idle, parent-waiting and ended rows. It now counts `spin.items`;
  the separate working metric and status marks still describe activity.
- Wait attribution used the first matching live process. An older observer
  with notifications disabled (or unknown) could hide a newly started waking
  wait for the same run. It now prefers a matching waking process, including
  for the row's Stop action. No minimum process age or end-of-turn condition
  is added.
- `WorkerHeader` deliberately rendered unknown model/context as question-mark
  controls. Those controls are now omitted. Invalidated usage after compaction
  or a context edit is omitted too; known token usage and active compaction
  remain displayable. Git retains its existing unavailable-state explanation.

The Pi facts path already reads the worker's own native transcript:
`readSpinoffTranscript` projects its model changes, assistant model and usage;
`SpinoffConversation` derives settings and context from those entries. It does
not need another store or a profile-name guess. The header now stays quiet
before that evidence exists and shows the facts when it arrives.

## Wait investigation and limits

Habitat detects the parent's live process and its wake policy, rather than
inferring a parent wait from Taskfleet's worker state. The native process tool
returns its start result immediately; the companion's existing literal-command
and live-argv readers do not impose a one-minute delay. The first-match masking
case above is reproducible and fixed. The original 24-second versus one-minute
observation was not reconstructed, so it is not evidence that this masking case
was the cause of that particular delay. The live check below should confirm it
on the next test round; no new timer or speculative daemon change was made.

## Verification

- Focused web checks passed: 217 files, 1,697 unit/component tests, typecheck and
  static checks. New coverage includes a new waking wait alongside an older
  observer, unknown Pi startup/invalidated context, and a known model before
  usage exists.
- Only the touched browser specs were run: `worker-panel.spec.ts` and
  `worker-view.spec.ts`, four cases passing in each of three final consecutive
  runs, two browser workers, port base 17300. The regression leaves one idle
  worker listed with count 1 and working count 0, recognizes a new waking wait,
  and stops that new process rather than the older observer. The header case
  transitions from absent Pi facts to known model/context. Desktop/phone and
  accessibility checks passed.
- Existing native companion checks passed: `process-extension.test.mjs` and
  `wait-reminder.test.mjs`, 12 tests, including literal and expanded live waits.
- Focused self-review checked count scope, wait selection and stop identity,
  independent model/context availability, and phone-header behavior. No daemon,
  contract, session-state or authority-path implementation changed.
- Synthetic PNG/HTML captures are outside git in the worker-results directory
  for run `01m7dxc2cb2ftymgce0ft54e5q`, under `panel/` and `header/`. Reviewed
  the single waiting-worker panel and the compact Pi startup header. No live
  installation was captured.

The first browser invocation was blocked by missing Pi SDK fixture dependencies;
installing the pinned fixture package resolved it. Subsequent runs passed.
Browser evidence is host-backed synthetic evidence with routed worker facts,
not a live-provider or separate-UID test.

## Decisions for later review

- Count every listed worker, including the ended section, rather than relabel
  the number as working-only: the tab names the whole list.
- Omit unknown model/context for every harness, not only Pi. Keep explanations
  in the details and keep Git's existing unavailable control. This avoids
  replacing one unknown placeholder with another.
- Prefer the waking process when multiple waits cover a run; otherwise retain
  the existing observer row behavior. Do not claim a wake from a process whose
  notification policy is unknown.

Live check: Start a Pi worker that pauses at a startup prompt and immediately
start a waking `taskfleet run wait` in the parent. The panel should keep count
1, mark the parent's wait on the next inventory refresh, and omit model/context
until the worker's native session supplies them. Open its view again after its
first response to check the known facts.
