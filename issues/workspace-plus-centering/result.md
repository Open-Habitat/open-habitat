# Partial combined-run result — retained for continuation

Run `01m52qdasz0zmd2rx0bmfbd310` fixes shared geometry in `web/src/components/Controls.module.css`, not a workspace-specific offset:

- Text-bearing icon buttons use `line-height: 1`, so the inherited body line box cannot exceed the compact icon box.
- `Primitives.Button` routes its icon-only contents through the existing shared `icon` presentation, removing the inline SVG baseline from the send arrow. Explicit presentations remain authoritative. Ordinary text buttons retain inline layout; making every shared button a flex container would wrongly centre the full-width Valmiit row and remove spacing in process-completion labels.

## Evidence

`TMPDIR=/var/tmp/ohcg OH_PORT_BASE=23600 OH_BROWSER_WORKERS=2 PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright ./scripts/test-focused.sh --area browser --spec composer-geometry.spec.ts` passed 4/4 desktop/phone × light/dark cases. It checks the workspace + text box, composer send SVG and the visible SVG-only shared buttons in the conversation view, including disabled controls. This does not assert every icon in every application state.

`./scripts/test-focused.sh --area web` passed. Existing `lab-workspace-page.spec.ts` passed 8/8 (including accessibility); `browser-conversation.spec.ts` passed 73/73 in an isolated rerun. Both used `umask 077`, disk-backed `TMPDIR=/var/tmp/ohcg`, two workers and the shared Chromium cache. The first conversation run overlapped the lab suite in the same checkout and returned 69 passed / 4 failed, including missing Playwright trace files. The output directory was shared despite distinct ports; that run is not a pass. No runnable code changed before the isolated 73/73 rerun.

Paired screenshot/offline HTML evidence from the synthetic lab is in `shots/{1440,390}-{light,dark}.{avif,html}`. The workspace + and its adjacent icons are centred. Composer captures live beside the other issue, `../composer-and-new-conversation/shots/geometry-*`. These are invented lab identities and homes, not live-host screenshots.

## Comparison and deviations

The shared icon alignment matches the centred +/send intent. The queued-send prototype is a conversation reference, not a workspace layout specification; these workspace screenshots do not establish compliance with its message states. No per-instance translation or pixel offset was introduced.

## Decisions for later review

None. The combined assignment's delivery implementation and mandatory restart acceptance evidence are incomplete. Accordingly this issue was not closed and this worker did not merge or deploy its partial work. After landing the complete work, add the desktop/phone and light/dark +/send check to `KOKEILTAVAA.md`; do not present this unmerged branch as already published.

## Independent review

`/llm-review` used finder `claude-fable-5-1` and verifier `gpt-6-astra` (two calls). The finder exposed three real regressions in the initial attempt: broad button flex layout centred the Valmiit row and collapsed process-completion spacing, and replacing the editor's literal background exposed the generic disabled fill. Local source/cascade checks confirmed them. The final patch narrows layout to icon presentations and restores disabled transparency; the verifier checked all three against revised source and found none remaining. A disabled-editor background assertion was added to the browser geometry check. Full local report: `history/review-composer-geometry.md`; the standalone explanation here survives that ignored scratch file.

Model-performance logging was attempted through `/assess-models` and failed with SSH-to-self `Permission denied (publickey,password)` (exit 3). The product review itself completed; the corpus entry was not logged.

After the review fixes, all checks were rerun sequentially on the final code: fast web (150 unit + 133 component tests), geometry 4/4, workspace 8/8 and conversation 73/73 passed. Captures were refreshed from this final code. Documentation validation and `git diff --check` passed. No Go, contract or full-gate claim is made for this CSS/primitive-only patch.
