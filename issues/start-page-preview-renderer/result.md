# Result

The editor opens the workspace-root `.agents/start-page.md` as the start page, reusing `WorkspaceIntro` with inert goal cards and complete goal guides. The text view and plain-document switch remain available. Invalid content falls back to nested metadata plus Markdown, with the first problem's field path; an unavailable check never shows an unchecked special view. JSON now uses the generic nested preview too.

Validation is a bounded POST to the person's daemon for an admitted workspace, using the saved-page parser. It neither reads the saved page nor writes files or starts Pi. The gateway only performs its existing session/CSRF forwarding. The registry is static bundled code, matches exact workspace-root paths, and does not affect offers or attachments.

## Decisions for later review

- Open this known file directly in preview; explicit links to a source line still open text. Alternative: always start in text. This makes the accepted special-view-first direction directly useful while preserving source navigation.
- Return the first parser problem with its zero-based field path, rather than accumulate a separate browser validation model. Structural YAML failures use a fixed message without exposing native parser errors; field validation points to places such as `goals[0].prompt`.
- Use proportional scroll mapping for the special view, since the page and its repeated goal guides do not have a one-to-one source heading map. Ordinary Markdown and table mappings are unchanged.
- Add the necessary exact gateway forwarding registration and proxy body cap alongside the daemon route. The design's “Gateway: nothing” is interpreted as no new authority or parsing there; without registration the existing gateway cannot reach a new route.

## Checks and review

- Contracts after rebasing onto integrated main: 102 schemas, 165 fixtures, 44 scenarios and negative checks; generated packages clean.
- Focused Go: `internal/daemon` and `internal/gateway` passed. Daemon rerun after the reviewed parser correction passed.
- Focused web after rebase: 229 files / 1,808 tests passed, including registry/path, frame input, valid/invalid/unavailable/oversized checks and stale reply cancellation.
- Host-backed synthetic Chromium: all 33 cases in `browser-editor.spec.ts` and `start-page-preview.spec.ts` passed with two workers and a dedicated port range. The four new cases passed in three separate runs before rebase and again on integrated main. They cover unsaved content, the actual route, inert immediate-start goals, plain/special switching, JSON, accessibility, and Explain mapping at 1440/390 pixels in Finnish and US English.
- Focused self-review plus independent route review by `claude-fable-5-2`; `gpt-6-astra` independently verified the one surviving parser finding and input/authority bounds. Empty front matter previously gave a misleading missing-delimiter error; corrected with a regression. Assessment: one confirmed local FIX, no follow-up issues.
- Synthetic screenshot/HTML pairs are in `evidence/`. Inspected valid, invalid and Explain layouts in both widths and languages. English UK uses these unchanged strings. Compact captures use pointer hover, not a touch-device interaction proof. No live installation or distinct-UID proof is claimed.
- UI agent references regenerated and checked. Rebase conflicts were limited to generated contract fingerprints, regenerated from both schemas. The integrated main also had stale BrowserConversation/HistoryView generated references; refreshed those from their unchanged source. Full clean gate and complete browser suite were deliberately left to the conductor.

Development checks caught and corrected the preview/source selection, a missing synthetic-host route mount, heading order, outdated JSON exclusion, and test selectors/waits. One unrelated `PersonalStorage` unit test had a transient unresolved-listing callback failure; the unchanged test and the complete web checks passed on the final rerun.

Live check: Open `.agents/start-page.md` in the browser editor. Choose a goal to jump to its guide without sending anything; switch to the plain document, then edit away a goal's `prompt` and return to preview. The problem should name that goal's field while the unsaved source remains intact. Also open a JSON file and use preview.
