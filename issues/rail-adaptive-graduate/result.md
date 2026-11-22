# Adaptive rail graduation

Graduation harvested from `28355dde9` onto `3e89f9706`, with the concurrent
sound/instructions graduation preserved. All required focused checks now pass;
the header blocker was a stale test observation, corrected in
`lab-desktop-header-1024-recap-ratio`.

## Delivered

- Desktop uses adaptive allocation without a preference switch. The phone drawer
  and collapsed rail retain their responsive layouts, not an experimental fallback.
- Removed adaptive-rail catalog, card and search entries. No adaptive-rail,
  attention-sound or agent-instructions experimental switch remains.
- Preserved the original focus fix (no rail remount on collapse) and margin-aware
  allocation for empty/loading/error workspace messages.
- Resolved the overlapping source changes and regenerated all UI references with
  `python3 scripts/generate-ui-reference.py`; generated references also incorporate
  the source branch's already-landed changes. No generated conflict was hand-merged.
- Aligned the section-filter fixture with current worker classification: an idle
  worker awaits the person; a working worker belongs in Running. No classification
  code changed. The old branch and worktree were not modified.

## Evidence

Tested code revision: `e1daf441f36be0e37bc80a9c7beee56a468faeb7`.
Product/test diff from `3e89f9706` (web, design-system, experimental catalog and
UI references), SHA-256:
`dcb28fbe482c014c24e62ee9dd33fe579eea9ef71cee87214e0921984af16eb5`.
Logs and paired synthetic screenshots/HTML:
`/var/tmp/agent-keep/rail-header-harvest/`.

All commands ran with umask 077, timeouts, a shared scratch lease and small
browser worker counts (one or two). Focused runs used distinct port bases.

- `./scripts/test-focused.sh --area web`: **257 files, 2176 tests passed**, plus
  formatting, type and catalog checks (`web-final.log`).
- `./scripts/test-focused.sh --area go --go-package ./internal/experimental`:
  compiled; this package has no test files (`go.log`).
- Named Playwright specs, `--repeat-each 3`, `OH_REPLY_DELAY_MS=60`:
  - Lab: `lab-adaptive-rail`, `lab-rail-scroll-region`, `lab-sidebar-account`:
    **60 passed** (`rail-lab-final.log`).
  - Ordinary: `rail-section-filter`, `settings-experimental`, `rail-place-toggle`,
    `workspace-count-rail`, `status-bell`, `server-browser`, `rail-now`,
    `workspace-slice`, `rail-icons-quiet`: **129 passed** (`rail-browser-final.log`).
  - Separate demo config: `synthetic-demo`: **24 passed** (`demo.log`).
- Entire `lab-desktop-header` spec, `--repeat-each 5`, original seed
  `1e2524bc1e09040c`: **25 passed**, including 1024px five times
  (`header-final.log`).
- Focused layout sweep: desktop header at **1024/1280** and phone header at
  **390**, light/dark captures and accessibility checks: **3 passed** (`layout.log`).
  Additional `lab-foundation`, `lab-shell-header`, `lab-page-scroll-header`,
  `lab-rail-keyboard-help`: **13 passed** (`layout-extra.log`).
- Visually inspected `layout/1024-sidebar-light.png`,
  `layout/1280-editor-dark.png`, and `layout/running-390-light.png`; paired HTML
  sits beside every capture. Desktop controls remain reachable through the menu,
  editor layout fits, and the phone retains its compact header. No captures are
  committed.

`python3 scripts/validate-project-view.py`, `issuectl doctor --json` and
`git diff --check` passed; regenerating UI references again produced no drift.

Initial formatting failures were corrected. The first ordinary browser run had
six section-filter failures from its idle-worker fixture; all were corrected and
its complete final group passed. Header diagnosis and the resolved original
failure are recorded in the header issue's result. No unresolved required failure.

## Review and limits

Focused self-review of the harvested diff, conflict resolutions, current worker
semantics, regenerated references and header diagnosis. The substantive original
review (`claude-fable-5-2`, verifier `gpt-6-astra`, followed by assessment) is
recorded in the original commit's result and was not claimed as a new review.
This continuation changes layout selection and tests, not sessions, contracts,
daemon state or authorization, so another independent review was not required.

No whole browser suite, clean release gate, deployment or live-server verification
was run. These are host-backed synthetic UI checks, not native-provider or
separate-UID evidence.

## Coverage retained

The original graduation removed switch-off-only variants and duplicate fixed vs
adaptive comparisons, not remaining behavior. Allocation unit tests, visibility
minima, live resizing, workspace counts, browser/place states, keyboard focus,
empty headings, phone automatic folding and collapsed navigation remain covered.
The long-list account fixture extends the workspace list inside its scrolling
region rather than appending fixed siblings outside it.

## Decisions for later review

- **Preserve both graduations.** Reintroducing the sound/instructions switches
  would undo current main; all three retired switches stay removed.
- **Use a working worker in the filter fixture.** Keeping an idle worker would
  contradict the already-landed Running semantics. The test is about filtering,
  not changing those semantics.
- **Correct the header test, not the layout.** Instrumented failures showed an
  intentional step-1 to step-3 transition after content arrived, with zero final
  overflow/overlap. The test now establishes its content before measuring.
- **Keep phone and collapsed layouts unchanged**, as in the original graduation.
