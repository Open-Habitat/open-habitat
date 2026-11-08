# Result

Settings keeps its section list beside the content at common desktop widths,
including 1280 and 1366 px, without restoring the stacked → side-by-side jump.
The app rail yields at 1400 px; settings navigation folds at 1050 px. CSS,
search previews and section-preserving resize handling use the same boundary.

## Root causes

- The 1400 px settings-navigation fold broke ordinary desktop navigation in
  account, model-picker, three-page, identity and English-route journeys.
  Fixed the product rather than increasing those specs' viewports.
- Two account-settings logout cases expected the app rail while Settings was
  using its space. They now close Settings before using the account menu;
  sign-out/user-switch and host-authorized administration assertions remain.
- Settings search exposed a separate omission: the Markdown preview experiment
  had a card but no search-index row. Added its Finnish/English search entry;
  kept the bidirectional index/page assertion unchanged.
- Rail groups expected green for a conversation whose worker awaits the
  person. The landed Pallot decision explicitly requires yellow. Updated only
  that state assertion/comment; age, geometry, persistence and axe remain.
- GitHub-first onboarding passed unchanged. No evidence justified changing it
  or reverting the new-conversation rail behavior.
- Skill-reader lab cases intermittently failed after reload at the guide-title
  assertion (1440 light, then 1440 dark). An unchanged final run passed all six.
  The brief identifies this spec as a known load flake (`load-race-sweep`).
  A disposable archive of pre-round `13a310340` passed four ordinary named
  runs and one with 4× CPU/250 ms jitter: this exact occurrence was **not**
  reproduced on that baseline, so it is not claimed as proven pre-existing or
  fixed here. No skill-reader code or assertions were weakened.

## Decisions for later review

- Give the settings panes priority over the workspace rail between 1051 and
  1400 px. Alternative: retain the early one-pane fold, or squeeze all three
  columns. Two settings panes at ordinary desktop widths preserve fast section
  navigation/search while the existing close control returns to workspaces.
  Container-driven row stacking and the monotonic width-sweep checks remain.

## Verification

Birch, base `db1537dcd`, implementation in the commit carrying this result.
Installed both locked npm dependency sets. All runs used umask 077,
disk-backed `/var/tmp/oh-r68.*` TMPDIR, `OH_BROWSER_WORKERS=2` and
`OH_PORT_BASE=23700` (23800 for the disposable baseline).

`./scripts/test-focused.sh --area web`: 190 files / 1431 tests pass, with
static checks, types and catalogs.

Each spec was run separately through
`./scripts/test-focused.sh --area browser --spec NAME.spec.ts`, adding `--lab`
for the last two rows. Final passing results:

| Spec | Cases |
| --- | ---: |
| github-first-onboarding | 6 |
| rail-groups | 2 |
| settings-search | 5 |
| settings-model-picker | 5 |
| settings-three-pages | 10 |
| workspace-slice-security | 8 |
| account-settings | 17 |
| settings-width-sweep | 21 |
| settings-breakpoint | 2 |
| settings-close | 8 |
| settings-selectors | 2 |
| server-settings-area | 3 |
| lab-skill-invocation | 6 |
| lab-english-url-paths | 1 |

The breakpoint test now explicitly visits 1280/1366, both sides of each
boundary, and narrow→wide resizing with the app rail open and collapsed.
`OH_VISUAL_CAPTURE=1` on that named test produced 2× synthetic-lab PNG/static
HTML pairs under `evidence/` at 1280, 1060, 1040 and 390 px. The 1280 image
was inspected: section navigation and content are side by side with readable
rows. No live profiles/data were captured.

Focused self-review checked CSS/JS breakpoint agreement, direct/layered
settings, search catalog parity, and the intent of all three named landed
issues. No daemon, contract, session-state ownership or authority changes;
no independent model review needed. No whole suite or clean gate was run.
These are host-backed synthetic checks, not live-provider or UID-isolation
qualification. Issue doctor, project-view validation and source whitespace
checks run before commit.

## Development failures and limits

Initial named settings-search/account-settings runs exposed the omitted index
row and rail-dependent logout paths above; fixed and rerun successfully.
The two lab-skill failures and their unchanged final pass are disclosed above.
Original suite logs at `/var/tmp/oh-suite-r68-logs` were unavailable to this
worker; fresh logs are under `/var/tmp/oh-r68-suitefix/`. Early discovery reads
also guessed two absent file paths and a missing load-race result; corrected
by scoped source searches. The staged whitespace check found trailing spaces
in browser-serialized HTML; normalized those generated snapshots and reran it
successfully. None blocked validation. No new issues filed.
