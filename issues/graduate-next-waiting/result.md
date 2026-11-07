# Result

The waiting-conversation row is always available. Removed its experiment card,
settings-search row and preference read/ID. The experiment persistence test now
uses Explain mode instead. The old off/on browser steps were removed; the same
journey now proves behavior with default preferences.

## Evidence

On Birch, implementation tree through `4db5c4430` (plus the start-here selector
update): `./scripts/test-focused.sh --area web` passed (179 files, 1352 tests).
With `OH_PORT_BASE=15300 OH_BROWSER_WORKERS=2`, focused browser specs
`next-waiting-row.spec.ts` (4) and `settings-experimental.spec.ts` (3) passed.
Focused self-review checked that the remaining experiments still toggle and the
row still obeys the existing draft and shortcut suppression. No daemon,
contract, session ownership or authority changes; evidence is synthetic, not
live-server or separate-UID acceptance. No full gate or push.

## Decisions for later review

None beyond the requested graduation. The return behavior is recorded separately
in `issues/next-waiting-on-return/result.md`.
