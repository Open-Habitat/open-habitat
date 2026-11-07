# Result

The empty conversation's start-page button is always available. Removed the
experiment card, preference gate and Finnish/English settings-index entries.
Existing browser and read-lifetime tests now use the default button instead of
the old gated hint. Request preparation, selected placeholder, chip-only history
and skill invocation are unchanged.

## Evidence

`./scripts/test-focused.sh --area web`: 179 files / 1352 tests passed.
Focused `start-page-request.spec.ts`: 2 passed; `start-here.spec.ts`: 4 passed
(desktop/phone, light/dark, accessibility). All used `OH_PORT_BASE=15300` and
`OH_BROWSER_WORKERS=2` on Birch, with implementation through `4db5c4430` and
the start-here selector update. First web attempts exposed a missing removed-row
translation, formatting, and two old hint expectations; fixed before the passing
run. The first start-here run hit the 30-second case budget on both desktop
cases; an unchanged rerun passed all four (38.5 seconds total).

Focused self-review checked both entry points still prepare rather than send.
No daemon or contract change. Synthetic host/fake-Pi evidence only; no live skill
execution or full clean gate claimed.

## Decisions for later review

None beyond the requested graduation.
