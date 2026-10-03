# Result — UI state inventory

Implemented at `b11def48cd7570ff1364d6dd3a9cde3961fd5c7b` (the final runnable commit). `web/lab/inventory.json` maps views, synthetic routes and interactions, source files, capture regions and designer draft states across desktop/phone and light/dark. States the lab cannot reproduce stay explicit gaps rather than being inferred absent from the product. The designer drafts also have state-level mappings; unmapped modes are reported.

`web/lab/capture-inventory.mjs` captures each reproducible state as a standalone inert HTML fragment and paired PNG, with full-page HTML/PNG for focus views. `snapshot()` retains an empty rail layout anchor in fragments so the app's CSS `:has(.ah-rail)` rules give the offline main column its original width. It preserves fonts, CSS and the theme via the existing inlining mechanism. `web/lab/snapshot.test.mjs` checks offline rendering without network requests and compares the captured and offline fragment dimensions. Captures and their `index.json` live under ignored `.cache/lab/`; they are not source files.

The design-package assembler now accepts `--inventory-captures`, includes fragments, full pages, screenshots, inventory, coverage and draft/implementation gaps, and maps changed files since the last `design-system/rounds.md` commit to affected states. Unmapped changes, routes, fixture scenarios and component stories are listed for the package author. The updated skill tells the assembler to reconcile inventory in its own worktree, capture at the packaging commit, then record that commit in `rounds.md` and the round issue. **No package was assembled or delivered in this run**, as requested; that integration path has syntax and source review but not a live package trial.

## Verification

- Source commit `b11def48cd7570ff1364d6dd3a9cde3961fd5c7b`: `NAH_PORT_BASE=20000 TMPDIR=/var/tmp/nah-inventory PLAYWRIGHT_BROWSERS_PATH=$PWD/.cache/ms-playwright node web/lab/capture-inventory.mjs .cache/lab/proof` exited 0; `index.json` records **84 captured presentations** (21 reproducible states × 4) and **44 explicit coverage gaps** (11 states × 4), with no failed reproducible state. A local trial of a desktop menu, expanded workspace details and phone landing had matching offline region dimensions. Generated captures are ignored, not committed; run the command again at the package commit.
- `NAH_PORT_BASE=20000 TMPDIR=/var/tmp/nah-inventory PLAYWRIGHT_BROWSERS_PATH=$PWD/.cache/ms-playwright node web/lab/snapshot.test.mjs` passed: static/inert offline snapshots, no network, layout and fragment dimensions verified.
- `TMPDIR=/var/tmp/nah-inventory ./scripts/test-web-fast.sh` passed.
- `NAH_PORT_BASE=20000 TMPDIR=/var/tmp/nah-inventory ./scripts/ci-local.sh --clean --json` passed on the committed candidate (`status: passed`, `clean: true`).
- `python3 -m py_compile .claude/skills/design-package/scripts/assemble.py`, `python3 scripts/validate-project-view.py`, `git diff --check` and `issuectl doctor --json` passed. The documentation/issue closure below changes no runnable code, so the full gate is not rerun for those edits.

Evidence is synthetic, not real login/provider data or a test-server deployment. The assembler's first real package will resolve remaining draft and lab gaps from the updated sources; visual suitability of any designer handoff remains Jari's judgement.

## Review

Focused self-review after the final diff: this is lab/package tooling, not an authorization or runtime state-flow change. The main risks were false-positive state captures, missing offline layout context and exhausted synthetic OAuth login admission. Deterministic trials exposed each; explicit state checks, an offline geometry test, and session reuse addressed them. The full clean gate and a complete four-presentation capture cover the runnable change. No independent model review was used because this isolated synthetic-only surface has direct test evidence; there are no changes to the Unix-user security boundary or live-host handling.
