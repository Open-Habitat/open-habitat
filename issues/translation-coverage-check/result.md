# Translation review extract and fast checks

Implemented on base `66153ba8a6b8b5392c75a64974967a8c31213650`.

`node web/scripts/catalog-review.mjs > /var/tmp/catalog-review.json` produces
one JSON file, keyed by file/export/message, with fi, en-US and effective en-GB
side by side. The checked tree has 5,847 entries from 155 files, including 904
Finnish function entries and 185 settings-search labels/descriptions. UK
fallbacks are expanded. Nested objects and arrays are flattened; functions,
JSX, template placeholders and referenced local helper functions retain their
source so a reviewer sees alternatives, not one sampled execution. The settings
index's generated rows are loaded with Vite's existing TS loader; bilingual
search keywords are deliberately excluded.

The fast web command's existing Vitest step now discovers the script tests.
They check missing/extra/wrong-kind messages, ASCII Finnish words in either
English region, English words in Finnish, Finnish letters and regional spelling,
including literal text within function branches, templates, JSX and local
helpers. TypeScript still owns full signature/shape compatibility. The small
fixed word lists come from the catalogs, and tests verify that provenance;
a copied word cannot exempt itself by entering both languages. Two key-scoped
exceptions preserve `settings.json` and Dropbox's external Settings page.
No product copy, authority, dependencies or browser behavior changed.

## UI text outside these catalogs (not moved)

Source audit of gateway/daemon Go and the three Habitat Pi extensions:

| Source | Strings/surface | Current coverage and limitation |
| --- | --- | --- |
| `internal/gateway/views_linux.go`, `viewText` / `viewFailure` | `viewBadRequest`, `viewHandoffExpired`, `viewSessionEnded`, `viewShareGone`, `viewLinkInvalid`, `viewFileMissing`, `viewReadOnly`, `viewLinkBusy`, `viewLinkDailyLimit`, `viewUnavailable` | Ten separate Finnish/English view-origin failure messages, selected from Accept-Language. Not web catalog entries; no US/UK split or new scan coverage. |
| `internal/gateway/editor_linux.go`, expired editor session HTML | “Editorin istunto on päättynyt. Avaa editori uudelleen sovelluksesta.” | Finnish-only page outside the app/catalogs; `lang="fi"`. VS Code iframe/page title is an external product name. |
| `internal/daemon/integrations/google_files_linux.go`, `(*google).Folders` whole-drive row | “Koko Google Drive” | Host-created folder name; `web/src/components/Integrations.tsx` displays `f.name` and `whole.name` directly. This Finnish text is not covered by the catalog scanner. Real provider folder names are user data and must not be translated. |
| `internal/daemon/git_identity_linux.go` | “Gitin globaali asetus” source value | Already remapped through `gitIdentityText` in `app/GitIdentity.tsx`; host literal remains outside catalog checking. |
| `internal/daemon/history_linux.go` and `history_blocks_linux.go` | “Uusi keskustelu”, “Local command”, “Extension message” fallback metadata | Browser title/history presentation has localized counterparts (`app/agentTitle.ts`, `app/HistoryView.tsx`); host fallback text itself is outside the catalogs. This is not evidence that every fallback is shown untranslated. |
| `internal/daemon/workspace_icon_write_linux.go`, `workspace_worktrees_linux.go` | “Työtilan kuvake: %s (open-habitat)”, “Tallennettu ennen worktreen poistoa (open-habitat)” | Product-written Git commit subjects, later visible as native Git history. Not web messages, and changing display language must not rewrite existing history. |
| `internal/daemon/rest_linux.go`, `crashDetail` | “Pi was killed by signal …”, “Habitat closed Pi's input after …, which ends Pi; …” and exit details | English diagnostic detail passed into the companion's restart account. Not catalog wording. |
| `internal/daemon/process-extension.mjs` | `stopCauses`, `stateText`, `wokeBecause`, `catchUpMessage`, `waitReminder`: “[Open Habitat] This conversation's Pi stopped …”, “Background processes that were cut off …”, “Spinoffs whose state changed:”, “A Taskfleet run you started is still working …” and wait instructions | English native custom messages with `display: true`. The browser recognizes their structured details and renders restart/wait cards from its catalogs; native Pi history/message content remains English and outside this check. |
| `internal/daemon/recap-extension.mjs` | Command description “Save a brief recap outside the agent context”; `OUTCOME` notifications | Native command description is English. Notifications carry a machine marker/JSON for daemon consumption, not ordinary translatable UI sentences. |
| `internal/daemon/rewind-extension.mjs` | Command description “Return the conversation or files to an earlier message (Habitat)”; `filesNote`, `undoNote` | Description is native English. “The person restored …” / “The person undid …” are agent instructions sent with `display: false`, not browser UI; OUTCOME notifications are protocol messages. |
| `internal/gateway/server.go` | “misdirected request”, “method not allowed”, “static client unavailable”, foundation not-implemented response | HTTP fallback bodies outside catalogs; direct navigation can expose them. Normal API errors use browser-localized codes rather than translating arbitrary response bodies. |

