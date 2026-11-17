# Result

Implemented in `0397f5d8fa8ec26ddee43ad451a3a7612463d8ae`.

Previewable files open in preview; the existing pencil control opens source.
The mode stays local to the open file, without a persisted preference. The
renderer registry still selects the checked start-page view within preview.

## Decisions for later review

- Line-addressed links open source, select the requested line range and focus
  it, including when that file is already in preview. Scrolling preview near
  the line was the alternative; source provides exact placement for YAML,
  front matter and other text that has no one-to-one rendered position.
- Apply the default to every existing preview format, including JSON, tables,
  SVG and HTML, rather than special-casing Markdown and YAML. All use the
  same view controls and inert preview boundary.
- Keep explicit choices only for the current open file, as before. Opening
  another file and returning chooses the default again; no browser storage
  or account preference was added.

## Verification

Tested product/test sources: `0397f5d8fa8ec26ddee43ad451a3a7612463d8ae`.
Commands used `umask 077`, a private scratch TMPDIR, the shared scratch lease,
explicit timeouts, two browser workers, port base 16700 and 0–60 ms reply jitter.

- `./scripts/test-web-fast.sh`: passed, 230 test files / 1,839 tests, including
  initial-mode cases for all supported formats, source-only files and line links.
- From `web/`: `npx playwright test tests/browser-editor.spec.ts tests/start-page-preview.spec.ts --repeat-each 3`:
  105 passed. Includes desktop/phone defaults, exact line selection and focus,
  explicit choices, reopening, start-page rendering, keyboard switching,
  source/preview scrolling, editing/saving and affected accessibility checks.
- From `web/`: `npx playwright test --config playwright.lab.config.ts tests/lab-yaml-preview.spec.ts --repeat-each 3`:
  12 passed, desktop/phone and Finnish/English Explain mode.
- The line-link cases also passed a focused three-repeat run (6 passed).
- `git diff --check`, `issuectl doctor --json` and
  `python3 scripts/validate-project-view.py`: passed.

The initial browser run exposed source focus happening before preview was
hidden. It was stopped, the transition moved ahead of the engine's selection
effect, and the complete selected specs rerun successfully. An intermediate
retry found the stopped run's Vite listener still present; that run's listener
was stopped before rerunning. Neither partial attempt is counted as a pass.

Logs are retained outside git at `/var/tmp/agent-keep/editor-preview-first/`:
`fast-final.log`, `browser-final.log`, and `line.log`.
This is host-backed synthetic Chromium evidence, not live deployment or native
phone-browser verification. No new layout or controls were introduced; existing
layout and accessibility assertions were retained. No screenshots were captured.
The whole browser suite and clean gate were deliberately not run.

## Review

Focused self-review of the final diff and its document-opening callers: low-risk
browser-local view state, no session, contract, daemon state or authorization
change. Checked renderer coverage, explicit-choice retention and selection-effect
ordering. No independent LLM review was required or run.

## Live check

After deployment, on desktop and phone:

1. Open Markdown, nested YAML and `.agents/start-page.md` from the file picker:
   each should display its preview without pressing the eye control.
2. Press the pencil, edit, and open/close the picker: source remains selected.
   Switch to preview and back: the unsaved buffer remains intact.
3. Open a source-only file: it opens as editable text without preview controls.
4. Follow an agent's `path:42` link to a previewable file: source opens with the
   requested line selected and visible. Preview can still be chosen afterwards.
5. Open another file and return: preview is the default again.

Deployment and this live check remain the conductor's follow-up, not evidence
claimed by this worker.
