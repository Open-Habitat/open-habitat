# Nested front matter and YAML preview

Implemented the accepted **1 Sisäkkäin** direction. Markdown front matter
and `.yaml` / `.yml` buffers use the same fully open renderer: nested maps,
numbered object cards, short string chips, longer/mixed lists, multiline
quotes, named empty values and monospace scalar literals. Indentation stops
growing after level four, including grid columns and card padding. Invalid
YAML retains its source with a translated explanation and source line when
available. The Markdown body follows the metadata. No experimental switch,
start-page-specific rendering or renderer registry was added.

## Extension point

`web/src/components/EditorContentPreview.tsx` is the editor's renderer-selection
boundary. It receives the path, complete current buffer and format. A later
file-specific renderer can be selected there before the generic Markdown/YAML
branch, without changing `YamlPreview` or its parser. `fileView` remains the
small format/toolbar classifier. Delimiter splitting stays parser-free so
editor heading navigation does not import YAML; parsing is in the existing
lazy renderer dependency graph, not the editor's eager entry point.

## Decisions for later review

- Use the accepted prototype's `yaml` dependency, pinned to 2.9.1, with core
  types, no custom tags or merge-key expansion, and bounded aliases. Extending
  the old handwritten reader would duplicate a YAML parser. Browser parsing
  follows unsaved edits without a new daemon API.
- Render only finite trees of at most 5,000 values and 100 structural levels;
  cyclic aliases, unsupported tags, non-string mapping keys and multi-document
  streams show the complete source instead. This avoids misleading key
  coercion and unbounded expansion. The visual depth cap is separate and never
  hides values within this budget. Ordinary aliases work; large integers remain
  exact. Alternatives were silently truncating content or rejecting all aliases.
- Mixed lists use ordinary bullets; maps inside them keep all their fields.
  Only all-map lists promote `title`, `name` or `heading` into card headers.
  Short string lists follow the prototype's eight-item / 24-character threshold.
- Plain YAML uses the document reading width and padding, but no metadata box.
  It opens at the top; source-line navigation for YAML is not introduced here.

## Verification and review

Focused self-review covered the parser limits, inert rendering, mixed lists,
empty/card-only values, lazy import boundary, and capped layout. It found and
fixed title removal in mixed lists. Visual inspection also caught missing
outer padding for standalone YAML, now fixed.

- `./scripts/test-focused.sh --area web`: 225 files, 1,785 tests passed;
  formatting, type checking and catalog checks passed.
- `./scripts/test-focused.sh --area browser --spec browser-editor.spec.ts`:
  all 29 cases passed, including the synthetic start page and workflow file,
  unsaved invalid YAML, keyboard preview switching and existing editor journeys.
- Final targeted synthetic-lab captures: both new preview cases passed at
  1366 and 390 px; four Explain-mode cases passed at 1440 and 390 px in Finnish
  and US English. UK uses the same copy. Paired HTML/PNG evidence is in
  `evidence/`; no live installation was captured.
- YAML tests cover depth, mixed lists, long/multiline strings, empty values,
  invalid syntax, a CI workflow, exact integers, hostile keys, aliases, cycles,
  excessive trees and inert HTML-looking content.
- UI reference regeneration/check and `git diff --check` passed. Regeneration
  also refreshed pre-existing EditorFileTree reference drift; its production
  behavior was not changed.

Initial checks failed on a test-string quoting mistake, the mixed-list defect,
formatting, a missing Pi test dependency and visual-test setup (non-lab capture,
lab workspace selection, picker readiness and hovering blank space). These were
corrected and the relevant commands rerun successfully. No Go, contracts,
full-browser-suite, full clean gate or live deployment was run; those are
outside this worker's scope.

Live check: open `.agents/start-page.md` in the test server's editor and choose
Preview; goals and their steps/prompts should be readable without expanding
anything. Open a `.yml` workflow and choose Preview, then introduce an unclosed
list in Text: Preview should show the error and unchanged source, without saving.
