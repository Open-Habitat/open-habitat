# Worker balls delivered

The chip, worker rows and rail now share the Pallot marks. A recognized wait adds an outer ring without hiding the worker's state; an idle worker keeps its yellow ball even inside that ring. Finished work is green, unfinished preserved work a red diamond, and ended work without a retained result an outlined diamond. Request handling keeps its rotating ring; a request waiting for the person uses yellow. More than five live workers are counted by both state and wait, rather than collapsing idle workers into unknown.

Explain mode shows the symbol table on the Workers chip, worker rows, panel group and rail worker mark. Finnish and English catalogs include the legend. There is no new experiment flag.

## Decisions for later review

- The rail remains a conversation-level summary, using existing snapshot facts: working takes precedence over idle when both counts exist. Its ring says the conversation has a recognized worker wait, not which of several workers it awaits. The alternative was fetching individual run inventories for every rail row; that would add reads and ownership beyond this visual change. Individual marks remain in the panel.
- A rail wait with no known working/idle count shows an unknown ring with the outer wait ring, rather than claiming the worker is working merely because someone waits. No host facts were invented.
- A conversation whose only active workers await the person now has a yellow rather than green main rail ball; its own working/background-wait state still takes precedence. This removes the misleading done indication while keeping the conversation and worker states distinct.
- The Explain table is a compact symbol/meaning table, not the prototype's three repeated placement columns. It fits the existing explanation card and uses the same production component as the actual marks. Existing status words, actions and lifecycle remain unchanged.

## Verification

Birch, final worker tree based on `13a310340` (the exact implementation is the commit carrying this result). Dependencies installed with `npm ci --prefix web` and `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts`.

- `./scripts/test-focused.sh --area web`: passed; 188 files, 1,408 tests, typecheck, formatting and bilingual catalog checks.
- `./scripts/test-focused.sh --area browser --spec worker-badges.spec.ts`: passed (1), including independent state/wait, >5 grouping, rail working/waiting/idle, motion and reduced motion, chip and row legend selection, legend axe audit and phone overflow.
- Same focused command separately for `spinoffs.spec.ts` (5), `process-tray.spec.ts` (6), `lab-explain-mode.spec.ts` (3): all passed. Existing native-worker lifecycle and interaction coverage retained. The obsolete branch-pulsing assertion was replaced with a shared-ball assertion; the process journey now checks an unknown worker with a known wait rather than inventing activity.
- `issuectl doctor --json` and `python3 scripts/validate-project-view.py`: passed. Source diff whitespace check passed; the captured static HTML preserves browser-serialized CSS/HTML trailing spaces and therefore produces `git diff --check` warnings. Those snapshots were retained unchanged.
- Browser runs: `umask 077`, disk-backed TMPDIR, `OH_BROWSER_WORKERS=2`, `OH_PORT_BASE=18640`.
- Focused self-review: checked against direction 1's CSS and all prototype state mappings, accessible parent descriptions, stale rail facts, translation parity and motion. This changes presentation only: no daemon, contract, session-state ownership or authority changes, so no independent-model review was required.

The initial iterations caught a lint warning in the new reduced-motion rule (fixed with specificity, no `!important`), an old broad row selector counting the newly nested mark (narrowed to rows), and invalid new test fixtures (missing lab base URL, a 27-character run id, nested rather than top-level snapshot agents, and zero counts where the schema requires absence). Repeated `--spec` flags ran only the final spec; each spec was then run separately. All final checks above passed.

Integration rebase: the first merge conflicted only in `KOKEILTAVAA.md`; retained main's newly added/moved checks and added this issue's line. After rebasing, fast web checks passed again (189 files / 1,422 tests) and all four focused browser specs passed again (1 + 5 + 6 + 3). Source whitespace and project-view validation also passed.

These are synthetic host/browser and rendering checks, not live Taskfleet/provider or Unix-user isolation evidence. No full suite or clean gate was run; integrated-main testing and deployment belong to the conductor.

## Visual evidence

`evidence/panel-light`, `panel-dark`, `legend`, and `phone` each contain a PNG and its static HTML twin, from the synthetic lab at device scale factor 2. Captured with `OH_VISUAL_CAPTURE=1` in `worker-badges.spec.ts`; normal checks do not rewrite evidence. The panel screenshots include the rail's waited, unwaited and idle marks. Images were inspected for ring visibility, yellow idle state, dark-theme contrast and phone fit.
