# Result: US and UK English

Personal and server language rows now offer System, Suomi, English (US) and
English (UK). The account preference follows the person across browsers; the
administrator default reaches sign-in and people without their own choice.
Installation `ui.default_language` accepts the same choices. Both regional
values pass the schemas and daemon/gateway/host validators.

The existing English catalogs are the US base, with typed sparse UK overlays
for differing strings/functions. Parameters and external control names stay
unchanged. Dates, time and numbers use the selected `Intl` locale. Static
landing, settings search and Storybook also understand the regional choices.

## Decisions for later review

- **Keep `en` as a legacy UK alias.** It previously formatted dates as en-GB;
  removing it would discard stored choices, while making it US would silently
  change existing date/time conventions. The UI offers only the explicit regions.
- **System uses the first browser preference:** fi/fi-* → Finnish; en-GB
  (case-insensitive, including extensions) → UK; other English regions and
  unsupported languages → US. Alternative: map Commonwealth regions to UK or
  infer from later preferences. The simple rule avoids pretending to support
  regional catalogs beyond the two offered choices; a person can override it.
- **UK accepts Oxford -ize spellings** (synchronize, initialize, recognize),
  while organisation, authorisation and cancelled are explicit UK overlays.
  Alternative: duplicate every -ize sentence; that adds many overrides without
  changing valid UK English. Named provider-console controls retain their spelling.
- **No experimental gate:** this is the requested extension of the existing
  language setting, not an optional new workflow.

## Evidence

Final focused checks after rebasing onto 6193febb (parallel dictation and Web
Push removals preserved), including the subsequent contrast correction:

- `./scripts/test-focused.sh --area contracts`: generated bindings clean; 88
  schemas and 134 fixtures valid.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`, and
  separate runs for `./internal/gateway` and `./internal/host`: passed.
  Go ran with umask 077 and a disposable disk-backed TMPDIR; host schema
  checks used a private uv venv with requirements-ci.txt.
- `./scripts/test-focused.sh --area web`: lint/types and 160 test files,
  1182 tests passed. Tests cover precedence, region
  formatting, nested overlays, unmodified parameters and catalog parity/spelling.
- Separate `--area browser --spec` runs: `ui-language.spec.ts` (9 cases),
  `ui-language-conversation.spec.ts` (1), `ui-language-views.spec.ts` (1),
  `settings-search.spec.ts` (4). Language-row Axe checks include a hovered
  inactive option in personal and server settings.
  OH_PORT_BASE=9930, OH_BROWSER_WORKERS=2. Personal changes, reload, a second
  browser, server overrides and browser-region defaults passed.
- `python3 scripts/validate-project-view.py`, `git diff --check`: passed.
- Independent `/llm-review`: claude-fable-5-1 finder and gpt-6-astra verifier.
  `/assess-findings`: one confirmed FIX (incomplete spelling overlays), fixed;
  two dropped nonfunctional candidates. Verifier caught remaining strings and
  a wrongly nested override; catalog tests now catch those. Local reports are
  `history/review-language-en-us-gb.md` and `history/assessment-language-en-us-gb.*`.

`evidence/` contains desktop/phone appearance and server rows, paired PNG and
static HTML, at device scale factor 2. Captured with
`web/lab/language-en-us-gb-shots.mjs`; all four choices are within the viewport.
These are synthetic lab/host results, not live-user or distinct-UID evidence.
No full gate or whole browser suite was run. The new Axe checks found muted
segment text below 4.5:1 on hover; the shared primitive now uses the existing
ink token on hover/press, and the browser checks pass with that state explicit.
The initial rebased web run timed out once in an untouched SpinoffConversation
unit test under host load; a complete unchanged rerun passed.

Rebase conflicts were the two generated fingerprints (regenerated), the deleted
push client (kept deleted), and dictation's cancelled label (kept removed, so
its now-unused UK overlay was dropped). No parallel-worker behavior was restored.

## Installation follow-through

Product `site/schema.json` and host validation accept `en-US` and `en-GB`.
A scoped search of Fleetrepo's infra, dotfiles and software found no independent
`default_language` validation to update. If a deployment-side whitelist is
introduced elsewhere, it must accept system, fi, en, en-US and en-GB; no
Fleetrepo file was changed by this worker.

## Tool/sub-workflow failures recovered

Initial discovery commands named nonexistent schema/a11y paths (or returned
no matches); narrowed searches found the actual files. Two edit calls had
ambiguous matches and wrote nothing; retried with unique context. One parallel
read briefly reported an incorrect line count; a sequential reread succeeded.
An exploratory typecheck named nonexistent tsconfig.app.json; the maintained
npm typecheck passed. An unused scratch audit tried the removed TypeScript JS
API (ERR_MODULE_NOT_FOUND); source inspection and typed catalogs replaced it.
First web check found formatting; Biome corrected it. Typecheck caught a
misnamed overlay key; the verifier and catalog parity test caught its wrong
nested parent. Both were fixed and web checks passed. Repeated --go-package
and --spec flags selected only the last value; logs exposed this, and separate
invocations covered every target. The finder's Python contract check lacked
referencing; the worker's private venv contract check passed. Snapshot serialization emitted trailing whitespace; the capture script now
normalizes generated HTML, and the final diff check passes. Initial issue
closure warned about missing acceptance criteria; those are now recorded.
`issuectl doctor --json` still exits 1 for the pre-existing main artifact
`issues/decisions-review-31-10/index.html` lacking item.md (no schema violations
or parse errors); no unrelated issue metadata was changed. No failed check
was treated as passing; continuing was safe after these corrections.
