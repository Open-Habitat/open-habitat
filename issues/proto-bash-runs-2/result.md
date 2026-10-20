# Result: ! commands in a production-sized conversation

Prototype: https://glasspad.example.test/p/qcyedtd2bwzzau3yk5aavhc4ne/

## Comparison

The axis remains **how much space completed commands take in the conversation**:

- **Kortit:** open output for every command; easiest immediate reading, longest history.
- **Loki:** successful commands collapse to one disclosure row; running, failed and unknown outcomes open. Recommended default: command order stays explicit without displacing the conversation with successful output.
- **Nippu:** adjacent commands share one frame; helpful for a sequence, but adds a grouping concept.

All three use identical invented content. The surrounding transcript now includes a user request, a two-stage agent turn with independently expandable work rows, an interim message, a final answer, a second user message, the command sequence and current Pi status. A process/spinoff overview sits above the composer and expands in place. The field retains its bottom row and field-adjacent notices. The sidebar is contextual, not functional navigation; model/file/command labels are context rather than working pickers. This remains a presentation copy, not a production implementation.

## Geometry and the round-1 correction

The old standalone prototype's generic `.composer div` selector constrained every nested flex container. This round removes that legacy class instead of repeatedly patching its descendants. The frame uses the production 296px rail token, a full remaining conversation pane, the 780px outer composer column including its production gutters, and the independently centred reading column. Message/turn CSS is frozen from `web/src/components/components.css`; field and row geometry comes from `composer/composer.css`. No shared prototype library or production file changes.

Measured and asserted by the initial Chromium run in both themes (final corrected bytes still require verification):

| Browser width | Editor box | Transcript column |
| --- | --- | --- |
| 1440px | 732px | 732px |
| 1366px | 732px | 732px |
| 390px | 362px | 362px |

Desktop gutters are 24px inside the 780px composer; phone gutters are 14px. The phone checkbox also provides a 390px frame on a desktop. Actual 390px browser viewports, not only a scaled phone frame, are covered by the tests. The test checks document and bottom-row overflow and would fail the narrow-field regression from round 1.

## Notices, host assumptions and review

All round-1 scenarios remain: one/many commands, failure, `!!`, long run, refusal of another command with draft retained, requested interruption, confirmed completion and unknown outcome after disconnect. The spinner says “Keskeytetään…” until the simulated host confirms; it never treats the request as proof that child work ended. Private output remains marked as excluded from Pi's context, not from native history.

The host facts assumed are unchanged from `issues/proto-bash-runs/result.md`: exact command/output, context exclusion, exit when known, running/terminal/unknown state, time, Pi state and interruption confirmation. Overview counts and work rows are frozen synthetic context, not new host services or stores. No real command executes.

Focused self-review is proportionate: only a self-contained visual experiment, a focused browser spec and issue/project review notes change. No Unix-user boundary, authority, authentication, contracts or installation inputs change. Reviewed escaping of entered commands, keyboard disclosures, draft preservation, field geometry and confirmation-versus-unknown wording. Independent security review and a full clean gate are not warranted here.

## Rebuild and evidence

```sh
node design-system/prototypes/build.mjs design-system/prototypes/rounds/2026-10-20-bash-runs-context
TMPDIR=/var/tmp ./scripts/test-focused.sh --area web
TMPDIR=/var/tmp ./scripts/test-focused.sh --area browser --spec prototype-bash-context.spec.ts --writers-paused
```

Rendered HTML SHA-256: `a788b0beb51a8a14065be1204ce4a3642b6b9227d7de30d2d5d7328e6f1f63fc`.

Validation / failure inventory:

- `node --check …/round.js`, prototype build, `validate-project-view.py`, `issuectl doctor --json`, and `git diff --check`: passed.
- Focused web check passed: job `dd8d549da58d79dbd53343d13bdd2e8cc65d6938a80c5f24a473547c96168278`, snapshot `8eac5934b53295a2337eb6f06a2dbe9cfb5f8b53605a2ecfe23895a87b23a873`. Web runnable inputs have not changed since this check; subsequent corrections are prototype-only CSS.
- Initial browser run: six passed (9.3s), job `cc4c6015af84c42ce657395c07e100380adb66a593a33f9eea32c266b08de530`, snapshot `771cfb9d3c3fbb54bc96c21e27734e86efe10217c0a058dff247f3b7fa8d07b3`. Superseded, not final evidence.
- Second browser run failed all six width assertions: job `9ed0bce59fc37d42c7b57e23c2b91171dc4d53dc90c9c2250df4dd6b854e3986`, snapshot `5625b29dfd3d987a5dbb50a26c95be45410f219a1c5af335de25ac91e1a29cfc`. During CSS-copy cleanup the closing brace of `.ah-message-interim` had been removed, nesting frame rules. Restored that brace and removed a dangling declaration/closing brace at the beginning of the copied message section instead. This fixes the identified source error, but needs another browser run.
- Corrected browser submission was refused before capture: `spool_quota`, “Retained input spool exceeds 8GiB after lossless compaction; archive terminal inputs before more work”. Attempted job `ab7ae3a3bf0271afdee8a720e849307e1409852440159894c41e99c234148c14`, idempotency key `oh-browser-5ebec247-38b1-4498-ae5a-43f97964898b`. Responses: `/var/tmp/oh-browser-aguuqfex`.
- Checked `fleetrepo-exec --help`, `create --help`, and doctor. There is no exposed archive command; probing `archive --help` returned `invalid_arguments`. Doctor reports SQLite/config healthy and admission needing freshness. Did not delete shared spool inputs, modify Fleetrepo, or bypass remote policy.
- Glasspad publish and same-URL correction both succeeded, `--no-open`; published bytes have the hash above. The published prototype is **not yet finally validated**.

**Blocked:** keep the issue open and preserve this branch. After the Fleetrepo retained-input spool is safely archived/its capacity repaired, rerun the focused browser command above, inspect all six results, and only then close and merge. There is no final passing browser result for the corrected source. No failed review workflow or other incomplete required step is hidden.

Alder policy defers local lab/specialist runs, so before/after screenshot + HTML captures and local `check.mjs` were **not run**. Ordinary remote Chromium checks exercise both themes at all three requested widths, all directions, keyboard output disclosure, notice states, draft retention, pending/confirmed/unknown interruption and console/page errors. This is synthetic prototype browser evidence, not proof of production integration, native execution or UID isolation. No test-server access or push occurred. Only authored synthetic HTML was published, using `--no-open`.

## For Jari

Use “Monta peräkkäin” and compare how much of the agent turn each direction displaces. Expand the stage summaries and the process overview, then exercise “Pitkä ajo” while typing `!git status`. Is Loki still the clearest default in this context, or is immediate output worth Kortit's height? Does Nippu's grouping add enough? Selection and production implementation remain separate work.
