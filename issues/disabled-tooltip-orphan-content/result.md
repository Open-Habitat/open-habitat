# Result

Fixed in the shared tooltip and both React Aria/native button adapters. Disabled buttons remain natively disabled; a labelled, focusable group owns their tooltip description and keyboard help. Tooltip portals stay within the trigger's document landmark. Merely adding `aria-describedby` did not fix Axe's `region` finding, so both changes are needed.

## Decisions for later review

- Give disabled icon help one Tab stop with a visible focus ring. Alternatives were pointer-only help or replacing native disabled behavior with manually guarded `aria-disabled` buttons. The group preserves native non-activation while making help reachable by keyboard.
- Portal into the existing landmark rather than inventing a landmark for each tooltip or suppressing Axe's region rule. Placement and warm-up still belong to React Aria. Header screenshots and browser geometry checks retain visible, non-overlapping placement.

## Verification

Base: `510932622a36580e6bfb5058ae2fe5dbc5d29f37`; tested the final working-tree changes carried by this result's commit, on Birch with private `/var/tmp` scratch, umask 077, `OH_PORT_BASE=10210`, `OH_BROWSER_WORKERS=2`.

- `./scripts/test-focused.sh --area web`: passed, 161 files / 1186 tests, static checks included. Unit regression covers native and React Aria disabled buttons, pointer/touch, description ownership, keyboard focus and refusal to invoke the action.
- `./scripts/test-focused.sh --area browser --spec workspace-editor.spec.ts`: 9 passed. Both phone themes explicitly hover disabled Save, audit the whole page with Axe, then Shift+Tab to its help and audit again; Escape dismisses, Enter/Space leave Save disabled. Desktop and existing editor journeys remain green.
- `./scripts/test-focused.sh --area browser --lab --spec lab-icon-tooltips.spec.ts`: passed. Expanded the enabled header audit to the whole page (including portalled help), checked keyboard description ownership, and set the actual theme as well as browser media. Final capture run passed with `OH_VISUAL_CAPTURE=1`.
- `header-light.{png,html}` and `header-dark.{png,html}` are paired synthetic-lab evidence. Reviewed header placement; no live data or host was captured.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py`, and `git diff --check`: completed; doctor retains repository-wide advisory findings (including PNG evidence), with no missing body sections or broken references.
- Focused self-review: checked native activation boundaries, focus/hover ownership, portal semantics, Escape behavior, layout and test assertions. No daemon, contract, session-state or authority change. No independent LLM review required.

These are host-backed synthetic browser checks, not live screen-reader or real-user acceptance. The full gate and whole browser suite were deliberately not run.

## Intermediate failures resolved

Initial lint/format errors were corrected. The first component test needed a pointer-modality event rather than the old manual hover opener; keyboard browser probing likewise needed actual keyboard modality after moving the mouse. A linkage-only implementation still failed both disabled-Save Axe cases; moving the portal to its landmark resolved them. An attempted portal-provider import was unavailable from React Aria Components; its existing typed portal-container prop is used instead. Four unrelated unit tests timed out at 5 seconds during one busy run; subsequent unchanged-suite runs passed all tests. Snapshot capture from the non-lab editor host was correctly refused; removed that probe and captured only through the synthetic lab. Final focused runs are green.
