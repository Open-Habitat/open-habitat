# Adaptive rail graduation

Implemented, but **not merged**: the required layout sweep still hits the
pre-existing `lab-desktop-header-1024-flake`. The identical failure reproduced
three times on main; the worker's failure policy requires preserving the work
rather than merging with a required check red. This issue remains in progress.

## Changes

- Removed the adaptive-rail catalog entry, experimental card/search entries and
  useExperimentalFeature gate. A saved false preference no longer selects an
  old desktop layout. Desktop WorkspaceRail now requires its adaptive inputs;
  only the phone drawer and collapsed rail use the non-adaptive branches.
- Kept allocation, workspace edge paging, place navigation, output counts,
  browser states, aligned empty headings and phone behavior covered. Updated
  component fixtures, design guidance and generated UI references.
- Fixed two defects exposed by making this the default: the conditional places
  wrapper remounted the rail and lost keyboard focus on collapse; status
  paragraphs' margins were omitted from height measurement and could clip an
  empty/error workspace message. Browser regressions cover both.
- Corrected the long-rail account fixture to extend the actual workspace list,
  rather than append rows as fixed siblings outside its scrolling region.

## Evidence

Tested base: `18c67cfada2cf1f2a2e1f69d62369851766410ae` plus this change.
SHA-256 of `git diff --binary HEAD -- web design-system internal/experimental
internal/daemon/ui-skill` before committing:
`b10ed884a943f6c211495ccaeaa63396620a7adb9a6d516c81d560e80768b131`.
All logs and review artifacts below are under
`/var/tmp/agent-keep/rail-adaptive-graduate/`.

- `./scripts/test-focused.sh --area web`: **255 files / 2156 tests passed**,
  including static checks (`web-final.log`).
- `./scripts/test-focused.sh --area go --go-package ./internal/experimental`:
  package compiled; it has **no test files** (`go.log`).
- Named Playwright runs with `--repeat-each 3`, `OH_BROWSER_WORKERS=2`,
  `OH_REPLY_DELAY_MS=60`, private leased scratch, umask 077 and timeouts:
  - `lab-adaptive-rail`, `lab-rail-scroll-region`: **42 passed**
    (`repeat-lab.log`).
  - `rail-section-filter`, `settings-experimental`, `rail-place-toggle`,
    `workspace-count-rail`, `status-bell`, `server-browser`, `rail-now`,
    `workspace-slice`, `rail-icons-quiet`: **129 passed**
    (`repeat-browser.log`).
  - Separate demo config, `synthetic-demo`: **24 passed**, one worker
    (`repeat-demo.log`).
  - Corrected `lab-sidebar-account`: **18 passed** (`sidebar-repeat.log`).
- Additional selector/layout sweep through the focused runner:
  `rail-groups`, `rail-hover-marks`, `lab-foundation`, `lab-sidebar-account`,
  `lab-outage-account`, `lab-explain-coverage`, `lab-workspace-icons`,
  `workspace-slice-security`, `lab-desktop-header`, `lab-shell-header`,
  `lab-page-scroll-header`, `lab-rail-keyboard-help`, `design-system`.
  **62 passed, 2 capture-only cases intentionally skipped, 2 failed**
  (`extra-browser.log`). The account fixture failure was corrected and its
  entire spec passed three times above. The remaining header failure is below.
- Synthetic visual capture: four adaptive-layout cases passed (`capture.log`).
  Inspected `ordinary-720-on.png` and `little-1080-on.png`; matching `.html`
  snapshots and the 900/1080 ordinary captures are beside them. No captures
  are committed.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json`,
  `git diff --check`: passed. UI references regenerated.

### Remaining required failure

`lab-desktop-header.spec.ts`, 1024px: `conversation-recap` has viewport ratio
0 at `expectOneRow`, line 206. The spec is untouched by this change.
A disposable source archive of main at
`18b58065955793314ad4f419bc119ef6f4d6a0c1` failed identically **3/3 times**:

```sh
OH_BROWSER_WORKERS=1 OH_REPLY_DELAY_MS=60 OH_REPLY_SEED=1e2524bc1e09040c \
  npx playwright test --config playwright.lab.config.ts \
  tests/lab-desktop-header.spec.ts --grep 'at 1024px' --repeat-each 3
```

`baseline-header.log` preserves this evidence. Added the new reproduction to
existing `lab-desktop-header-1024-flake`, preserving its untriaged/unlaned
status and original provenance instead of filing a duplicate. Did not change
header code or chase that unrelated failure.

No whole browser suite, clean gate, installation or live-server verification
was run; none is claimed. This is host-backed synthetic UI evidence, not
native-provider or separate-UID evidence. No deployment was performed.

## Review

Used routine `/llm-review` because a shared layout graduation affects several
journeys: finder `claude-fable-5-2`, verifier `gpt-6-astra`, followed by
`/assess-findings`. Four actionable findings were resolved (demo filter test,
quiet workspace-name expectation, collapse focus, phone automatic-fold
coverage); one request to test translated state wording was dropped under
TESTING.md. Verifier confirmed the outstanding candidates' corrections in the
current code. No unresolved review finding. No authority, session, contract or
daemon-state change. Review and assessment copies are in the evidence directory.

## Coverage retained when removing old tests

- Deleted the switch-off-only case and comparisons against fixed desktop
  geometry: those exercised the removed option, not a remaining layout.
  Allocation unit cases, direct visibility minima and live resize comparisons
  retain the desktop sizing checks.
- Removed duplicate false/true variants of empty-heading and count cases;
  Finnish/English empty headings and counts at all three desktop steps plus
  the phone drawer remain tested.
- Moved automatic-fold assertions from desktop to the phone drawer, where the
  behavior still exists. Desktop now explicitly remains open when crowded.
- Short-list filter checks use the phone drawer; the many-workspace lab still
  checks the desktop filter. Removed only the duplicate short-list filter
  interaction from demo smoke coverage.
- Browser summary transitions use data-state rather than translated text,
  so coverage works for icons, tiles and rows. Place-toggle tests still
  exercise return navigation and drafts/scroll preservation.

## Decisions for later review

- **Keep phone crowding and collapsed navigation unchanged.** The alternative
  was extending adaptive allocation to them; graduation explicitly preserves
  the drawer, so the remaining non-adaptive code is responsive layout, not an
  experimental fallback.
- **Repair focus and empty-message measurement within graduation.** Both are
  reachable defects on the new default path, with reproducing browser checks;
  leaving them for separate work would make the default knowingly worse.
- **Do not merge with the known header failure.** The task explicitly requires
  a blocked report for a required failing check, even though this occurrence
  is already tracked and reproduced on main. Work is committed for continuation.
