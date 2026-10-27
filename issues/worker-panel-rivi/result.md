# Result: Workerit panel, Rivi direction

The Workerit tab of the background strip (`web/src/components/BackgroundStrip.tsx`)
now follows direction 1 Rivi of `issues/proto-worker-panel/`. Each worker row
has two lines. The first holds the name and the time: how long a live run has
been going, or the clock time an ended one stopped. The second says in words
what the row means: *agentti odottaa*, *agentti ei odota*, *odottaa
pääagenttia*, *tila ei tiedossa*, *laskeutui*, *ei mergetty · työ tallessa*,
*epäonnistui* (with *· työ tallessa* when work remains). After that come the
harness and Taskfleet profile (*Pi · nopea*) and, only when the worker works
in another repository than the conversation, that repository's name. The
legend at the top of the panel is gone. A row that has a wait keeps ■ Lopeta
odotus. The row's name opens the worker view that `worker-view-conversation`
landed. The pill, the ended fold and the red attention dot are unchanged.

## Host facts added

The prototype round found four facts missing from the contract. They are now
in `contracts/v1/spinoffs.schema.json`, all read by the daemon as the user
from their own Taskfleet. No new authority is involved.

- `state: "failed"`: Taskfleet `status: failed` (not landed). Before this the
  daemon folded `failed`, `done` and `cancelled` into `unmerged`, so a failed
  worker looked the same as one whose merge stopped. The same enum value is
  added to `process-event.schema.json`, which shares `spinoffState`. A failed
  run with preserved work needs the person just as a preserved `unmerged`
  one does (red dot).
- `profile` on every row. It used to be sent only for the selected run. Ended
  rows already ran `taskfleet run show` and now take the profile from it.
  Live rows get it from one extra `run show` in a second pass that starts only
  after every ended row's required read, so it never spends their time under
  the 5 s deadline. A missing profile does not make the reply partial.
- `other_repository`: the directory name of the run's `source_repo`, sent
  only when the parent session's cwd is not inside it.
- `ended_at`: an ended run's `manifest.updated_at`. Taskfleet records no end
  time, and the manifest is last written when the run ends.

## Evidence

Screenshots at device scale factor 2 are in `evidence/`
(`paneeli-{1440,390}-{light,dark}.png`). They were taken by
`web/tests/worker-panel.spec.ts` with
`OH_WORKER_PANEL_CAPTURE=$PWD/issues/worker-panel-rivi/evidence`. They show
the prototype's seven workers: two waited (one in `kirjasto`), one Claude
worker not waited on, one waiting on its parent, and landed, preserved and
failed ended runs.

Checks run on Birch:

- `./scripts/test-focused.sh --area contracts`: clean.
- `go test ./internal/daemon`: ok. New tests cover `otherRepository`, the
  ended row's `failed`/`ended_at`/`profile`, the live row's
  `profile`/`other_repository`, and the `done`/`cancelled`/`failed` state
  mapping.
- `./scripts/test-focused.sh --area web`: passed, including `stateWord`
  tones and attention for a preserved failed run.
- Browser: `worker-panel.spec.ts` (new: no legend, the waited and unwaited
  rows and the stop, the other repository, the failed and preserved ended
  rows, axe, no horizontal overflow at 390 px, the row opening the worker
  view), plus `spinoffs.spec.ts`, `worker-view.spec.ts` and
  `process-tray.spec.ts`: all passed. The whole-suite result is in the
  commit message.
- Independent `/llm-review` (gpt-6-astra) produced one finding: the inline
  live-row `run show` could starve ended rows' reads under a slow Taskfleet.
  It was confirmed and fixed with the second pass described above.

Not verified live: the panel against real Taskfleet runs on the test server
(KOKEILTAVAA).

## Decisions for later review

- **`failed` as a new state rather than a flag.** The alternative was a
  `failed: true` beside `unmerged`. A state keeps the worker view's result
  card, the restart notice and the panel on one mapping, and there are no
  compatibility constraints. `done` without a landing and `cancelled` stay
  `unmerged`.
- **A failed run with preserved work reads "epäonnistui · työ tallessa" and
  keeps the red dot.** The prototype showed such a run as "ei mergetty · työ
  tallessa". Saying it failed is more truthful, and the attention rule stays
  "work remains on a branch".
- **Profile for live rows costs one `taskfleet run show` per live worker per
  3 s poll**, about 6 ms each on Birch. The alternative, the profile only for
  ended rows, would leave it off exactly the rows the person watches.
- **The other repository is compared against the parent session's cwd.** A
  conductor running in a worktree of the same repository whose children
  record the main checkout as `source_repo` would see that repository named.
  Taskfleet records the git top level where the run was created, so this
  should not normally happen.
- **The harness is shown as "Pi"/"Claude"** (short, as in the prototype),
  while the worker band says "Claude Code". A profile spelled like its
  harness ("claude") is not repeated.
- **The stop button stays on any row with a running wait**, as before, even
  when that wait does not wake the agent. The prototype only showed it on
  waited rows, but such a wait can still be stopped.
