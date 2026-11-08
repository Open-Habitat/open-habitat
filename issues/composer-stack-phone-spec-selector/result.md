# Result

Updated all five obsolete direct-child composer selectors, including the stop-state height sampler. Worker-view already used a valid selector. No geometry assertion was loosened.

The restored checks exposed two CSS defects, fixed here: actionable warnings had an extra horizontal inset (24px per side on desktop), and phone recap sizing/keyboard hiding still addressed the old direct-child structure. The latter pushed the field 12.375px below the simulated keyboard viewport.

## Verification

Base: `5f5383a2e`, with this issue's diff. Birch, `umask 077`, `OH_PORT_BASE=14500`, `OH_BROWSER_WORKERS=2`, `OH_LAB_WORKERS=2`. Installed both pinned npm fixture sets.

`./scripts/test-focused.sh --area browser --spec NAME.spec.ts` passed, in full, after the CSS fixes:

- browser-conversation: 86
- browser-shell: 12
- resilience-states: 10
- github-connection-warning: 6
- phone-composer-keyboard: 2
- composer-geometry: 4
- lab-composer-stack-gaps: 2
- lab-composer-area: 10
- lab-composer-bang-spacing: 4
- lab-composer-lists-in-field: 4

Lab names used `--lab`. Fast web checks passed after the final product changes. These are synthetic host-backed Chromium checks, not actual iOS/Android keyboard or live-host evidence. No Go/contracts changes or full gate.

Focused self-review checked selector uniqueness, retained bounds, CSS container versus child insets, keyboard recap scope, and searched web for the obsolete selector (none remain). Existing failing assertions caught both CSS defects and passed unchanged after repair.

The paired `evidence/after-390-queued.{png,html}` shows the final synthetic lab stack at 2x scale, visually inspected. Captured with the existing stack spec's `OH_STACK_CAPTURE=after`, temporarily directing only its output to this issue; that capture-path edit was reverted. It is a stack overview, not keyboard or warning evidence; those are covered by the automated bounds checks.

Rebased onto `aae54f5f4`: combined the independent KOKEILTAVAA entries and kept both workers' CSS edits. Re-ran warning (6), keyboard (2), and stack-gap (2) specs successfully on the integrated product tree. Project-view validation and issuectl doctor completed. The closing-status command warned that the inherited issue has no Acceptance Criteria section. Diff whitespace checking flags only browser-serialized whitespace in the offline HTML evidence; source changes are clean.

## Decisions for later review

None: restored the existing layout contract rather than introducing new behavior or controls.

## Failed attempts and recovery

Initial warning checks failed 3/6 on the double inset; initial keyboard checks failed 2/2 on the obsolete recap rules. Both defects were fixed and the specs passed. An optional keyboard snapshot attempt was refused because the ordinary synthetic host is not a lab host; the temporary capture code was removed, and the real lab stack capture succeeded instead. Exploratory lookups of nonexistent Composer.tsx/useViewport paths and `test-focused.sh --help` returned errors; source discovery and reading the script resolved them. Logs are disposable under `/var/tmp/oh-phonesel.18mbeN/`.
