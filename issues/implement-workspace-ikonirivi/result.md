# Result

Implemented direction 2, **Ikonirivi**, from
`design-system/prototypes/rounds/2026-10-16-tyotilasivu-2/`.

The workspace head has copy path, observed GitHub remote, rename dialog,
hide/show toggle (`aria-pressed`), disabled deletion with its reason, a divider
and direct conversation creation. Phone targets are 40 × 40 px on their own
row; the phone top bar has only navigation and the workspace name. Sidebar
and home workspace rows now have only +. The obsolete cross-page menu intent
and its callback plumbing were removed, rather than retaining invisible menus.

Hide stays on the workspace page. The hidden native annotation removes only
the rail row; the page remains routable after reload and offers Näytä in its
dashed tag and icon toggle. Kumoa uses the same eight-second, pointer/focus-paused
notice as archive. Failed writes remain visible and require fresh native facts;
no annotation or identity is optimistically invented in the browser.

Cards follow the accepted order: new answer, working, process wait, spinoff wait,
waiting for the person, unknown. State and recap age are separate from the
working/waiting line. The spinoff dot blinks, respecting reduced motion. The
Git pill's adjacent summary counts the observed attention/work/wait states.
Valmiit and Arkisto stay folded; even an empty archive has its row. Existing
native-source and restoration guards remain intact.

Card archive is disabled for a native active run (including a question), an
accepted command, or process/spinoff waits; the reason is both the hover title
and accessible description. Empty waiting arrays do not block idle work. This
is browser enforcement using the existing contract: the daemon's existing
native-writer/admission guards were not changed. It is not a claim that a
custom HTTP client cannot bypass a presentation rule. Self-review also found
that card archiving did not actually create the accepted undo offer: only
archiving from a conversation did. Card and conversation archives now use the
same offer, mounted in the shell so home and workspace both retain it. Undo
returns to the originating route and never starts Pi.

## Prototype comparison and decisions

Paired `lab-<state>-<width>-<theme>` and `round-<state>-<width>-<theme>`
AVIF images and adjacent offline HTML show page, Git, rename and hidden states at
1440 and 390 px in light and dark. All lab data is synthetic. Reproduce with
`web/lab/capture-workspace-ikonirivi.mjs` against the private lab at
`OH_PORT_BASE=29300`; build the round with
`(cd design-system/prototypes && node build.mjs rounds/2026-10-16-tyotilasivu-2)`.
No built prototype HTML was read in full. Cropped working, process-wait and
spinoff-wait pairs add the same activity states in all four viewport/theme
combinations. Those lab crops explicitly inject activity facts at the snapshot
wire boundary while keeping native fixture titles, histories and recaps.

The first comparison exposed the inherited generic-state 720 px cap despite
the workspace's own 860 px limit, excess desktop top padding, accent-colored
quiet icons and a boxed disabled trash icon. These were corrected, not explained
away. The workspace now escapes the generic error/onboarding cap, has the
accepted 860 px content width and neutral icon treatment. The phone's extra
home shortcut was also removed specifically on workspace landing pages.
The accepted narrow rule follows the content container, not just the viewport;
a 900 px desktop browser with its rail therefore also gets 40 px targets and
one card column. A dedicated browser width checks this.

Most importantly, the hidden-state capture showed **Avoimet 0**: routing had been
fixed, but the inherited conversation selector still discarded hidden-workspace
conversations. That was a real mismatch, not a permitted deviation. The selector
now includes every present native workspace for its own page, while home still
filters to visible workspaces. The browser test and capture both assert that
hiding, undo and reloading preserve every conversation title. The active-card
comparison also corrected the disabled archive icon's boxed treatment and the
waiting-line wording.

Deliberate differences retained:

- Lab native histories are not the prototype's invented five active sessions.
  Unknown/read-only terminal observations remain explicitly unknown/read-only;
  synthetic process/spinoff/activity wire seams in the browser regression
  establish the active-state guards, not real provider behavior. Recap ages and
  card lengths follow the native fixture, never fabricated prototype ages.
- The global production rail retains its account, filter-refresh and workspace
  discovery presentation. This task changes workspace actions, not the accepted
  account/navigation journeys. Its native workspace names and counts differ.
- Existing production recap text is rendered as text, including the fixture's
  Markdown fences; this task does not introduce a new Markdown rendering path
  for host summaries. Long native titles wrap rather than being clipped.
- Git details preserve native path/status/commit observations, local-only fetch
  wording, error/retry handling and publication. No invented added/deleted line
  counts, network freshness or prototype commit dates are supplied.
- The Git pill retains its established text label rather than the prototype's
  decorative branch/caret glyphs: the actual branch, changes and ahead/behind
  counts are in its accessible name, and the bordered pill still signals the
  expandable layer. The desktop + uses the existing 32 px icon target rather
  than the prototype's 28 px +; the five actions are also 32 px, and all six
  become 40 px in narrow content.
