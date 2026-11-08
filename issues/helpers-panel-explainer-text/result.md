# Result

Moved the helpers panel's standing rule into the new Avustajat/Helpers card.
The icon-only chip and helper rows now explain their marks, read-only destination
and report acknowledgement. Reused the shared worker legend.

Added Finnish and English cards for asset rows/versions/locating, offer corner
icons and expiry choices, browser chip/strip/preview/control actions, and helper
archive rows/branch details. Publication, expiry changes, browser control/stop
and stopping a worker wait are held in Explain mode. Opening/reading still works.
No daemon, contract, authority or session-state changes.

Used `.pi/skills/explain-card/SKILL.md`; recorded its first use in
`explain-card-skill` and checked that issue's remaining acceptance item.
Regenerated the agent UI reference from the browser sources. The post-rebase
regeneration also refreshes pre-existing main drift for settings-index,
OfferPanel, QuickTooltip and viewLinks; these are generated copies only.

## Validation and focused self-review

Rebased the implementation from `f80fdb7c9` onto main including
`helpers-across-conversations`, `worker-terminal-row-noise`, the tooltip fix,
and public file offers. Both commits replayed without conflict. Range review
confirmed the removed worker terminal card stayed removed and the helpers
copy does not claim to list other conversations' helpers. Public file offers
reuse the same action selectors as views. A second rebase onto `9d4e15390`
replayed only this worker's four commits after main's equivalent earlier
commits had been rewritten. The sole conflict was KOKEILTAVAA: kept main's
removal of already-tested items and replaced only the skill placeholder with
this feature's trial line. No source conflicts. Final web, named-workers and
Explain-mode checks were rerun on `f6950ec4a`.

Final focused checks on the rebased source plus this issue's changes:

- `./scripts/test-focused.sh --area web`: 194 files / 1463 tests passed,
  including typed catalogs, Finnish/English checks and formatting.
- Each spec invoked separately with `--area browser --spec NAME`,
  `OH_PORT_BASE=13100`, `OH_BROWSER_WORKERS=2`, private disk TMPDIR and umask 077:
  `named-workers` 1, `helper-archive` 1, `lab-explain-mode` 4,
  `server-browser` 3, `view-links` 4, `agent-file-offers` 6 passed.
- Extended existing journeys: helpers map to V15/V16 and still open;
  publishing maps to V20 but stays private in Explain mode; browser viewing
  remains available but B04 does not take control until the mode ends.
- `python3 scripts/generate-ui-reference.py --check` and `git diff --check`.
- Side-by-side catalog extract reviewed with `node web/scripts/catalog-review.mjs`.

Self-review traced component handlers, nested selector precedence, disabled
publication, and the waiting set. No wording assertions were added. Removed
only the old panel-note wording assertion, replacing it with absence of the
removed element; navigation/state behaviour remains covered.

## Visual evidence and limits

`web/lab/helpers-panel-explainer-text.mjs` runs under a 180-second timeout.
`evidence/` holds 24 paired AVIF/static HTML captures: Finnish and US English,
1440 and 390 CSS pixels, scale 2, of the helper chip and row, asset row,
download icon, browser chip and large-view control. Inspected representative
cards in both languages and widths: they fit and highlight the intended
control. The long helper legend fits at the captured 900-pixel height.
UK uses these same strings without overrides. Captures are synthetic lab
state, not a live installation, native Taskfleet, provider or UID-isolation
claim. Existing Explain-mode phone tests exercise first/second taps; the
capture journey uses a pointer at both widths.

Not individually captured: archive confirmation/branch cards, expiry submenu,
every disabled state and every corner icon. Publication is exercised by the
host-backed spec; the manual lab without the separate view origin could not
show its view-public control. No whole suite or clean gate was run.

## Recovered validation problems

Initial test setup attempted two experimental preference updates in one request
(the API accepts one); split them. Initial repeated `--spec` flags selected only
the last spec; reran each separately. Publication test setup initially reloaded
an empty conversation after offering, then ran into the state card covering the
offer and hover-only icons; enable the experiment before creating the conversation,
move to the account control to dismiss the state card, then hover the offer.
Browser modal Escape closes the sheet, not Explain mode; explicitly leave the
mode before continuing its ordinary control/input journey. All final specs pass.

Capture attempts using the `types` fixture hit an unavailable SVG thumbnail;
used the single PNG fixture. Attempts to capture publishing in the manual lab
could not locate the control; retained the dedicated spec instead. Biome required
an import separator in the capture script. CSS serialization added trailing
space to one keyframe line in each HTML snapshot; normalized that whitespace.
These are disclosed evidence/setup limits, not claimed passes of the failed
attempts. Shell discovery globs and two exact-edit attempts also missed their
initial targets; corrected before changing files. The final web rerun hit
5-second timeouts in untouched GitLabConnection and Integrations tests while
host load exceeded 90. Both files then passed (36 tests), and the complete web
check passed again unchanged (194 files / 1463 tests).

## Decisions for later review

- Added individual cards for action icons rather than relying on the broad
  offer-card description. This distinguishes publication from safe opening and
  lets publication/expiry wait while the person explores.
- Reused the full worker legend for helpers rather than adding a separate
  shortened legend, to keep identical marks' meanings in one place. This makes
  helper cards longer, but the inspected 390/1440 layouts fit.
- Browser startup remains available as opening a tool, like opening a terminal;
  taking/giving control and stopping are held. Blocking all browser navigation
  would prevent exploring the strip and read-only view.
