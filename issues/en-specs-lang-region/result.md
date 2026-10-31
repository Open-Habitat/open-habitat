# Result

Changed four `html` language assertions from `en` to `en-GB` in the composer,
shell/editor, worker-panel and lab workspace specs. The shell/editor helper
covers two cases, so this corrects all five reported failures. Every affected
context explicitly uses `locale: "en-GB"`; no product behavior changed.

## Verification

Tested base `b68fc71f79c9f575fd697172c615bcb0cd6bd6d2` plus the four assertion
edits in this commit, on Birch with umask 077, installed locked web and Pi
fixture dependencies, `OH_BROWSER_WORKERS=2` and `OH_PORT_BASE=9970`.

- `./scripts/test-focused.sh --area web`: passed; 160 files, 1182 tests,
  including static/unit/component checks.
- `./scripts/test-focused.sh --area browser --spec <file>` for each ordinary
  spec below, individually: all passed (16 cases).
  - `composer-english.spec.ts`: 1
  - `en-shell-editor.spec.ts`: 2
  - `worker-panel.spec.ts`: 2
  - `ui-language-conversation.spec.ts`: 1
  - `ui-language-views.spec.ts`: 1
  - `ui-language.spec.ts`: 9
- `./scripts/test-focused.sh --area browser --lab --spec <file>`:
  `lab-en-workspaces.spec.ts` and `lab-english-url-paths.spec.ts`, one case
  each, both passed.
- Focused self-review: checked each literal against its explicit context
  locale, inspected the final diff, and searched all browser specs for English
  contexts and plain `en` language assertions. No stale assertion remains.
- `git diff --check`, project-view validator and `issuectl doctor --json`: passed.

These are host-backed synthetic browser results, not live-host or UID-isolation
proof. No Go/contracts changes; full browser suite and clean gate left to the
conductor as requested.

## Tool/sub-workflow corrections

The first browser invocation supplied multiple `--spec` flags; only the last
(`ui-language.spec.ts`) ran. Its nine cases passed, but it was not counted as
coverage of the others. Each remaining spec was then run separately and passed.
The exploratory `test-focused.sh --help` printed usage (the script has no help
flag); the source and usage supplied the supported invocation. Neither affected
product files or left validation incomplete.

## Decisions for later review

None. The issue already specified the regional tag and test-only scope.
