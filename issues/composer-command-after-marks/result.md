# Result

Fixed the test, not the product. The command assertion remains the agreed
behavior; the test was issuing Enter before a command was ready to choose.

## Root cause and agreement

Read the historical `composer-lists-in-field` and
`composer-lists-preview-folders` issue bodies through the trailers of
872507353 and 29ac730f6. The former preserves existing command functionality
inside the field, including inserting a button-chosen command first; the latter
separates folder navigation from marking. Neither removes folder marking or
changes command insertion.

The original spec reproduces the reported failure: two paths are inserted,
then Enter after filling the command search leaves the draft unchanged.
`Composer.tsx` loads commands independently when the command list opens
(`useSources`). Opening the list and filling its input do not establish that
its asynchronous catalog has arrived. `accept` ignores a missing/status
selection; it does not queue Enter against a future result. The test waited
for the file tree but not for the command selection. Marks are reset by
`fromButton` and are not the cause. `tests/` is a valid marked folder.

The spec now waits for `composer-command-fix-tests` to be selected, then
presses Enter. It checks the entire resulting draft (both original paths),
list closure and restored field focus. No sleeps, product changes or relaxed
expectations were needed.

## Validation and review

On Birch, installed both locked npm dependency sets. Browser runs used private
`/var/tmp/oh-cmdmarks.*` scratch, umask 077, OH_BROWSER_WORKERS=2 and
OH_PORT_BASE=17300.

- Original focused lab spec: reproduced one failure, two passes.
- A diagnostic wait for the command selection: all three cases passed.
- Final spec: `./scripts/test-focused.sh --area browser --lab --spec lab-composer-lists-in-field.spec.ts`
  passed **three consecutive runs**, all three cases each (4.2s each).
- `./scripts/test-focused.sh --area web`: passed; 188 files, 1408 tests.
- Focused self-review: checked command loading/selection/acceptance and mark
  lifetime against the two historical issues. The test still catches wrong
  command placement, lost or duplicated paths, list closure and focus errors.

Evidence is host-backed synthetic browser behavior, including the existing
axe check and phone case, not live Pi/provider or separate-UID evidence.
No contract, daemon, authority or session-state changes; no full gate run.

## Decisions for later review

None: preserved agreed behavior. Waiting for an actual selected command is a
test precondition, not a new product decision.
