# Editor controls — implementation

Implemented Jari's round-2 “Oma otsake” choice. Production revision: `eb22670a` (the subsequent commit records evidence and closes the issue).

## Evidence

- `./scripts/test-web-fast.sh`: passed (83 files, 482 tests; see `/var/tmp/editor-web-final.log`).
- `./scripts/test-focused.sh --area browser --spec workspace-editor.spec.ts`: **8 passed**, including 1366/390 px × light/dark, keyboard activation, both return routes, full-window close/reopen, frame identity, draft retention, reachable composer and Axe in split/full-window. `/var/tmp/editor-browser-pass.log`. The ordinary command dispatches Playwright through Fleetrepo's warm Cedar Linux guest; no local Alder browser was used.
- `cd web && npm run build-storybook`: passed on final production code. `/var/tmp/editor-storybook-final.log`.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json`, `git diff --check`: passed. Doctor retains existing attachment-format advisories elsewhere.
- Eight paired screenshot/static-HTML captures under [evidence/](evidence/): split/full at both widths and themes, synthetic lab with fake Pi and fake code-server. Capture script: `web/lab/capture-implement-editor-header.mjs`, run remotely through `python3 -m hbexec.warm`, after a fresh production build. `/var/tmp/editor-remote-captures-pass.log` contains the successful capture/export. PNGs converted to AVIF using `avifenc -j 2 -s 8 -q 75`.
- Visually inspected desktop split/full and phone dark split: local actions remain above the editor, conversation stays on the right on desktop and below on phone, and the composer remains usable. Captures include the existing unstyled local-folder notice above the app; that belongs to the parallel attachment worker, not this change. The embedded editor is a deliberately plain synthetic stand-in, not a visual claim about real VS Code.

No Go, host authority, contracts or dependencies changed. No full gate, deployment, real provider, real code-server or distinct-UID claim is made; the conductor runs the main gate. The previous phone-exclusion test was replaced because the chosen design explicitly supports stacked panes; the replacement proves actual editor availability, pane geometry and preserved state rather than maintaining that superseded restriction.

## Review

One focused final-diff self-review was proportionate: this is browser-only layout and focus/state wiring with unchanged host calls and origin checks. Reviewed local action ownership, loading/failure overlays, frame lifetime, focus restoration, CSS cascade on phones and the new regression cases. The independent Unix-user-boundary review is not applicable. Full-window Axe uncovered a missing top-level heading when the conversation is hidden; the editor heading now becomes level one in full-window mode, and final browser checks pass without suppressing the rule.

## Decisions for later review

No unresolved product decision. The existing conversation editor icon still toggles the editor, as in the selected prototype; the editor also has its own close button. Narrow mode uses the existing 800 px breakpoint, initially giving the editor 40% of the pane area (minimum 235 px) with an independently reachable conversation below. The width splitter is hidden there because horizontal resizing has no meaning in a stacked layout.

## Failure inventory

All required checks completed successfully after repair; no residual required failure.

- Fast checks initially rejected a focus-effect dependency, then missing Storybook args. Made the open/closed focus condition explicit and supplied story defaults; final fast checks pass. Logs: `/var/tmp/editor-web-fast.log`, `/var/tmp/editor-web-final.log`.
- The expanded full-window Axe audit initially failed on the missing page heading (2 desktop cases). Fixed semantics, not the assertion; final 8-case suite passes. `/var/tmp/editor-browser-final.log`, `/var/tmp/editor-browser-pass.log`.
- Capture setup first looked for a locally built browser host (ENOENT; the browser build was remote), then invoked the warm module as a file (relative-import error), then selected an ordinary-fixture workspace absent from lab mode (30 s timeout). Used the supported module entry point and the lab's aurinkokello workspace; all eight final pairs exported successfully. Logs: `/var/tmp/editor-capture.log`, `/var/tmp/editor-remote-captures.log`, `/var/tmp/editor-remote-captures-final.log`, `/var/tmp/editor-remote-captures-pass.log`. The failed local attempt launched no browser or host.
- Read-only discovery probes used a nonexistent component-path WorkspaceEditor/standalone EditorSplit story and wildcard editor-spec path; continued from the real app controller and workspace-editor spec. Fleetrepo generic task/command probes returned missing `.hb-exec.json` / native-placement refusal; ordinary Playwright dispatch and `hbexec.warm` completed remotely. No installation, runner configuration, shared services or other workers were changed.
