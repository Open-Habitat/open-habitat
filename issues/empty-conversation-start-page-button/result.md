# Result

Implemented the accepted row-and-button direction and the later Siru ja lause /
Aina pois decisions. The empty-conversation button is off by default behind
**Aloitussivupainike keskustelussa** in experimental settings. Both entry points
prepare the same native skill request without sending, preserve an existing
draft, and select the additional-instructions placeholder. Repeated presses do
not duplicate an already prepared request. There is no new hint line.

Send removes only the known exact trailing placeholder, not arbitrary brackets;
text or whitespace after the marker keeps it literal. Attachments remain intact.
A skill-backed draft reconstructs the rule after reload. Plain goals use the
current tab's chosen goal only before its first send. The native start-page
skill has a localized history chip; authored goals without arguments retain
the existing chip-only history presentation. The start-page skill's authoring
paragraph now explains omission on Send.

## Decisions for later review

- **Experimental scope:** gate only the new empty-conversation affordance. The
  alternative was gating the existing workspace button's presentation and all
  goal sends too. Those are explicitly requested changes to existing behavior,
  so both entry points use the new template and all goals share the cut rule.
- **History:** use neutral localized *Aloitussivu* for the built-in skill, rather
  than retaining a create/update action outside native history. Keep its sent
  sentence and any person's additional text visible. Chip alone means a goal
  whose entire request was already carried by its skill, not hiding user text.
- **Instruction source:** the composer chip reads the shipped skill Markdown as
  a build input, rather than copying its body into a browser catalog. Vite's
  development file allowance adds only that public skill directory. No runtime
  filesystem endpoint, contract, identity or daemon-state change was added.
- **No-skill goals:** the prepared marker is known until the first send in the
  current tab; after reload no chip identifies that draft, so brackets remain
  literal, as the accepted host-facts specification describes.

## Validation

On Birch, with private disk-backed TMPDIR, umask 077, OH_PORT_BASE=12900 and
OH_BROWSER_WORKERS=2. Final runnable changes were tested before this result was
written; the issue's Fixes-Issue commit identifies that tree.

- `./scripts/test-focused.sh --area web`: pass, 170 files / 1278 tests,
  TypeScript and Biome. Added composer-boundary tests for untouched and edited
  suffixes, trailing whitespace/newlines, unrelated brackets and attachments.
- `./scripts/test-focused.sh --area browser --spec start-page-request.spec.ts`:
  2 pass, 1440 and 390 widths; experimental off/on, preserving draft,
  placeholder selection, idempotence, reload, actual outgoing request, goal
  placeholder omission and chip-only recorded history, axe on the new row.
- Same command individually for `start-here.spec.ts` (4 pass),
  `lab-start-page-goal.spec.ts` (2 pass), and `lab-workspace-landing.spec.ts`
  (2 pass). The workspace-button assertion now checks selection and outgoing
  request instead of obsolete raw-command presentation; no wording assertions
  added.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: pass
  after installing requirements-ci.txt into a disposable uv virtualenv. This
  includes the native start-page skill expansion test.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py`, and
  staged `git diff --check`: pass (doctor retains existing image-format/size
  advisories). Snapshot-export trailing whitespace was normalized before commit.
- Focused self-review of the diff, template preparation, all three send modes,
  marker provenance, attachment preservation and experimental gating. Corrected
  repeat-press duplication, avoided rewriting ordinary attachment text on send,
  and kept the built-in chip from triggering unrelated first-history reads.
- Synthetic screenshot + static HTML pairs in `evidence/` at device scale 2;
  inspected the phone prepared view. These are host-backed synthetic evidence,
  not live-provider or separate-UID acceptance. Full gate / whole browser suite
  deliberately left to the conductor; live model behavior remains to be tried.

## Resolved development failures

The first typecheck caught missing StartGoal fields in the template helper.
The first two web runs rejected the external raw skill import: an exact file
allowance was insufficient for Vite's query-suffixed check; the public directory
allowance fixed it. One formatting check then needed Biome. An attempted regex
combination of named specs was refused by test-focused; individual runs passed.
The first daemon run lacked Python referencing; the disposable uv environment
fixed that and the package rerun passed. Two ambiguous edit calls were refused
without writes and retried with unique blocks. Exploratory searches also named
several nonexistent component/instruction paths; scoped searches found their
actual locations. No failed check is being counted as passing evidence.
