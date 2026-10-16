# Spinoff/process duplication

## Cause and scope

`ProcessTrayView` rendered the entire native inventory. The daemon already recognises
`taskfleet run wait` from the **full command** and returns its `run_ids`; optional
Taskfleet enrichment only supplies titles/states. The UI used that enrichment to
rename waiters but still counted and listed them alongside ordinary processes.
Thus the same work appeared in both the tray and the spinoff group.

The tray now filters on nonempty `run_ids`, including terminal waiters and waiters
whose run-show enrichment is unavailable. No command-preview/name heuristic is
used. Counts, groups, selection lookup and the empty-tray condition use the same
filtered records. The provider retains the full inventory: native waits, wake
notifications, header waiting facts and history joins are untouched. No server,
authority, contract or native process-lifecycle change was needed.

The clear button **already existed in the expanded Päättyneet group**, including
in Jari's `spinoffit-prosesseina.png`. It was absent when collapsed, as in
`spinoff-ja-prosessit.png`. It now lives beside the summary toggle, reachable in
both states whenever ordinary finished records exist. It remains a shared React
Aria button, not a nested button. The existing CSRF/owner-fenced native
`clear-finished` action removes finished records/logs (including terminal waiter
logs), never running processes, spinoffs or conversation history.

The shared spinoff/process strip is intentionally **not redesigned**: the issue
explicitly leaves that choice to `proto-composer-strip`.

## Paired visual comparison

All new application PNGs have adjacent inert HTML twins, captured with
`web/lab/session.mjs` against a production bundle in the **synthetic lab**, base
29800, invented Alice/aurinkokello, explicitly intercepted process/spinoff wire
responses. These are not live-host or real-Pi evidence.

Reproduction:

```sh
# Build the lab host/bundle as scripts/lab.sh does; host was process-tool managed.
TMPDIR=/var/tmp/open-habitat-build go build -o .cache/browser-host ./test/browser-host
npm run build --prefix web
BROWSER_HOST_LAB=1 BROWSER_HOST_PORT=29801 .cache/browser-host web/dist
# .cache/lab/port contains 29801.
OH_PORT_BASE=29800 PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node issues/spinoff-process-duplication/capture.mjs --before
# After the fix and a fresh build, omit --before.
```

| Matched state | Before/reference | Fixed synthetic lab | Comparison |
| --- | --- | --- | --- |
| Mixed inventory, collapsed | Reporter `spinoff-ja-prosessit.png`; `before-light-collapsed.{png,html}` | `desktop-light-collapsed.{png,html}` | Waiter's name/count disappears; clear is reachable without expanding. |
| Mixed inventory, expanded | Reporter `spinoffit-prosesseina.png`; `before-light-expanded.{png,html}` | `desktop-light-expanded.{png,html}` | Ordinary running/finished tests remain; both waiter rows disappear; separate spinoff status remains. |
| After clearing, collapsed | Same running-work state after removing finished records | `desktop-light-cleared.{png,html}` | Running ordinary test and spinoff remain; clear and finished count disappear. |
| Theme/width variants of all three states | Same fixture | `desktop-dark-*`, `phone-light-*`, `phone-dark-*` | Quiet connected bar/list, accessible clear, bounded column and composer retained. |

Compared the bar/list against the already captured selected process round in
`../process-ui-fidelity/prototype-1440-light-bar.png`,
`prototype-1440-light-clear.png` and `prototype-390-dark-bar.png` (process direction
3 and the subsequent quiet block direction 1). Built the selected spinoff round
with `node design-system/prototypes/build.mjs design-system/prototypes/rounds/2026-10-16-spinoffit --out .cache/spinoffit.html`;
`prototype-spinoff-langassa.png` captures direction 1's working-spinoff state.

### Deviations and why

- **Clear moves from the finished-group heading to the summary's right edge.**
  This deliberately differs from the original round's expanded-only placement:
  the reported missing action is in the collapsed state. One shared location
  solves discoverability without duplicating controls. The compact rounded
  surface, connected list, small group labels and ordinary rows stay unchanged.
- **Phone hides the redundant finished-count badge**, as well as process names,
  so the running count and full clear label fit one line. The clear action itself
  indicates finished work; opening reveals those rows. Desktop retains the badge.
- **Spinoff summary remains the existing plain clickable row**, unlike the richer
  framed/icon/time/hint row in the original spinoff prototype. That pre-existing
  visual gap is exactly the open `proto-composer-strip` topic, not silently
  claimed fixed here. The spinoff remains outside the process tray and readable.
- **Fixture content/shell/vertical position differ:** the synthetic lab has one
  ordinary running test, one finished test and one displayed working spinoff
  with two native wait records, versus the live report's two distinct spinoffs,
  real conversation and magnified crop. The empty synthetic conversation is
  intentional: no real history is used, and process recognition is inventory
  driven. Durations, model availability and sidebar names are synthetic facts,
  not invented production changes. The before fixture reproduces the same
  duplication and hidden-clear states, not the reporter's private text.
- Existing process wording, visible stop words, output controls and unavailable
  states are unchanged; their prototype differences remain documented in
  `../process-ui-fidelity/result.md`. This task does not restyle unrelated UI.

## Verification

- New fixture-inventory browser regression fails on the original implementation:
  expected `1 käynnissä`, received `2 käynnissä` including `odota-spinoff-0`.
  It checks live and terminal waits without optional enrichment, ordinary commands
  merely mentioning Taskfleet, collapsed owner/CSRF-fenced cleanup, surviving live
  work, removal of a wait-only tray, and retained spinoff status. The collapsed
  clear click also fails independently if clear is left inside the closed list.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=29800 PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright ./scripts/test-focused.sh --area browser --spec process-tray.spec.ts`:
  5/5 passed. Includes output/follow/stale stop, waiting header/home/recap,
  unavailable inventory, Axe, both themes and both widths.
- Initial five-worker attempt: 2 passed, 3 timed out (one during login). Alder
  was at 1 GiB available with swap full; retrying with two workers passed all.
  No test timeout was increased or assertion removed.
- `./scripts/test-web-fast.sh`: format, lint, TypeScript, 26 unit files / 144 tests and 20 component files / 133 tests passed.
- `git diff --check`, `issuectl doctor --json`, and `python3 scripts/validate-project-view.py` passed (doctor retains repository-wide pre-existing advisories).
- Full clean gate: pending on the committed implementation below; result will be appended after completion.

Focused self-review: native recognition survives missing enrichment; display-only
filtering cannot stop a waiter; all tray calculations share the filter; cleanup
keeps existing generation/CSRF/pending guards; no nested interactive controls;
shared slot covers both conversation views. No unrelated finding was filed.

Live behaviour is **not yet verified**. `KOKEILTAVAA.md` has the exact mixed
spinoff/process, collapsed cleanup and phone/dark checks for the next deployment.