- Working lines say the observed generic operation (working, tool use or answer
  writing) rather than inventing an exact shell command not carried in that
  card's facts. Waiting lines use the native process/spinoff name and the
  accepted first-person wording.
- The shared React Aria dialog/layer/control semantics and established modal
  presentation remain, including focus return to the rename pencil. The
  prototype's hand-built dialogs are not copied as a second overlay system.
- Archive removal uses the existing immediate optimistic list update with
  refusal recovery, not an artificial delay for the prototype's 160 ms fade.
  Confirmation/error ownership and the eight-second undo offer are preserved.

### Page pairs

| View | Lab | Accepted round |
| --- | --- | --- |
| Desktop, light | [Lab](lab-page-1440-light.avif) | [Round](round-page-1440-light.avif) |
| Desktop, dark | [Lab](lab-page-1440-dark.avif) | [Round](round-page-1440-dark.avif) |
| Phone, light | [Lab](lab-page-390-light.avif) | [Round](round-page-390-light.avif) |
| Phone, dark | [Lab](lab-page-390-dark.avif) | [Round](round-page-390-dark.avif) |

The same suffixes cover `git`, `rename`, `hidden`, `working`,
`waiting_process` and `waiting_spinoff`. Every image has adjacent `.html`.
PNG captures are encoded with `avifenc --speed 8 --jobs 1 --qcolor 80` for the
repository; no live or personal browser data was captured.

## Verification

Runnable source verified at **c57a7bc8e1c3f7b4fec71130dce1dd89d4566340**
(the preceding source commits are 470ca5dd and 94cb9a85):

- `./scripts/test-web-fast.sh`: format, lint, typecheck, **141 app/unit and
  133 component tests passed**.
- From `web/`, `TMPDIR=/var/tmp OH_PORT_BASE=29300 OH_BROWSER_WORKERS=1
  PLAYWRIGHT_BROWSERS_PATH=/home/maintainer/.cache/ms-playwright npx playwright test
  --config playwright.lab.config.ts lab-workspace-page.spec.ts
  lab-sidebar-account.spec.ts`: **10/10 passed**, including 1440, 900 and 390 px,
  focus/axe, every icon action, the menu-free rail, conversation preservation
  through hide/undo/reload, three archive-block states and idle release, and
  actual card archive/undo without starting Pi. A final two-worker rerun also
  checks the deletion reason as an accessible description.
- Same environment plus `CHOKIDAR_USEPOLLING=1`, normal Playwright
  `--grep 'archive|@workspace-slice|@lab|@process-tray|daemon restart loses controller|settled terminal history can be titled'`:
  **33/33 passed** in 1.3 minutes. Covers archive timer/focus/restore, mapped
  identity and production bundle boundaries, native history, waiting facts,
  process surfaces, home/workspace navigation and affected a11y.
- `capture-workspace-ikonirivi.mjs`: **28 paired states** (56 images and 56
  offline HTML snapshots). Hidden-state preservation and disabled archive
  guards are asserted during capture; screenshots were visually compared,
  not counted as automatic visual passes. The capture host uses a frozen
  private copy of the production bundle, so another build cannot remove its
  assets mid-capture.
- `python3 scripts/validate-project-view.py`: **29 pages valid**;
  `git diff --check` and `issuectl doctor --json` run for delivery.

Local logs are `/var/tmp/oh-ikonirivi-preserved-{fast,lab,browser,capture}.log`
and `/var/tmp/oh-ikonirivi-delivery-lab.log`. This worker runs the matching
web/browser checks from TESTING.md, not a full release gate. Go, contracts,
packaging, a release gate receipt and live provider/UID tests are not claimed
for this web-only change. RAM was checked before heavy runs (initially 8 GiB
available; under load 3–7 GiB).
Build scratch uses `/var/tmp`; no shared service or machine limit was changed.

The first normal run was invoked from the repository root: 95/97 passed.
The noindex asset inspection needs `web/` as cwd and failed looking for root
`dist/assets`; this was an invocation error, not a product failure. The other
failure was the unrelated daemon-restart editor timeout; it passed in the next
97-case run. That run passed 96/97, with an unrelated native title write refused
with HTTP 409 instead of 200. Both cases subsequently passed in the focused
33-case regression run, without weakening any native guard. One further
parallel archive-expiry run timed out waiting for refreshed archive facts to
enable Palauta; the final serial 33-case run passed that test as well, with its
clock assertions and native admission guards unchanged.
The first capture attempt overlapped a fresh browser production build, which
removed a font asset during HTML inlining; final captures run after builds.

Focused self-review covered native visibility versus route selection, identity
and observation-token preservation, menu removal, GitHub noopener, clipboard
failure, rename focus, unavailable actions, empty waiting arrays, active runs,
archive offer ownership and restoration without Pi startup. No follow-up issue
was filed. Live authenticated checks are in `KOKEILTAVAA.md`; lab evidence does
not establish distinct-UID isolation, live sign-in or real provider turns.
