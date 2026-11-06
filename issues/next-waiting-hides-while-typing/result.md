# Result

The existing composer draft gates the next-waiting dock's `open` prop. A nonempty draft hides the row and removes its keyboard listener without closing the accepted-send window. Clearing it restores the offer if that window and the waiting list still qualify. No new state or store.

## Evidence

Tested on base `3931722dc7e17a21b04bd8544bfda549a7c78997` plus this issue's source/test diff:

- `./scripts/test-focused.sh --area web`: lint/typecheck and 170 files / 1267 tests passed.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=12800 ./scripts/test-focused.sh --area browser --spec next-waiting-row.spec.ts`: 4 passed, including the existing row axe audit. Extended the accepted-send journey to type text and whitespace, check row absence and no Alt+ArrowDown navigation, then clear and check reappearance. No wording assertions added.
- Focused self-review: checked the dock's shared visibility/shortcut eligibility and effect cleanup, and that draft changes do not reset the accepted-send window. No daemon, contract, session ownership or authority changes.

Browser evidence is host-backed synthetic evidence, not live-host acceptance. Full gate and unrelated browser specs were intentionally not run.

## Decisions for later review

Whitespace-only text also hides the row. Alternative: trim before testing emptiness. Chosen because entering a space is still beginning a draft, and the requested return condition is an empty field.
