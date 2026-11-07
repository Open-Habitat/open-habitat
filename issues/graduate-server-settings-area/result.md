# Result

The server area is always enabled for administrators; the experiment card,
preference read and search-index row are removed. Personal settings retain a
single Palvelimen ylläpito entry, now ending in a forward chevron. Ordinary
section rows do not have that arrow. Administrator checks are unchanged.

## Evidence

On Birch, `./scripts/test-focused.sh --area web`: 179 files / 1352 tests passed.
Focused `server-settings-area.spec.ts` (3) and `live-conversation-limit.spec.ts`
(2) passed with `OH_PORT_BASE=15300 OH_BROWSER_WORKERS=2`. Tests cover desktop
and phone routing, back/history, keyboard, axe, deep links, denied non-admin
access and the limit-control journey. Tested implementation through `4db5c4430`.

`evidence/` contains paired synthetic-lab PNG and static HTML captures at 2x:
personal entry, desktop area and light/dark phone area. Inspected the personal
entry image: the forward chevron reads as a way into another area, without an
edge stripe. Focused self-review checked filtering and retained admin checks.
No authority or server changes; no live-server evidence or full gate claimed.

## Decisions for later review

- Chose a trailing chevron using the existing forward icon, rather than changing
  link colors or typography. It distinguishes the destination without creating
  another navigation style and follows the requested arrow option.
