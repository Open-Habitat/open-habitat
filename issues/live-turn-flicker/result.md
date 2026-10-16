# Live-turn flicker

## Cause and change

The synthetic real-controller/fake-Pi journey reproduced the reported label.
The original mutation log contains **10 appearances** of `Tarkista keskustelun tila`
(22 samples containing it), each followed by disappearance. Two independent
normal transitions contributed:

- A send persists an `uncertain` marker **before** making its request. Rendering
  that marker as a recovery action also rendered it while the request was merely
  pending, before the native receipt arrived.
- Native-history invalidation marks the retained window stale before its read
  succeeds. That intermediate state rendered both a history warning inside the
  timeline and a recovery button outside it.

The pending-send marker no longer advertises manual recovery. Uncertain outcomes
and history warnings must persist for 800 ms before those surfaces appear. This
is a presentation delay, not an optimistic status: send guards, receipt tracking,
identity boundaries and recovery reads still act immediately. Successful reads
remove the warning immediately. Scope changes cancel timers, so another
conversation/person cannot inherit a warning.

Normal progress now has one owner, the existing turn header. The extra
`Valmistelee seuraavaa vaihetta` / `Käyttää työkalua bash` / `Työkalun tulos saapui`
row below the live answer is removed; stopping and genuine uncertain-process
explanations remain. No shared process, spinoff, composer, scrolling or recap
component was changed.

## Evidence and matched-state comparison

All captures are **synthetic**, 1440×900. No live host or personal profile was
used. The issue supplied no screenshot attachments, so there is no claimed
live-image comparison. `web/lab/flicker.mjs` records child-list/text mutations
and 50 ms samples across streaming, tool execution, settlement, a second turn
and automatic recap. Each lab image has an adjacent offline HTML snapshot.

| State | Original lab | Fixed lab | Approved reference |
| --- | --- | --- | --- |
| Just accepted | [before](before-accepted.png) | [after](after-accepted.png) | Turn header in the selected Agentin vuoro prototype |
| Streaming | [before](before-streaming.png) | [after](after-streaming.png) | [prototype](prototype-streaming.png) |
| Tool executing, work folded | [before](before-tool.png) | [after](after-tool.png) | [prototype](prototype-tool.png) |
| Answer arriving | [before](before-answer.png) | [after](after-answer.png) | [prototype](prototype-answer.png), settled endpoint |
| Automatic recap | [before](before-recap.png) | [after](after-recap.png) | Prototype's Tilannekatsaus card above the editor |

[Prototype source](prototype.html) is the checked-in selected
`design-system/drafts/Agentin vuoro.proto.html`, not a newly invented design.
The prototype frame has its own toolbar and inset app, so pixel coordinates
between it and the full-viewport lab are not a visual assertion. The lab
before/after pairs use the same viewport and prompts. Native timing can leave
slightly different partial text in the answer-arriving pair; phase-specific
browser assertions, rather than screenshot filenames, establish streaming.

Comparison decisions and deviations:

- The fixed view retains the prototype's single quiet work row and folded work.
  Removing the duplicate status below the answer restores that design rather
  than adding a new progress treatment.
- The prototype contains previous history, an old recap and a known model;
  this first-turn lab starts without those facts. It must not invent them to
  look identical. The lab recap appears only after the synthetic idle trigger;
  its width and placement remain aligned with the editor. This arrival is one
  deliberate layout transition, not something to debounce or reserve an empty
  card for. Existing recap behavior dismisses the previous recap on send and
  shows a newer one after idle; this task does not change that policy.
- The lab's unavailable process bridge and spinoff status are genuine synthetic
  fixture limitations, not empty inventories. Their existing notices remain
  visible and stable. Changing their design belongs to the parallel
  `process-ui-fidelity` worker; hiding them would falsely imply successful reads.
- Sending and finishing switch the composer between send and queue controls.
  Those deliberate transitions remain immediate; the **during-stream** editor
  position is the measured invariant, not zero movement across an entire
  send/finish/recap journey.
- Viimeisimpään remains an out-of-flow floating action governed by reader
  scrolling. It does not appear in this following-at-bottom recording. No new
  hysteresis is added to reader intent. Existing browser cases exercise
  expanded output, reader scroll and return-to-follow.
- Recovery remains immediate when explicitly opened through Tiedot; automatic
  warnings get the short settling interval. Persistent history failure remains
  visible and actionable, verified by failing history reads after the turn.

`before-mutations.json` and `after-mutations.json` are the recorded traces.
The final fixed trace has **397 samples and zero check-button appearances**;
recap mounts once after idle, the process surface stays mounted, and normal
progress never mounts. The composer changes between pending, queue and send
modes rather than repeatedly showing recovery notices.
The original script's jump selector did not match the floating control; do not
use its `jump` field as evidence. The final script uses the actual floating
control and also records composer mode/disabled state. Screenshot pairs and
the existing scroll tests cover the original at-bottom state.

## Validation

Base revision: `31836307b3bfb4d70404694a9312430d369afeca`.

- `OH_PORT_BASE=29000 ... test-focused.sh --area browser --spec lab-live-turn.spec.ts`:
  passed, including DOM mutation + 16 ms sampling, no recovery/stale-warning
  samples, no duplicate progress row, ≤2 px editor range during streaming,
  and a sustained 503 history failure that must still expose recovery.
- Same browser regression with the original `BrowserConversation.tsx` restored:
  **failed** on transient recovery/stale samples. The fixed source was restored
  automatically afterwards. This establishes a red/green regression, not just
  a screenshot capture.
- `test-focused.sh --area web`: passed format, lint, typecheck, 141 unit tests
  and 133 component tests, including timer cancellation and delayed-warning
  boundary coverage. An initial formatting failure was corrected and rerun.
- An intermediate recording missed the idle recap because it attempted the
  next send before the slow stream finished. The script now waits for the
  actual Send control before continuing; the successful final recording is
  the evidence above.

- Existing `browser-conversation.spec.ts`: 72/73 passed; the question-once case
  timed out waiting for the explicit details check control after clicking
  Tiedot. The same case passed in isolation (8.0 s); this is recorded rather
  than treated as evidence that its batch passed.
- `issuectl doctor --json`, `git diff --check`, and
  `python3 scripts/validate-project-view.py`: passed. Doctor retains existing
  repository image-format/large-image warnings; captures here follow the
  paired screenshot/HTML lab convention.

Further browser/gate results are recorded below after completion.

## Focused self-review

Reviewed the final diff against send receipt settlement and retained-history
recovery: no request, retry, status store, continuation proof, draft persistence
or authorization behavior changes. The pending marker exclusion is limited to
manual recovery presentation; send/queue guards continue to read it. Timer
cleanup is covered on resolution, route change and unmount. Tiedot remains an
explicit, undelayed way to check. Ordinary turn progress remains accessible in
the named turn region. The full browser regression was run against original
source and failed before the fixed run passed.

## Scope and remaining live check

This is host-backed synthetic evidence, not a claim that the deployed Pi or
live network has been observed. `KOKEILTAVAA.md` asks for a real streaming/tool/
recap turn after deployment. Persistent transport/process failures still show
honest notices; this patch does not smooth them into a false healthy state.
