# Result

Implemented in the working tree based on `113674f3`; the commit containing this result carries the tested production changes. No push, deployment or live-server changes.

## Decisions for later review

- **“Hae etätiedot” / “Lue paikallinen tila”.** Chosen over “Hae etärepo” / “Lue uudelleen” to distinguish network fetch from a disk read. The visible hint names `git fetch`, says it changes neither the working branch nor files, and directs the person to ask the agent for `pull --rebase`. No pull/rebase host action was added.
- **Report the resulting comparison totals**, e.g. “Etätiedot haettu. origin/main: 8 tulossa.”, rather than “8 uutta committia” or “Ei uutta”. A change in behind-count cannot reliably measure newly downloaded commits: the local branch may move concurrently, and an earlier comparison may be unavailable. Zero is reported explicitly; unknown comparisons say they are unavailable, never “nothing new”. Existing failure/uncertain-outcome messages remain unchanged.
- **Neutral compact actions.** Both labelled actions use the shared secondary/inline role (same label colour). Workspace “Sulje” uses that role too, on a separate right-aligned row with token spacing; the conversation's icon-only close uses inline/quiet. Kept the workspace's visible close label rather than replacing it with another icon. No shared token or authority change.

## Validation

- `./scripts/test-web-fast.sh`: format, lint, TypeScript, 245 unit tests and 174 component tests passed.
- `OH_PORT_BASE=15420 OH_BROWSER_WORKERS=2 PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" npm run test:browser --prefix web -- --config playwright.lab.config.ts lab-git-status.spec.ts lab-workspace-page.spec.ts`: 10 passed. Covers desktop/phone conversation panel, workspace panel at 1440/900/390px, accessibility, real synthetic-repository fetch, local reread without fetch, unchanged branch/files, consistent colours, separated compact controls, close and Escape focus restoration.
- `npm run storybook:test --prefix web`: passed. New production-component stories cover before-fetch, incoming, zero incoming, fetching and failure states. Stories are presentation fixtures, not network simulations.
- `python3 scripts/validate-project-view.py`, `git diff --check` and `issuectl doctor --json`: passed. Doctor retains pre-existing evidence-format/large-file advisories elsewhere.
- Focused self-review: checked the diff against button roles/tokens and inspected all four after captures. The workspace panel reproduces the originally touching close button in the before captures; the revised layout has a visibly separate close row. Conversation actions share the same details component.

## Synthetic visual evidence

`web/lab/capture-git-panel-actions.mjs before|after` captures the production workspace Git panel from the synthetic lab. Each AVIF has adjacent inert, self-contained HTML. Widths are 1440 and 390px, height 1000px. Before is pre-fetch; after includes a successful fetch result. Images are losslessly encoded from Chromium PNGs.

| View | Before | After |
| --- | --- | --- |
| Desktop light | [Image](evidence/before-desktop-light.avif) · [HTML](evidence/before-desktop-light.html) | [Image](evidence/after-desktop-light.avif) · [HTML](evidence/after-desktop-light.html) |
| Desktop dark | [Image](evidence/before-desktop-dark.avif) · [HTML](evidence/before-desktop-dark.html) | [Image](evidence/after-desktop-dark.avif) · [HTML](evidence/after-desktop-dark.html) |
| Phone light | [Image](evidence/before-phone-light.avif) · [HTML](evidence/before-phone-light.html) | [Image](evidence/after-phone-light.avif) · [HTML](evidence/after-phone-light.html) |
| Phone dark | [Image](evidence/before-phone-dark.avif) · [HTML](evidence/before-phone-dark.html) | [Image](evidence/after-phone-dark.avif) · [HTML](evidence/after-phone-dark.html) |

## Failures and limits

The first formatter invocation was mistakenly run from the repository root and rejected the nested web configuration; rerunning from `web/` succeeded. The first fast check found an unused capture-script import; removed it and reran successfully. Initial source-discovery probes referenced nonexistent component/spec paths; corrected them to the actual files. A repeat Playwright run passed 7 cases but failed the 3 workspace-width cases when Chromium discarded the completed no-store fetch response body before `response.json()`. The test now waits for the visible fetch result and reobserves native branch/files through the request API instead of depending on Chromium's retained response body; the complete focused suite was rerun. No required check remains blocked.

No full clean gate, Go suite, external review or live VM exercise was run: this browser-only task uses focused checks and self-review. Build output retains non-fatal PostCSS/chunk-size warnings. Screenshots and browser tests prove synthetic same-UID behavior, not live operation or cross-user isolation. Live checks are at the top of `KOKEILTAVAA.md` for the next pilot.
