# Result

Implemented direction 4, Yhteinen: file button and typed @ use the same in-field list, with the message token owning the query. Tab marks, Enter adds marked paths, → reveals a search result in its folder, and Esc leaves the text. Preview and the existing experimental gate remain. Finnish and English search-line hints are catalogued.

## Decisions for later review

- Ctrl/⌘+P uses the same @ insertion as the button, including from the commands search. The alternative was retaining a second independently editable file search; that would contradict the shared-list decision. As in the prototype, invoking it again closes a nonempty search without changing text, or removes an empty @.
- The scrollable checkbox list is keyboard-focusable in addition to its controlling message field. The alternative was relying only on the external textarea; Axe identified the scroll region as inaccessible. Normal typing and Tab marking still stay in the message.

## Evidence and review

Focused self-review against the accepted prototype and final diff; no daemon, contract, session-state or authority changes. Checked fallback text insertion, caret/suffix retention, command-search handover, mark retention, reveal selection after keyup, and the unchanged gate-off path. Updated the prior Tab-completes and separate-search tests to the new accepted behavior rather than retaining contradictory expectations.

Final runnable tree based on `f0724bc81` plus this issue's patch:

- `./scripts/test-focused.sh --area web`: passed, 190 files / 1431 tests, typecheck and static/catalog checks.
- `./scripts/test-focused.sh --area browser --spec lab-composer-lists-in-field.spec.ts`: 4 passed, including Axe, desktop/phone, button and typed entry, caret insertion, Esc retention, marking, reveal and command-search shortcut handover.
- `./scripts/test-focused.sh --area browser --spec lab-composer-area.spec.ts`: 10 passed (including the unchanged gate-off completion/palette behavior).
- `./scripts/test-focused.sh --area browser --spec composer-english.spec.ts`: 1 passed.

Browser runs used `umask 077`, disk-backed TMPDIR, `OH_PORT_BASE=23700`, `OH_BROWSER_WORKERS=2`. These are synthetic host-backed checks, not live-host or UID-isolation evidence. No full gate or whole browser suite run.

`evidence/` contains paired PNG/static HTML captures of the tree, search, marked desktop and marked phone views in light/dark, device scale 2. Visually inspected desktop search and dark phone marking. Captures use only synthetic lab data.

Development checks initially caught formatting/suppression placement, a missing shortcut-label variable, old separate-search expectations and the scroll-region accessibility failure; all were corrected and checks rerun. The no-execCommand fallback now explicitly updates completion state, matching real browser insertion. A multi-`--spec` invocation selected only the last spec; reran each named spec separately, as listed above.