Synthetic view/title/file fixtures, generated agent skill instructions,
provider/model/tool output, real folder names, user prompts, and arbitrary
third-party Pi extension content are not product catalog translations.
`internal/daemon/editor-extension/extension.js` has no user-facing message
strings of its own. This inventory is source evidence, not a live walkthrough
or a claim that every native string should move into a browser catalog.

## Decisions for later review

- Use source-preserving JSON rather than rendered sample messages or CSV.
  Samples can hide branches and lose JSX/link placement; JSON preserves both
  readable source and searchable fragments. No generated extract is committed.
- Use short fixed, catalog-derived word lists instead of a language detector or
  a dynamically subtracted vocabulary. This avoids new dependencies and the
  self-exemption bug; it deliberately cannot prove translation meaning or detect
  every foreign word. Agent review of the extract remains necessary.
- Include the settings index despite its different storage shape, using the
  existing Vite loader for generated rows rather than building an expression
  interpreter or silently omitting a visible surface.
- Leave Go/Pi-owned strings where they are, as requested. In particular the
  Finnish editor-expiry page and whole-Google-Drive label remain outside these
  checks; this run does not claim complete application-wide localization.

## Validation and focused self-review

- `npm ci --prefix web` and the requested Pi fixture dependency install passed.
- `./scripts/test-focused.sh --area web`, with a fresh disk-backed TMPDIR,
  `OH_PORT_BASE=17000`, `OH_BROWSER_WORKERS=2`: passed Biome, TypeScript and
  183 test files / 1,388 tests. Seven new cases exercise extraction, both
  contamination directions, helper/template/JSX text, settings keywords,
  regional spelling, and refusals. Existing canvas-unimplemented notices did
  not fail tests. Log: `/var/tmp/oh-i18n.djNYol/web.log` (disposable).
- Rebased onto `27d451b39` (earlier round landings). The only conflict was
  the additions under KOKEILTAVAA's Työn alla; kept both workers' lines and this
  run's line. The integrated fast web check passed 184 files / 1,389 tests
  (`/var/tmp/oh-i18n-rebased.PZ0cNe/web.log`); only Markdown conflict markers
  were removed afterwards, and the project-view/diff validators passed again.
- Standalone extract executed successfully; JSON parsed and counts above were
  checked. Artifact: `/var/tmp/oh-i18n-review-final.json` (disposable).
- Focused self-review checked fallback/overlay behavior, that copied words do
  not disappear from detection, helper-source coverage, exact-word matching,
  source-only versus rendered text limits, and that Vite closes in `finally`.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py` and
  `git diff --check` passed. Doctor reports pre-existing large prototype HTML
  and image-format observations, with no tracker errors introduced here.
- No Go/contracts or browser specs changed; those checks and the full gate were
  not run. No visual change, so no screenshot/browser claim.

Development failures were resolved before final validation: TypeScript 7 lacks
the old compiler API, so extraction uses the already-present Vite parser;
Vitest initially excluded script tests, so its include set was extended;
initial strict extraction exposed templates, arrays and generated settings rows,
which are now covered; a jsdom-relative URL was replaced by an explicit file URL
in tests; legitimate Settings occurrences got scoped reasons; an unused word
was removed from the catalog-derived vocabulary. Initial lint warnings about
literal template-source fixtures received an explicit test-file explanation.
An attempted multi-edit of documentation did not match and was reapplied
precisely. Exploratory reads of guessed `workspaces.ts`/`server_linux.go` paths
failed; actual files were located without changing anything. The initial
rebase stopped on the KOKEILTAVAA additions; a range-diff attempted before
continuation consequently had no new range. Resolution kept all additions,
then continuation and range-diff succeeded with no code changes.
