# Result

Fixed both regressions in the experimental in-field lists:

- A new selected item starts its preview at the top (also resets horizontal
  scrolling). Selection identity, rather than row index or object identity,
  controls the reset, so a folder read inserting rows does not reset the same
  item's reading position. The preview element stays mounted and focusable.
- Folder caret and name presses open/close the folder even when paths are
  marked. The checkbox alone changes the folder's mark. File-row and keyboard
  insertion behavior are unchanged, including Enter inserting the marked set.

## Decisions for later review

None: these restore the behavior explicitly requested in the issue and brief.
The feature remains experimental; no copy, styling, host or contract changes.

## Validation and review

Focused self-review of the final diff: checked marked/unmarked folder clicks,
checkbox event propagation, keyboard insertion, stable selection identity and
preview focus lifetime. Extended the existing component and browser journeys
rather than introducing duplicate folder journeys.

On base b5befbe4e plus this issue's patch (then repeated after rebase at
190a2d3bd):

- `OH_WEB_WORKERS=4 ./scripts/test-focused.sh --area web`: passed static checks,
  TypeScript and all 1351 tests (179 files); rebased run passed all 1369 tests
  (180 files).
- `OH_PORT_BASE=15800 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser
  --spec lab-composer-lists-in-field.spec.ts`: all 3 passed, also after rebase. Desktop caret/name
  clicks with marks, touch navigation with other marks, checkbox independence,
  exact inserted paths, and two long skill previews scrolled before changing
  selection. Existing axe check passes. Host-backed synthetic lab evidence;
  skill descriptions are synthetic intercepted command-list replies. No live
  deployment or real-provider verification.

Earlier attempts: two unrelated web tests (GitLabConnection and Integrations)
exceeded their 5-second limits; a two-worker retry was interrupted at the shell's
240-second deadline. A later complete four-worker run passed unchanged. A main
archive baseline passed those tests (1362 tests passed) but its full run hit an
unrelated PDF worker import denial because dependencies were symlinked outside
that archive; not claimed as a passing baseline suite. The first browser attempt
used an invalid synthetic command reply (missing schema version, overlong
text), corrected to the actual contract; its phone journey also missed the open
list once, then passed unchanged on the complete rerun. No failure remains in
the final focused checks. The first merge conflicted only in the shared
KOKEILTAVAA additions; both sides were retained and both focused checks rerun.
Logs are temporary under `/var/tmp/oh-lists.ZwyIXN`.
