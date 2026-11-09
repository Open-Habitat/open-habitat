# Result

The stack now follows Jari's refined order: notices, queued messages, Workers/other chips, next-waiting, message field. BrowserConversation supplies the existing chips and next-waiting controls through a Composer slot immediately before the field. No CSS reordering, state changes, new controls or copy; existing bilingual Explain cards still apply.

## Decisions for later review

- Keep draft accessories (attachments, goals and dictation warnings) above the chips/next-waiting pair. Putting them below the pair would separate next-waiting from the field. Their existing relative order is unchanged.

## Evidence and validation

Rebased without conflicts onto dfd8fe2fe, including the overflow fix 80fd69bc0. Final executable checks ran on 15236edfc (only evidence and issue/documentation changes followed):

- `./scripts/test-focused.sh --area web`: passed (199 files, 1498 tests).
- `./scripts/test-focused.sh --area browser --spec next-waiting-row.spec.ts`: 4 passed; order and 9 px gaps checked at 1440 and 390, existing axe and interaction checks retained.
- Same command for `queued-send.spec.ts`: 14 passed.
- `composer-geometry.spec.ts`: 4 passed.
- `lab-composer-stack-gaps.spec.ts`: 4 passed, including the overflow worker's long-title edge and gap checks at 1440, 1024, 800 and 390 in both themes. Updated its ordered measurement list to match the new DOM order.

Browser runs used `OH_PORT_BASE=15000 OH_BROWSER_WORKERS=2`, private disk-backed TMPDIR and umask 077. Focused self-review checked conditional rendering, DOM/focus order, unchanged control props and Explain selectors, nested padding/width, and preservation of the overflow fix.

Synthetic lab captures at 1440×900 and 390×900, device scale factor 2, are paired AVIF/HTML files under `evidence/`. Captured with `web/lab/capture-next-waiting-strip-lowest.mjs`, converted with `scripts/screenshots-to-avif.py`, visually inspected. These are same-UID synthetic host/fake-Pi checks, not deployment or real provider evidence. No full suite or clean gate was run.

## Resolved attempts

The first stack-gap run failed because its selector list still described the old order; updated that list and all checks passed, including after rebase. A source lookup used a nonexistent NextWaitingDock CSS path and a later glob matched no overflow-named spec; scoped searches found NextWaitingRow.css and the gap spec. Image inspection first tried absent `magick`; installed `convert` worked. Recapturing produced PNGs beside existing AVIFs, which the converter correctly refused to overwrite; removed only the two exact old AVIF paths and reconverted successfully. Closing initially warned about unchecked acceptance items; both are now checked against the passing evidence.
